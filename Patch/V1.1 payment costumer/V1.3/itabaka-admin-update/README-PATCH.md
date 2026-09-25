# Itabaka — Admin Update

Patch ini untuk project Itabaka yang sudah memasang:
- initial schema
- payment flow
- pickup/shipping

## Ganti
- `src/admin.js`
- `src/styles.css`

## Tambahkan
- `supabase/migrations/202609240004_admin_features.sql`

## Admin yang diperbaiki
- Detail customer: nama, email, HP, alamat
- Pilihan booth / pengiriman
- Rencana pembayaran dan metode pembayaran
- Nominal bayar sekarang, dibayar, dan sisa
- Lihat bukti pembayaran dari bucket privat menggunakan signed URL
- Tandai LUNAS / ubah ke DP
- Upload foto produk
- Aktif/nonaktif, harga, stok, URL gambar
- Branding: nama, judul, deskripsi, warna utama/aksen
- Upload logo, banner, QRIS
- Pengaturan DP dan rekening BCA

## Urutan
1. Pastikan `202609240002_payment_flow.sql` sudah sukses.
2. Pastikan `202609240003_pickup_shipping.sql` sudah sukses.
3. Jalankan `202609240004_admin_features.sql`.
4. Replace `src/admin.js` dan `src/styles.css`.
5. Restart Vite (`npm run dev`).

Jangan ubah:
- `admin.html`
- `src/lib/supabase.js`
- `src/lib/format.js`
- migration sebelumnya
