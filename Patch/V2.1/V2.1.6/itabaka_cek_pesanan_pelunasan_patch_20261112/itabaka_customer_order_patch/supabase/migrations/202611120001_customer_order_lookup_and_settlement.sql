-- Itabaka: public order lookup + second payment proof (settlement)
-- Customer invoice status is intentionally separate from internal verification.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_payment_status text NOT NULL DEFAULT 'DP',
  ADD COLUMN IF NOT EXISTS settlement_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS settlement_proof_path text,
  ADD COLUMN IF NOT EXISTS settlement_proof_uploaded_at timestamptz;

UPDATE public.orders
SET customer_payment_status = CASE WHEN payment_plan = 'FULL' THEN 'LUNAS' ELSE 'DP' END;

UPDATE public.orders
SET settlement_token = gen_random_uuid()
WHERE settlement_token IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN settlement_token SET DEFAULT gen_random_uuid(),
  ALTER COLUMN settlement_token SET NOT NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_customer_payment_status_check
  CHECK (customer_payment_status IN ('DP','LUNAS'));

CREATE TABLE IF NOT EXISTS public.order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_type text NOT NULL CHECK (payment_type IN ('INITIAL','SETTLEMENT')),
  expected_amount bigint NOT NULL CHECK (expected_amount > 0),
  reported_amount bigint NOT NULL CHECK (reported_amount > 0),
  proof_path text NOT NULL,
  internal_status text NOT NULL DEFAULT 'PENDING'
    CHECK (internal_status IN ('PENDING','MATCHED','CONTACT')),
  internal_note text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  checked_at timestamptz,
  checked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (order_id, payment_type)
);

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_payments_admin_select ON public.order_payments;
CREATE POLICY order_payments_admin_select
  ON public.order_payments FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS order_payments_admin_update ON public.order_payments;
CREATE POLICY order_payments_admin_update
  ON public.order_payments FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, UPDATE ON public.order_payments TO authenticated;
REVOKE ALL ON public.order_payments FROM anon;

-- Capture the first proof already attached by the existing checkout flow.
CREATE OR REPLACE FUNCTION public.capture_initial_order_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.payment_proof_path IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.payment_proof_path IS NOT DISTINCT FROM NEW.payment_proof_path THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.order_payments (
    order_id, payment_type, expected_amount, reported_amount, proof_path
  )
  VALUES (
    NEW.id,
    'INITIAL',
    GREATEST(COALESCE(NEW.payment_amount_due, NEW.total_amount), 1),
    GREATEST(COALESCE(NEW.payment_amount_due, NEW.total_amount), 1),
    NEW.payment_proof_path
  )
  ON CONFLICT (order_id, payment_type) DO UPDATE
    SET proof_path = EXCLUDED.proof_path;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_capture_initial_payment ON public.orders;
CREATE TRIGGER orders_capture_initial_payment
AFTER INSERT OR UPDATE OF payment_proof_path ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.capture_initial_order_payment();

-- Backfill first proofs uploaded before this migration.
INSERT INTO public.order_payments (
  order_id, payment_type, expected_amount, reported_amount, proof_path
)
SELECT
  o.id,
  'INITIAL',
  GREATEST(COALESCE(o.payment_amount_due, o.total_amount), 1),
  GREATEST(COALESCE(o.payment_amount_due, o.total_amount), 1),
  o.payment_proof_path
FROM public.orders o
WHERE o.payment_proof_path IS NOT NULL
ON CONFLICT (order_id, payment_type) DO NOTHING;

-- Internal checks update only verified paid_amount; they never control the
-- customer-facing invoice status stored in customer_payment_status.
CREATE OR REPLACE FUNCTION public.sync_order_payment_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id uuid;
  v_total bigint;
  v_paid bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_order_id := OLD.order_id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;
  SELECT total_amount INTO v_total
  FROM public.orders WHERE id = v_order_id;

  IF v_total IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(reported_amount), 0)::bigint INTO v_paid
  FROM public.order_payments
  WHERE order_id = v_order_id AND internal_status = 'MATCHED';

  v_paid := LEAST(GREATEST(v_paid, 0), v_total);

  UPDATE public.orders
  SET paid_amount = v_paid,
      payment_status = CASE WHEN v_paid = v_total THEN 'LUNAS' ELSE 'DP' END,
      payment_verified_at = CASE WHEN v_paid > 0 THEN now() ELSE NULL END
  WHERE id = v_order_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS order_payments_sync_verification ON public.order_payments;
CREATE TRIGGER order_payments_sync_verification
AFTER INSERT OR UPDATE OF internal_status, reported_amount OR DELETE
ON public.order_payments
FOR EACH ROW EXECUTE FUNCTION public.sync_order_payment_verification();

-- Private bucket for the second proof; the original payment-proofs bucket is unchanged.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'settlement-proofs', 'settlement-proofs', false, 2097152,
  ARRAY['image/png','image/jpeg','image/webp','application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 2097152,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.is_valid_settlement_proof_path(object_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_id uuid;
  v_token uuid;
BEGIN
  IF object_path IS NULL OR object_path !~ '^settlements/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(png|jpg|jpeg|webp|pdf)$' THEN
    RETURN false;
  END IF;
  v_order_id := split_part(object_path, '/', 2)::uuid;
  v_token := split_part(split_part(object_path, '/', 3), '.', 1)::uuid;
  RETURN EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = v_order_id
      AND o.settlement_token = v_token
      AND o.payment_plan = 'DP'
      AND o.customer_payment_status = 'DP'
      AND o.settlement_proof_path IS NULL
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_valid_settlement_proof_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_settlement_proof_path(text) TO anon, authenticated;

DROP POLICY IF EXISTS settlement_proofs_anon_insert ON storage.objects;
CREATE POLICY settlement_proofs_anon_insert
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'settlement-proofs'
  AND public.is_valid_settlement_proof_path(name)
);

DROP POLICY IF EXISTS settlement_proofs_anon_delete_unattached ON storage.objects;
CREATE POLICY settlement_proofs_anon_delete_unattached
ON storage.objects FOR DELETE TO anon, authenticated
USING (bucket_id = 'settlement-proofs' AND public.is_valid_settlement_proof_path(name));

DROP POLICY IF EXISTS settlement_proofs_admin_select ON storage.objects;
CREATE POLICY settlement_proofs_admin_select
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'settlement-proofs' AND public.is_admin());

-- Exact invoice + phone match. No OTP, but no broad public SELECT access either.
CREATE OR REPLACE FUNCTION public.lookup_public_order(
  p_invoice_no text,
  p_customer_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%rowtype;
  v_phone text := regexp_replace(COALESCE(p_customer_phone, ''), '\D', '', 'g');
  v_items jsonb;
  v_payments jsonb;
  v_can_settle boolean;
BEGIN
  IF length(v_phone) < 8 OR length(trim(COALESCE(p_invoice_no, ''))) < 5 THEN
    RAISE EXCEPTION 'Nomor invoice atau nomor HP tidak valid';
  END IF;

  SELECT * INTO v_order
  FROM public.orders o
  WHERE upper(trim(o.invoice_no)) = upper(trim(p_invoice_no))
    AND regexp_replace(COALESCE(o.customer_phone, o.customer_contact, ''), '\D', '', 'g') = v_phone
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan. Periksa nomor invoice dan nomor HP.';
  END IF;

  v_can_settle := v_order.payment_plan = 'DP'
    AND v_order.customer_payment_status = 'DP'
    AND v_order.settlement_proof_path IS NULL
    AND EXISTS (SELECT 1 FROM public.order_payments op WHERE op.order_id = v_order.id AND op.payment_type = 'INITIAL');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', oi.product_name,
    'category', oi.product_category,
    'size', oi.size,
    'quantity', oi.quantity,
    'unit_price', oi.unit_price,
    'subtotal', COALESCE(oi.subtotal, oi.unit_price * oi.quantity)
  ) ORDER BY oi.id), '[]'::jsonb)
  INTO v_items
  FROM public.order_items oi WHERE oi.order_id = v_order.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', op.id,
    'payment_type', op.payment_type,
    'expected_amount', op.expected_amount,
    'reported_amount', op.reported_amount,
    'uploaded_at', op.uploaded_at,
    'has_proof', true
  ) ORDER BY op.uploaded_at), '[]'::jsonb)
  INTO v_payments
  FROM public.order_payments op WHERE op.order_id = v_order.id;

  RETURN jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id,
      'invoice_no', v_order.invoice_no,
      'created_at', v_order.created_at,
      'customer_name', v_order.customer_name,
      'delivery_method', v_order.delivery_method,
      'customer_address', v_order.customer_address,
      'payment_plan', v_order.payment_plan,
      'customer_payment_status', v_order.customer_payment_status,
      'payment_method', v_order.payment_method,
      'total_amount', v_order.total_amount,
      'subtotal_amount', COALESCE(v_order.subtotal_amount, v_order.total_amount),
      'discount_amount', v_order.discount_amount,
      'promo_code', v_order.promo_code,
      'payment_amount_due', v_order.payment_amount_due,
      'remaining_amount', v_order.remaining_amount,
      'settlement_available', v_can_settle,
      'settlement_token', CASE WHEN v_can_settle THEN v_order.settlement_token ELSE NULL END,
      'settlement_uploaded_at', v_order.settlement_proof_uploaded_at
    ),
    'items', v_items,
    'payments', v_payments
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_public_order(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_public_order(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.attach_settlement_proof(
  p_invoice_no text,
  p_customer_phone text,
  p_settlement_token uuid,
  p_proof_path text,
  p_reported_amount bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%rowtype;
  v_phone text := regexp_replace(COALESCE(p_customer_phone, ''), '\D', '', 'g');
  v_expected bigint;
  v_path_order uuid;
  v_path_token uuid;
BEGIN
  IF p_proof_path IS NULL OR p_proof_path !~ '^settlements/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(png|jpg|jpeg|webp|pdf)$' THEN
    RAISE EXCEPTION 'Path bukti pelunasan tidak valid';
  END IF;

  v_path_order := split_part(p_proof_path, '/', 2)::uuid;
  v_path_token := split_part(split_part(p_proof_path, '/', 3), '.', 1)::uuid;

  SELECT * INTO v_order
  FROM public.orders o
  WHERE upper(trim(o.invoice_no)) = upper(trim(p_invoice_no))
    AND regexp_replace(COALESCE(o.customer_phone, o.customer_contact, ''), '\D', '', 'g') = v_phone
    AND o.id = v_path_order
  FOR UPDATE;

  IF NOT FOUND OR v_order.settlement_token IS DISTINCT FROM p_settlement_token
     OR v_path_token IS DISTINCT FROM p_settlement_token THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan atau token pelunasan tidak cocok';
  END IF;

  IF v_order.payment_plan <> 'DP' OR v_order.customer_payment_status <> 'DP'
     OR v_order.settlement_proof_path IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM public.order_payments op WHERE op.order_id = v_order.id AND op.payment_type = 'INITIAL') THEN
    RAISE EXCEPTION 'Pesanan ini tidak membutuhkan upload pelunasan lagi';
  END IF;

  v_expected := GREATEST(v_order.total_amount - COALESCE(v_order.payment_amount_due, 0), 0);
  IF v_expected <= 0 THEN
    RAISE EXCEPTION 'Nominal pelunasan tidak valid';
  END IF;

  IF p_reported_amount IS NULL OR p_reported_amount <= 0 OR p_reported_amount > v_order.total_amount THEN
    RAISE EXCEPTION 'Nominal transfer harus lebih dari 0 dan tidak melebihi total pesanan';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'settlement-proofs' AND name = p_proof_path
  ) THEN
    RAISE EXCEPTION 'File bukti pelunasan belum berhasil diunggah';
  END IF;

  INSERT INTO public.order_payments (
    order_id, payment_type, expected_amount, reported_amount, proof_path
  ) VALUES (
    v_order.id, 'SETTLEMENT', v_expected, p_reported_amount, p_proof_path
  );

  UPDATE public.orders
  SET settlement_proof_path = p_proof_path,
      settlement_proof_uploaded_at = now(),
      customer_payment_status = 'LUNAS'
  WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_no', v_order.invoice_no,
    'customer_payment_status', 'LUNAS'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.attach_settlement_proof(text, text, uuid, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_settlement_proof(text, text, uuid, text, bigint) TO anon, authenticated;

-- Keep the 9-argument public-order RPC and all legacy overloads; fix the promo
-- subtotal read, generated remaining_amount write, and customer-facing status.
CREATE OR REPLACE FUNCTION public.create_public_order(
  p_customer_name text,
  p_customer_email text,
  p_customer_address text,
  p_customer_phone text,
  p_delivery_method text,
  p_payment_plan text,
  p_payment_method text,
  p_promo_code text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_code text := upper(regexp_replace(trim(coalesce(p_promo_code,'')), '\s+', ' ', 'g'));
  v_member public.promo_members%rowtype;
  v_result jsonb;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_final_total bigint := 0;
  v_payment_due bigint := 0;
  v_dp_percentage integer := 50;
  v_order_id uuid;
BEGIN
  IF v_code <> '' THEN
    SELECT * INTO v_member
    FROM public.promo_members
    WHERE plate_code = v_code
    FOR UPDATE;

    IF NOT FOUND OR NOT v_member.is_active THEN
      RAISE EXCEPTION 'Kode promo tidak ditemukan atau sedang nonaktif';
    END IF;
    IF v_member.is_used THEN
      RAISE EXCEPTION 'Kode promo ini sudah pernah digunakan';
    END IF;
  END IF;

  v_result := public.create_public_order(
    p_customer_name, p_customer_email, p_customer_address, p_customer_phone,
    p_delivery_method, p_payment_plan, p_payment_method, p_items
  );

  v_order_id := (v_result->>'id')::uuid;
  SELECT o.total_amount INTO v_subtotal
  FROM public.orders o WHERE o.id = v_order_id;

  IF v_subtotal IS NULL OR v_subtotal <= 0 THEN
    RAISE EXCEPTION 'Subtotal pesanan tidak valid';
  END IF;

  IF v_code <> '' THEN
    IF v_member.discount_type = 'PERCENT' THEN
      v_discount := round(v_subtotal::numeric * v_member.discount_value / 100)::bigint;
    ELSE
      v_discount := v_member.discount_value;
    END IF;
    v_discount := least(greatest(v_discount,0),greatest(v_subtotal-1,0));
  END IF;

  v_final_total := v_subtotal - v_discount;
  IF v_final_total <= 0 THEN
    RAISE EXCEPTION 'Total setelah diskon harus lebih dari 0';
  END IF;

  SELECT coalesce(dp_percentage,50) INTO v_dp_percentage
  FROM public.site_settings WHERE id = 1;
  v_dp_percentage := greatest(1,least(99,coalesce(v_dp_percentage,50)));

  IF p_payment_plan = 'FULL' THEN
    v_payment_due := v_final_total;
  ELSIF p_payment_plan = 'DP' THEN
    v_payment_due := greatest(1,ceil(v_final_total::numeric * v_dp_percentage / 100))::bigint;
  ELSE
    RAISE EXCEPTION 'Rencana pembayaran harus DP atau FULL';
  END IF;

  UPDATE public.orders
  SET subtotal_amount = v_subtotal,
      discount_amount = v_discount,
      promo_code = nullif(v_code,''),
      total_amount = v_final_total,
      payment_amount_due = v_payment_due,
      customer_payment_status = CASE WHEN p_payment_plan = 'FULL' THEN 'LUNAS' ELSE 'DP' END
  WHERE id = v_order_id;

  IF v_code <> '' THEN
    UPDATE public.promo_members
    SET is_used = true,
        used_order_id = v_order_id,
        used_at = now(),
        updated_at = now()
    WHERE id = v_member.id;
  END IF;

  v_result := jsonb_set(v_result,'{subtotal_amount}',to_jsonb(v_subtotal),true);
  v_result := jsonb_set(v_result,'{discount_amount}',to_jsonb(v_discount),true);
  v_result := jsonb_set(v_result,'{promo_code}',coalesce(to_jsonb(nullif(v_code,'')),'null'::jsonb),true);
  v_result := jsonb_set(v_result,'{total_amount}',to_jsonb(v_final_total),true);
  v_result := jsonb_set(v_result,'{payment_amount_due}',to_jsonb(v_payment_due),true);
  v_result := jsonb_set(v_result,'{remaining_amount}',to_jsonb(greatest(v_final_total - 0,0)),true);
  v_result := jsonb_set(v_result,'{customer_payment_status}',to_jsonb(CASE WHEN p_payment_plan = 'FULL' THEN 'LUNAS' ELSE 'DP' END),true);
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_public_order(text,text,text,text,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(text,text,text,text,text,text,text,text,jsonb) TO anon, authenticated;
