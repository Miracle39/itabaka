CIRCLE ITABAKA - PROMO MEMBER PATCH
===================================

ISI PATCH
- supabase_promo_members.sql : tabel promo member, RLS admin, validasi promo publik, dan overload create_public_order 9 parameter.
- admin-promos.html : halaman pengelolaan promo member.
- src/admin-promos.js : tambah/edit/nonaktifkan/aktifkan/reset/hapus member.
- src/checkout.js : input kode promo, preview diskon, dan pengiriman kode ke RPC order.
- src/invoice.js : subtotal, kode promo, diskon, total akhir, dan nominal DP/Full Payment.
- src/admin.js : navigasi Promo Member, ringkasan tagihan pada detail dan cetak invoice, export kolom promo.
- vite.config.js : mendaftarkan halaman admin-promos pada build Vite.

LANGKAH PEMASANGAN
1. Backup project dan database terlebih dahulu.
2. Buka Supabase SQL Editor, jalankan seluruh isi supabase_promo_members.sql.
   SQL ini mengasumsikan fungsi public.create_public_order 8-parameter yang saat ini dipakai checkout sudah ada dan aktif.
3. Salin file di folder src ke folder src project, timpa file dengan nama yang sama.
4. Salin admin-promos.html ke root project (sejajar dengan admin.html dan checkout.html).
5. Timpa vite.config.js di root project.
6. Jalankan npm run build. Jika berhasil, uji lokal sebelum push manual ke GitHub.
7. Login admin, buka menu Promo Member, lalu buat satu kode uji.
8. Uji checkout dengan kode tersebut. Pastikan invoice menunjukkan subtotal, kode promo, diskon, total akhir, dan DP/Full Payment berdasarkan total akhir.

CATATAN KEAMANAN DAN PERILAKU
- Kode disimpan uppercase dan spasi berurutan dinormalisasi; contoh D 1234 ABC.
- Kode hanya dapat dipakai satu kali. Penguncian FOR UPDATE di fungsi pembuatan order mencegah dua checkout memakai kode yang sama secara bersamaan.
- Preview promo tidak mengunci/menghabiskan kode. Kode baru ditandai terpakai setelah order berhasil dibuat.
- Admin page dan akses tabel dibatasi ke user authenticated dengan profiles.role = 'admin'.
- Diskon persen dibatasi 1-99%. Diskon rupiah dibatasi agar total akhir tetap minimal Rp1.
- Jika kode sudah dipakai, admin dapat menekan Reset Pakai. Nonaktifkan untuk sementara atau hapus jika tidak diperlukan.
- File checkout dan invoice mempertahankan alur upload bukti pembayaran yang sudah ada.

PENGUJIAN YANG WAJIB
- Kode valid persen dan nominal tetap.
- Kode salah, nonaktif, dan kode yang sudah digunakan.
- Dua checkout hampir bersamaan dengan kode sama (hanya satu yang boleh berhasil).
- DP dan Full Payment setelah diskon.
- Reset kode oleh admin lalu gunakan kembali.
- Order tanpa kode promo tetap berhasil dan nominalnya sama seperti sebelumnya.
- Jalankan build dan cek Console/Network browser untuk error RPC atau RLS.

PENTING
Patch ini belum dijalankan terhadap database Supabase milik Anda. Jalankan SQL di salinan/staging terlebih dahulu dan verifikasi hasilnya sebelum production. Saya tidak melakukan commit atau push GitHub.
