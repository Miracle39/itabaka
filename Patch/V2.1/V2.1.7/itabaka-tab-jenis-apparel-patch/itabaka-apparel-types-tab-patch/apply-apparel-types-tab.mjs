import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const adminPath = path.join(root, 'src', 'admin.js');
const cssPath = path.join(root, 'src', 'admin.css');

function fail(message) {
  console.error(`\nPATCH DIHENTIKAN: ${message}\n`);
  process.exit(1);
}
if (!fs.existsSync(adminPath)) fail('File src/admin.js tidak ditemukan. Jalankan script dari folder utama proyek Itabaka.');
if (!fs.existsSync(cssPath)) fail('File src/admin.css tidak ditemukan. File ini yang dipakai halaman admin.');

let js = fs.readFileSync(adminPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');
if (js.includes('apparelTypesPagePatch')) {
  console.log('Tab Jenis Apparel sudah terpasang. Tidak ada perubahan baru.');
  process.exit(0);
}

// Hanya patch source yang sudah memiliki pengelolaan jenis apparel dinamis.
for (const marker of ['loadApparelTypes', 'addApparelType', 'toggleApparelType', 'Jenis Apparel']) {
  if (!js.includes(marker)) fail(`Kode terbaru belum lengkap: penanda "${marker}" tidak ditemukan. Pastikan src/admin.js adalah versi yang sudah memuat fitur Jenis Apparel dinamis.`);
}

const pageLine = 'const page = document.body.dataset.adminPage || "products";';
if (!js.includes(pageLine)) fail('Deklarasi halaman admin tidak ditemukan; source tampaknya berbeda dari versi yang dikirim.');
js = js.replace(pageLine,
  'const page = new URLSearchParams(window.location.search).get("page") || document.body.dataset.adminPage || "products"; // apparelTypesPagePatch');

const hrefAnchor = 'return target === "products" ? "/admin.html"';
if (!js.includes(hrefAnchor)) fail('Fungsi hrefFor() tidak cocok dengan versi source saat ini.');
js = js.replace(hrefAnchor,
  'return target === "products" ? "/admin.html"\n    : target === "apparelTypes" ? "/admin.html?page=apparelTypes"');

const navAnchor = '${nav("products","Produk")}';
if (!js.includes(navAnchor)) fail('Menu navigasi Produk tidak ditemukan.');
js = js.replace(navAnchor,
  `${navAnchor}\n            \${nav("apparelTypes","Jenis Apparel")}`);

// Ketika halaman Produk dirender (termasuk setelah menyimpan produk), lepaskan panel jenis apparel.
const renderCall = 'renderProductsPage();';
const callCount = js.split(renderCall).length - 1;
if (callCount < 2) fail('Pemanggilan renderProductsPage() tidak sesuai; patch tidak diterapkan agar tidak merusak halaman.');
js = js.split(renderCall).join(`${renderCall}\n    removeApparelTypesPanel();`);

const renderPageAnchor = 'async function renderPage() {';
if (!js.includes(renderPageAnchor)) fail('Fungsi renderPage() tidak ditemukan.');
const helper = `
// apparelTypesPagePatch: pindahkan panel pengelolaan jenis apparel ke tab khusus.
function findApparelTypesPanel() {
  const root = $("#pageContent");
  if (!root) return null;
  const heading = [...root.querySelectorAll("h1,h2,h3,h4,h5")]
    .find(el => /jenis\\s+apparel/i.test((el.textContent || "").trim()));
  if (!heading) return null;
  return heading.closest(".panel-card") || heading.closest("section") || heading.parentElement;
}

function removeApparelTypesPanel() {
  findApparelTypesPanel()?.remove();
}

function renderApparelTypesPage() {
  // Render panel memakai form dan event handler yang sudah ada agar logika CRUD tetap sama.
  renderProductsPage();
  const root = $("#pageContent");
  const panel = findApparelTypesPanel();
  if (!panel) {
    root.innerHTML = ` + '`' + `
      <section class="page-title-row">
        <div><div class="kicker">KATALOG</div><h1>Jenis Apparel</h1>
          <p class="muted">Kelola jenis apparel yang tersedia untuk produk.</p></div>
      </section>
      <div class="admin-message error">Panel Jenis Apparel tidak ditemukan pada halaman Produk. Periksa markup panel di src/admin.js.</div>` + '`' + `;
    return;
  }
  const heading = document.createElement("section");
  heading.className = "page-title-row";
  heading.innerHTML = ` + '`' + `
    <div><div class="kicker">KATALOG</div><h1>Jenis Apparel</h1>
      <p class="muted">Tambah, aktifkan, atau nonaktifkan jenis apparel tanpa memenuhi halaman Produk.</p></div>` + '`' + `;
  const layout = document.createElement("div");
  layout.className = "apparel-types-page-layout";
  panel.classList.add("apparel-types-panel");
  layout.append(panel);
  root.replaceChildren(heading, layout);
}

`;
js = js.replace(renderPageAnchor, helper + renderPageAnchor);

const productsBranch = 'if (page === "products") {';
if (!js.includes(productsBranch)) fail('Cabang halaman Produk di renderPage() tidak ditemukan.');
js = js.replace(productsBranch,
  'if (page === "apparelTypes") {\n    await Promise.all([loadProducts(), loadOrders(), loadApparelTypes()]);\n    renderApparelTypesPage();\n  } else if (page === "products") {');

// Prevent accidental partial writes: validate the key routing pieces before saving.
if (!js.includes('target === "apparelTypes"') || !js.includes('nav("apparelTypes","Jenis Apparel")') || !js.includes('page === "apparelTypes"')) {
  fail('Validasi internal patch gagal. File asli tidak disentuh.');
}

const backup = `${adminPath}.before-apparel-types-tab.bak`;
if (!fs.existsSync(backup)) fs.copyFileSync(adminPath, backup);
fs.writeFileSync(adminPath, js, 'utf8');

const cssAddition = `

/* Tab khusus pengelolaan jenis apparel */
.apparel-types-page-layout {
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
}
.apparel-types-panel {
  width: 100%;
  min-width: 0;
}
.apparel-types-panel .panel-head {
  align-items: flex-start;
}
@media (max-width: 760px) {
  .apparel-types-page-layout { max-width: 100%; }
  .apparel-types-panel { padding: 16px; }
}
`;
if (!css.includes('Tab khusus pengelolaan jenis apparel')) {
  if (!fs.existsSync(`${cssPath}.before-apparel-types-tab.bak`)) fs.copyFileSync(cssPath, `${cssPath}.before-apparel-types-tab.bak`);
  fs.writeFileSync(cssPath, css + cssAddition, 'utf8');
}

console.log('Berhasil: menu Jenis Apparel sekarang menjadi tab tersendiri di /admin.html?page=apparelTypes.');
console.log('Backup dibuat sebagai src/admin.js.before-apparel-types-tab.bak dan src/admin.css.before-apparel-types-tab.bak.');
