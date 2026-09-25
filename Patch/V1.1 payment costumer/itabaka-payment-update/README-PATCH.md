# Itabaka payment update — patch untuk project lama

Patch ini dibuat untuk project `Miracle39/itabaka` yang sudah memiliki dashboard admin.

## File yang diganti

1. `src/main.js`
2. `src/styles.css`

## File yang ditambahkan

1. `supabase/migrations/202609240002_payment_flow.sql`
2. `supabase/tests/payment_flow.sql`

Jangan hapus `202609230001_initial_schema.sql`.

Jangan ganti:
- `admin.html`
- `src/admin.js`
- `src/lib/supabase.js`
- `src/lib/format.js`
- `package.json`
- `package-lock.json`

## Urutan pemasangan

1. Backup project lama.
2. Replace `src/main.js` dan `src/styles.css` dengan file dari patch.
3. Copy migration `202609240002_payment_flow.sql` ke `supabase/migrations/`.
4. Jalankan `202609240002_payment_flow.sql` di Supabase SQL Editor SETELAH migration awal sudah pernah dijalankan.
5. Pastikan `.env` yang lama tetap ada dan menggunakan:
   `VITE_SUPABASE_URL`
   `VITE_SUPABASE_PUBLISHABLE_KEY`
6. Jalankan `npm install`, lalu `npm run dev`.

## Catatan

Migration ini sengaja kompatibel dengan schema lama: `customer_contact`, `payment_status`, RPC lama, dan dashboard admin lama tidak dibuang. Customer checkout memakai field baru untuk email/alamat/nomor HP, sedangkan `customer_contact` tetap diisi nomor HP agar admin lama masih bisa membaca pesanan.

`payment_status` awal selalu `DP` dan `paid_amount` awal `0`. Admin kemudian yang memverifikasi pembayaran dan mengubah status menjadi `LUNAS`.

Bucket `payment-proofs` dibuat private. Upload customer diikat ke `order_id + proof_token`, lalu admin dapat mengakses file melalui Storage dengan hak admin.
