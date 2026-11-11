PATCH ITABAKA — INVOICE CUSTOMER + BUKTI PELUNASAN ADMIN
Tanggal: 12 November 2026

TUJUAN
1. Invoice customer menampilkan QRIS dari site_settings.qris_image_url.
2. Invoice customer menampilkan nomor rekening dan nama rekening blu by BCA Digital dari site_settings.
3. Customer yang mengecek pesanan dapat mencetak / menyimpan invoice terkini sebagai PDF. Status invoice mengikuti customer_payment_status (DP/LUNAS), sehingga setelah bukti pelunasan berhasil dikirim, invoice PDF yang diunduh sudah berstatus LUNAS.
4. Halaman admin menampilkan bukti pertama dan bukti pelunasan secara terpisah. Ditambahkan fallback baca settlement_proof_path bila path tersimpan di orders tetapi baris SETTLEMENT tidak tersedia pada order_payments.

FILE YANG DIGANTI
- src/invoice.js
- src/order-status.js
- src/admin.js

CARA PASANG
1. Backup tiga file lama.
2. Salin file dalam folder src dari ZIP ke folder src project, timpa file dengan nama sama.
3. Jangan timpa vite.config.js. Pertahankan entri adminAllOrders yang sudah kamu tambahkan.
4. Tidak ada migration SQL baru untuk patch ini. Patch mengandalkan migration 202611120001_customer_order_lookup_and_settlement.sql yang sudah dipasang sebelumnya.
5. Pastikan pengaturan admin berisi gambar QRIS, nama pemilik rekening, dan nomor rekening. Data dibaca dari site_settings.
6. Jalankan npm run build. Setelah berhasil, tes di lokal sebelum commit/push manual.

TES YANG DISARANKAN
A. Invoice checkout baru: QRIS dan rekening terlihat di layar dan di Cetak/Simpan PDF.
B. Invoice DP: status kuning DP, nominal DP dan sisa pembayaran benar.
C. Cek Pesanan setelah pelunasan: status hijau LUNAS; klik Cetak/Simpan Invoice PDF; hasil PDF juga berstatus LUNAS.
D. Admin > Semua Order > Detail: tampil Bukti 1 · DP dan Bukti 2 · Pelunasan. Buka masing-masing bukti dan pastikan file benar.
E. Tandai bukti MATCHED/CONTACT: status invoice customer tidak berubah; hanya hasil pengecekan internal dan paid_amount yang diperbarui.

BATAS PENGUJIAN
- node --check berhasil untuk ketiga file JavaScript.
- Build Vite penuh dan tes Supabase/storage live tidak dapat dilakukan di sini karena file HTML utama project dan akses database live tidak tersedia dalam workspace.
