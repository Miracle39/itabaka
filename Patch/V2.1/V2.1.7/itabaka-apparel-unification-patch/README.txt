# Itabaka — Unifikasi kategori Apparel

## Isi patch
- `src/admin.js`: kategori produk utama Merchandise/Apparel, pilihan jenis Kaos/Jaket, dukungan data pesanan lama dan baru, rekap ukuran.
- `src/main.js`: katalog mengenali kategori utama `APPAREL`.
- `src/checkout.js`: preview voucher mengirim daftar item, bukan subtotal seluruh keranjang.
- `supabase/migrations/202611120002_apparel_unification_and_apparel_only_voucher.sql`: migrasi database dan fungsi voucher.

## Urutan pemasangan
1. Backup database Supabase terlebih dahulu.
2. Buka Supabase Dashboard → SQL Editor.
3. Jalankan seluruh isi file SQL migration satu kali.
4. Setelah SQL berhasil, ganti file `src/admin.js`, `src/main.js`, dan `src/checkout.js` pada project dengan file dari patch.
5. Jalankan `npm install` bila dependency lokal bermasalah, lalu `npm run build`.
6. Tes tambah/edit produk Merchandise, Kaos, dan Jaket; tes keranjang campuran; tes voucher pada Apparel-only dan keranjang campuran.
7. Commit/push ke GitHub secara manual seperti biasa.

## Perubahan data
- Produk lama kategori `TSHIRT` dan `JACKET` dipindahkan ke `APPAREL`.
- Kolom `apparel_type` menyimpan `TSHIRT` atau `JACKET`.
- `available_sizes` tidak diubah.
- Baris `order_items` lama tetap mempertahankan `product_category` TSHIRT/JACKET. Kolom `apparel_type` diisi untuk laporan.
- Baris pesanan baru menyimpan kategori `APPAREL` dan jenis Apparel terpisah melalui trigger.
- Voucher hanya menghitung subtotal produk `APPAREL`. Merchandise tidak mendapat diskon.
- Fungsi inti `create_public_order` 8-parameter diperbarui agar tetap memvalidasi ukuran Apparel dan mengurangi stok.

## Catatan pengujian
Syntax JavaScript diperiksa dengan `node --check` dan lolos.
Build Vite belum dapat diverifikasi di lingkungan ini karena paket native Rollup `@rollup/rollup-linux-x64-gnu` tidak tersedia pada `node_modules` di arsip. Ini masalah dependency lokal arsip, bukan hasil error syntax source.
