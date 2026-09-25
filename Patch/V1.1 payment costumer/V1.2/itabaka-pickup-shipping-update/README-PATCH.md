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
