from pathlib import Path
import sys

CANDIDATES = [Path("src/admin.js"), Path("admin.js")]
admin = next((p for p in CANDIDATES if p.is_file()), None)

if admin is None:
    print("GAGAL: admin.js tidak ditemukan. Jalankan dari folder utama proyek.")
    sys.exit(1)

source = admin.read_text(encoding="utf-8")
updated = source

replacements = [
    (
        'data-toggle-apparel-type="${type.id}"',
        'data-toggle-apparel-type="${escapeHtml(type.code || "")}" data-next-active="${type.is_active ? "false" : "true"}"',
        "atribut tombol Jenis Apparel"
    ),
    (
        'button.addEventListener("click", () => toggleApparelType(button.dataset.toggleApparelType));',
        'button.addEventListener("click", () => toggleApparelType(button.dataset.toggleApparelType, button.dataset.nextActive === "true"));',
        "event listener toggle Jenis Apparel"
    ),
]

for old, new, label in replacements:
    count = updated.count(old)
    if count != 1:
        print(f"GAGAL: {label} harus ditemukan tepat 1 kali, ditemukan {count} kali.")
        print("Tidak ada perubahan yang disimpan.")
        sys.exit(2)
    updated = updated.replace(old, new, 1)

old_heading = (
    '  // Hapus judul dan deskripsi duplikat di panel bawah.\n'
    '  const panelHeading = panel.querySelector(".panel-head");\n'
    '  if (panelHeading) {\n'
    '    panelHeading.querySelector("h2")?.remove();\n'
    '    panelHeading.querySelector("p")?.remove();\n'
    '\n'
    '    if (!panelHeading.textContent.trim() && !panelHeading.querySelector("*")) {\n'
    '      panelHeading.remove();\n'
    '    }\n'
    '  }'
)

new_heading = (
    '  // Sembunyikan heading panel bawah karena judul halaman sudah tampil di atas.\n'
    '  // Jangan hapus elemen panel-head agar struktur panel/form tetap aman.\n'
    '  const panelHeading = panel.querySelector(".panel-head");\n'
    '  if (panelHeading) {\n'
    '    panelHeading.style.display = "none";\n'
    '  }'
)

count = updated.count(old_heading)
if count != 1:
    print(f"GAGAL: blok heading duplikat harus ditemukan tepat 1 kali, ditemukan {count} kali.")
    print("Tidak ada perubahan yang disimpan.")
    sys.exit(3)

updated = updated.replace(old_heading, new_heading, 1)

backup = admin.with_suffix(admin.suffix + ".bak")
if backup.exists():
    print(f"GAGAL: backup sudah ada ({backup}). Pindahkan/ubah nama backup lama dahulu.")
    print("Tidak ada perubahan yang disimpan.")
    sys.exit(4)

backup.write_text(source, encoding="utf-8")
admin.write_text(updated, encoding="utf-8")

print(f"BERHASIL: {admin} sudah diperbaiki.")
print(f"Backup asli: {backup}")
print("Silakan uji halaman Admin > Jenis Apparel.")
