# Fix customer blank page

Penyebab: syntax error di `src/main.js` pada template invoice.

Perubahan:
- `: }` diperbaiki menjadi `: ""` pada bagian tampilan ukuran item invoice.

Install:
1. Replace `src/main.js` dengan file dari patch ini.
2. Restart `npm run dev`.
3. Hard refresh browser (Ctrl+Shift+R).

Tidak perlu menjalankan migration SQL lagi.
