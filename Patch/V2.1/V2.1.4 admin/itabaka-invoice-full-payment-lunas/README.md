# Itabaka — Invoice Full Payment status LUNAS

Ganti file project `src/invoice.js` dengan file `src/invoice.js` dari ZIP ini.

Perubahan:
- Jika `payment_plan === "FULL"`, invoice customer langsung menampilkan status LUNAS.
- Badge status Full Payment berwarna hijau meskipun status database awal masih DP.
- Catatan invoice untuk Full Payment tidak lagi menyebut pengecekan saat serah-terima.
- Rencana DP tetap menampilkan status pengecekan saat serah-terima.
- Tidak ada perubahan SQL atau status pembayaran di database.
