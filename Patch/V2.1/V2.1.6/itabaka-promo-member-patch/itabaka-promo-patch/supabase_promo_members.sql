-- Circle Itabaka: promo member berdasarkan nomor polisi kendaraan
-- Jalankan setelah memastikan fungsi public.create_public_order 8-parameter yang aktif tersedia.

create table if not exists public.promo_members (
  id uuid primary key default gen_random_uuid(),
  plate_code text not null unique,
  member_name text not null,
  discount_type text not null check (discount_type in ('PERCENT','FIXED')),
  discount_value bigint not null check (discount_value > 0),
  is_active boolean not null default true,
  is_used boolean not null default false,
  used_order_id uuid null references public.orders(id) on delete set null,
  used_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_members_plate_code_format check (plate_code = upper(regexp_replace(trim(plate_code), '\s+', ' ', 'g'))),
  constraint promo_members_percent_range check (discount_type <> 'PERCENT' or discount_value between 1 and 99)
);

alter table public.orders add column if not exists subtotal_amount bigint;
alter table public.orders add column if not exists discount_amount bigint not null default 0;
alter table public.orders add column if not exists promo_code text;

alter table public.promo_members enable row level security;

drop policy if exists promo_members_admin_select on public.promo_members;
drop policy if exists promo_members_admin_insert on public.promo_members;
drop policy if exists promo_members_admin_update on public.promo_members;
drop policy if exists promo_members_admin_delete on public.promo_members;

create policy promo_members_admin_select on public.promo_members
for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy promo_members_admin_insert on public.promo_members
for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy promo_members_admin_update on public.promo_members
for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy promo_members_admin_delete on public.promo_members
for delete to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

grant select, insert, update, delete on public.promo_members to authenticated;

create or replace function public.preview_public_promo(p_code text, p_subtotal bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_code text := upper(regexp_replace(trim(coalesce(p_code,'')), '\s+', ' ', 'g'));
  v_member public.promo_members%rowtype;
  v_discount bigint := 0;
begin
  if v_code = '' then
    return jsonb_build_object('valid',false,'message','Masukkan kode promo member.');
  end if;

  select * into v_member
  from public.promo_members
  where plate_code = v_code;

  if not found or not v_member.is_active then
    return jsonb_build_object('valid',false,'message','Kode promo tidak ditemukan atau sedang nonaktif.');
  end if;
  if v_member.is_used then
    return jsonb_build_object('valid',false,'message','Kode promo ini sudah pernah digunakan. Hubungi admin jika ada kekeliruan.');
  end if;
  if coalesce(p_subtotal,0) <= 0 then
    return jsonb_build_object('valid',false,'message','Subtotal pesanan tidak valid.');
  end if;

  if v_member.discount_type = 'PERCENT' then
    v_discount := round(p_subtotal::numeric * v_member.discount_value / 100)::bigint;
  else
    v_discount := v_member.discount_value;
  end if;
  v_discount := least(greatest(v_discount,0),greatest(p_subtotal-1,0));

  return jsonb_build_object(
    'valid',true,
    'code',v_member.plate_code,
    'discount_type',v_member.discount_type,
    'discount_value',v_member.discount_value,
    'discount_amount',v_discount
  );
end;
$function$;

revoke all on function public.preview_public_promo(text,bigint) from public;
grant execute on function public.preview_public_promo(text,bigint) to anon, authenticated;

-- Overload baru: kompatibel dengan fungsi 8-parameter lama.
-- Promo dikunci (FOR UPDATE), order lama dibuat dalam transaksi yang sama,
-- lalu total dan nominal DP dihitung ulang berdasarkan total setelah diskon.
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
  v_code text := upper(regexp_replace(trim(coalesce(p_promo_code,'')), '\s+', ' ', 'g'));
  v_member public.promo_members%rowtype;
  v_result jsonb;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_final_total bigint := 0;
  v_payment_due bigint := 0;
  v_dp_percentage integer := 50;
  v_order_id uuid;
  v_member_used boolean := false;
begin
  if v_code <> '' then
    select * into v_member
    from public.promo_members
    where plate_code = v_code
    for update;

    if not found or not v_member.is_active then
      raise exception 'Kode promo tidak ditemukan atau sedang nonaktif';
    end if;
    if v_member.is_used then
      raise exception 'Kode promo ini sudah pernah digunakan';
    end if;
  end if;

  -- Panggil fungsi existing 8-parameter agar validasi produk, ukuran,
  -- stok, invoice, proof token, dan detail order tetap memakai alur lama.
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
  v_subtotal := coalesce((v_result->>'total_amount')::bigint,0);
  if v_subtotal <= 0 then
    raise exception 'Subtotal pesanan tidak valid';
  end if;

  if v_code <> '' then
    if v_member.discount_type = 'PERCENT' then
      v_discount := round(v_subtotal::numeric * v_member.discount_value / 100)::bigint;
    else
      v_discount := v_member.discount_value;
    end if;
    v_discount := least(greatest(v_discount,0),greatest(v_subtotal-1,0));
  end if;

  v_final_total := v_subtotal - v_discount;
  if v_final_total <= 0 then
    raise exception 'Total setelah diskon harus lebih dari 0';
  end if;

  select coalesce(dp_percentage,50) into v_dp_percentage
  from public.site_settings where id = 1;
  v_dp_percentage := greatest(1,least(99,coalesce(v_dp_percentage,50)));

  if p_payment_plan = 'FULL' then
    v_payment_due := v_final_total;
  elsif p_payment_plan = 'DP' then
    v_payment_due := greatest(1,ceil(v_final_total::numeric * v_dp_percentage / 100))::bigint;
  else
    raise exception 'Rencana pembayaran harus DP atau FULL';
  end if;

  update public.orders
  set subtotal_amount = v_subtotal,
      discount_amount = v_discount,
      promo_code = nullif(v_code,''),
      total_amount = v_final_total,
      payment_amount_due = v_payment_due,
      remaining_amount = greatest(v_final_total - v_payment_due, 0)
  where id = v_order_id;

  if v_code <> '' then
    update public.promo_members
    set is_used = true,
        used_order_id = v_order_id,
        used_at = now(),
        updated_at = now()
    where id = v_member.id;
    v_member_used := true;
  end if;

  v_result := jsonb_set(v_result,'{subtotal_amount}',to_jsonb(v_subtotal),true);
  v_result := jsonb_set(v_result,'{discount_amount}',to_jsonb(v_discount),true);
  v_result := jsonb_set(v_result,'{promo_code}',coalesce(to_jsonb(nullif(v_code,'')),'null'::jsonb),true);
  v_result := jsonb_set(v_result,'{total_amount}',to_jsonb(v_final_total),true);
  v_result := jsonb_set(v_result,'{payment_amount_due}',to_jsonb(v_payment_due),true);
  v_result := jsonb_set(v_result,'{remaining_amount}',to_jsonb(greatest(v_final_total-v_payment_due,0)),true);
  return v_result;
end;
$function$;

revoke all on function public.create_public_order(text,text,text,text,text,text,text,text,jsonb) from public;
grant execute on function public.create_public_order(text,text,text,text,text,text,text,text,jsonb) to anon, authenticated;
