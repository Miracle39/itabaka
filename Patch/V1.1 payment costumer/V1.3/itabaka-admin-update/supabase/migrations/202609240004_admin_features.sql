-- Circle Itabaka admin feature update.
-- Run AFTER 202609240002_payment_flow.sql and 202609240003_pickup_shipping.sql.

alter table public.site_settings
  add column if not exists primary_color text not null default '#111111',
  add column if not exists accent_color text not null default '#777777';

alter table public.orders
  add column if not exists payment_verified_at timestamptz;

-- Public media buckets for product images and branding.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-images',
    'product-images',
    true,
    8388608,
    array['image/png','image/jpeg','image/webp']::text[]
  ),
  (
    'site-media',
    'site-media',
    true,
    8388608,
    array['image/png','image/jpeg','image/webp']::text[]
  )
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Only admins may upload/change/delete media.
drop policy if exists product_images_admin_insert on storage.objects;
create policy product_images_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_admin()
  and name like 'products/%'
);

drop policy if exists product_images_admin_update on storage.objects;
create policy product_images_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists product_images_admin_delete on storage.objects;
create policy product_images_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists site_media_admin_insert on storage.objects;
create policy site_media_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'site-media'
  and public.is_admin()
  and (name like 'logo/%' or name like 'banner/%' or name like 'qris/%')
);

drop policy if exists site_media_admin_update on storage.objects;
create policy site_media_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'site-media' and public.is_admin())
with check (bucket_id = 'site-media' and public.is_admin());

drop policy if exists site_media_admin_delete on storage.objects;
create policy site_media_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'site-media' and public.is_admin());

-- Re-apply admin settings permissions in case the earlier migration did not create them.
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
