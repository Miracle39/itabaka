PATCH ITABAKA — EMAIL & NOMOR TELEPON DI INVOICE CEK PESANAN

Penyebab:
RPC public.lookup_public_order sebelumnya tidak menyertakan customer_email dan
customer_phone pada objek JSON 'order'. Akibatnya invoice Cek Pesanan menampilkan
tanda '-' meskipun data pelanggan tersimpan di tabel orders.

Cara memasang:
1. Buka Supabase Dashboard → SQL Editor.
2. Buka file supabase/fix_lookup_public_order_email_phone.sql.
3. Salin seluruh isinya ke SQL Editor lalu jalankan.
4. Tes Cek Pesanan menggunakan invoice dan nomor HP yang benar.

Perubahan:
- Menambahkan customer_email ke JSON order.
- Menambahkan customer_phone ke JSON order, dengan fallback customer_contact.
- Mempertahankan validasi pencarian, detail item, detail pembayaran, dan token pelunasan.
- Tidak mengubah desain invoice, tabel lain, atau fungsi upload bukti pembayaran.

Catatan:
Patch ini memperbaiki sumber data. Tampilan invoice tetap memakai template invoice
bersama yang digunakan setelah checkout awal, selama src/invoice.js dan
src/order-status.js dari patch invoice sebelumnya masih terpasang.
