# Itabaka checkout validation patch

## Isi ZIP
- `src/checkout.js`: validasi nama, nomor HP, ukuran file bukti pembayaran, dan ringkasan hanya di langkah pembayaran.
- `supabase/limit_payment_proof_2mb.sql`: opsi perintah satu kali untuk membatasi ukuran bucket `payment-proofs` di sisi Supabase menjadi 2 MiB juga.

## Aturan input
- Nama wajib diisi sebagai teks dan tidak boleh hanya angka.
- Nomor HP hanya digit, 8–15 angka. Nilai tetap disimpan sebagai teks agar angka nol di depan tidak hilang.
- Bukti pembayaran menerima PNG, JPG/JPEG, WEBP, dan PDF dengan batas 2 MiB.
- File terlalu besar/format yang tidak didukung ditolak sebelum order dibuat.
- Ringkasan tetap disembunyikan pada langkah Data Pemesan dan muncul di langkah Pembayaran.

## Cara memasang
1. Ganti `src/checkout.js` dengan file di ZIP.
2. Buka file SQL di Supabase SQL Editor dan jalankan sekali untuk menegakkan batas 2 MiB pada storage bucket, bukan hanya di browser.
3. Jalankan `npm run build`, lalu commit dan push secara manual.


## Customer field feedback update
- Nama accepts Unicode letters and spaces only. Invalid characters are removed while typing and a visible inline message explains the rule.
- Nomor HP keeps only digits, preserves leading zeroes, and shows an inline message when non-numeric characters are typed or pasted. Length is validated as 8–15 digits.
