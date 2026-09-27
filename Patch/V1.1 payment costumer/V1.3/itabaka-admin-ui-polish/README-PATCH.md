# Itabaka — Pickup / Shipping Update

### Customer
- Ambil di Booth CF24
- Dikirim ke Alamat
- Alamat hanya tampil dan wajib ketika memilih pengiriman.
- Invoice menampilkan pilihan pengambilan/pengiriman dan alamat bila dikirim.

### File
Ganti:
- `src/main.js`
- `src/styles.css`

Tambahkan:
- `supabase/migrations/202609240003_pickup_shipping.sql`

### Database
Migration ini dijalankan setelah `202609240002_payment_flow.sql` berhasil.
Jangan hapus migration sebelumnya.


## UI polish

Versi ini hanya memperbarui `src/styles.css` untuk memperbaiki:
- lebar dan keseimbangan kolom
- panel Pesanan agar tidak memanjang kosong
- spacing dan margin
- ukuran tombol/input
- tabel pesanan
- daftar produk
- section branding/payment
- detail order dan modal bukti
- responsive mobile

Tidak ada perubahan database atau logic customer/admin.
