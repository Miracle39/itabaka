PATCH ITABAKA - INVOICE CEK PESANAN SAMA DENGAN INVOICE AWAL

Isi patch:
- src/order-status.js
  * Menghapus tampilan QRIS, nomor rekening, dan nama pemilik rekening dari halaman hasil Cek Pesanan.
  * Tombol Cetak / Simpan Invoice membuka invoice.html dan menggunakan template invoice yang sama dengan invoice awal.
- src/invoice.js
  * Memakai tampilan invoice awal yang sudah tanpa QRIS dan rekening.
  * Jika status customer sudah LUNAS (termasuk DP yang sudah mengirim bukti pelunasan), nominal Dibayar menjadi total pesanan dan Sisa Pembayaran menjadi Rp0.

Pemasangan:
1. Backup src/order-status.js dan src/invoice.js.
2. Ekstrak folder src dari ZIP ke root project, lalu izinkan kedua file diganti.
3. Jangan mengganti vite.config.js atau file HTML.
4. Jalankan npm run build di project lokal.
5. Jika build berhasil, commit dan push sendiri ke GitHub.

Catatan:
- Tidak ada perubahan SQL atau alur upload bukti pelunasan.
- Tombol invoice pada Cek Pesanan akan membuka invoice.html di tab baru; izinkan pop-up jika browser memblokirnya.
