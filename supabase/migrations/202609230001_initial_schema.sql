create extension if not exists pgcrypto;

create sequence if not exists public.order_invoice_seq;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price bigint not null check (price >= 0),
  image_url text,
  stock integer check (stock is null or stock >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  customer_name text not null check (char_length(trim(customer_name)) between 1 and 120),
  customer_contact text not null check (char_length(trim(customer_contact)) between 1 and 120),
  pickup_method text not null default 'Ambil di CF24',
  notes text check (notes is null or char_length(notes) <= 1000),
  payment_status text not null check (payment_status in ('DP','LUNAS')),
  total_amount bigint not null check (total_amount > 0),
  paid_amount bigint not null check (paid_amount >= 0),
  remaining_amount bigint generated always as (total_amount - paid_amount) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (payment_status = 'DP' and paid_amount > 0 and paid_amount < total_amount)
    or (payment_status = 'LUNAS' and paid_amount = total_amount)
  )
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  unit_price bigint not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  subtotal bigint generated always as (unit_price * quantity) stored
);

create index if not exists products_active_sort_idx on public.products(active, sort_order);
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists orders_payment_status_idx on public.orders(payment_status);
create index if not exists order_items_order_idx on public.order_items(order_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists products_public_select on public.products;
create policy products_public_select on public.products for select to anon, authenticated using (active = true or public.is_admin());

drop policy if exists products_admin_insert on public.products;
create policy products_admin_insert on public.products for insert to authenticated with check (public.is_admin());
drop policy if exists products_admin_update on public.products;
create policy products_admin_update on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists products_admin_delete on public.products;
create policy products_admin_delete on public.products for delete to authenticated using (public.is_admin());

drop policy if exists orders_admin_select on public.orders;
create policy orders_admin_select on public.orders for select to authenticated using (public.is_admin());
drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_items_admin_select on public.order_items;
create policy order_items_admin_select on public.order_items for select to authenticated using (public.is_admin());

create or replace function public.create_public_order(
  p_customer_name text,
  p_customer_contact text,
  p_pickup_method text,
  p_notes text,
  p_payment_status text,
  p_paid_amount bigint,
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
  v_item jsonb;
  v_product public.products%rowtype;
  v_requested integer;
  v_paid bigint := greatest(coalesce(p_paid_amount, 0), 0);
  v_result jsonb;
begin
  if length(trim(coalesce(p_customer_name,''))) not between 1 and 120 then raise exception 'Nama pemesan tidak valid'; end if;
  if length(trim(coalesce(p_customer_contact,''))) not between 1 and 120 then raise exception 'Kontak pemesan tidak valid'; end if;
  if p_payment_status not in ('DP','LUNAS') then raise exception 'Status pembayaran harus DP atau LUNAS'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Pesanan harus memiliki minimal satu produk'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if not (v_item ? 'product_id') then raise exception 'product_id wajib diisi'; end if;
    v_requested := coalesce((v_item->>'quantity')::integer,0);
    if v_requested <= 0 then raise exception 'Jumlah produk harus lebih dari 0'; end if;

    select * into v_product from public.products where id = (v_item->>'product_id')::uuid and active = true for update;
    if not found then raise exception 'Produk tidak ditemukan atau tidak aktif'; end if;

    if v_product.stock is not null then
      if v_requested > v_product.stock then raise exception 'Stok produk % tidak mencukupi', v_product.name; end if;
      update public.products set stock = stock - v_requested where id = v_product.id;
    end if;

    v_total := v_total + (v_product.price * v_requested);
  end loop;

  if v_total <= 0 then raise exception 'Total pesanan harus lebih dari 0'; end if;
  if p_payment_status = 'LUNAS' then v_paid := v_total;
  elsif v_paid <= 0 or v_paid >= v_total then raise exception 'Nominal DP harus lebih dari 0 dan kurang dari total'; end if;

  v_invoice_no := format('ITB-PO-%s-%s', to_char(now() at time zone 'Asia/Jakarta','YYYY'), lpad(nextval('public.order_invoice_seq')::text,6,'0'));

  insert into public.orders (id,invoice_no,customer_name,customer_contact,pickup_method,notes,payment_status,total_amount,paid_amount)
  values (v_order_id,v_invoice_no,trim(p_customer_name),trim(p_customer_contact),coalesce(nullif(trim(p_pickup_method),''),'Ambil di CF24'),nullif(trim(p_notes),''),p_payment_status,v_total,v_paid);

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid;
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity)
    values(v_order_id,v_product.id,v_product.name,v_product.price,(v_item->>'quantity')::integer);
  end loop;

  select jsonb_build_object(
    'id',o.id,'invoice_no',o.invoice_no,'customer_name',o.customer_name,'customer_contact',o.customer_contact,
    'pickup_method',o.pickup_method,'notes',o.notes,'payment_status',o.payment_status,'total_amount',o.total_amount,
    'paid_amount',o.paid_amount,'remaining_amount',o.remaining_amount,'created_at',o.created_at,
    'items',coalesce((select jsonb_agg(jsonb_build_object('name',oi.product_name,'quantity',oi.quantity,'unit_price',oi.unit_price,'subtotal',oi.subtotal) order by oi.id) from public.order_items oi where oi.order_id=o.id),'[]'::jsonb)
  ) into v_result from public.orders o where o.id=v_order_id;
  return v_result;
end;
$$;

revoke all on public.profiles from anon;
revoke all on public.orders from anon;
revoke all on public.order_items from anon;
grant select on public.profiles to authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant execute on function public.create_public_order(text,text,text,text,text,bigint,jsonb) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
