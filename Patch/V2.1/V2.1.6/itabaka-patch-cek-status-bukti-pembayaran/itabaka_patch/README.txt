PATCH ITABAKA - CEK STATUS QRIS/REKENING + BUKTI PEMBAYARAN ADMIN

File yang diganti:
- src/order-status.js
- src/admin.js

Perubahan:
1. Halaman Cek Pesanan menampilkan gambar QRIS, nomor rekening, dan nama pemilik rekening dari site_settings (pengaturan admin).
2. Tabel order admin menampilkan tombol Bukti 1 dan Bukti 2 secara terpisah jika file tersedia.
3. Detail order admin menampilkan bukti pembayaran awal dari orders.payment_proof_path sebagai fallback jika baris INITIAL belum ada di order_payments.
4. Bukti pelunasan tetap ditampilkan terpisah dan dibuka melalui bucket settlement-proofs.
5. Jika data bukti berada di order_payments, tombol membuka file berdasarkan payment_type dan bucket yang sesuai.

Cara pasang:
1. Backup src/order-status.js dan src/admin.js yang sekarang.
2. Ekstrak ZIP ini ke root project Itabaka, izinkan replace kedua file tersebut.
3. Jangan mengganti vite.config.js, file SQL, atau file lain.
4. Jalankan npm run build, lalu uji halaman Cek Pesanan dan halaman Admin.

Catatan validasi:
- Kedua file lolos pemeriksaan sintaks JavaScript (node --check).
- Build Vite belum dapat divalidasi di lingkungan pemeriksaan ini karena arsip node_modules hanya berisi binary Rollup Windows, bukan optional dependency Linux. Ini bukan error dari kode patch.
