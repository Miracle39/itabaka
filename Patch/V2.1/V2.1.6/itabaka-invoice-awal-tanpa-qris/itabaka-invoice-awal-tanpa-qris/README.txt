PATCH ITABAKA - INVOICE AWAL TANPA QRIS / NOMOR REKENING

Perubahan:
- Menghilangkan gambar QRIS dari invoice awal setelah checkout.
- Menghilangkan nomor rekening dan nama pemilik rekening dari invoice awal.
- Informasi rencana pembayaran, metode pembayaran, status bukti, nominal dibayar, dan sisa pembayaran tetap ada.
- Perubahan berlaku pada tampilan invoice dan hasil Cetak / Simpan PDF karena keduanya menggunakan markup invoice yang sama.

Pemasangan:
1. Backup src/invoice.js pada project.
2. Ekstrak ZIP ke folder utama project dan izinkan src/invoice.js diganti.
3. Jalankan npm run build.
4. Jika build berhasil, commit dan push secara manual.

Catatan: Patch hanya berisi src/invoice.js. Halaman Cek Pesanan (order-status.js) tidak diubah, sehingga QRIS dan rekening dari pengaturan tetap dapat ditampilkan di sana. Tidak ada SQL atau vite.config.js yang diubah.
