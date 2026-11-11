# Itabaka hotfix — 12 November 2026

## Isi patch
- `sql/20261112_001_fix_public_order_subtotal_and_booth_address.sql`: memperbaiki pembacaan subtotal pada overload `create_public_order` 9 parameter dan mengizinkan `customer_address = NULL` untuk pesanan booth.
- `checkout.js`: menangani error RPC/koneksi secara aman agar tombol konfirmasi tidak tertinggal disabled; memvalidasi respons RPC sebelum mengunggah bukti.
- `invoice.js`: mengganti label `Dibayar` menjadi `Nominal pembayaran dipilih`, karena nilai invoice adalah nominal sesuai rencana customer dan belum berarti pembayaran diverifikasi admin.

## Cara menerapkan
1. Backup database / simpan definisi fungsi SQL aktif terlebih dahulu.
2. Buka Supabase SQL Editor dan jalankan file SQL hotfix satu kali.
3. Ganti `src/checkout.js` dan `src/invoice.js` dengan file pada ZIP ini.
4. Jalankan build lokal (`npm run build`) dan tes checkout di lingkungan staging/test sebelum deploy.
5. Tes minimal: BOOTH_CF24 tanpa alamat + DP, BOOTH_CF24 tanpa alamat + FULL, SHIP_TO_ADDRESS dengan alamat + DP/FULL, pesanan dengan promo, produk apparel dengan ukuran, dan stok tidak mencukupi.

## Catatan keamanan/operasional
- Patch tidak menghapus overload 5/7/8 parameter dan tidak mengubah pesanan lama.
- Fungsi 9 parameter tetap menjadi entry point yang dipanggil checkout.
- Jika transaksi create order gagal, transaksi PostgreSQL akan rollback sehingga perubahan stok dan order dalam fungsi tersebut ikut batal.
- Upload bukti gagal setelah order berhasil tetap menghasilkan invoice dengan peringatan; jangan mengulang submit secara membabi buta karena order sudah tercipta.
- Saya tidak dapat menguji SQL terhadap project Supabase live dari sesi ini. SQL menggunakan pemeriksaan pola dan akan berhenti dengan exception jika definisi fungsi aktif berbeda dari yang dikirim.
