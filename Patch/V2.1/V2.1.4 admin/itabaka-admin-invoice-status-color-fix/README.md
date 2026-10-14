# Itabaka — Admin invoice badge color fix

Ganti `src/admin.js` dengan file yang disediakan sebagai `src/admin.js` di ZIP ini.

Perubahan hanya pada invoice yang dibuka melalui tombol Invoice di admin:
- Status LUNAS menggunakan badge hijau.
- Status DP atau CEK SAAT SERAH TERIMA menggunakan badge kuning.
- Class warna diikat ke teks status efektif yang sudah digunakan oleh halaman invoice admin.

Tidak mengubah SQL atau data pembayaran.
