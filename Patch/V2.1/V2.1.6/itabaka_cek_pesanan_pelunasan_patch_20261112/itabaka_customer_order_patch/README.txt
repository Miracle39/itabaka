PATCH ITABAKA — CEK PESANAN & PELUNASAN DP
Tanggal: 12 November 2026

FITUR
- Customer membuka halaman Cek Pesanan dari katalog.
- Pencarian memakai nomor invoice + nomor HP, tanpa OTP.
- Halaman menampilkan ringkasan pesanan dan riwayat bukti pembayaran.
- Pesanan DP dapat mengunggah bukti pelunasan kedua (maksimal 2 MB).
- Setelah bukti pelunasan berhasil diunggah dan tercatat di database, status invoice customer langsung menjadi LUNAS.
- Admin melihat bukti pertama (DP/FULL) dan bukti kedua (pelunasan) secara terpisah.
- Admin dapat menandai tiap bukti: Belum dicek, Sesuai, atau Perlu hubungi customer, menyesuaikan nominal aktual, dan menyimpan catatan internal.
- Jika status internal MATCHED, database menghitung paid_amount dari jumlah bukti yang cocok. remaining_amount tetap generated oleh database.
- Status customer_payment_status terpisah dari payment_status internal; pengecekan internal tidak menahan status invoice customer.

FILE YANG DISALIN
1. src/main.js
2. src/invoice.js
3. src/admin.js
4. src/order-status.js (file baru)
5. order-status.html (file baru di root)
6. vite.config.js (root)
7. supabase/migrations/202611120001_customer_order_lookup_and_settlement.sql (file baru)

LANGKAH PEMASANGAN
1. Backup database Supabase dan project lokal.
2. Salin file sesuai daftar di atas, pertahankan file lain yang tidak ada di ZIP.
3. Buka Supabase SQL Editor, jalankan seluruh isi migration SQL satu kali.
4. Jika Supabase/PostgREST belum mengenali relasi order_payments, buka Settings/API atau jalankan NOTIFY pgrst, 'reload schema'; lalu tunggu schema cache dimuat ulang.
5. Jalankan npm run build. Pastikan Vite menemukan order-status.html dan halaman HTML admin yang sudah ada di project.
6. Tes di preview/development sebelum commit dan push manual ke GitHub.

SKENARIO TES WAJIB
A. FULL
- Checkout pilih FULL dan unggah bukti pertama.
- Invoice langsung hijau/LUNAS.
- Cari invoice + HP di Cek Pesanan.
- Admin membuka Detail dan melihat Bukti 1 · Full Payment.
- Tandai MATCHED setelah nominal di rekening cocok; paid_amount menjadi total.

B. DP lalu pelunasan
- Checkout pilih DP dan unggah bukti pertama.
- Invoice langsung kuning/DP.
- Cari invoice + HP di Cek Pesanan; form Upload Bukti Pelunasan tampil.
- Isi nominal transfer aktual dan unggah bukti kedua.
- Status invoice langsung hijau/LUNAS tanpa menunggu admin.
- Admin membuka Detail dan melihat dua bukti secara terpisah.
- Tandai masing-masing MATCHED jika sesuai, atau CONTACT jika perlu menghubungi customer via WhatsApp.
- paid_amount hanya menjumlahkan bukti yang berstatus MATCHED; remaining_amount dihitung otomatis.

C. Pengamanan alur
- Coba invoice benar + HP salah: tidak boleh menampilkan data pesanan.
- Coba upload pelunasan kedua kali: harus ditolak.
- Coba file lebih dari 2 MB atau tipe selain PNG/JPG/WEBP/PDF: harus ditolak.
- Coba pesanan FULL mengunggah pelunasan: tidak boleh tersedia.

CATATAN KEAMANAN
- Sesuai keputusan, fitur tidak memakai OTP. Siapa pun yang mengetahui nomor invoice dan nomor HP yang tepat dapat melihat ringkasan pesanan terbatas. Customer sebaiknya menjaga kedua informasi tersebut.
- Endpoint lookup hanya mengembalikan satu pesanan yang cocok; tidak ada akses SELECT publik langsung ke orders atau order_payments.
- Bukti pembayaran disimpan di bucket privat. Hanya admin yang dapat membuat signed URL untuk melihat bukti.
- Jangan menganggap status LUNAS customer sebagai bukti transfer sudah diverifikasi. Itu adalah status yang dilaporkan customer. Pemeriksaan internal tersimpan terpisah.

BATAS PENGUJIAN
JavaScript diperiksa dengan node --check. ZIP diuji integritasnya. SQL perlu dijalankan di Supabase milik project untuk validasi runtime; sesi ini tidak memiliki akses langsung ke database Supabase dan tidak dapat menguji transaksi/storage live.
