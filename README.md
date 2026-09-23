# Circle Itabaka — Pre-Order

Aplikasi pre-order Circle Itabaka dengan Vite + Supabase.

## Customer

Customer **hanya** mengisi:
- Nama
- Email
- Alamat
- Nomor HP

Customer tidak mengisi status pembayaran, nominal DP, atau data pembayaran.

Order baru otomatis masuk sebagai status `DP` dengan `paid_amount = 0`. Pembayaran dikelola dari dashboard admin.

## Admin dashboard

- Login Supabase Auth email/password
- Statistik PO
- Cari dan lihat detail PO
- Ubah status DP / LUNAS
- Kelola produk: nama, kode, harga, stok, aktif/nonaktif
- Upload foto produk
- Upload logo dan banner
- Ganti nama, judul, deskripsi, warna

## Setup

Butuh Node.js 20.19+ dan project Supabase.

```bash
npm install
cp .env.example .env
npm run dev
```

Customer: `/`

Admin: `/admin.html`

Isi `.env` dengan:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Database

1. Jalankan `supabase/migrations/202609230001_initial_schema.sql` di SQL Editor.
2. Jalankan `supabase/seed.sql`.
3. Buat user admin lewat Supabase Authentication.
4. Promote user tersebut:

```sql
update public.profiles
set role='admin', display_name='Admin Itabaka'
where id='UUID-USER-ANDA';
```

## Storage

Buat bucket public bernama `site-media`.

Policy yang diperlukan:
- public/anon: read object
- admin authenticated: upload object
- admin authenticated: update/delete object

Service-role/secret key tidak boleh masuk frontend.

## GitHub manual

Project ini tidak melakukan push otomatis.

```bash
git add .
git commit -m "feat: build Itabaka PO app with Supabase"
git push origin main
```
