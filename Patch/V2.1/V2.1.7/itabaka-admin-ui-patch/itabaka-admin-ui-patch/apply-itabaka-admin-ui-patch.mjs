import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const adminPath = path.join(root, 'src', 'admin.js');
const cssPath = path.join(root, 'src', 'admin.css');

function fail(message) {
  console.error(`\nPATCH DIHENTIKAN: ${message}\nTidak ada file yang diubah.\n`);
  process.exit(1);
}
if (!fs.existsSync(adminPath)) fail('src/admin.js tidak ditemukan. Jalankan script dari folder utama proyek.');
if (!fs.existsSync(cssPath)) fail('src/admin.css tidak ditemukan.');

let js = fs.readFileSync(adminPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');
if (js.includes('itabakaAdminUiPatch') && css.includes('/* Jenis Apparel: halaman penuh dengan daftar berbentuk grid */')) {
  console.log('Patch Jenis Apparel sudah terpasang. Tidak ada perubahan baru.');
  process.exit(0);
}
const originalJs = js;
const originalCss = css;

// 1) Route tab khusus tetap memakai admin.html, sehingga tidak perlu HTML baru.
if (js.includes('const page = document.body.dataset.adminPage || "products";')) {
  js = js.replace(
    'const page = document.body.dataset.adminPage || "products";',
    'const page = new URLSearchParams(window.location.search).get("page") || document.body.dataset.adminPage || "products";'
  );
}
if (js.includes('function hrefFor(target) {')) {
  if (!/target\s*===\s*["']apparelTypes["']/.test(js.slice(js.indexOf('function hrefFor(target) {'), js.indexOf('\n}', js.indexOf('function hrefFor(target) {'))))) {
    const anchor = 'return target === "products" ? "/admin.html"';
    if (!js.includes(anchor)) fail('Rute Produk pada hrefFor() tidak ditemukan.');
    js = js.replace(anchor, `${anchor}\n    : target === "apparelTypes" ? "/admin.html?page=apparelTypes"`);
  }
} else {
  fail('Fungsi hrefFor() tidak ditemukan.');
}

// Pastikan menu berada tepat setelah Kaos/Jaket dan sebelum Promo Member.
const typesNav = '${nav("apparelTypes","Jenis Apparel")}';
const apparelNavPattern = /\$\{nav\(\s*["']apparel["']\s*,\s*["']Kaos\s*\/\s*Jaket["']\s*\)\}/;
const promoNavPattern = /\$\{nav\(\s*["']promos["']\s*,\s*["']Promo Member["']\s*\)\}/;
js = js.replace(/\$\{nav\(\s*["']apparelTypes["']\s*,\s*["']Jenis Apparel["']\s*\)\}/g, '');
const apparelNavMatch = js.match(apparelNavPattern);
if (apparelNavMatch && promoNavPattern.test(js)) {
  js = js.replace(apparelNavMatch[0], `${apparelNavMatch[0]}\n            ${typesNav}`);
} else if (!js.includes(typesNav)) {
  fail('Urutan menu Kaos/Jaket dan Promo Member tidak ditemukan.');
}

// 2) Daftar jenis apparel diubah menjadi kartu grid.
const managerStart = js.indexOf('function renderApparelTypeManager() {');
if (managerStart < 0) fail('Fungsi renderApparelTypeManager() tidak ditemukan.');
const managerEnd = js.indexOf('\nasync function addApparelType', managerStart);
if (managerEnd < 0) fail('Batas fungsi renderApparelTypeManager() tidak ditemukan.');
const gridFunction = `function renderApparelTypeManager() {
  const target = $("#apparelTypeList");
  if (!target) return;
  target.innerHTML = apparelTypes.length ? 
    \`<div class="apparel-type-grid">
      \${apparelTypes.map(type => \`
        <article class="apparel-type-card">
          <div class="apparel-type-card-top">
            <span class="status-pill \${type.is_active ? "active" : "inactive"}">\${type.is_active ? "AKTIF" : "NONAKTIF"}</span>
            <code>\${escapeHtml(type.code)}</code>
          </div>
          <h3>\${escapeHtml(type.name)}</h3>
          <p>\${type.is_active ? "Tersedia untuk produk apparel baru." : "Nonaktif untuk produk baru; produk lama tetap tersimpan."}</p>
          <button class="btn ghost full" type="button" data-toggle-apparel-type="\${escapeHtml(type.code)}" data-active="\${type.is_active ? "true" : "false"}">\${type.is_active ? "Nonaktifkan" : "Aktifkan"}</button>
        </article>\`).join("")}
    </div>\` : \`<div class="empty-state">Belum ada jenis Apparel.</div>\`;
  target.querySelectorAll("[data-toggle-apparel-type]").forEach(button => {
    button.onclick = () => toggleApparelType(button.dataset.toggleApparelType, button.dataset.active !== "true");
  });
}`;
js = js.slice(0, managerStart) + gridFunction + js.slice(managerEnd);

// Pastikan tab Jenis Apparel benar-benar memiliki renderer dan cabang halaman.
if (!js.includes('function renderApparelTypesPage() {')) {
  const pageHelpers = `function findApparelTypesPanel() {
  const root = $("#pageContent");
  return root?.querySelector(".apparel-type-manager") || null;
}

function removeApparelTypesPanel() {
  findApparelTypesPanel()?.remove();
}

function renderApparelTypesPage() {
  renderProductsPage();
  const root = $("#pageContent");
  const panel = findApparelTypesPanel();
  if (!panel) {
    root.innerHTML = \`<section class="page-title-row"><div><div class="kicker">KATALOG</div><h1>Jenis Apparel</h1><p class="muted">Kelola jenis apparel yang tersedia untuk produk.</p></div></section><div class="admin-message error">Panel Jenis Apparel tidak ditemukan.</div>\`;
    return;
  }
  const heading = document.createElement("section");
  heading.className = "page-title-row";
  heading.innerHTML = \`<div><div class="kicker">KATALOG</div><h1>Jenis Apparel</h1><p class="muted">Tambah, aktifkan, atau nonaktifkan jenis apparel.</p></div>\`;
  const layout = document.createElement("div");
  layout.className = "apparel-types-page-layout";
  panel.classList.add("apparel-types-panel");
  layout.append(panel);
  root.replaceChildren(heading, layout);
}

`;
  if (!js.includes('async function renderPage() {')) fail('Fungsi renderPage() tidak ditemukan.');
  js = js.replace('async function renderPage() {', pageHelpers + 'async function renderPage() {');
}
if (!/if\s*\(page\s*===\s*["']apparelTypes["']\)/.test(js)) {
  const productsBranch = 'async function renderPage() {\n  if (page === "products") {';
  if (!js.includes(productsBranch)) fail('Cabang Produk pada renderPage() tidak ditemukan.');
  js = js.replace(productsBranch, `async function renderPage() {\n  if (page === "apparelTypes") {\n    await Promise.all([loadProducts(), loadOrders(), loadApparelTypes()]);\n    renderApparelTypesPage();\n  } else if (page === "products") {`);
}
// Pastikan panel pengelolaan tidak tertinggal di bawah halaman Produk.
const pageStart = js.indexOf('async function renderPage() {');
const pageEnd = js.indexOf('\n}', pageStart);
const pageBlock = js.slice(pageStart, pageEnd);
if (pageBlock.includes('renderProductsPage();') && !pageBlock.includes('removeApparelTypesPanel();')) {
  const productPageCall = '    renderProductsPage();\n  } else if (page === "allOrders")';
  if (js.includes(productPageCall)) {
    js = js.replace(productPageCall, '    renderProductsPage();\n    removeApparelTypesPanel();\n  } else if (page === "allOrders")');
  }
}

// 3) Kode produk otomatis, tanpa mengubah kode lama saat mengedit produk.
const codeFieldOld = '<label>Kode Produk<input id="pCode" maxlength="40" required></label>';
const codeFieldNew = `<label>Kode Produk
              <input id="pCode" maxlength="40" readonly aria-readonly="true" required>
              <small class="field-hint">Dibuat otomatis: ITB untuk Merchandise, APP untuk Apparel.</small>
            </label>`;
if (js.includes(codeFieldOld)) js = js.replace(codeFieldOld, codeFieldNew);
else if (!/id=["']pCode["'][^>]*readonly/.test(js)) fail('Input Kode Produk tidak ditemukan dalam format yang dikenal.');

const codeHelpers = `// itabakaAdminUiPatch: kode produk otomatis untuk Merchandise dan Apparel.\nfunction productCodePrefix(category) {
  return category === "APPAREL" ? "APP" : "ITB";
}

function nextProductCodeFromCodes(category, codes = []) {
  const prefix = productCodePrefix(category);
  const pattern = new RegExp(\`^\${prefix}-(\\\\d+)$\`, "i");
  let max = 0;
  const used = new Set();
  for (const value of codes) {
    const code = String(value || "").trim().toUpperCase();
    used.add(code);
    const match = code.match(pattern);
    if (match) max = Math.max(max, Number(match[1]) || 0);
  }
  let sequence = max + 1;
  let candidate = \`\${prefix}-\${String(sequence).padStart(3, "0")}\`;
  while (used.has(candidate)) {
    sequence += 1;
    candidate = \`\${prefix}-\${String(sequence).padStart(3, "0")}\`;
  }
  return candidate;
}

function syncProductCodePreview() {
  const input = $("#pCode");
  if (!input || editingProductId) return;
  input.value = nextProductCodeFromCodes($("#pCategory")?.value || "MERCHANDISE", products.map(product => product.code));
}

async function generateNextProductCode(category) {
  const { data, error } = await supabase.from("products").select("code");
  if (error) throw error;
  return nextProductCodeFromCodes(category, (data || []).map(product => product.code));
}

`;
if (!js.includes('function nextProductCodeFromCodes(')) {
  const helperAnchor = js.includes('function syncApparelTypeField() {')
    ? 'function syncApparelTypeField() {'
    : 'async function saveProduct(e) {';
  if (!js.includes(helperAnchor)) fail('Lokasi untuk fungsi generator kode produk tidak ditemukan.');
  js = js.replace(helperAnchor, () => codeHelpers + helperAnchor);
}

const simpleCategoryHandler = '$("#pCategory").onchange = syncApparelTypeField;';
if (js.includes(simpleCategoryHandler)) {
  js = js.replace(simpleCategoryHandler, `$("#pCategory").onchange = () => {
    syncApparelTypeField();
    syncProductCodePreview();
  };
  syncProductCodePreview();`);
} else if (!js.includes('syncProductCodePreview();')) {
  const handler = 'syncApparelTypeField();';
  if (!js.includes(handler)) fail('Handler kategori apparel tidak ditemukan untuk memperbarui preview kode.');
  js = js.replace(handler, `${handler}\n  syncProductCodePreview();`);
}

const oldPayloadCode = 'code: $("#pCode").value.trim(),';
if (js.includes(oldPayloadCode)) {
  js = js.replace(oldPayloadCode, 'code: editingProductId ? $("#pCode").value.trim() : await generateNextProductCode(category),');
} else if (!js.includes('await generateNextProductCode(category)')) {
  fail('Properti code pada payload saveProduct() tidak ditemukan.');
}

// Preview kode berikutnya setelah form tambah direset.
if (!js.includes('syncProductCodePreview();', js.indexOf('function resetProductForm() {'), js.indexOf('\n}', js.indexOf('function resetProductForm() {')))) {
  const resetStart = js.indexOf('function resetProductForm() {');
  const resetEnd = js.indexOf('\n}', resetStart);
  if (resetStart < 0 || resetEnd < 0) fail('Fungsi resetProductForm() tidak ditemukan.');
  const resetBlock = js.slice(resetStart, resetEnd);
  if (!resetBlock.includes('editingProductId = null;')) fail('resetProductForm() tidak cocok dengan source yang diharapkan.');
  js = js.slice(0, resetEnd) + '\n  syncProductCodePreview();' + js.slice(resetEnd);
}

// Backup, lalu tulis hanya setelah semua anchor lolos validasi.
if (js === originalJs && css.includes('/* Jenis Apparel: halaman penuh dengan daftar berbentuk grid */')) {
  console.log('Patch Jenis Apparel dan kode otomatis sudah terpasang. Tidak ada perubahan baru.');
  process.exit(0);
}
if (!js.includes('function nextProductCodeFromCodes(') || !js.includes('await generateNextProductCode(category)') || !js.includes('apparel-type-grid')) {
  fail('Validasi akhir gagal. Source asli tidak disentuh.');
}

const cssAddition = `

/* Jenis Apparel: halaman penuh dengan daftar berbentuk grid */
.apparel-types-page-layout { width:100%; max-width:none; margin:0; }
.apparel-types-panel { width:100%; min-width:0; margin-top:0 !important; }
.apparel-type-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,245px),1fr)); gap:16px; }
.apparel-type-card { min-width:0; display:flex; flex-direction:column; gap:12px; padding:18px; border:1px solid #e3e8ec; border-radius:13px; background:#fff; }
.apparel-type-card-top { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.apparel-type-card-top code { color:#707780; font-size:11px; font-weight:800; }
.apparel-type-card h3 { margin:2px 0 0; font-size:19px; line-height:1.25; }
.apparel-type-card p { flex:1; min-height:36px; margin:0; color:#737a84; font-size:12px; line-height:1.5; }
.field-hint { display:block; margin-top:6px; color:#858c95; font-size:11px; font-weight:500; line-height:1.4; }
#pCode[readonly] { background:#f5f7f8; color:#555d66; cursor:default; }
@media(max-width:640px) { .apparel-type-grid { grid-template-columns:1fr; } .apparel-type-card { padding:16px; } }
`;
if (!css.includes('/* Jenis Apparel: halaman penuh dengan daftar berbentuk grid */')) css += cssAddition;

const backupJs = `${adminPath}.before-admin-ui-patch.bak`;
const backupCss = `${cssPath}.before-admin-ui-patch.bak`;
if (!fs.existsSync(backupJs)) fs.copyFileSync(adminPath, backupJs);
if (!fs.existsSync(backupCss)) fs.copyFileSync(cssPath, backupCss);
fs.writeFileSync(adminPath, js, 'utf8');
fs.writeFileSync(cssPath, css, 'utf8');
console.log('Berhasil memasang patch Jenis Apparel: grid, lebar penuh, dan kode produk otomatis.');
console.log('Kode baru: ITB-xxx untuk Merchandise, APP-xxx untuk Apparel. Kode produk lama tidak diubah.');
console.log('Backup: src/admin.js.before-admin-ui-patch.bak dan src/admin.css.before-admin-ui-patch.bak');
