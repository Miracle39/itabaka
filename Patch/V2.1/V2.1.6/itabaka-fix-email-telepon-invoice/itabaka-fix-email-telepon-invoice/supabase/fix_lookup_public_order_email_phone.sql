-- Itabaka: sertakan email dan nomor telepon pada hasil Cek Pesanan.
-- Jalankan di Supabase SQL Editor.
-- Fungsi lain, validasi invoice/HP, item, pembayaran, dan token pelunasan tetap dipertahankan.

CREATE OR REPLACE FUNCTION public.lookup_public_order(
  p_invoice_no text,
  p_customer_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
    AND EXISTS (
      SELECT 1
      FROM public.order_payments op
      WHERE op.order_id = v_order.id
        AND op.payment_type = 'INITIAL'
    );

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', oi.product_name,
        'category', oi.product_category,
        'size', oi.size,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'subtotal', COALESCE(oi.subtotal, oi.unit_price * oi.quantity)
      )
      ORDER BY oi.id
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM public.order_items oi
  WHERE oi.order_id = v_order.id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', op.id,
        'payment_type', op.payment_type,
        'expected_amount', op.expected_amount,
        'reported_amount', op.reported_amount,
        'uploaded_at', op.uploaded_at,
        'has_proof', true
      )
      ORDER BY op.uploaded_at
    ),
    '[]'::jsonb
  )
  INTO v_payments
  FROM public.order_payments op
  WHERE op.order_id = v_order.id;

  RETURN jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id,
      'invoice_no', v_order.invoice_no,
      'created_at', v_order.created_at,
      'customer_name', v_order.customer_name,
      'customer_email', v_order.customer_email,
      'customer_phone', COALESCE(v_order.customer_phone, v_order.customer_contact),
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
      'settlement_token', CASE
        WHEN v_can_settle THEN v_order.settlement_token
        ELSE NULL
      END,
      'settlement_uploaded_at', v_order.settlement_proof_uploaded_at
    ),
    'items', v_items,
    'payments', v_payments
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';
