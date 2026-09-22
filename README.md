# Circle Itabaka — Pre-Order

Project awal dari nol untuk website pre-order Circle Itabaka dengan Vite + Supabase.

## Fitur

### Public
- Katalog produk dari Supabase
- Keranjang tambah/kurang/hapus
- Checkout data pemesan
- Status pembayaran hanya `DP` atau `LUNAS`
- Hitung total, dibayar, dan sisa
- PO dibuat di database melalui RPC server-side
- Stok dikurangi transactionally saat PO dibuat
- Invoice otomatis
- Cetak / Save as PDF dari browser

### Admin
- Login email/password lewat Supabase Auth
- Dashboard jumlah PO, DP, LUNAS
- Cari invoice/nama/kontak
- Detail pesanan
- Ubah status pembayaran DP ↔ LUNAS
- Tambah/edit/nonaktifkan produk

## Teknologi

- Vite 8
- Vanilla JavaScript
- `@supabase/supabase-js` v2
- Supabase Postgres
- Supabase Auth
- Row Level Security (RLS)
- PostgreSQL RPC untuk pembuatan order

Vite 8 saat ini membutuhkan Node.js 20.19+ atau 22.12+. Supabase JavaScript client terbaru berada pada v2.x; repository ini memakai range `^2.116.0`. citeturn416852search0turn543064search4

## Setup

1. Buat project Supabase baru.
2. Copy `.env.example` menjadi `.env`.
3. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Jalankan:

```bash
npm install
npm run dev
```

5. Buka `/` untuk halaman PO.
6. Buka `/admin.html` untuk admin.

Supabase client memakai publishable key di frontend; jangan pernah memasukkan service-role/secret key ke source frontend. Supabase juga meminta grant/policy yang sesuai untuk Data API. citeturn543064search0

## Database

Jalankan migration:

```text
supabase/migrations/202609230001_initial_schema.sql
```

Lalu seed produk development dari:

```text
supabase/seed.sql
```

Setelah membuat user admin di Supabase Auth, ambil UUID user tersebut lalu jalankan di SQL Editor sebagai database owner/admin:

```sql
update public.profiles
set role = 'admin', display_name = 'Admin Itabaka'
where id = 'UUID-USER-ANDA';
```

## Supabase CLI workflow

Untuk workflow version-controlled, gunakan migration files dan CLI. Supabase mendokumentasikan `supabase link`, `supabase db push`, `supabase db reset`, dan `supabase migration list` untuk mengelola migration history. Untuk remote baru yang kosong, jalankan:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --dry-run
supabase db push
```

Seed sebaiknya dipakai untuk development/staging, bukan production. citeturn543064search1turn543064search3

## GitHub manual

Sesuai permintaan, commit dan push dilakukan manual oleh kamu:

```bash
git add .
git commit -m "feat: build Supabase-backed Itabaka PO app"
git push origin main
```

Jangan commit `.env`.

## Catatan production

Status `DP`/`LUNAS` pada public checkout merupakan deklarasi pembayaran dari pemesan. Sebelum publik, sebaiknya tambahkan bukti pembayaran dan proses verifikasi admin agar status `LUNAS` tidak hanya bergantung pada input pengguna.

## Roadmap

- Upload gambar via Supabase Storage
- Bukti pembayaran
- Verifikasi pembayaran admin
- Export CSV
- Pengaturan buka/tutup PO
- Rate limiting / anti-spam
- Audit log admin
- Test RLS/integration yang lebih lengkap
- Deploy production
