-- Itabaka hotfix: subtotal extraction + booth address compatibility.
-- Jalankan setelah backup/export SQL function yang aktif.
-- Tidak menghapus overload create_public_order lama dan tidak mengubah data order.

begin;

-- customer_address memang nullable pada tabel, tetapi CHECK lama menolak NULL.
-- NULL diperbolehkan untuk BOOTH_CF24; fungsi 9 argumen tetap wajib memvalidasi
-- alamat ketika delivery_method = SHIP_TO_ADDRESS.
alter table public.orders
  drop constraint if exists orders_customer_address_check;

alter table public.orders
  add constraint orders_customer_address_check
  check (
    customer_address is null
    or char_length(btrim(customer_address)) between 1 and 500
  ) not valid;

alter table public.orders
  validate constraint orders_customer_address_check;

-- Fungsi 9 argumen memanggil overload 8 argumen. Overload 8 argumen tidak
-- mengembalikan total_amount di JSON, jadi subtotal harus dibaca dari orders.
do $patch$
declare
  v_oid oid;
  v_definition text;
  v_old text := $old$v_subtotal := coalesce((v_result->>'total_amount')::bigint,0);$old$;
  v_new text := $new$select o.total_amount into v_subtotal
  from public.orders o
  where o.id = v_order_id;$new$;
begin
  v_oid := to_regprocedure(
    'public.create_public_order(text,text,text,text,text,text,text,text,jsonb)'
  );

  if v_oid is null then
    raise exception 'Fungsi create_public_order 9 parameter tidak ditemukan. Tidak ada perubahan fungsi.';
  end if;

  v_definition := pg_get_functiondef(v_oid);
  if position(v_old in v_definition) = 0 then
    if position(v_new in v_definition) > 0 then
      raise notice 'Hotfix subtotal sudah terpasang; fungsi tidak diubah.';
    else
      raise exception 'Pola pembacaan subtotal tidak ditemukan. Fungsi tidak diubah; periksa definisi aktif secara manual.';
    end if;
  else
    v_definition := replace(v_definition, v_old, v_new);
    execute v_definition;
    raise notice 'Hotfix subtotal berhasil diterapkan pada overload 9 parameter.';
  end if;
end;
$patch$;

commit;

-- Verifikasi setelah menjalankan:
-- select pg_get_functiondef('public.create_public_order(text,text,text,text,text,text,text,text,jsonb)'::regprocedure);
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint where conrelid='public.orders'::regclass
--   and conname='orders_customer_address_check';
