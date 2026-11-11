PATCH ADMIN CIRCLE ITABAKA
Jenis Apparel Grid + Kode Produk Otomatis + Lebar Halaman

ISI PATCH
- Mengubah daftar Jenis Apparel dari tabel panjang menjadi kartu-kartu grid responsif.
- Menempatkan tab Jenis Apparel setelah tab Kaos / Jaket dan sebelum Promo Member.
- Memastikan halaman Jenis Apparel memakai lebar konten admin penuh, sama seperti tab admin lain.
- Membuat kode produk otomatis:
    Merchandise -> ITB-001, ITB-002, ...
    Apparel     -> APP-001, APP-002, ...
  Nomor berikutnya dihitung dari kode yang sudah ada di database, bukan dari jumlah produk.
- Kode produk lama tidak diubah saat produk diedit.
- Tidak menambah tabel, mengubah SQL, atau mengubah checkout/invoice.
- Tidak mengubah vite.config.js.

CARA MEMASANG
1. Ekstrak ZIP ini.
2. Salin file apply-itabaka-admin-ui-patch.mjs ke folder utama proyek Itabaka (sejajar dengan package.json).
3. Buka terminal VS Code pada folder utama proyek.
4. Jalankan:
      node apply-itabaka-admin-ui-patch.mjs
5. Jika berhasil, script akan membuat backup:
      src/admin.js.before-admin-ui-patch.bak
      src/admin.css.before-admin-ui-patch.bak
6. Jalankan website lokal dan periksa tab Admin.

PENGUJIAN YANG DISARANKAN
- Buka tab Jenis Apparel: tab berada di antara Kaos / Jaket dan Promo Member.
- Pastikan daftar jenis tampil dalam beberapa kolom dan menyesuaikan layar.
- Buka tab Produk, pilih Merchandise: preview kode memakai awalan ITB.
- Pilih Apparel: preview kode memakai awalan APP.
- Simpan produk baru dan pastikan kode baru melanjutkan nomor terbesar yang sudah ada.
- Edit produk lama dan pastikan kode lamanya tetap sama.

CATATAN
- Script mengubah file yang sudah ada secara terarah agar perubahan invoice, checkout, dan fitur lain di src/admin.js tetap dipertahankan.
- Script memeriksa beberapa penanda source. Jika struktur file tidak cocok, script berhenti tanpa menulis perubahan.
- Jalankan script dari folder utama proyek, bukan dari folder src.
