PATCH ITABAKA - INFORMASI PEMESAN PADA INVOICE

Perubahan:
- Bagian Pemesan menampilkan Email dan No. Telepon dengan label yang jelas.
- Menghapus baris status bukti pembayaran "Bukti ✓ Berhasil diunggah" / "Perlu pengecekan admin" dari invoice.
- Tidak mengubah tampilan invoice lainnya, halaman Cek Pesanan, atau alur pembayaran.

Pemasangan:
1. Backup file src/invoice.js.
2. Salin invoice.js dari folder src pada ZIP ini ke src/invoice.js (replace file lama).
3. Jalankan npm run build.
4. Jika berhasil, commit dan push sendiri ke GitHub.

Catatan: Invoice memakai data customer_email dan customer_phone (fallback customer_contact) yang dikirim oleh data pesanan.
