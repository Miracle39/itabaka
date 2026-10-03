# Itabaka Admin — 4 Page + UI Polish Patch

## Struktur
1. `admin.html` — Dashboard + tambah produk + katalog lengkap + export Excel
2. `admin-orders.html` — Order Merchandise + search + pagination 5/10/25/50/100
3. `admin-apparel.html` — Order Kaos/Jaket + rekap size + search + pagination
4. `admin-settings.html` — semua pengaturan

## UI
- Font admin diperbesar.
- Layout memakai lebar layar lebih maksimal.
- Panel dan tabel diberi spacing yang lebih lega.
- Produk ditampilkan sebagai kartu katalog.

## Export
Tombol `Export Semua Order ke Excel` di halaman 1 membuat `.xlsx` dengan sheet:
- Semua Order
- Order Merchandise
- Order Kaos-Jaket
- Rekap Size

Tidak memerlukan package Excel tambahan.

## Apparel / size
Migration `202609240005_apparel_categories.sql` menambahkan:
- `products.category`: MERCHANDISE / TSHIRT / JACKET
- `products.available_sizes`
- `order_items.product_category`
- `order_items.size`

Customer page juga ditambahkan pilihan size saat produk kaos/jaket dipilih.

## Pemasangan
1. Backup project.
2. Ganti `admin.html`.
3. Tambahkan `admin-orders.html`, `admin-apparel.html`, `admin-settings.html`.
4. Ganti `src/admin.js`.
5. Tambahkan `src/admin.css`.
6. Ganti `src/main.js` dan `src/styles.css` dari patch ini.
7. Jalankan migration `supabase/migrations/202609240005_apparel_categories.sql` setelah migration payment + pickup sebelumnya sudah sukses.
8. `npm run dev`.

Jangan jalankan ulang migration lama.
