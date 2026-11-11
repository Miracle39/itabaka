# Itabaka — Apparel dinamis + voucher Apparel-only

Patch ini menyatukan kategori utama produk menjadi `MERCHANDISE` dan `APPAREL`, sekaligus menambahkan master data jenis Apparel yang dapat dikelola dari dashboard admin.

## Isi patch
- `src/admin.js`: dropdown jenis Apparel dibaca dari tabel `apparel_types`; admin dapat menambah jenis dan mengaktifkan/menonaktifkannya. Produk lama dan riwayat pesanan tetap dikenali.
- `src/main.js`: katalog mengenali kategori utama `APPAREL`.
- `src/checkout.js`: preview voucher mengirim daftar item agar server menghitung diskon hanya dari Apparel.
- `supabase/migrations/202611120002_apparel_unification_and_apparel_only_voucher.sql`: migrasi kategori, master data jenis Apparel, trigger snapshot kategori/jenis pada detail order, serta fungsi checkout dan voucher.

## Urutan pemasangan
1. Backup database Supabase terlebih dahulu.
2. Buka Supabase Dashboard → SQL Editor.
3. Jalankan seluruh isi file SQL migration satu kali.
4. Setelah SQL berhasil, ganti file `src/admin.js`, `src/main.js`, dan `src/checkout.js` pada project dengan file dari patch.
5. Jalankan `npm install` bila diperlukan, lalu `npm run build`.
6. Tes tambah/edit produk Merchandise, Kaos, dan Jaket.
7. Di halaman Produk admin, bagian **Jenis Apparel**, coba tambahkan contoh `Hoodie`. Setelah berhasil, dropdown jenis Apparel akan otomatis memuat Hoodie.
8. Tes voucher untuk Apparel-only dan keranjang campuran Apparel + Merchandise.
9. Commit/push ke GitHub secara manual seperti biasa.

## Cara mengelola jenis Apparel setelah dipasang
- Tambahkan jenis melalui bagian **Jenis Apparel** pada halaman Produk.
- Kode jenis dibuat otomatis dari nama (contoh `Hoodie` menjadi `HOODIE`).
- Jenis dapat dinonaktifkan/diaktifkan kembali.
- Jenis yang sudah digunakan produk tidak dihapus dari database; nonaktifkan saja agar data produk dan riwayat tetap aman.

## Perubahan data
- Produk lama kategori `TSHIRT` dan `JACKET` dipindahkan ke `APPAREL`.
- Kolom `apparel_type` menyimpan kode jenis yang terdaftar di `apparel_types`.
- `available_sizes` tidak diubah.
- Baris `order_items` lama tetap mempertahankan `product_category` TSHIRT/JACKET. Kolom `apparel_type` diisi untuk laporan.
- Baris pesanan baru menyimpan kategori `APPAREL` dan jenis Apparel terpisah melalui trigger.
- Voucher hanya menghitung subtotal produk `APPAREL`. Merchandise tidak mendapat diskon.
- Fungsi inti `create_public_order` 8-parameter tetap menangani validasi ukuran dan pengurangan stok; wrapper promo menghitung diskon hanya dari Apparel.

## Validasi yang dilakukan
- `node --check` pada `admin.js`, `main.js`, dan `checkout.js`.
- Build Vite belum dijalankan karena arsip project tidak menyertakan `node_modules`; jalankan `npm install` dan `npm run build` secara lokal sebelum deploy.
