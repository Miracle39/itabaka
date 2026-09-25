# Circle Itabaka — Customer Payment Flow

Versi ini berfokus pada alur customer:

1. Pilih produk.
2. Isi nama, email, alamat, nomor HP.
3. Pilih **DP** atau **Full Payment**.
4. Pilih **QRIS** atau **Transfer Bank BCA Blue**.
5. Lihat nominal yang harus dibayar.
6. Upload bukti pembayaran.
7. PO dibuat dan invoice ditampilkan.

## DP

Persentase DP diatur admin melalui `site_settings.dp_percentage`.
Default `50`.

## Full Payment

Nominal pembayaran = seluruh total order.

## Bukti pembayaran

Format:
- PNG
- JPG/JPEG
- WEBP
- PDF

Maksimal 5 MB.

Bukti disimpan dalam bucket private `payment-proofs`.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Supabase:
1. Jalankan migration awal project.
2. Jalankan `supabase/migrations/202609240002_payment_flow.sql`.
3. Jalankan `supabase/seed.sql`.
4. Isi QRIS/BCA dari dashboard/admin atau langsung di `site_settings`.

Jangan commit `.env` dan jangan pernah menaruh service-role/secret key di frontend.

## Catatan

Versi ini membuat order sebagai status aktual `DP` dengan `paid_amount = 0`. Admin kemudian memverifikasi bukti pembayaran dan mencatat pembayaran/status aktual.
