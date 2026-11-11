import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const jsPath = path.join(root, 'src', 'admin.js');
const cssPath = path.join(root, 'src', 'admin.css');
if (!fs.existsSync(jsPath) || !fs.existsSync(cssPath)) {
  console.error('PATCH DIHENTIKAN: Jalankan script dari root proyek yang berisi src/admin.js dan src/admin.css.');
  process.exit(1);
}
let js = fs.readFileSync(jsPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');
const originalJs = js;
const originalCss = css;

function replaceOnce(source, pattern, replacement, label) {
  const matches = source.match(pattern);
  if (!matches || matches.length !== 1) throw new Error(`Pola ${label} tidak ditemukan secara unik (${matches?.length ?? 0}).`);
  return source.replace(pattern, replacement);
}

try {
  // Correct the duplicate/unreachable apparelTypes route without disturbing other routes.
  if (js.includes(': target === "apparelTypes" ? "/admin.html?page=apparelTypes"')) {
    js = js.replace(/\n\s*: target === "apparelTypes" \? "\/admin-apparel-types\.html"/, '');
  } else if (!js.includes(': target === "apparelTypes" ? "/admin.html?page=apparelTypes"')) {
    js = replaceOnce(js, /(function hrefFor\(target\) \{[\s\S]*?return target === "products" \? "\/admin\.html"\n)/,
      '$1    : target === "apparelTypes" ? "/admin.html?page=apparelTypes"\n', 'route Jenis Apparel');
  }

  // Keep the dedicated tab between Apparel and Promo Member.
  if (!/nav\("apparelTypes"\s*,\s*"Jenis Apparel"\)/.test(js)) {
    js = replaceOnce(js, /(\$\{nav\("apparel"\s*,\s*"[^"]+"\)\}\s*\n)/,
      '$1            ${nav("apparelTypes","Jenis Apparel")}\n', 'menu Jenis Apparel');
  }

  // Replace the table renderer with responsive cards; preserve existing add/toggle functions.
  if (!js.includes('class="apparel-type-grid"')) {
    const start = js.indexOf('function renderApparelTypeManager()');
    const end = js.indexOf('\nasync function addApparelType', start);
    if (start < 0 || end < 0) throw new Error('Fungsi renderApparelTypeManager/addApparelType tidak ditemukan.');
    const renderer = "function renderApparelTypeManager() {\n  const target = $(\"#apparelTypeList\");\n  if (!target) return;\n  target.innerHTML = apparelTypes.length ? `\n    <div class=\"apparel-type-grid\">\n      ${apparelTypes.map(type => `\n        <article class=\"apparel-type-card\">\n          <div class=\"apparel-type-card-top\">\n            <span class=\"apparel-type-code\">${escapeHtml(type.code || \"-\")}</span>\n            <span class=\"status-pill ${type.is_active ? \"active\" : \"inactive\"}\">${type.is_active ? \"AKTIF\" : \"NONAKTIF\"}</span>\n          </div>\n          <h3>${escapeHtml(type.name || \"Tanpa nama\")}</h3>\n          <button class=\"btn ${type.is_active ? \"ghost\" : \"primary\"} full\" type=\"button\" data-toggle-apparel-type=\"${type.id}\">\n            ${type.is_active ? \"Nonaktifkan\" : \"Aktifkan\"}\n          </button>\n        </article>\n      `).join(\"\")}\n    </div>` : `<div class=\"empty-state\">Belum ada jenis apparel. Tambahkan jenis pertama melalui formulir di atas.</div>`;\n  target.querySelectorAll(\"[data-toggle-apparel-type]\").forEach(button => {\n    button.addEventListener(\"click\", () => toggleApparelType(button.dataset.toggleApparelType));\n  });\n}\n";
    js = js.slice(0, start) + renderer + js.slice(end);
  }

  // Generate sequential product codes from the largest existing suffix; existing codes are untouched.
  if (!js.includes('function generateProductCode(category)')) {
    const helper = `function generateProductCode(category) {
  const prefix = category === "MERCHANDISE" ? "ITB" : "APP";
  const largest = products.reduce((max, product) => {
    const match = String(product.code || "").trim().match(new RegExp("^" + prefix + "-(\\\\d+)$", "i"));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return prefix + "-" + String(largest + 1).padStart(3, "0");
}

`;
    js = replaceOnce(js, /async function saveProduct\(e\) \{/, helper + 'async function saveProduct(e) {', 'titik sisip generator kode');
  }

  // Make code field informational/readonly for new products, while edits retain their current code.
  js = js.replace(/<label>Kode Produk<input id="pCode" maxlength="40" required><\/label>/,
    '<label>Kode Produk<input id="pCode" maxlength="40" readonly required><small class="muted">Kode dibuat otomatis: ITB untuk merchandise, APP untuk apparel.</small></label>');

  // Use generated code only on insert. Editing always preserves the stored code.
  if (js.includes('code: $("#pCode").value.trim(),')) {
    js = js.replace('code: $("#pCode").value.trim(),', 'code: editingProductId ? $("#pCode").value.trim() : generateProductCode(category),');
  } else if (!js.includes('code: editingProductId ? $("#pCode").value.trim() : generateProductCode(category),')) {
    throw new Error('Baris payload code produk tidak cocok; tidak aman untuk melanjutkan.');
  }

  // Preview the next code on category changes and after reset.
  if (!js.includes('pCategory")?.addEventListener("change"')) {
    const bindAnchor = '$("#productForm").onsubmit = saveProduct;';
    if (!js.includes(bindAnchor)) throw new Error('Binding productForm tidak ditemukan untuk preview kode.');
    js = js.replace(bindAnchor, bindAnchor + `
  $("#pCategory")?.addEventListener("change", () => {
    if (!editingProductId && $("#pCode")) $("#pCode").value = generateProductCode($("#pCategory").value);
  });
  if (!editingProductId && $("#pCode")) $("#pCode").value = generateProductCode($("#pCategory").value);`);
  }

  // Ensure reset refreshes the suggested code; existing product codes are not rewritten.
  if (!js.includes('generateProductCode($("#pCategory").value);\n  $("#cancelEdit")')) {
    js = js.replace('$("#productFormTitle").textContent = "Tambah Produk";',
      '$("#productFormTitle").textContent = "Tambah Produk";\n  if (products.length && $("#pCode")) $("#pCode").value = generateProductCode($("#pCategory").value);');
  }

  const cssAdd = `

/* Jenis Apparel: tampilan kartu/grid dan lebar konsisten dengan halaman admin */
.apparel-types-page-layout{width:100%;max-width:none;margin:0}
.apparel-types-panel{width:100%;min-width:0;padding:26px}
.apparel-types-panel .panel-head{align-items:flex-start}
.apparel-type-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px;width:100%}
.apparel-type-card{min-width:0;background:#fff;border:1px solid #e1e6ea;border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:14px;box-shadow:0 6px 18px rgba(25,35,50,.035)}
.apparel-type-card-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.apparel-type-code{font-size:11px;font-weight:950;letter-spacing:.09em;color:#858c94}
.apparel-type-card h3{font-size:18px;line-height:1.3;margin:0;overflow-wrap:anywhere}
.apparel-type-card .btn{margin-top:auto}
#productForm #pCode[readonly]{background:#f7f8fa;color:#59616b;cursor:not-allowed}
#productForm label small.muted{display:block;margin-top:5px;font-size:11px;font-weight:600}
@media(max-width:900px){.apparel-types-panel{padding:20px}}
@media(max-width:640px){.apparel-types-panel{padding:18px}.apparel-type-grid{grid-template-columns:1fr}}
`;
  if (!css.includes('/* Jenis Apparel: tampilan kartu/grid')) css += cssAdd;

  // Validate key changes before writing either file.
  for (const [ok, label] of [
    [js.includes('function generateProductCode(category)'), 'generator kode'],
    [js.includes('class="apparel-type-grid"'), 'grid jenis apparel'],
    [js.includes('nav("apparelTypes","Jenis Apparel")'), 'menu jenis apparel'],
    [js.includes('generateProductCode(category)'), 'kode otomatis saat tambah produk']
  ]) if (!ok) throw new Error(`Validasi akhir gagal: ${label}.`);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(jsPath, `${jsPath}.before-admin-apparel-${stamp}.bak`);
  fs.copyFileSync(cssPath, `${cssPath}.before-admin-apparel-${stamp}.bak`);
  fs.writeFileSync(jsPath, js, 'utf8');
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('PATCH BERHASIL: admin.js dan admin.css diperbarui. Backup dibuat dengan akhiran .before-admin-apparel-*.bak');
} catch (error) {
  // No file is written until every structural check has passed.
  console.error('PATCH DIHENTIKAN: ' + error.message + ' Tidak ada file yang diubah.');
  process.exit(1);
}
