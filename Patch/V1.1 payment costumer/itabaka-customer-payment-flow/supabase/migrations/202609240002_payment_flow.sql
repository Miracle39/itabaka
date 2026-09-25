-- Apply after the project's initial schema migration.
alter table public.site_settings
  add column if not exists dp_percentage integer not null default 50 check (dp_percentage between 1 and 99),
  add column if not exists qris_image_url text,
  add column if not exists bca_account_name text,
  add column if not exists bca_account_number text;

alter table public.orders
  add column if not exists payment_plan text not null default 'DP' check (payment_plan in ('DP','FULL')),
  add column if not exists payment_method text not null default 'QRIS' check (payment_method in ('QRIS','BCA_TRANSFER')),
  add column if not exists payment_amount_due bigint not null default 0 check (payment_amount_due >= 0),
  add column if not exists payment_proof_path text,
  add column if not exists payment_proof_uploaded_at timestamptz,
  add column if not exists proof_token uuid not null default gen_random_uuid();

update public.orders
set payment_amount_due = case
  when payment_plan = 'FULL' then total_amount
  else greatest(
    1,
    ceil((total_amount * coalesce((select dp_percentage from public.site_settings where id=1),50))::numeric/100)::bigint
  )
end
where payment_amount_due=0;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-proofs','payment-proofs',false,5242880,array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict(id) do update set
  public=false,file_size_limit=5242880,
  allowed_mime_types=array['image/png','image/jpeg','image/webp','application/pdf'];

drop policy if exists "payment_proofs_anon_insert" on storage.objects;
create policy "payment_proofs_anon_insert"
on storage.objects for insert to anon
with check (bucket_id='payment-proofs' and name like 'orders/%/%');

drop policy if exists "payment_proofs_admin_select" on storage.objects;
create policy "payment_proofs_admin_select"
on storage.objects for select to authenticated
using (bucket_id='payment-proofs' and public.is_admin());

drop function if exists public.create_public_order(text,text,text,text,jsonb);

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
language plpgsql security definer set search_path=public
as $$
declare
  v_order_id uuid:=gen_random_uuid();
  v_invoice_no text:=public.next_invoice_no();
  v_proof_token uuid:=gen_random_uuid();
  v_total bigint:=0;
  v_payment_due bigint:=0;
  v_dp_percentage integer:=50;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_result jsonb;
begin
  if length(trim(coalesce(p_customer_name,''))) not between 1 and 120 then raise exception 'Nama pemesan tidak valid'; end if;
  if length(trim(coalesce(p_customer_email,''))) not between 3 and 160 then raise exception 'Email pemesan tidak valid'; end if;
  if length(trim(coalesce(p_customer_address,''))) not between 1 and 500 then raise exception 'Alamat pemesan tidak valid'; end if;
  if length(trim(coalesce(p_customer_phone,''))) not between 3 and 30 then raise exception 'Nomor HP pemesan tidak valid'; end if;
  if p_payment_plan not in ('DP','FULL') then raise exception 'Rencana pembayaran harus DP atau FULL'; end if;
  if p_payment_method not in ('QRIS','BCA_TRANSFER') then raise exception 'Metode pembayaran harus QRIS atau BCA_TRANSFER'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Pesanan harus memiliki minimal satu produk'; end if;

  select coalesce(dp_percentage,50) into v_dp_percentage from public.site_settings where id=1;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty:=(v_item->>'quantity')::integer;
    if v_qty is null or v_qty<=0 then raise exception 'Jumlah produk harus lebih dari 0'; end if;

    select * into v_product
    from public.products
    where id=(v_item->>'product_id')::uuid and active=true
    for update;

    if not found then raise exception 'Produk tidak ditemukan atau tidak aktif'; end if;
    if v_product.stock is not null and v_qty>v_product.stock then raise exception 'Stok produk % tidak mencukupi',v_product.name; end if;

    if v_product.stock is not null then
      update public.products set stock=stock-v_qty where id=v_product.id;
    end if;

    v_total:=v_total+(v_product.price*v_qty);
  end loop;

  if p_payment_plan='FULL' then v_payment_due:=v_total;
  else v_payment_due:=greatest(1,ceil((v_total*v_dp_percentage)::numeric/100)::bigint);
  end if;

  insert into public.orders(
    id,invoice_no,customer_name,customer_email,customer_address,customer_phone,
    payment_plan,payment_method,payment_status,payment_amount_due,total_amount,paid_amount,proof_token
  ) values(
    v_order_id,v_invoice_no,trim(p_customer_name),lower(trim(p_customer_email)),trim(p_customer_address),trim(p_customer_phone),
    p_payment_plan,p_payment_method,'DP',v_payment_due,v_total,0,v_proof_token
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products where id=(v_item->>'product_id')::uuid;
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity)
    values(v_order_id,v_product.id,v_product.name,v_product.price,(v_item->>'quantity')::integer);
  end loop;

  select jsonb_build_object(
    'id',o.id,'invoice_no',o.invoice_no,'customer_name',o.customer_name,'customer_email',o.customer_email,
    'customer_address',o.customer_address,'customer_phone',o.customer_phone,
    'payment_plan',o.payment_plan,'payment_method',o.payment_method,'payment_status',o.payment_status,
    'payment_amount_due',o.payment_amount_due,'total_amount',o.total_amount,'paid_amount',o.paid_amount,
    'remaining_amount',o.remaining_amount,'created_at',o.created_at,'proof_token',o.proof_token,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'name',oi.product_name,'quantity',oi.quantity,'unit_price',oi.unit_price,'subtotal',oi.subtotal
    ) order by oi.id) from public.order_items oi where oi.order_id=o.id),'[]'::jsonb)
  ) into v_result from public.orders o where o.id=v_order_id;

  return v_result;
end;
$$;

grant execute on function public.create_public_order(text,text,text,text,text,text,jsonb) to anon,authenticated;

create or replace function public.attach_payment_proof(
  p_order_id uuid,p_proof_token uuid,p_proof_path text
)
returns jsonb language plpgsql security definer set search_path=public
as $$
begin
  if p_proof_path is null or p_proof_path not like 'orders/'||p_order_id::text||'/%' then
    raise exception 'Path bukti pembayaran tidak valid';
  end if;

  if not exists(select 1 from public.orders where id=p_order_id and proof_token=p_proof_token) then
    raise exception 'Token order tidak valid';
  end if;

  update public.orders
  set payment_proof_path=p_proof_path,payment_proof_uploaded_at=now()
  where id=p_order_id;

  return jsonb_build_object('id',p_order_id,'payment_proof_path',p_proof_path);
end;
$$;

grant execute on function public.attach_payment_proof(uuid,uuid,text) to anon,authenticated;
