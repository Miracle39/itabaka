-- Circle Itabaka: pilihan pengambilan / pengiriman.
-- Jalankan SETELAH 202609240002_payment_flow.sql berhasil.

alter table public.orders
  add column if not exists delivery_method text;

update public.orders
set delivery_method = coalesce(
  delivery_method,
  case
    when nullif(trim(coalesce(customer_address, '')), '') is not null
      then 'SHIP_TO_ADDRESS'
    else 'BOOTH_CF24'
  end
)
where delivery_method is null;

alter table public.orders
  drop constraint if exists orders_delivery_method_check;

alter table public.orders
  add constraint orders_delivery_method_check
  check (delivery_method in ('BOOTH_CF24','SHIP_TO_ADDRESS'));

drop function if exists public.create_public_order(text,text,text,text,text,text,text,jsonb);

create or replace function public.create_public_order(
  p_customer_name text,
  p_customer_email text,
  p_customer_address text,
  p_customer_phone text,
  p_delivery_method text,
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
  v_address text := nullif(trim(coalesce(p_customer_address,'')), '');
begin
  if length(trim(coalesce(p_customer_name,''))) not between 1 and 120 then
    raise exception 'Nama pemesan tidak valid';
  end if;

  if length(trim(coalesce(p_customer_email,''))) not between 3 and 160 then
    raise exception 'Email pemesan tidak valid';
  end if;

  if length(trim(coalesce(p_customer_phone,''))) not between 5 and 30 then
    raise exception 'Nomor HP tidak valid';
  end if;

  if p_delivery_method not in ('BOOTH_CF24','SHIP_TO_ADDRESS') then
    raise exception 'Pilihan pengambilan/pengiriman tidak valid';
  end if;

  if p_delivery_method = 'SHIP_TO_ADDRESS' and v_address is null then
    raise exception 'Alamat pengiriman wajib diisi';
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
    v_payment_due := greatest(
      1,
      ceil(v_total::numeric * v_dp_percentage / 100)
    )::bigint;
  end if;

  v_invoice_no := format(
    'ITB-PO-%s-%s',
    to_char(now() at time zone 'Asia/Jakarta','YYYY'),
    lpad(nextval('public.order_invoice_seq')::text, 6, '0')
  );

  insert into public.orders (
    id, invoice_no,
    customer_name, customer_contact, customer_email,
    customer_address, customer_phone,
    pickup_method, notes,
    payment_status, delivery_method,
    payment_plan, payment_method,
    payment_amount_due, paid_amount, proof_token
  )
  values (
    v_order_id, v_invoice_no,
    trim(p_customer_name), trim(p_customer_phone), trim(p_customer_email),
    v_address, trim(p_customer_phone),
    case
      when p_delivery_method = 'BOOTH_CF24'
        then 'Ambil di Booth CF24'
      else 'Dikirim ke Alamat'
    end,
    null,
    'DP', p_delivery_method,
    p_payment_plan, p_payment_method,
    v_payment_due, 0, v_proof_token
  );

  for v_item in select value from jsonb_array_elements(p_items) loop
    select *
      into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid;

    insert into public.order_items (
      order_id, product_id, product_name, unit_price, quantity
    )
    values (
      v_order_id, v_product.id, v_product.name, v_product.price,
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
    'delivery_method', o.delivery_method,
    'payment_status', o.payment_status,
    'payment_plan', o.payment_plan,
    'payment_method', o.payment_method,
    'payment_amount_due', o.payment_amount_due,
    'paid_amount', o.paid_amount,
    'remaining_amount', o.remaining_amount,
    'created_at', o.created_at,
    'proof_token', o.proof_token,
    'items', coalesce(
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

revoke all on function public.create_public_order(
  text,text,text,text,text,text,text,jsonb
) from public;

grant execute on function public.create_public_order(
  text,text,text,text,text,text,text,jsonb
) to anon, authenticated;
