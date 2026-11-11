PATCH ITABAKA - LOGIKA PEMBAYARAN ADMIN SEMUA ORDER

File yang diganti:
  src/admin.js

Perubahan:
1. Label "Bayar sekarang" menjadi "Terbayar".
2. Menghapus keterangan "Terverifikasi internal" dari kolom Status.
3. "Sisa aktual" dihitung dari status pembayaran yang ditampilkan:
   - LUNAS (termasuk DP yang sudah mengunggah bukti pelunasan): Rp 0.
   - DP: total pesanan dikurangi nominal terbayar.
4. Verifikasi internal tetap terpisah. Upload bukti pelunasan tidak mengubah
   payment_status, paid_amount, atau payment_verified_at.

Cara memasang:
1. Backup src/admin.js.
2. Ekstrak ZIP di folder utama project dan izinkan file src/admin.js diganti.
3. Jalankan npm run build di komputer project.
4. Jika build berhasil, lakukan commit dan push secara manual.

Tidak ada perubahan SQL, vite.config.js, atau file lain.
