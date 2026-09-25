import "./styles.css";
import { supabase } from "./lib/supabase.js";
import { escapeHtml, formatDate, formatRupiah } from "./lib/format.js";

const app = document.querySelector("#app");
let orders = [];
let products = [];
let settings = {};
let editingId = null;

app.innerHTML = `
<header class="topbar">
  <div>
    <div class="brand">CIRCLE ITABAKA</div>
    <div class="muted">Admin Dashboard</div>
  </div>
  <div id="topActions"></div>
</header>
<main id="adminMain" class="admin-main"></main>`;

const main = document.querySelector("#adminMain");
const topActions = document.querySelector("#topActions");

function notice(message, type = "") {
  const el = document.querySelector("#adminNotice");
  if (el) el.innerHTML = `<div class="notice ${type}">${escapeHtml(message)}</div>`;
}

function loginView(error = "") {
  main.innerHTML = `
    <div style="max-width:420px;margin:60px auto">
      <div class="card panel">
        <p class="eyebrow">ADMIN</p>
        <h1>Masuk</h1>
        ${error ? `<div class="notice error">${escapeHtml(error)}</div>` : ""}
        <form id="loginForm">
          <label>Email<input id="email" type="email" required autocomplete="email"></label>
          <label>Password<input id="password" type="password" required autocomplete="current-password"></label>
          <button class="primary full" type="submit">Masuk</button>
        </form>
      </div>
    </div>`;
  document.querySelector("#loginForm").onsubmit = login;
}

async function login(e) {
  e.preventDefault();
  const { error } = await supabase.auth.signInWithPassword({
    email: document.querySelector("#email").value,
    password: document.querySelector("#password").value
  });
  if (error) loginView(error.message);
  else await boot();
}

async function getAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,role,display_name")
    .eq("id", user.id)
    .single();

  if (error || data?.role !== "admin") {
    await supabase.auth.signOut();
    return null;
  }
  return { user, profile: data };
}

async function boot() {
  const session = await getAdmin();
  if (!session) {
    topActions.innerHTML = "";
    return loginView();
  }

  topActions.innerHTML = `<button id="logout" class="secondary" type="button">Keluar</button>`;
  document.querySelector("#logout").onclick = async () => {
    await supabase.auth.signOut();
    loginView();
  };

  renderShell(session);
  await Promise.all([loadOrders(), loadProducts(), loadSettings()]);
}

function renderShell(s) {
  main.innerHTML = `
    <div id="adminNotice"></div>

    <div class="toolbar">
      <div>
        <p class="eyebrow">DASHBOARD</p>
        <h1>PO Management</h1>
        <p class="muted">${escapeHtml(s.profile.display_name || s.user.email)}</p>
      </div>
      <div class="actions">
        <a class="secondary" href="/">Halaman PO</a>
      </div>
    </div>

    <div class="stat-grid">
      <div class="card stat"><span class="muted">Total PO</span><strong id="statOrders">0</strong></div>
      <div class="card stat"><span class="muted">DP</span><strong id="statDp">0</strong></div>
      <div class="card stat"><span class="muted">Lunas</span><strong id="statLunas">0</strong></div>
    </div>

    <div class="admin-grid">
      <section class="card panel">
        <h2 id="productTitle">Tambah Produk</h2>
        <form id="productForm">
          <label>Kode<input id="pCode" required maxlength="40"></label>
          <label>Nama<input id="pName" required maxlength="120"></label>
          <label>Deskripsi<textarea id="pDesc" rows="3"></textarea></label>
          <label>Harga<input id="pPrice" type="number" min="0" step="1000" required></label>
          <label>Stok<input id="pStock" type="number" min="0"></label>
          <label>Foto Produk<input id="pImageFile" type="file" accept="image/png,image/jpeg,image/webp"></label>
          <label>URL gambar (opsional)<input id="pImage" placeholder="https://..."></label>
          <label>Aktif<select id="pActive"><option value="true">Ya</option><option value="false">Tidak</option></select></label>
          <div class="actions">
            <button class="primary" type="submit">Simpan Produk</button>
            <button class="secondary hidden" id="cancelEdit" type="button">Batal</button>
          </div>
        </form>
        <hr style="border:0;border-top:1px solid #eee;margin:24px 0">
        <h3>Daftar Produk</h3>
        <div id="productList"></div>
      </section>

      <section class="card panel">
        <div class="toolbar">
          <h2>Pesanan</h2>
          <input id="search" class="search" placeholder="Cari invoice / nama / email / HP">
        </div>
        <div id="ordersList"></div>
      </section>
    </div>

    <section class="card panel" style="margin-top:18px">
      <div class="toolbar">
        <div>
          <p class="eyebrow">PAYMENT & BRANDING</p>
          <h2>Pengaturan Website</h2>
        </div>
        <button id="saveSettingsButton" class="primary" type="button">Simpan Pengaturan</button>
      </div>
      <div class="admin-settings-grid">
        <div>
          <h3>Branding</h3>
          <label>Nama situs<input id="sSiteName"></label>
          <label>Judul situs<input id="sSiteTitle"></label>
          <label>Deskripsi situs<textarea id="sSiteDescription" rows="3"></textarea></label>
          <label>Warna utama<input id="sPrimaryColor" type="color" value="#111111"></label>
          <label>Warna aksen<input id="sAccentColor" type="color" value="#777777"></label>
        </div>
        <div>
          <h3>Aset</h3>
          <label>Logo<input id="sLogoFile" type="file" accept="image/png,image/jpeg,image/webp"></label>
          <label>Banner<input id="sBannerFile" type="file" accept="image/png,image/jpeg,image/webp"></label>
          <label>QRIS<input id="sQrisFile" type="file" accept="image/png,image/jpeg,image/webp"></label>
          <div id="assetPreview" class="asset-preview"></div>
        </div>
        <div>
          <h3>Pembayaran</h3>
          <label>Persentase DP<input id="sDpPercentage" type="number" min="1" max="99" step="1"></label>
          <label>Nama pemilik rekening BCA Blue<input id="sBcaName"></label>
          <label>Nomor rekening BCA Blue<input id="sBcaNumber" inputmode="numeric"></label>
          <div class="notice">Bukti pembayaran customer disimpan di bucket privat dan dapat dibuka dari detail pesanan.</div>
        </div>
      </div>
    </section>
  </main>
  <div id="proofModal" class="modal hidden">
    <div class="modal-backdrop" data-close-proof></div>
    <div class="modal-card">
      <div class="toolbar">
        <h3>Bukti Pembayaran</h3>
        <button class="secondary" type="button" data-close-proof>Tutup</button>
      </div>
      <div id="proofBody"></div>
    </div>
  </div>`;

  document.querySelector("#productForm").onsubmit = saveProduct;
  document.querySelector("#cancelEdit").onclick = resetForm;
  document.querySelector("#search").oninput = renderOrders;
  document.querySelector("#saveSettingsButton").onclick = saveSettings;
  document.querySelectorAll("[data-close-proof]").forEach((el) => el.onclick = closeProof);
}

async function loadSettings() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("id,site_name,site_title,site_description,logo_url,banner_url,qris_image_url,bca_account_name,bca_account_number,dp_percentage,primary_color,accent_color")
    .eq("id", 1)
    .maybeSingle();

  if (error) return notice("Pengaturan gagal dimuat: " + error.message, "error");
  settings = data || {};
  fillSettings();
}

function fillSettings() {
  const s = settings;
  const set = (id, value) => { const el = document.querySelector(id); if (el) el.value = value ?? ""; };
  set("#sSiteName", s.site_name);
  set("#sSiteTitle", s.site_title);
  set("#sSiteDescription", s.site_description);
  set("#sDpPercentage", s.dp_percentage ?? 50);
  set("#sBcaName", s.bca_account_name);
  set("#sBcaNumber", s.bca_account_number);
  set("#sPrimaryColor", s.primary_color || "#111111");
  set("#sAccentColor", s.accent_color || "#777777");
  document.querySelector("#assetPreview").innerHTML = `
    ${s.logo_url ? `<div><small>Logo saat ini</small><br><img src="${escapeHtml(s.logo_url)}" alt="Logo"></div>` : ""}
    ${s.banner_url ? `<div><small>Banner saat ini</small><br><img class="banner-preview" src="${escapeHtml(s.banner_url)}" alt="Banner"></div>` : ""}
    ${s.qris_image_url ? `<div><small>QRIS saat ini</small><br><img src="${escapeHtml(s.qris_image_url)}" alt="QRIS"></div>` : ""}`;
}

async function uploadPublicAsset(bucket, folder, file) {
  if (!file) return null;
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) throw new Error("Format gambar harus PNG, JPG/JPEG, atau WEBP.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Ukuran gambar maksimal 8 MB.");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    cacheControl: "3600",
    contentType: file.type
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function saveSettings() {
  const button = document.querySelector("#saveSettingsButton");
  button.disabled = true;
  try {
    let logo_url = settings.logo_url || null;
    let banner_url = settings.banner_url || null;
    let qris_image_url = settings.qris_image_url || null;

    logo_url = await uploadPublicAsset("site-media", "logo", document.querySelector("#sLogoFile").files?.[0]) || logo_url;
    banner_url = await uploadPublicAsset("site-media", "banner", document.querySelector("#sBannerFile").files?.[0]) || banner_url;
    qris_image_url = await uploadPublicAsset("site-media", "qris", document.querySelector("#sQrisFile").files?.[0]) || qris_image_url;

    const payload = {
      id: 1,
      site_name: document.querySelector("#sSiteName").value.trim(),
      site_title: document.querySelector("#sSiteTitle").value.trim(),
      site_description: document.querySelector("#sSiteDescription").value.trim(),
      primary_color: document.querySelector("#sPrimaryColor").value,
      accent_color: document.querySelector("#sAccentColor").value,
      dp_percentage: Number(document.querySelector("#sDpPercentage").value),
      bca_account_name: document.querySelector("#sBcaName").value.trim(),
      bca_account_number: document.querySelector("#sBcaNumber").value.trim(),
      logo_url, banner_url, qris_image_url,
      updated_at: new Date().toISOString()
    };

    if (!payload.site_name || !payload.site_title || !payload.site_description) throw new Error("Nama, judul, dan deskripsi situs wajib diisi.");
    if (!Number.isInteger(payload.dp_percentage) || payload.dp_percentage < 1 || payload.dp_percentage > 99) throw new Error("DP harus 1–99%.");

    const { error } = await supabase.from("site_settings").upsert(payload, { onConflict: "id" });
    if (error) throw error;
    settings = {...settings, ...payload};
    fillSettings();
    notice("Pengaturan berhasil disimpan.", "success");
  } catch (error) {
    notice("Gagal menyimpan pengaturan: " + error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function loadProducts() {
  const { data, error } = await supabase.from("products").select("*").order("sort_order").order("name");
  if (error) {
    document.querySelector("#productList").innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
    return;
  }
  products = data || [];
  renderProducts();
}

function renderProducts() {
  document.querySelector("#productList").innerHTML = products.length ? products.map((p) => `
    <div class="admin-product-row">
      <div>
        ${p.image_url ? `<img class="admin-thumb" src="${escapeHtml(p.image_url)}" alt="">` : `<div class="admin-thumb placeholder">IMG</div>`}
      </div>
      <div class="grow">
        <strong>${escapeHtml(p.name)}</strong>
        <div class="muted">${escapeHtml(p.code)} · ${formatRupiah(p.price)} · stok ${p.stock ?? "∞"} · ${p.active ? "aktif" : "nonaktif"}</div>
      </div>
      <button class="secondary" type="button" data-edit="${p.id}">Edit</button>
    </div>`).join("") : '<p class="muted">Belum ada produk.</p>';

  document.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => editProduct(b.dataset.edit));
}

function editProduct(id) {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  editingId = id;
  document.querySelector("#productTitle").textContent = "Edit Produk";
  document.querySelector("#pCode").value = p.code;
  document.querySelector("#pName").value = p.name;
  document.querySelector("#pDesc").value = p.description || "";
  document.querySelector("#pPrice").value = p.price;
  document.querySelector("#pStock").value = p.stock ?? "";
  document.querySelector("#pImage").value = p.image_url || "";
  document.querySelector("#pActive").value = String(p.active);
  document.querySelector("#cancelEdit").classList.remove("hidden");
  window.scrollTo({top: 0, behavior: "smooth"});
}

function resetForm() {
  editingId = null;
  document.querySelector("#productForm").reset();
  document.querySelector("#pActive").value = "true";
  document.querySelector("#productTitle").textContent = "Tambah Produk";
  document.querySelector("#cancelEdit").classList.add("hidden");
}

async function saveProduct(e) {
  e.preventDefault();
  const button = e.submitter;
  button.disabled = true;
  try {
    let image_url = document.querySelector("#pImage").value.trim() || null;
    const file = document.querySelector("#pImageFile").files?.[0];
    if (file) image_url = await uploadPublicAsset("product-images", "products", file);

    const payload = {
      code: document.querySelector("#pCode").value.trim(),
      name: document.querySelector("#pName").value.trim(),
      description: document.querySelector("#pDesc").value.trim() || null,
      price: Number(document.querySelector("#pPrice").value),
      stock: document.querySelector("#pStock").value === "" ? null : Number(document.querySelector("#pStock").value),
      image_url,
      active: document.querySelector("#pActive").value === "true"
    };

    if (!payload.code || !payload.name) throw new Error("Kode dan nama produk wajib diisi.");
    if (!Number.isFinite(payload.price) || payload.price < 0) throw new Error("Harga tidak valid.");
    if (payload.stock !== null && (!Number.isInteger(payload.stock) || payload.stock < 0)) throw new Error("Stok tidak valid.");

    const result = editingId
      ? await supabase.from("products").update(payload).eq("id", editingId)
      : await supabase.from("products").insert(payload);

    if (result.error) throw result.error;
    resetForm();
    await loadProducts();
    notice("Produk berhasil disimpan.", "success");
  } catch (error) {
    notice("Gagal menyimpan produk: " + error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function loadOrders() {
  const { data, error } = await supabase.from("orders").select(`
    id,invoice_no,created_at,
    customer_name,customer_email,customer_contact,customer_phone,customer_address,
    delivery_method,delivery_method,notes,
    payment_status,payment_plan,payment_method,payment_amount_due,
    paid_amount,remaining_amount,payment_proof_path,payment_proof_uploaded_at,
    order_items(id,product_name,unit_price,quantity,subtotal)
  `).order("created_at", {ascending: false});

  if (error) {
    document.querySelector("#ordersList").innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
    return;
  }
  orders = data || [];
  renderOrders();
}

function renderOrders() {
  const q = (document.querySelector("#search")?.value || "").toLowerCase().trim();
  const filtered = orders.filter((o) => [
    o.invoice_no, o.customer_name, o.customer_email, o.customer_phone, o.customer_contact
  ].join(" ").toLowerCase().includes(q));

  document.querySelector("#statOrders").textContent = orders.length;
  document.querySelector("#statDp").textContent = orders.filter((o) => o.payment_status === "DP").length;
  document.querySelector("#statLunas").textContent = orders.filter((o) => o.payment_status === "LUNAS").length;

  document.querySelector("#ordersList").innerHTML = filtered.length ? `
    <div class="table-wrap">
      <table class="table">
        <thead><tr>
          <th>Invoice</th><th>Pemesan</th><th>Total</th><th>Status</th><th>Aksi</th>
        </tr></thead>
        <tbody>
          ${filtered.map((o) => `
            <tr>
              <td><strong>${escapeHtml(o.invoice_no)}</strong><br><small>${formatDate(o.created_at)}</small></td>
              <td>${escapeHtml(o.customer_name)}<br><small>${escapeHtml(o.customer_email || o.customer_phone || o.customer_contact || "")}</small></td>
              <td>${formatRupiah(o.total_amount)}<br><small>Bayar sekarang ${formatRupiah(o.payment_amount_due || 0)} · Dibayar ${formatRupiah(o.paid_amount)}</small></td>
              <td>
                <span class="status ${o.payment_status === "LUNAS" ? "lunas" : "dp"}">${escapeHtml(o.payment_status)}</span><br>
                <small>${escapeHtml(o.payment_plan === "FULL" ? "Full Payment" : "DP")} · ${escapeHtml(o.payment_method === "QRIS" ? "QRIS" : "BCA")}</small><br>
                <small>Sisa ${formatRupiah(o.remaining_amount)}</small>
              </td>
              <td>
                <div class="actions">
                  ${o.payment_status === "DP"
                    ? `<button class="primary" type="button" data-lunas="${o.id}">Tandai Lunas</button>`
                    : `<button class="secondary" type="button" data-dp="${o.id}">Ubah DP</button>`}
                  <button class="secondary" type="button" data-detail="${o.id}">Detail</button>
                  ${o.payment_proof_path ? `<button class="secondary" type="button" data-proof="${o.id}">Bukti</button>` : ""}
                </div>
              </td>
            </tr>
            <tr id="detail-${o.id}" class="hidden">
              <td colspan="5">${renderDetail(o)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>` : '<p class="muted">Tidak ada pesanan.</p>';

  document.querySelectorAll("[data-lunas]").forEach((b) => b.onclick = () => setStatus(b.dataset.lunas, "LUNAS"));
  document.querySelectorAll("[data-dp]").forEach((b) => b.onclick = () => setStatus(b.dataset.dp, "DP"));
  document.querySelectorAll("[data-detail]").forEach((b) => b.onclick = () => {
    document.querySelector("#detail-" + b.dataset.detail).classList.toggle("hidden");
  });
  document.querySelectorAll("[data-proof]").forEach((b) => b.onclick = () => viewProof(b.dataset.proof));
}

function renderDetail(o) {
  const delivery = o.delivery_method === "SHIP_TO_ADDRESS"
    ? `<strong>Dikirim ke Alamat</strong><br>${escapeHtml(o.customer_address || "-")}`
    : `<strong>Ambil di Booth CF24</strong>`;

  return `
    <div class="detail-grid">
      <div>
        <strong>Data Customer</strong>
        <p>${escapeHtml(o.customer_name)}<br>${escapeHtml(o.customer_email || "-")}<br>${escapeHtml(o.customer_phone || o.customer_contact || "-")}</p>
      </div>
      <div>
        <strong>Pengambilan / Pengiriman</strong>
        <p>${delivery}</p>
      </div>
      <div>
        <strong>Pembayaran</strong>
        <p>Rencana: ${escapeHtml(o.payment_plan === "FULL" ? "Full Payment" : "DP")}<br>
        Metode: ${escapeHtml(o.payment_method === "QRIS" ? "QRIS" : "Transfer Bank BCA Blue")}<br>
        Bayar sekarang: ${formatRupiah(o.payment_amount_due || 0)}<br>
        Dibayar: ${formatRupiah(o.paid_amount)}<br>
        Sisa: ${formatRupiah(o.remaining_amount)}</p>
      </div>
      <div>
        <strong>Produk</strong>
        <table class="table"><tbody>
          ${(o.order_items || []).map((i) => `<tr><td>${escapeHtml(i.product_name)}</td><td>${i.quantity}×</td><td class="right">${formatRupiah(i.subtotal)}</td></tr>`).join("")}
        </tbody></table>
      </div>
    </div>
    ${o.notes ? `<p><strong>Catatan:</strong> ${escapeHtml(o.notes)}</p>` : ""}
    <div class="actions">
      ${o.payment_proof_path ? `<button class="primary" type="button" data-proof="${o.id}">Lihat Bukti Pembayaran</button>` : `<span class="muted">Bukti pembayaran belum tersedia.</span>`}
    </div>`;
}

async function viewProof(orderId) {
  const order = orders.find((x) => x.id === orderId);
  if (!order?.payment_proof_path) return;

  const body = document.querySelector("#proofBody");
  document.querySelector("#proofModal").classList.remove("hidden");
  body.innerHTML = `<p class="muted">Memuat bukti pembayaran...</p>`;

  const { data, error } = await supabase.storage
    .from("payment-proofs")
    .createSignedUrl(order.payment_proof_path, 600);

  if (error) {
    body.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
    return;
  }

  const isPdf = /\.pdf$/i.test(order.payment_proof_path);
  body.innerHTML = isPdf
    ? `<iframe class="proof-frame" src="${escapeHtml(data.signedUrl)}" title="Bukti pembayaran PDF"></iframe>
       <p><a class="primary" href="${escapeHtml(data.signedUrl)}" target="_blank" rel="noreferrer">Buka PDF di tab baru</a></p>`
    : `<img class="proof-image" src="${escapeHtml(data.signedUrl)}" alt="Bukti pembayaran">`;
}

function closeProof() {
  document.querySelector("#proofModal").classList.add("hidden");
  document.querySelector("#proofBody").innerHTML = "";
}

async function setStatus(id, status) {
  const o = orders.find((x) => x.id === id);
  if (!o) return;

  let paid = o.paid_amount || 0;
  if (status === "LUNAS") {
    paid = o.total_amount;
  } else {
    const max = Math.max(1, o.total_amount - 1);
    const suggested = Math.min(max, Number(o.paid_amount || o.payment_amount_due || 1));
    const answer = prompt(`Masukkan nominal pembayaran untuk ${o.invoice_no}:`, String(suggested));
    if (answer === null) return;
    paid = Number(answer);
    if (!Number.isInteger(paid) || paid <= 0 || paid >= o.total_amount) {
      return alert("Nominal DP harus lebih dari 0 dan kurang dari total.");
    }
  }

  const { error } = await supabase.from("orders").update({
    payment_status: status,
    paid_amount: paid,
    payment_verified_at: new Date().toISOString()
  }).eq("id", id);

  if (error) alert("Gagal mengubah status: " + error.message);
  else {
    await loadOrders();
    notice(`Status ${o.invoice_no} berhasil diubah menjadi ${status}.`, "success");
  }
}

async function start() {
  await boot();
}

let authBooting = false;
supabase.auth.onAuthStateChange(async () => {
  if (authBooting) return;
  authBooting = true;
  try {
    await start();
  } finally {
    authBooting = false;
  }
});

start();
