# Itabaka Customer - Staged Checkout Patch v1

Patch customer-side flow menjadi bertahap:

1. Catalog: pilih produk -> Tambah ke Keranjang
2. Keranjang: dibuka lewat tombol Keranjang, muncul sebagai side drawer/popup
3. Checkout Step 1: Data Pemesan
4. Checkout Step 2: Pembayaran + upload bukti
5. Invoice: muncul sebagai halaman/section hasil order setelah PO berhasil

Yang dipertahankan:
- Supabase RPC `create_public_order`
- upload bukti ke bucket `payment-proofs`
- pilihan DP / Full Payment
- QRIS / blu by BCA Digital
- pickup booth / kirim ke alamat
- pilihan ukuran apparel
- invoice + cetak/simpan PDF

Cara pasang:
- Replace `src/main.js` dengan `main.js` dari patch.
- Replace `src/styles.css` dengan `styles.css` dari patch.
- Tidak perlu SQL/migration baru.
- Jalankan `npm run dev`, lalu hard refresh browser.

Catatan:
- Patch ini hanya mengubah customer flow/UI.
- Admin dashboard tidak perlu diganti untuk patch ini.
