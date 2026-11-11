PATCH ITABAKA — NOMINAL PELUNASAN TERKUNCI

File yang diganti:
- src/order-status.js

Perubahan:
1. Kolom Nominal transfer pelunasan dibuat readonly (tidak bisa diedit).
2. Nilainya tetap otomatis dihitung dari Total Pesanan dikurangi Nominal Awal.
3. Saat submit, nominal yang dikirim ke RPC dihitung ulang dari data order, bukan membaca nilai input.
4. Upload bukti, validasi file maksimal 2 MB, lookup order, dan pembukaan invoice tetap dipertahankan.

Pemasangan:
Ganti src/order-status.js di project dengan file dari ZIP ini.
Tidak ada perubahan SQL atau file lain.
