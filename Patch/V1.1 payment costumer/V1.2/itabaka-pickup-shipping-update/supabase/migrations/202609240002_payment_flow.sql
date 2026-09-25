-- Circle Itabaka payment flow compatibility migration.
-- Keeps the existing 202609230001_initial_schema.sql intact and extends it.

create extension if not exists pgcrypto;

-- Site configuration used by the customer page.
create table if not exists public.site_settings (
  id integer primary key check (id = 1),
  site_name text not null default 'Circle Itabaka',
  site_title text not null default 'Pre-Order CF24',
  site_description text not null default 'Pesan merchandise Itabaka untuk CF24.',
  logo_url text,
  banner_url text,
  qris_image_url text,
  bca_account_name text,
  bca_account_number text,
  dp_percentage integer not null default 50 check (dp_percentage between 1 and 99),
  updated_at timestamptz not null default now()
);

insert into public.site_settings (
  id, site_name, site_title, site_description, dp_percentage,
  bca_account_name, bca_account_number
)
values (
  1, 'Circle Itabaka', 'Pre-Order CF24', 'Pesan merchandise Itabaka untuk CF24.', 50,
  'Nama Pemilik Rekening', '0000000000'
)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists site_settings_public_select on public.site_settings;
create policy site_settings_public_select
on public.site_settings for select to anon, authenticated
using (true);

drop policy if exists site_settings_admin_insert on public.site_settings;
create policy site_settings_admin_insert
on public.site_settings for insert to authenticated
with check (public.is_admin());

drop policy if exists site_settings_admin_update on public.site_settings;
create policy site_settings_admin_update
on public.site_settings for update to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;

-- New customer fields; customer_contact remains as the legacy/admin-compatible phone field.
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists customer_address text;
alter table public.orders add column if not exists customer_phone text;

update public.orders
set customer_phone = coalesce(customer_phone, customer_contact)
where customer_phone is null;

-- Payment plan is what the customer selected; payment_status remains admin-controlled.
alter table public.orders add column if not exists payment_plan text;
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists payment_amount_due bigint;
alter table public.orders add column if not exists payment_proof_path text;
alter table public.orders add column if not exists payment_proof_uploaded_at timestamptz;
alter table public.orders add column if not exists proof_token uuid default gen_random_uuid();

update public.orders
set
  payment_plan = coalesce(payment_plan, case when payment_status = 'LUNAS' then 'FULL' else 'DP' end),
  payment_method = coalesce(payment_method, 'QRIS'),
  payment_amount_due = coalesce(payment_amount_due,
    case when payment_status = 'LUNAS' then total_amount else greatest(1, paid_amount) end),
  proof_token = coalesce(proof_token, gen_random_uuid());

-- The old check required a DP order to already have paid_amount > 0.
-- Public checkout now creates the order first and payment is verified by admin later.
alter table public.orders drop constraint if exists orders_check;
alter table public.orders add constraint orders_payment_status_check check (
  (payment_status = 'DP' and paid_amount >= 0 and paid_amount < total_amount)
  or
  (payment_status = 'LUNAS' and paid_amount = total_amount)
);

alter table public.orders add constraint orders_payment_plan_check check (
  payment_plan is null or payment_plan in ('DP','FULL')
);

alter table public.orders add constraint orders_payment_method_check check (
  payment_method is null or payment_method in ('QRIS','BCA_TRANSFER')
);

alter table public.orders add constraint orders_payment_due_check check (
  payment_amount_due is null or (payment_amount_due > 0 and payment_amount_due <= total_amount)
);

update public.orders
set payment_amount_due =
  case
    when payment_plan = 'FULL' then total_amount
    else greatest(1, ceil(total_amount::numeric * coalesce((select dp_percentage from public.site_settings where id = 1), 50) / 100))
  end
where payment_amount_due is null;

-- Keep the legacy RPC from being callable with the old signature.
drop function if exists public.create_public_order(text,text,text,text,text,bigint,jsonb);

create or replace function public.create_public_order(
  p_customer_name text,
  p_customer_email text,
  p_customer_address text,
  p_customer_phone text,
  p_payment_plan text,
  p_payment_method text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_invoice_no text;
  v_total bigint := 0;
  v_payment_due bigint := 0;
  v_dp_percentage integer := 50;
  v_item jsonb;
  v_product public.products%rowtype;
  v_requested integer;
  v_result jsonb;
  v_proof_token uuid := gen_random_uuid();
begin
  if length(trim(coalesce(p_customer_name,''))) not between 1 and 120 then
    raise exception 'Nama pemesan tidak valid';
  end if;

  if length(trim(coalesce(p_customer_email,''))) not between 3 and 160 then
    raise exception 'Email pemesan tidak valid';
  end if;

  if length(trim(coalesce(p_customer_address,''))) not between 1 and 500 then
    raise exception 'Alamat pemesan tidak valid';
  end if;

  if length(trim(coalesce(p_customer_phone,''))) not between 5 and 30 then
    raise exception 'Nomor HP tidak valid';
  end if;

  if p_payment_plan not in ('DP','FULL') then
    raise exception 'Rencana pembayaran harus DP atau FULL';
  end if;

  if p_payment_method not in ('QRIS','BCA_TRANSFER') then
    raise exception 'Metode pembayaran tidak valid';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Pesanan harus memiliki minimal satu produk';
  end if;

  select coalesce(dp_percentage, 50)
  into v_dp_percentage
  from public.site_settings
  where id = 1;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if not (v_item ? 'product_id') then
      raise exception 'product_id wajib diisi';
    end if;

    v_requested := coalesce((v_item->>'quantity')::integer, 0);
    if v_requested <= 0 then
      raise exception 'Jumlah produk harus lebih dari 0';
    end if;

    select *
    into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and active = true
    for update;

    if not found then
      raise exception 'Produk tidak ditemukan atau tidak aktif';
    end if;

    if v_product.stock is not null then
      if v_requested > v_product.stock then
        raise exception 'Stok produk % tidak mencukupi', v_product.name;
      end if;
      update public.products
      set stock = stock - v_requested
      where id = v_product.id;
    end if;

    v_total := v_total + (v_product.price * v_requested);
  end loop;

  if v_total <= 0 then
    raise exception 'Total pesanan harus lebih dari 0';
  end if;

  if p_payment_plan = 'FULL' then
    v_payment_due := v_total;
  else
    v_payment_due := greatest(1, ceil(v_total::numeric * v_dp_percentage / 100))::bigint;
  end if;

  v_invoice_no := format(
    'ITB-PO-%s-%s',
    to_char(now() at time zone 'Asia/Jakarta','YYYY'),
    lpad(nextval('public.order_invoice_seq')::text, 6, '0')
  );

  insert into public.orders (
    id,
    invoice_no,
    customer_name,
    customer_contact,
    customer_email,
    customer_address,
    customer_phone,
    delivery_method,
    notes,
    payment_status,
    payment_plan,
    payment_method,
    payment_amount_due,
    paid_amount,
    proof_token
  )
  values (
    v_order_id,
    v_invoice_no,
    trim(p_customer_name),
    trim(p_customer_phone),
    trim(p_customer_email),
    trim(p_customer_address),
    trim(p_customer_phone),
    'Ambil di CF24',
    null,
    'DP',
    p_payment_plan,
    p_payment_method,
    v_payment_due,
    0,
    v_proof_token
  );

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid;

    insert into public.order_items (
      order_id, product_id, product_name, unit_price, quantity
    )
    values (
      v_order_id,
      v_product.id,
      v_product.name,
      v_product.price,
      (v_item->>'quantity')::integer
    );
  end loop;

  select jsonb_build_object(
    'id', o.id,
    'invoice_no', o.invoice_no,
    'customer_name', o.customer_name,
    'customer_email', o.customer_email,
    'customer_address', o.customer_address,
    'customer_phone', o.customer_phone,
    'payment_status', o.payment_status,
    'payment_plan', o.payment_plan,
    'payment_method', o.payment_method,
    'payment_amount_due', o.payment_amount_due,
    'paid_amount', o.paid_amount,
    'remaining_amount', o.remaining_amount,
    'created_at', o.created_at,
    'proof_token', o.proof_token,
    'items',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'name', oi.product_name,
              'quantity', oi.quantity,
              'unit_price', oi.unit_price,
              'subtotal', oi.subtotal
            )
            order by oi.id
          )
          from public.order_items oi
          where oi.order_id = o.id
        ),
        '[]'::jsonb
      )
  )
  into v_result
  from public.orders o
  where o.id = v_order_id;

  return v_result;
end;
$$;

revoke all on function public.create_public_order(text,text,text,text,text,text,jsonb) from public;
grant execute on function public.create_public_order(text,text,text,text,text,text,jsonb) to anon, authenticated;

-- A security-definer validator binds the storage object path to the order's proof token.
create or replace function public.is_valid_proof_path(object_path text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_token uuid;
  v_name text;
  v_token_text text;
begin
  if object_path is null or object_path !~ '^orders/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(png|jpg|jpeg|webp|pdf)$' then
    return false;
  end if;

  v_order_id := split_part(object_path, '/', 2)::uuid;
  v_name := split_part(object_path, '/', 3);
  v_token_text := split_part(v_name, '.', 1);
  v_token := v_token_text::uuid;

  return exists (
    select 1
    from public.orders o
    where o.id = v_order_id
      and o.proof_token = v_token
      and o.payment_proof_path is null
  );
exception
  when others then
    return false;
end;
$$;

revoke all on function public.is_valid_proof_path(text) from public;
grant execute on function public.is_valid_proof_path(text) to anon, authenticated;

create or replace function public.attach_payment_proof(
  p_order_id uuid,
  p_proof_token uuid,
  p_proof_path text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_proof_path !~ '^orders/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(png|jpg|jpeg|webp|pdf)$' then
    raise exception 'Path bukti pembayaran tidak valid';
  end if;

  if split_part(p_proof_path, '/', 2)::uuid <> p_order_id then
    raise exception 'Path tidak cocok dengan order';
  end if;

  if split_part(split_part(p_proof_path, '/', 3), '.', 1)::uuid <> p_proof_token then
    raise exception 'Token bukti pembayaran tidak cocok';
  end if;

  update public.orders
  set payment_proof_path = p_proof_path,
      payment_proof_uploaded_at = now()
  where id = p_order_id
    and proof_token = p_proof_token
    and payment_proof_path is null;

  if not found then
    raise exception 'Order atau token bukti pembayaran tidak valid';
  end if;

  return true;
end;
$$;

revoke all on function public.attach_payment_proof(uuid,uuid,text) from public;
grant execute on function public.attach_payment_proof(uuid,uuid,text) to anon, authenticated;

-- Private proof bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880,
  array['image/png','image/jpeg','image/webp','application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists payment_proofs_anon_insert on storage.objects;
create policy payment_proofs_anon_insert
on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'payment-proofs'
  and public.is_valid_proof_path(name)
);

drop policy if exists payment_proofs_admin_select on storage.objects;
create policy payment_proofs_admin_select
on storage.objects for select to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.is_admin()
);

drop policy if exists payment_proofs_admin_delete on storage.objects;
create policy payment_proofs_admin_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.is_admin()
);
