PATCH JENIS APPAREL — ITABAKA

Isi:
- apply_patch.py: patch otomatis untuk admin.js.
- Tidak ada file .mjs.
- Tidak mengubah vite.config.js, SQL, atau file lain.

CARA PAKAI
1. Ekstrak ZIP ini ke folder utama proyek Itabaka.
2. Buka terminal VS Code di folder proyek.
3. Jalankan: python apply_patch.py
   Jika perlu: py apply_patch.py
4. Script mencari ./src/admin.js atau ./admin.js.
5. Backup asli dibuat sebagai admin.js.bak.

Jika script berhenti karena pola kode tidak cocok, jangan paksa atau ubah file.
Kirimkan pesan error-nya agar patch disesuaikan dengan versi admin.js kamu.

Perubahan:
- Tombol status memakai type.code.
- Tombol mengirim status berikutnya sebagai parameter kedua.
- Heading panel bawah disembunyikan, bukan dihapus, agar struktur panel/form/daftar tetap utuh.
