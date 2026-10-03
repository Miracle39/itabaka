import "./admin.css";
import { supabase } from "./lib/supabase.js";
import { escapeHtml, formatDate, formatRupiah } from "./lib/format.js";

const page = document.body.dataset.adminPage || "products";
const app = document.querySelector("#app");
let products = [];
let orders = [];
let settings = {};
let editingProductId = null;
let ordersPerPage = 10;
let currentPage = 1;
let bootBusy = false;

const $ = (selector) => document.querySelector(selector);

function msg(text, type = "") {
  const el = $("#pageMessage");
  if (!el) return;
  el.innerHTML = `<div class="admin-message ${type}">${escapeHtml(text)}</div>`;
  clearTimeout(msg.timer);
  msg.timer = setTimeout(() => el.replaceChildren(), 5000);
}

function loginView(error = "") {
  app.innerHTML = `
    <div class="login-screen">
      <section class="login-card">
        <div class="brand-lockup">
          <strong>CIRCLE ITABAKA</strong>
          <span>Admin Panel</span>
        </div>
        <h1>Masuk Admin</h1>
        <p class="muted">Kelola katalog, pesanan, dan pengaturan website.</p>
        <div id="loginError">${error ? `<div class="admin-message error">${escapeHtml(error)}</div>` : ""}</div>
        <form id="loginForm" class="stack">
          <label>Email<input id="loginEmail" type="email" autocomplete="email" required></label>
          <label>Password<input id="loginPassword" type="password" autocomplete="current-password" required></label>
          <button class="btn primary full" type="submit">Masuk</button>
        </form>
      </section>
    </div>`;
  $("#loginForm").onsubmit = login;
}

async function login(e) {
  e.preventDefault();
  const { error } = await supabase.auth.signInWithPassword({
    email: $("#loginEmail").value.trim(),
    password: $("#loginPassword").value
  });
  if (error) loginView(error.message);
  else boot();
}

async function getSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,role,display_name")
    .eq("id", user.id)
    .single();
  if (error || profile?.role !== "admin") {
    await supabase.auth.signOut();
    return null;
  }
  return {user, profile};
}

function hrefFor(target) {
  return target === "products" ? "/admin.html"
    : target === "merchandise" ? "/admin-orders.html"
    : target === "apparel" ? "/admin-apparel.html"
    : "/admin-settings.html";
}

function nav(target, label) {
  return `<a class="nav-link ${page === target ? "active" : ""}" href="${hrefFor(target)}">${label}</a>`;
}

function shell(session) {
  app.innerHTML = `
    <div class="admin-app">
      <header class="admin-header">
        <div class="header-inner">
          <a class="brand-link" href="/admin.html">
            <strong>CIRCLE ITABAKA</strong>
            <span>Admin Panel</span>
          </a>
          <nav class="main-nav">
            ${nav("products","Produk")}
            ${nav("merchandise","Merchandise")}
            ${nav("apparel","Kaos / Jaket")}
            ${nav("settings","Pengaturan")}
          </nav>
          <div class="header-actions">
            <span class="user-name">${escapeHtml(session.profile.display_name || session.user.email)}</span>
            <a class="btn ghost" href="/" target="_blank" rel="noreferrer">Customer</a>
            <button class="btn ghost" id="logout" type="button">Keluar</button>
          </div>
        </div>
      </header>
      <main class="admin-main">
        <div id="pageMessage"></div>
        <div id="pageContent"></div>
      </main>
    </div>`;

  $("#logout").onclick = async () => {
    await supabase.auth.signOut();
    loginView();
  };
}

async function loadProducts() {
  const { data, error } = await supabase.from("products").select(`
    id,code,name,description,price,image_url,stock,active,sort_order,
    category,available_sizes,created_at,updated_at
  `).order("sort_order").order("name");
  if (error) throw error;
  products = data || [];
}

async function loadOrders() {
  const { data, error } = await supabase.from("orders").select(`
    id,invoice_no,created_at,
    customer_name,customer_email,customer_contact,customer_phone,customer_address,
    delivery_method,payment_status,payment_plan,payment_method,
    payment_amount_due,total_amount,paid_amount,remaining_amount,
    payment_proof_path,payment_proof_uploaded_at,payment_verified_at,
    order_items(
      id,product_id,product_name,product_category,size,unit_price,quantity,subtotal
    )
  `).order("created_at", {ascending:false});
  if (error) throw error;
  orders = data || [];
}

async function loadSettings() {
  const { data, error } = await supabase.from("site_settings").select(`
    id,site_name,site_title,site_description,
    logo_url,banner_url,qris_image_url,
    bca_account_name,bca_account_number,dp_percentage,
    primary_color,accent_color
  `).eq("id",1).maybeSingle();
  if (error) throw error;
  settings = data || {};
}

function productCategoryLabel(c) {
  return c === "TSHIRT" ? "Kaos" : c === "JACKET" ? "Jaket" : "Merchandise";
}

function categoryItems(order, cat) {
  return (order.order_items || []).filter(i => i.product_category === cat);
}

function orderHasCategory(order, cats) {
  return (order.order_items || []).some(i => cats.includes(i.product_category));
}

function renderProductsPage() {
  const merch = orders.filter(o => orderHasCategory(o, ["MERCHANDISE"])).length;
  const apparel = orders.filter(o => orderHasCategory(o, ["TSHIRT","JACKET"])).length;

  $("#pageContent").innerHTML = `
    <section class="page-title-row">
      <div>
        <div class="kicker">DASHBOARD & KATALOG</div>
        <h1>Produk</h1>
        <p class="muted">Tambah produk, kelola katalog, dan pantau ringkasan PO.</p>
      </div>
      <button id="exportOrders" class="btn primary">Export Semua Order ke Excel</button>
    </section>

    <section class="stats-grid">
      <div class="stat-card"><span>Total PO</span><strong>${orders.length}</strong></div>
      <div class="stat-card"><span>Order Merchandise</span><strong>${merch}</strong></div>
      <div class="stat-card"><span>Order Kaos/Jaket</span><strong>${apparel}</strong></div>
      <div class="stat-card"><span>DP</span><strong>${orders.filter(o=>o.payment_status==="DP").length}</strong></div>
      <div class="stat-card"><span>Lunas</span><strong>${orders.filter(o=>o.payment_status==="LUNAS").length}</strong></div>
    </section>

    <div class="products-page-grid">
      <section class="panel-card">
        <div class="panel-head">
          <div><div class="kicker">PRODUK</div><h2 id="productFormTitle">Tambah Produk</h2></div>
          <button class="btn ghost hidden" id="cancelEdit" type="button">Batal</button>
        </div>
        <form id="productForm" class="stack">
          <div class="form-grid two">
            <label>Kode Produk<input id="pCode" maxlength="40" required></label>
            <label>Nama Produk<input id="pName" maxlength="120" required></label>
          </div>
          <label>Kategori
            <select id="pCategory">
              <option value="MERCHANDISE">Merchandise</option>
              <option value="TSHIRT">Kaos</option>
              <option value="JACKET">Jaket</option>
            </select>
          </label>
          <label>Deskripsi<textarea id="pDescription" rows="4" maxlength="1000"></textarea></label>
          <div class="form-grid two">
            <label>Harga<input id="pPrice" type="number" min="0" step="1000" required></label>
            <label>Stok<input id="pStock" type="number" min="0"></label>
          </div>
          <label>Ukuran tersedia <span class="muted">(untuk kaos/jaket)</span>
            <input id="pSizes" placeholder="S, M, L, XL, 2XL">
          </label>
          <div class="form-grid two">
            <label>Status
              <select id="pActive">
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </select>
            </label>
            <label>Foto Produk<input id="pImageFile" type="file" accept="image/png,image/jpeg,image/webp"></label>
          </div>
          <label>URL gambar (opsional)<input id="pImageUrl" placeholder="https://..."></label>
          <div class="editor-actions">
            <button class="btn primary" type="submit">Simpan Produk</button>
          </div>
        </form>
      </section>

      <section class="panel-card">
        <div class="panel-head">
          <div><div class="kicker">KATALOG</div><h2>Daftar Produk</h2></div>
          <input id="productSearch" class="compact-search" placeholder="Cari kode / nama">
        </div>
        <div id="catalogList"></div>
      </section>
    </div>`;

  $("#productForm").onsubmit = saveProduct;
  $("#cancelEdit").onclick = resetProductForm;
  $("#productSearch").oninput = renderCatalogList;
  $("#exportOrders").onclick = exportAllOrders;
  renderCatalogList();
}

function renderCatalogList() {
  const q = ($("#productSearch")?.value || "").toLowerCase().trim();
  const filtered = products.filter(p => `${p.code} ${p.name} ${p.description || ""}`.toLowerCase().includes(q));
  $("#catalogList").innerHTML = filtered.length ? `
    <div class="catalog-grid">
      ${filtered.map(p => `
        <article class="catalog-card">
          <div class="catalog-media">
            ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}">` : `<div class="no-image">NO IMAGE</div>`}
          </div>
          <div class="catalog-body">
            <div class="catalog-top">
              <span class="product-code">${escapeHtml(p.code)}</span>
              <span class="status-pill ${p.active ? "active":"inactive"}">${p.active ? "AKTIF":"NONAKTIF"}</span>
            </div>
            <h3>${escapeHtml(p.name)}</h3>
            <p class="catalog-desc">${escapeHtml(p.description || "Tidak ada deskripsi.")}</p>
            <div class="catalog-details">
              <div><span>Kategori</span><strong>${productCategoryLabel(p.category)}</strong></div>
              <div><span>Harga</span><strong>${formatRupiah(p.price)}</strong></div>
              <div><span>Stok</span><strong>${p.stock ?? "∞"}</strong></div>
              <div><span>Ukuran</span><strong>${(p.available_sizes || []).length ? escapeHtml(p.available_sizes.join(", ")) : "-"}</strong></div>
            </div>
            <button class="btn ghost full" type="button" data-edit="${p.id}">Edit Produk</button>
          </div>
        </article>
      `).join("")}
    </div>` : `<div class="empty-state">Tidak ada produk.</div>`;

  document.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => editProduct(b.dataset.edit));
}

function editProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  editingProductId = id;
  $("#productFormTitle").textContent = "Edit Produk";
  $("#pCode").value = p.code || "";
  $("#pName").value = p.name || "";
  $("#pCategory").value = p.category || "MERCHANDISE";
  $("#pDescription").value = p.description || "";
  $("#pPrice").value = p.price ?? "";
  $("#pStock").value = p.stock ?? "";
  $("#pSizes").value = (p.available_sizes || []).join(", ");
  $("#pActive").value = String(p.active);
  $("#pImageUrl").value = p.image_url || "";
  $("#pImageFile").value = "";
  $("#cancelEdit").classList.remove("hidden");
  window.scrollTo({top:0, behavior:"smooth"});
}

function resetProductForm() {
  editingProductId = null;
  $("#productForm").reset();
  $("#pCategory").value = "MERCHANDISE";
  $("#pActive").value = "true";
  $("#productFormTitle").textContent = "Tambah Produk";
  $("#cancelEdit").classList.add("hidden");
}

async function uploadAsset(bucket, folder, file) {
  if (!file) return null;
  const allowed = ["image/png","image/jpeg","image/webp"];
  if (!allowed.includes(file.type)) throw new Error("Format gambar harus PNG, JPG/JPEG, atau WEBP.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Ukuran gambar maksimal 8 MB.");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {upsert:false,contentType:file.type,cacheControl:"3600"});
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

async function saveProduct(e) {
  e.preventDefault();
  const button = e.submitter;
  button.disabled = true;

  try {
    const category = $("#pCategory").value;
    const sizes = $("#pSizes").value.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    if ((category === "TSHIRT" || category === "JACKET") && !sizes.length) {
      throw new Error("Kaos/jaket harus memiliki minimal satu ukuran.");
    }

    let imageUrl = $("#pImageUrl").value.trim() || null;
    const file = $("#pImageFile").files?.[0];
    if (file) imageUrl = await uploadAsset("product-images","products",file);

    const payload = {
      code: $("#pCode").value.trim(),
      name: $("#pName").value.trim(),
      category,
      description: $("#pDescription").value.trim() || null,
      price: Number($("#pPrice").value),
      stock: $("#pStock").value === "" ? null : Number($("#pStock").value),
      available_sizes: category === "MERCHANDISE" ? [] : [...new Set(sizes)],
      image_url: imageUrl,
      active: $("#pActive").value === "true"
    };

    if (!payload.code || !payload.name) throw new Error("Kode dan nama produk wajib diisi.");
    if (!Number.isFinite(payload.price) || payload.price < 0) throw new Error("Harga tidak valid.");
    if (payload.stock !== null && (!Number.isInteger(payload.stock) || payload.stock < 0)) throw new Error("Stok tidak valid.");

    const result = editingProductId
      ? await supabase.from("products").update(payload).eq("id", editingProductId)
      : await supabase.from("products").insert(payload);

    if (result.error) throw result.error;

    const wasEditing = Boolean(editingProductId);
    resetProductForm();
    await loadProducts();
    renderProductsPage();
    msg(wasEditing ? "Produk berhasil diperbarui." : "Produk berhasil ditambahkan.", "success");
  } catch (error) {
    msg("Gagal menyimpan produk: " + error.message, "error");
  } finally {
    button.disabled = false;
  }
}

function filteredOrders(categoryMode) {
  if (categoryMode === "merchandise") return orders.filter(o => orderHasCategory(o,["MERCHANDISE"]));
  if (categoryMode === "apparel") return orders.filter(o => orderHasCategory(o,["TSHIRT","JACKET"]));
  return orders;
}

function renderOrdersPage(mode) {
  currentPage = 1;
  const data = filteredOrders(mode);
  const isApparel = mode === "apparel";

  $("#pageContent").innerHTML = `
    <section class="page-title-row">
      <div>
        <div class="kicker">${isApparel ? "KAOS / JAKET" : "MERCHANDISE"}</div>
        <h1>${isApparel ? "Order Kaos / Jaket" : "Order Merchandise"}</h1>
        <p class="muted">${isApparel ? "Order apparel lengkap dengan ukuran." : "Daftar order merchandise yang masuk."}</p>
      </div>
      <div class="page-count">${data.length} order</div>
    </section>

    ${isApparel ? renderSizeSummary(data) : ""}

    <section class="panel-card orders-panel">
      <div class="orders-toolbar">
        <input id="orderSearch" class="compact-search wide" placeholder="Cari invoice / nama / email / HP">
        <label class="per-page"><span>Tampilkan</span>
          <select id="perPage"><option>5</option><option selected>10</option><option>25</option><option>50</option><option>100</option></select>
          <span>order</span>
        </label>
      </div>
      <div id="ordersTable"></div>
      <div id="pagination"></div>
    </section>

    <div id="proofModal" class="admin-modal hidden">
      <div class="modal-backdrop" data-close-proof></div>
      <div class="modal-card">
        <div class="modal-head"><div><div class="kicker">BUKTI PEMBAYARAN</div><h2>Bukti Pembayaran</h2></div><button class="btn ghost" type="button" data-close-proof>Tutup</button></div>
        <div id="proofBody"></div>
      </div>
    </div>`;

  $("#perPage").value = String(ordersPerPage);
  $("#perPage").onchange = () => { ordersPerPage = Number($("#perPage").value); currentPage = 1; renderOrdersTable(mode); };
  $("#orderSearch").oninput = () => { currentPage = 1; renderOrdersTable(mode); };
  document.querySelectorAll("[data-close-proof]").forEach(el => el.onclick = closeProof);
  renderOrdersTable(mode);
}

function renderSizeSummary(data) {
  const map = new Map();
  for (const order of data) {
    for (const item of order.order_items || []) {
      if (!["TSHIRT","JACKET"].includes(item.product_category) || !item.size) continue;
      const key = `${item.product_category}|${item.size}`;
      map.set(key, (map.get(key) || 0) + Number(item.quantity || 0));
    }
  }

  const rows = [...map.entries()].sort((a,b) => {
    const [ca,sa]=a[0].split("|"), [cb,sb]=b[0].split("|");
    return ca.localeCompare(cb) || sa.localeCompare(sb, undefined, {numeric:true});
  });

  return `
    <section class="size-summary-grid">
      ${["TSHIRT","JACKET"].map(cat => {
        const vals = rows.filter(([key]) => key.startsWith(cat + "|"));
        return `<div class="size-card">
          <div class="size-card-head"><span>${cat === "TSHIRT" ? "KAOS" : "JAKET"}</span><strong>${vals.reduce((s,[,n])=>s+n,0)}</strong><small>pcs</small></div>
          <div class="size-list">
            ${vals.length ? vals.map(([key,n]) => `<div><span>${escapeHtml(key.split("|")[1])}</span><strong>${n}</strong></div>`).join("") : `<span class="muted">Belum ada order ukuran.</span>`}
          </div>
        </div>`;
      }).join("")}
    </section>`;
}

function renderOrdersTable(mode) {
  const all = filteredOrders(mode);
  const q = ($("#orderSearch")?.value || "").toLowerCase().trim();
  const filtered = all.filter(o => [
    o.invoice_no,o.customer_name,o.customer_email,o.customer_phone,o.customer_contact
  ].join(" ").toLowerCase().includes(q));

  const pages = Math.max(1, Math.ceil(filtered.length / ordersPerPage));
  currentPage = Math.min(currentPage, pages);
  const visible = filtered.slice((currentPage-1)*ordersPerPage, currentPage*ordersPerPage);

  $("#ordersTable").innerHTML = visible.length ? `
    <div class="orders-table-wrap">
      <table class="orders-table">
        <thead><tr>
          <th>Invoice</th><th>Customer</th><th>Item</th><th>Pengiriman</th><th>Pembayaran</th><th>Status</th><th>Aksi</th>
        </tr></thead>
        <tbody>
          ${visible.map(o => {
            const items = categoryItems(o, mode === "merchandise" ? "MERCHANDISE" : "TSHIRT")
              .concat(mode === "apparel" ? categoryItems(o,"JACKET") : []);
            const itemHtml = items.map(i => `${escapeHtml(i.product_name)}${i.size ? ` <span class="item-size">(${escapeHtml(i.size)})</span>`:""} × ${i.quantity}`).join("<br>") || "-";
            return `<tr>
              <td><strong>${escapeHtml(o.invoice_no)}</strong><small>${formatDate(o.created_at)}</small></td>
              <td><strong>${escapeHtml(o.customer_name)}</strong><small>${escapeHtml(o.customer_email || "-")}</small><small>${escapeHtml(o.customer_phone || o.customer_contact || "-")}</small></td>
              <td>${itemHtml}</td>
              <td><strong>${o.delivery_method === "SHIP_TO_ADDRESS" ? "Dikirim" : "Booth CF24"}</strong><small>${o.delivery_method === "SHIP_TO_ADDRESS" ? escapeHtml(o.customer_address || "-") : "Ambil langsung"}</small></td>
              <td><strong>${formatRupiah(o.total_amount)}</strong><small>${o.payment_plan === "FULL" ? "Full Payment" : "DP"} · ${o.payment_method === "QRIS" ? "QRIS" : "Transfer BCA"}</small><small>Bayar ${formatRupiah(o.payment_amount_due || 0)}</small></td>
              <td><span class="status-pill ${o.payment_status === "LUNAS" ? "paid" : "pending"}">${escapeHtml(o.payment_status)}</span><small>Dibayar ${formatRupiah(o.paid_amount)}</small><small>Sisa ${formatRupiah(o.remaining_amount)}</small></td>
              <td><div class="row-actions">
                <button class="btn tiny ghost" data-detail="${o.id}" type="button">Detail</button>
                ${o.payment_proof_path ? `<button class="btn tiny ghost" data-proof="${o.id}" type="button">Bukti</button>` : `<span class="no-proof">Belum ada bukti</span>`}
                ${o.payment_status === "DP" ? `<button class="btn tiny primary" data-paid="${o.id}" type="button">Tandai Lunas</button>` : `<button class="btn tiny ghost" data-dp="${o.id}" type="button">Ubah DP</button>`}
              </div></td>
            </tr>
            <tr id="detail-${o.id}" class="hidden"><td colspan="7">${renderOrderDetail(o,mode)}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>` : `<div class="empty-state">Tidak ada order yang cocok.</div>`;

  document.querySelectorAll("[data-detail]").forEach(b=>b.onclick=()=>$("#detail-"+b.dataset.detail).classList.toggle("hidden"));
  document.querySelectorAll("[data-proof]").forEach(b=>b.onclick=()=>viewProof(b.dataset.proof));
  document.querySelectorAll("[data-paid]").forEach(b=>b.onclick=()=>updatePaymentStatus(b.dataset.paid,"LUNAS",mode));
  document.querySelectorAll("[data-dp]").forEach(b=>b.onclick=()=>updatePaymentStatus(b.dataset.dp,"DP",mode));

  $("#pagination").innerHTML = pages > 1 ? `
    <div class="pagination">
      <span class="muted">Halaman ${currentPage} dari ${pages}</span>
      <div class="pagination-buttons">
        <button class="page-btn" data-page="${Math.max(1,currentPage-1)}" ${currentPage===1?"disabled":""}>‹</button>
        ${Array.from({length:pages},(_,i)=>i+1).map(i=>`<button class="page-btn ${i===currentPage?"active":""}" data-page="${i}">${i}</button>`).join("")}
        <button class="page-btn" data-page="${Math.min(pages,currentPage+1)}" ${currentPage===pages?"disabled":""}>›</button>
      </div>
    </div>` : "";

  document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>{currentPage=Number(b.dataset.page);renderOrdersTable(mode);window.scrollTo({top:0,behavior:"smooth"});});
}

function renderOrderDetail(o, mode) {
  const delivery = o.delivery_method === "SHIP_TO_ADDRESS"
    ? `Dikirim ke alamat<br><strong>${escapeHtml(o.customer_address || "-")}</strong>`
    : "Ambil di Booth CF24";

  const items = (o.order_items || []).filter(i =>
    mode === "merchandise" ? i.product_category === "MERCHANDISE" : ["TSHIRT","JACKET"].includes(i.product_category)
  );

  return `<div class="detail-box">
    <div class="detail-grid">
      <div><span>Customer</span><strong>${escapeHtml(o.customer_name)}</strong><small>${escapeHtml(o.customer_email || "-")}</small><small>${escapeHtml(o.customer_phone || o.customer_contact || "-")}</small></div>
      <div><span>Pengiriman</span><strong>${delivery}</strong></div>
      <div><span>Pembayaran</span><strong>${o.payment_plan==="FULL"?"Full Payment":"DP"} · ${o.payment_method==="QRIS"?"QRIS":"Transfer BCA"}</strong><small>Dibayar ${formatRupiah(o.paid_amount)}</small><small>Sisa ${formatRupiah(o.remaining_amount)}</small><small>${o.payment_verified_at ? "Diverifikasi " + formatDate(o.payment_verified_at) : "Belum diverifikasi"}</small></div>
    </div>
    <div class="detail-products"><span>Produk</span>
      ${items.map(i=>`<div class="detail-product-row"><span>${escapeHtml(i.product_name)}${i.size ? ` · Size ${escapeHtml(i.size)}`:""} × ${i.quantity}</span><strong>${formatRupiah(i.subtotal)}</strong></div>`).join("")}
    </div>
  </div>`;
}

async function updatePaymentStatus(id,status,mode) {
  const o = orders.find(x=>x.id===id);
  if (!o) return;
  let paid = Number(o.paid_amount || 0);

  if (status === "LUNAS") paid = Number(o.total_amount);
  else {
    const max = Math.max(1, Number(o.total_amount)-1);
    const suggested = Math.min(max, Number(o.paid_amount || o.payment_amount_due || 1));
    const answer = prompt(`Nominal pembayaran untuk ${o.invoice_no}:`, String(suggested));
    if (answer === null) return;
    paid = Number(answer);
    if (!Number.isInteger(paid) || paid <= 0 || paid >= Number(o.total_amount)) {
      return alert("Nominal DP harus lebih dari 0 dan kurang dari total.");
    }
  }

  const { error } = await supabase.from("orders").update({
    payment_status: status,
    paid_amount: paid,
    payment_verified_at: new Date().toISOString()
  }).eq("id",id);

  if (error) return alert("Gagal mengubah status: " + error.message);

  await loadOrders();
  renderOrdersPage(mode);
  msg(`Status ${o.invoice_no} berhasil diubah menjadi ${status}.`, "success");
}

async function viewProof(id) {
  const o = orders.find(x=>x.id===id);
  if (!o?.payment_proof_path) return;
  $("#proofModal").classList.remove("hidden");
  $("#proofBody").innerHTML = `<div class="loading">Memuat bukti pembayaran...</div>`;

  const {data,error} = await supabase.storage.from("payment-proofs").createSignedUrl(o.payment_proof_path,600);
  if (error) {
    $("#proofBody").innerHTML = `<div class="admin-message error">${escapeHtml(error.message)}</div>`;
    return;
  }

  $("#proofBody").innerHTML = /\.pdf$/i.test(o.payment_proof_path)
    ? `<iframe class="proof-frame" src="${escapeHtml(data.signedUrl)}" title="Bukti pembayaran"></iframe><a class="btn primary" href="${escapeHtml(data.signedUrl)}" target="_blank" rel="noreferrer">Buka PDF</a>`
    : `<img class="proof-image" src="${escapeHtml(data.signedUrl)}" alt="Bukti pembayaran">`;
}

function closeProof() {
  const el = $("#proofModal");
  if (el) el.classList.add("hidden");
}

function renderSettingsPage() {
  $("#pageContent").innerHTML = `
    <section class="page-title-row">
      <div><div class="kicker">KONFIGURASI</div><h1>Pengaturan</h1><p class="muted">Semua pengaturan website dalam satu halaman.</p></div>
    </section>

    <form id="settingsForm" class="settings-layout">
      <section class="panel-card">
        <div class="panel-head"><div><h2>Website</h2><p class="muted">Identitas yang tampil di customer.</p></div></div>
        <div class="stack">
          <label>Nama Situs<input id="sSiteName" required></label>
          <label>Judul Situs<input id="sSiteTitle" required></label>
          <label>Deskripsi<textarea id="sSiteDescription" rows="4" required></textarea></label>
        </div>
      </section>

      <section class="panel-card">
        <div class="panel-head"><div><h2>Pembayaran</h2><p class="muted">Nominal DP dan rekening transfer.</p></div></div>
        <div class="stack">
          <label>Persentase DP<input id="sDp" type="number" min="1" max="99" required></label>
          <label>Nama Pemilik Rekening<input id="sBcaName"></label>
          <label>Nomor Rekening<input id="sBcaNumber"></label>
        </div>
      </section>

      <section class="panel-card">
        <div class="panel-head"><div><h2>Tampilan</h2><p class="muted">Warna utama dan aksen.</p></div></div>
        <div class="form-grid two">
          <label>Warna Utama<input id="sPrimary" type="color"></label>
          <label>Warna Aksen<input id="sAccent" type="color"></label>
        </div>
      </section>

      <section class="panel-card">
        <div class="panel-head"><div><h2>Media</h2><p class="muted">Upload aset website dan QRIS.</p></div></div>
        <div class="stack">
          <label>Logo<input id="sLogo" type="file" accept="image/png,image/jpeg,image/webp"></label>
          <label>Banner<input id="sBanner" type="file" accept="image/png,image/jpeg,image/webp"></label>
          <label>QRIS<input id="sQris" type="file" accept="image/png,image/jpeg,image/webp"></label>
          <div id="settingsPreview" class="settings-preview"></div>
        </div>
      </section>

      <div class="settings-actions"><button class="btn primary" type="submit">Simpan Semua Pengaturan</button></div>
    </form>`;

  $("#sSiteName").value = settings.site_name || "";
  $("#sSiteTitle").value = settings.site_title || "";
  $("#sSiteDescription").value = settings.site_description || "";
  $("#sDp").value = settings.dp_percentage ?? 50;
  $("#sBcaName").value = settings.bca_account_name || "";
  $("#sBcaNumber").value = settings.bca_account_number || "";
  $("#sPrimary").value = settings.primary_color || "#111111";
  $("#sAccent").value = settings.accent_color || "#777777";
  renderSettingsPreview();
  $("#settingsForm").onsubmit = saveSettings;
}

function renderSettingsPreview() {
  $("#settingsPreview").innerHTML = `
    ${settings.logo_url ? `<div><span>Logo</span><img src="${escapeHtml(settings.logo_url)}" alt="Logo"></div>` : ""}
    ${settings.banner_url ? `<div><span>Banner</span><img class="banner-preview" src="${escapeHtml(settings.banner_url)}" alt="Banner"></div>` : ""}
    ${settings.qris_image_url ? `<div><span>QRIS</span><img src="${escapeHtml(settings.qris_image_url)}" alt="QRIS"></div>` : ""}
  `;
}

async function saveSettings(e) {
  e.preventDefault();
  const button = e.submitter;
  button.disabled = true;

  try {
    const upload = async (folder,id) => {
      const f = $(id).files?.[0];
      return f ? await uploadAsset("site-media",folder,f) : null;
    };

    const logo = await upload("logo","#sLogo") || settings.logo_url || null;
    const banner = await upload("banner","#sBanner") || settings.banner_url || null;
    const qris = await upload("qris","#sQris") || settings.qris_image_url || null;

    const payload = {
      id:1,
      site_name:$("#sSiteName").value.trim(),
      site_title:$("#sSiteTitle").value.trim(),
      site_description:$("#sSiteDescription").value.trim(),
      dp_percentage:Number($("#sDp").value),
      bca_account_name:$("#sBcaName").value.trim(),
      bca_account_number:$("#sBcaNumber").value.trim(),
      primary_color:$("#sPrimary").value,
      accent_color:$("#sAccent").value,
      logo_url:logo,
      banner_url:banner,
      qris_image_url:qris,
      updated_at:new Date().toISOString()
    };

    if (!payload.site_name || !payload.site_title || !payload.site_description) throw new Error("Nama, judul, dan deskripsi wajib diisi.");
    if (!Number.isInteger(payload.dp_percentage) || payload.dp_percentage < 1 || payload.dp_percentage > 99) throw new Error("Persentase DP harus 1–99.");

    const {error} = await supabase.from("site_settings").upsert(payload,{onConflict:"id"});
    if (error) throw error;
    settings = {...settings,...payload};
    renderSettingsPage();
    msg("Pengaturan berhasil disimpan.","success");
  } catch (error) {
    msg("Gagal menyimpan pengaturan: " + error.message,"error");
  } finally {
    button.disabled = false;
  }
}

/* Minimal XLSX writer, no extra npm dependency. */
function crc32(bytes) {
  let table = crc32.table;
  if (!table) {
    table = [];
    for (let n=0; n<256; n++) {
      let c=n;
      for (let k=0; k<8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n]=c>>>0;
    }
    crc32.table=table;
  }
  let c=0xFFFFFFFF;
  for (const b of bytes) c=table[(c^b)&255]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;
}
function u16(n){return [n&255,(n>>>8)&255];}
function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];}
function zipStore(files) {
  const chunks=[]; const central=[]; let offset=0;
  const enc = new TextEncoder();
  for (const file of files) {
    const name = enc.encode(file.name);
    const data = typeof file.data === "string" ? enc.encode(file.data) : file.data;
    const crc=crc32(data);
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(name.length), ...u16(0), ...name
    ]);
    chunks.push(local, data);
    const cen = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
      ...u32(offset), ...name
    ]);
    central.push(cen);
    offset += local.length + data.length;
  }
  const centralOffset=offset;
  let centralSize=0;
  for (const c of central){chunks.push(c);centralSize+=c.length;}
  const end=new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(centralSize), ...u32(centralOffset), ...u16(0)
  ]);
  chunks.push(end);
  return new Blob(chunks,{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}
function xesc(v){return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
function colName(n){let s="";while(n){let r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;}
function sheetXml(rows) {
  let r=1;
  const body=rows.map(row=>{
    let c=1;
    const cells=row.map(value=>{
      const ref=`${colName(c++)}${r}`;
      if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xesc(value)}</t></is></c>`;
    }).join("");
    r++;
    return `<row r="${r-1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}
function makeXlsx(sheets) {
  const files=[];
  files.push({name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`});
  files.push({name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`});
  files.push({name:"xl/workbook.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xesc(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("")}</sheets></workbook>`});
  files.push({name:"xl/_rels/workbook.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`});
  files.push({name:"xl/styles.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><color rgb="000000"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellXfs></styleSheet>`});
  sheets.forEach((s,i)=>files.push({name:`xl/worksheets/sheet${i+1}.xml`,data:sheetXml(s.rows)}));
  return zipStore(files);
}
function orderRows(list) {
  const rows=[["Invoice","Tanggal","Customer","Email","HP","Pengiriman","Alamat","Rencana Pembayaran","Metode","Total","Bayar Sekarang","Dibayar","Sisa","Status","Bukti","Produk","Kategori","Size","Qty"]];
  for (const o of list) {
    for (const i of o.order_items || []) {
      rows.push([
        o.invoice_no, formatDate(o.created_at), o.customer_name, o.customer_email || "",
        o.customer_phone || o.customer_contact || "",
        o.delivery_method === "SHIP_TO_ADDRESS" ? "Dikirim" : "Booth CF24",
        o.customer_address || "",
        o.payment_plan === "FULL" ? "Full Payment" : "DP",
        o.payment_method === "QRIS" ? "QRIS" : "Transfer BCA",
        Number(o.total_amount), Number(o.payment_amount_due || 0), Number(o.paid_amount || 0),
        Number(o.remaining_amount || 0), o.payment_status,
        o.payment_proof_path ? "Ada" : "Belum",
        i.product_name, productCategoryLabel(i.product_category), i.size || "", Number(i.quantity || 0)
      ]);
    }
  }
  return rows;
}
function exportAllOrders() {
  const apparel=orders.filter(o=>orderHasCategory(o,["TSHIRT","JACKET"]));
  const merch=orders.filter(o=>orderHasCategory(o,["MERCHANDISE"]));
  const sizeMap = new Map();
  for (const o of apparel) {
    for (const i of o.order_items || []) {
      if (!["TSHIRT","JACKET"].includes(i.product_category) || !i.size) continue;
      const key=`${productCategoryLabel(i.product_category)}|${i.size}`;
      sizeMap.set(key,(sizeMap.get(key)||0)+Number(i.quantity||0));
    }
  }
  const sizeRows=[["Kategori","Size","Total Qty"]];
  [...sizeMap.entries()].sort().forEach(([key,n])=>sizeRows.push([...key.split("|"),n]));
  const orderOverview=[["Invoice","Tanggal","Customer","Email","HP","Pengiriman","Rencana","Metode","Total","Dibayar","Sisa","Status","Kategori Order"]];
  for(const o of orders){
    const cats=[...new Set((o.order_items||[]).map(i=>productCategoryLabel(i.product_category)))].join(", ");
    orderOverview.push([o.invoice_no,formatDate(o.created_at),o.customer_name,o.customer_email||"",o.customer_phone||o.customer_contact||"",o.delivery_method==="SHIP_TO_ADDRESS"?"Dikirim":"Booth CF24",o.payment_plan==="FULL"?"Full Payment":"DP",o.payment_method==="QRIS"?"QRIS":"Transfer BCA",Number(o.total_amount),Number(o.paid_amount||0),Number(o.remaining_amount||0),o.payment_status,cats]);
  }
  const sheets=[
    {name:"Semua Order",rows:orderOverview},
    {name:"Order Merchandise",rows:orderRows(merch)},
    {name:"Order Kaos-Jaket",rows:orderRows(apparel)},
    {name:"Rekap Size",rows:sizeRows}
  ];
  const blob=makeXlsx(sheets);
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`itabaka-orders-${new Date().toISOString().slice(0,10)}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  msg("Export Excel berhasil dibuat.","success");
}

async function renderPage() {
  if (page === "products") {
    await Promise.all([loadProducts(),loadOrders()]);
    renderProductsPage();
  } else if (page === "merchandise") {
    await loadOrders();
    renderOrdersPage("merchandise");
  } else if (page === "apparel") {
    await loadOrders();
    renderOrdersPage("apparel");
  } else {
    await loadSettings();
    renderSettingsPage();
  }
}

async function boot() {
  const session = await getSession();
  if (!session) return loginView();
  shell(session);
  try {
    await renderPage();
  } catch (error) {
    const target=$("#pageContent");
    if(target) target.innerHTML=`<div class="admin-message error">${escapeHtml(error.message)}</div>`;
  }
}

supabase.auth.onAuthStateChange(() => {
  if (bootBusy) return;
  bootBusy = true;
  setTimeout(async()=>{try{await boot();}finally{bootBusy=false;}},0);
});

boot();
