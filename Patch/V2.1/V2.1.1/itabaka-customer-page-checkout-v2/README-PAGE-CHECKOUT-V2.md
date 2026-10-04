# Itabaka Customer - Page Checkout v2

Flow:
1. Catalog (`index.html`) -> tambah produk ke keranjang.
2. Buka Keranjang -> klik Checkout.
3. Browser pindah ke `checkout.html`.
4. `checkout.html` berisi:
   - Step 1: data pemesan + pickup/shipping.
   - Step 2: DP/Full Payment + QRIS/blu by BCA Digital + upload bukti.
5. Setelah PO berhasil, browser pindah ke `invoice.html`.

Penyimpanan sementara antar halaman memakai `sessionStorage`.
Tidak ada SQL/migration baru.

File yang diganti/ditambah:
- replace `src/main.js`
- replace `src/styles.css`
- add `checkout.html`
- add `invoice.html`
- add `src/checkout.js`
- add `src/invoice.js`

Setelah pemasangan:
- `npm run dev`
- hard refresh (Ctrl+F5)

Catatan:
- Bukti pembayaran tidak disimpan di browser; file harus dipilih lagi bila halaman checkout di-refresh sebelum submit.
- Admin dashboard tidak perlu diganti untuk patch ini.
