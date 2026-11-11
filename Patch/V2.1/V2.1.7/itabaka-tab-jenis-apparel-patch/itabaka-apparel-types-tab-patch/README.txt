PATCH TAB BARU: JENIS APPAREL — CIRCLE ITABAKA

Tujuan:
- Memindahkan panel pengelolaan Jenis Apparel dari halaman Produk ke tab admin tersendiri.
- Menambahkan menu navigasi "Jenis Apparel".
- Memakai kembali fungsi/form CRUD yang sudah ada (addApparelType dan toggleApparelType), sehingga tidak membuat tabel atau fungsi database baru.
- Tidak mengubah SQL, Supabase schema, invoice, checkout, pesanan, maupun vite.config.js.

CARA PASANG
1. Ekstrak ZIP ini.
2. Salin file apply-apparel-types-tab.mjs ke folder utama proyek Itabaka (sejajar dengan package.json).
3. Pastikan src/admin.js adalah versi terbaru yang sudah memiliki loadApparelTypes, addApparelType, toggleApparelType, dan panel "Jenis Apparel".
4. Buka terminal VS Code pada folder utama proyek.
5. Jalankan:
      node apply-apparel-types-tab.mjs
6. Jika muncul pesan berhasil, hapus file script patch dari folder utama (opsional).
7. Jalankan website lokal dan buka Admin → menu Jenis Apparel.
8. Periksa halaman Produk: panel pengelolaan Jenis Apparel sudah tidak muncul di bawah katalog.

CATATAN PENTING
- Script sengaja memeriksa source sebelum mengubah file. Jika penanda fitur dinamis tidak ditemukan, script berhenti tanpa mengubah apa pun.
- Script membuat backup otomatis file src/admin.js dan src/admin.css sebelum perubahan.
- Tab baru memakai URL /admin.html?page=apparelTypes. Tidak perlu membuat file HTML baru dan tidak perlu mengubah vite.config.js.
- Halaman admin mengimpor src/admin.css, bukan src/styles.css. Karena itu styling tab ditambahkan ke src/admin.css.
- Jika navigasi belum berubah setelah patch, lakukan hard refresh (Ctrl + Shift + R).
