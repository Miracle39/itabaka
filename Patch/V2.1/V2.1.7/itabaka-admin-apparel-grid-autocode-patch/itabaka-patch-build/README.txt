PATCH ADMIN ITABAKA — JENIS APPAREL + KODE OTOMATIS

Isi:
- apply-itabaka-admin-update.mjs : script patch untuk proyek lokal

Cara pakai:
1. Ekstrak file ZIP ini.
2. Salin apply-itabaka-admin-update.mjs ke folder utama proyek Itabaka (sejajar package.json).
3. Pastikan folder src berisi admin.js dan admin.css versi terbaru.
4. Buka terminal VS Code di folder utama proyek.
5. Jalankan: node apply-itabaka-admin-update.mjs
6. Jika berhasil, jalankan: npm run build
7. Cek halaman Produk, Jenis Apparel, dan alur tambah/edit produk.

Script membuat backup otomatis untuk src/admin.js dan src/admin.css.
Jika ada struktur kode yang tidak cocok, script berhenti dan tidak mengubah file.

Catatan:
- Kode lama tidak diubah.
- Produk baru mendapatkan ITB-001, ITB-002, ... untuk MERCHANDISE.
- Produk baru kategori TSHIRT/JACKET mendapatkan APP-001, APP-002, ...
- Nomor berikutnya dihitung dari nomor terbesar yang sudah ada untuk prefix terkait.
