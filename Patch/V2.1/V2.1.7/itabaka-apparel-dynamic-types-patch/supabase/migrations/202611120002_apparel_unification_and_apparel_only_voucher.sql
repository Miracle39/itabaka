-- Unify product categories into MERCHANDISE and APPAREL.
-- Legacy order_items.product_category values are intentionally preserved.
-- New order items receive APPAREL + apparel_type through a trigger.

begin;

alter table public.products
  add column if not exists apparel_type text;

alter table public.order_items
  add column if not exists apparel_type text;

-- Master data jenis Apparel. Penambahan jenis berikutnya dilakukan dari Admin.
create table if not exists public.apparel_types (
  code text primary key check (code ~ '^[A-Z0-9_]{1,40}$'),
  name text not null unique check (char_length(trim(name)) between 1 and 50),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.apparel_types(code,name,is_active,sort_order) values
  ('TSHIRT','Kaos',true,10),
  ('JACKET','Jaket',true,20)
on conflict (code) do nothing;

alter table public.apparel_types enable row level security;
drop policy if exists apparel_types_public_select on public.apparel_types;
create policy apparel_types_public_select on public.apparel_types
  for select to anon,authenticated using (is_active or public.is_admin());
drop policy if exists apparel_types_admin_insert on public.apparel_types;
create policy apparel_types_admin_insert on public.apparel_types
  for insert to authenticated with check (public.is_admin());
drop policy if exists apparel_types_admin_update on public.apparel_types;
create policy apparel_types_admin_update on public.apparel_types
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.apparel_types to anon,authenticated;
grant insert,update on public.apparel_types to authenticated;

-- Preserve the former category as the apparel subtype before changing the main category.
update public.products
set apparel_type = category
where category in ('TSHIRT', 'JACKET')
  and apparel_type is null;

alter table public.products
  drop constraint if exists products_category_check;

update public.products
set category = 'APPAREL'
where category in ('TSHIRT', 'JACKET');

alter table public.products
  add constraint products_category_check
  check (category in ('MERCHANDISE', 'APPAREL'));

alter table public.products
  drop constraint if exists products_apparel_type_check;
alter table public.products
  drop constraint if exists products_apparel_type_fkey;
alter table public.products
  add constraint products_apparel_type_check
  check (
    (category = 'MERCHANDISE' and apparel_type is null)
    or
    (category = 'APPAREL' and apparel_type is not null)
  );
alter table public.products
  add constraint products_apparel_type_fkey
  foreign key (apparel_type) references public.apparel_types(code)
  on update cascade on delete restrict;

-- Historical order lines retain TSHIRT/JACKET. Populate their subtype for reporting.
update public.order_items
set apparel_type = product_category
where product_category in ('TSHIRT', 'JACKET')
  and apparel_type is null;

-- Snapshot category/type from the product for every newly inserted order line.
create or replace function public.set_order_item_product_category()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_category text;
  v_apparel_type text;
begin
  select p.category, p.apparel_type
    into v_category, v_apparel_type
  from public.products p
  where p.id = new.product_id;

  if not found then
    raise exception 'Produk tidak ditemukan.';
  end if;

  new.product_category := v_category;
  new.apparel_type := v_apparel_type;
  return new;
end;
$function$;

drop trigger if exists order_items_set_product_category on public.order_items;
create trigger order_items_set_product_category
before insert on public.order_items
for each row execute function public.set_order_item_product_category();

-- Update the existing 8-argument core RPC so APPAREL products still require
-- a valid size. Its stock, invoice, proof-token and order validation flow is kept.
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
  v_size text;
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

  select coalesce(dp_percentage,50)
  into v_dp_percentage
  from public.site_settings
  where id=1;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_requested := coalesce((v_item->>'quantity')::integer,0);
    if v_requested <= 0 then
      raise exception 'Jumlah produk harus lebih dari 0';
    end if;

    select *
    into v_product
    from public.products
    where id=(v_item->>'product_id')::uuid
      and active=true
    for update;

    if not found then
      raise exception 'Produk tidak ditemukan atau tidak aktif';
    end if;

    if v_product.category = 'APPAREL' then
      v_size := nullif(upper(trim(coalesce(v_item->>'size',''))),'');
      if v_size is null then
        raise exception 'Ukuran wajib dipilih untuk %', v_product.name;
      end if;

      if not (v_size = any(v_product.available_sizes)) then
        raise exception 'Ukuran % tidak tersedia untuk %', v_size, v_product.name;
      end if;
    else
      v_size := null;
    end if;

    if v_product.stock is not null then
      if v_requested > v_product.stock then
        raise exception 'Stok produk % tidak mencukupi', v_product.name;
      end if;
      update public.products set stock=stock-v_requested where id=v_product.id;
    end if;

    v_total := v_total + (v_product.price*v_requested);
  end loop;

  if v_total <= 0 then
    raise exception 'Total pesanan harus lebih dari 0';
  end if;

  if p_payment_plan='FULL' then
    v_payment_due := v_total;
  else
    v_payment_due := greatest(1,ceil(v_total::numeric*v_dp_percentage/100))::bigint;
  end if;

  v_invoice_no := format(
    'ITB-PO-%s-%s',
    to_char(now() at time zone 'Asia/Jakarta','YYYY'),
    lpad(nextval('public.order_invoice_seq')::text,6,'0')
  );

  insert into public.orders (
    id,invoice_no,customer_name,customer_email,customer_address,
    customer_phone,customer_contact,payment_status,total_amount,paid_amount,
    delivery_method,payment_plan,payment_method,payment_amount_due,
    payment_proof_path,payment_proof_uploaded_at,proof_token
  )
  values (
    v_order_id,v_invoice_no,trim(p_customer_name),trim(p_customer_email),
    v_address,trim(p_customer_phone),trim(p_customer_phone),'DP',v_total,0,
    p_delivery_method,p_payment_plan,p_payment_method,v_payment_due,
    null,null,v_proof_token
  );

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_product
    from public.products
    where id=(v_item->>'product_id')::uuid;

    if v_product.category = 'APPAREL' then
      v_size := nullif(upper(trim(coalesce(v_item->>'size',''))),'');
    else
      v_size := null;
    end if;

    insert into public.order_items (
      order_id,product_id,product_name,product_category,size,unit_price,quantity
    )
    values (
      v_order_id,v_product.id,v_product.name,v_product.category,v_size,
      v_product.price,(v_item->>'quantity')::integer
    );
  end loop;

  select jsonb_build_object(
    'id',o.id,
    'invoice_no',o.invoice_no,
    'customer_name',o.customer_name,
    'customer_email',o.customer_email,
    'customer_address',o.customer_address,
    'customer_phone',o.customer_phone,
    'delivery_method',o.delivery_method,
    'payment_status',o.payment_status,
    'payment_plan',o.payment_plan,
    'payment_method',o.payment_method,
    'payment_amount_due',o.payment_amount_due,
    'paid_amount',o.paid_amount,
    'remaining_amount',o.remaining_amount,
    'created_at',o.created_at,
    'proof_token',o.proof_token,
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'name',oi.product_name,
        'quantity',oi.quantity,
        'unit_price',oi.unit_price,
        'subtotal',oi.subtotal,
        'category',oi.product_category,
        'apparel_type',oi.apparel_type,
        'size',oi.size
      ) order by oi.id)
      from public.order_items oi
      where oi.order_id=o.id
    ),'[]'::jsonb)
  )
  into v_result
  from public.orders o
  where o.id=v_order_id;

  return v_result;
end;
$$;

-- Preview only discounts the APPAREL portion of the cart.
drop function if exists public.preview_public_promo(text, bigint);

create or replace function public.preview_public_promo(
  p_code text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_code text := upper(regexp_replace(trim(coalesce(p_code, '')), '\s+', ' ', 'g'));
  v_member public.promo_members%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_apparel_subtotal bigint := 0;
  v_discount bigint := 0;
begin
  if v_code = '' then
    return jsonb_build_object('valid', false, 'message', 'Masukkan kode promo member.');
  end if;

  select * into v_member
  from public.promo_members
  where plate_code = v_code;

  if not found or not v_member.is_active then
    return jsonb_build_object('valid', false, 'message', 'Kode promo tidak ditemukan atau sedang nonaktif.');
  end if;

  if v_member.is_used then
    return jsonb_build_object('valid', false, 'message', 'Kode promo ini sudah pernah digunakan.');
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    return jsonb_build_object('valid', false, 'message', 'Data keranjang tidak valid.');
  end if;

  if jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('valid', false, 'message', 'Keranjang masih kosong.');
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(v_item->>'product_id', '') = '' then
      return jsonb_build_object('valid', false, 'message', 'Ada produk pada keranjang yang tidak valid.');
    end if;

    begin
      select * into v_product
      from public.products
      where id = (v_item->>'product_id')::uuid
        and active = true;
    exception when invalid_text_representation then
      return jsonb_build_object('valid', false, 'message', 'Ada produk pada keranjang yang tidak valid.');
    end;

    if not found then
      return jsonb_build_object('valid', false, 'message', 'Ada produk yang sudah tidak tersedia.');
    end if;

    begin
      v_quantity := (v_item->>'quantity')::integer;
    exception when others then
      return jsonb_build_object('valid', false, 'message', 'Jumlah produk pada keranjang tidak valid.');
    end;

    if v_quantity is null or v_quantity < 1 then
      return jsonb_build_object('valid', false, 'message', 'Jumlah produk pada keranjang tidak valid.');
    end if;

    if v_product.category = 'APPAREL' then
      v_apparel_subtotal := v_apparel_subtotal + (v_product.price * v_quantity);
    end if;
  end loop;

  if v_apparel_subtotal <= 0 then
    return jsonb_build_object('valid', false, 'message', 'Voucher hanya berlaku untuk produk Apparel.');
  end if;

  if v_member.discount_type = 'PERCENT' then
    v_discount := round(v_apparel_subtotal::numeric * v_member.discount_value / 100)::bigint;
  else
    v_discount := v_member.discount_value;
  end if;

  -- Keep the final order total above zero, including Apparel-only carts.
  v_discount := least(greatest(v_discount, 0), greatest(v_apparel_subtotal - 1, 0));

  return jsonb_build_object(
    'valid', true,
    'code', v_member.plate_code,
    'member_name', v_member.member_name,
    'discount_type', v_member.discount_type,
    'discount_value', v_member.discount_value,
    'apparel_subtotal', v_apparel_subtotal,
    'discount_amount', v_discount
  );
end;
$function$;

revoke all on function public.preview_public_promo(text, jsonb) from public;
grant execute on function public.preview_public_promo(text, jsonb) to anon, authenticated;

-- Keep the existing 8-argument order creator responsible for stock, size,
-- invoice, proof token and order-item creation. This wrapper only applies promo.
create or replace function public.create_public_order(
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
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_code text := upper(regexp_replace(trim(coalesce(p_promo_code, '')), '\s+', ' ', 'g'));
  v_member public.promo_members%rowtype;
  v_result jsonb;
  v_subtotal bigint := 0;
  v_apparel_subtotal bigint := 0;
  v_discount bigint := 0;
  v_final_total bigint := 0;
  v_payment_due bigint := 0;
  v_dp_percentage integer := 50;
  v_order_id uuid;
begin
  if v_code <> '' then
    select * into v_member
    from public.promo_members
    where plate_code = v_code
    for update;

    if not found or not v_member.is_active then
      raise exception 'Kode promo tidak ditemukan atau sedang nonaktif.';
    end if;

    if v_member.is_used then
      raise exception 'Kode promo ini sudah pernah digunakan.';
    end if;
  end if;

  -- Core function keeps its existing validation and stock deduction behavior.
  v_result := public.create_public_order(
    p_customer_name,
    p_customer_email,
    p_customer_address,
    p_customer_phone,
    p_delivery_method,
    p_payment_plan,
    p_payment_method,
    p_items
  );

  v_order_id := (v_result->>'id')::uuid;

  select
    coalesce(sum(oi.subtotal), 0),
    coalesce(sum(oi.subtotal) filter (where oi.product_category = 'APPAREL'), 0)
  into v_subtotal, v_apparel_subtotal
  from public.order_items oi
  where oi.order_id = v_order_id;

  if v_subtotal <= 0 then
    raise exception 'Subtotal pesanan tidak valid.';
  end if;

  if v_code <> '' then
    if v_apparel_subtotal <= 0 then
      raise exception 'Voucher hanya berlaku untuk produk Apparel.';
    end if;

    if v_member.discount_type = 'PERCENT' then
      v_discount := round(v_apparel_subtotal::numeric * v_member.discount_value / 100)::bigint;
    else
      v_discount := v_member.discount_value;
    end if;

    v_discount := least(greatest(v_discount, 0), greatest(least(v_apparel_subtotal, v_subtotal - 1), 0));
  end if;

  v_final_total := v_subtotal - v_discount;
  if v_final_total <= 0 then
    raise exception 'Total setelah diskon harus lebih dari 0.';
  end if;

  select coalesce(dp_percentage, 50)
    into v_dp_percentage
  from public.site_settings
  where id = 1;

  v_dp_percentage := greatest(1, least(99, coalesce(v_dp_percentage, 50)));

  if p_payment_plan = 'FULL' then
    v_payment_due := v_final_total;
  elsif p_payment_plan = 'DP' then
    v_payment_due := greatest(1, ceil(v_final_total::numeric * v_dp_percentage / 100)::bigint);
  else
    raise exception 'Rencana pembayaran harus DP atau FULL.';
  end if;

  update public.orders
  set subtotal_amount = v_subtotal,
      discount_amount = v_discount,
      promo_code = nullif(v_code, ''),
      total_amount = v_final_total,
      payment_amount_due = v_payment_due,
      customer_payment_status = case when p_payment_plan = 'FULL' then 'LUNAS' else 'DP' end
  where id = v_order_id;

  if v_code <> '' then
    update public.promo_members
    set is_used = true,
        used_order_id = v_order_id,
        used_at = now(),
        updated_at = now()
    where id = v_member.id;
  end if;

  v_result := jsonb_set(v_result, '{subtotal_amount}', to_jsonb(v_subtotal), true);
  v_result := jsonb_set(v_result, '{discount_amount}', to_jsonb(v_discount), true);
  v_result := jsonb_set(v_result, '{promo_code}', coalesce(to_jsonb(nullif(v_code, '')), 'null'::jsonb), true);
  v_result := jsonb_set(v_result, '{total_amount}', to_jsonb(v_final_total), true);
  v_result := jsonb_set(v_result, '{payment_amount_due}', to_jsonb(v_payment_due), true);
  v_result := jsonb_set(v_result, '{remaining_amount}', to_jsonb(v_final_total), true);
  v_result := jsonb_set(v_result, '{customer_payment_status}', to_jsonb(case when p_payment_plan = 'FULL' then 'LUNAS' else 'DP' end), true);

  return v_result;
end;
$function$;

revoke all on function public.create_public_order(text, text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.create_public_order(text, text, text, text, text, text, text, text, jsonb) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
