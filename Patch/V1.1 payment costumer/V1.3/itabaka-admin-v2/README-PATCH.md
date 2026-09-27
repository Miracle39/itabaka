# Itabaka Admin Dashboard v2

Patch ini hanya memperbaiki `src/admin.js`.

## Perubahan
- Tidak lagi membaca `orders.pickup_method`
- Tidak lagi membaca `orders.notes`
- Menggunakan `orders.delivery_method`
- Menampilkan alamat hanya untuk pengiriman
- Menampilkan email, HP, metode pembayaran, DP/Full Payment
- Melihat bukti pembayaran dari bucket privat
- Verifikasi DP/LUNAS
- Tetap mendukung upload foto produk
- Tetap mendukung pengaturan branding, QRIS, BCA, dan DP

## Pemasangan
1. Backup project.
2. Ganti `src/admin.js` dengan file dari patch ini.
3. Tidak perlu menjalankan SQL tambahan.
4. Jalankan ulang `npm run dev`.
5. Buka `/admin.html`.
