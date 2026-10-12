# Itabaka Admin Order Workflow Improvements

Patch ini memperbarui `src/admin.js`, `src/admin.css`, `vite.config.js`, dan menambahkan `admin-all-orders.html`.

## Perubahan
- Menambah tab **Semua Order** yang menampilkan setiap nomor invoice sekali beserta seluruh item dalam invoice tersebut, termasuk Merchandise + Kaos/Jaket jika dibeli bersamaan.
- Mempertahankan tab Merchandise dan Kaos/Jaket sebagai filter kerja admin.
- Detail card dan rekap ukuran pada tab Kaos/Jaket tetap dipertahankan.
- Setiap baris order memiliki tombol **Invoice** untuk membuka invoice yang bisa dilihat ulang dan dicetak/disimpan sebagai PDF. Invoice memuat logo dari Media Admin jika tersedia.
- Tombol **Edit Pembayaran** membuka modal untuk memilih DP/LUNAS dan mengubah nominal. Jika LUNAS, nominal diisi otomatis sama dengan total order.

## Pasang
1. Backup project.
2. Ganti `src/admin.js`, `src/admin.css`, dan `vite.config.js` dari patch ini.
3. Tambahkan `admin-all-orders.html` di folder root.
4. Jalankan `npm run build` dan pastikan `dist/admin-all-orders.html` terbentuk.
5. Commit dan push manual ke GitHub agar deployment Vercel diperbarui.

Tidak ada perubahan SQL atau skema database.
