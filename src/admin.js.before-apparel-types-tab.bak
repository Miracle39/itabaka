import "./admin.css";
import { supabase } from "./lib/supabase.js";
import { escapeHtml, formatDate, formatRupiah } from "./lib/format.js";

const page = document.body.dataset.adminPage || "products";
const app = document.querySelector("#app");
let products = [];
let orders = [];
let apparelTypes = [];
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
    : target === "allOrders" ? "/admin-all-orders.html"
    : target === "merchandise" ? "/admin-orders.html"
    : target === "apparel" ? "/admin-apparel.html"
    : target === "promos" ? "/admin-promos.html"
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
            ${nav("allOrders","Semua Order")}
            ${nav("merchandise","Merchandise")}
            ${nav("apparel","Kaos / Jaket")}
            ${nav("promos","Promo Member")}
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
    category,apparel_type,available_sizes,created_at,updated_at
  `).order("sort_order").order("name");
  if (error) throw error;
  products = data || [];
}

async function loadApparelTypes() {
  const { data, error } = await supabase
    .from("apparel_types")
    .select("code,name,is_active,sort_order")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  apparelTypes = data || [];
}

function apparelTypeName(code) {
  const found = apparelTypes.find(type => type.code === code);
  if (found) return found.name;
  if (code === "TSHIRT") return "Kaos";
  if (code === "JACKET") return "Jaket";
  return code || "Apparel";
}

async function loadOrders() {
  const { data, error } = await supabase.from("orders").select(`
    id,invoice_no,created_at,
    customer_name,customer_email,customer_contact,customer_phone,customer_address,
    delivery_method,payment_status,payment_plan,payment_method,customer_payment_status,
    payment_amount_due,total_amount,subtotal_amount,discount_amount,promo_code,paid_amount,remaining_amount,
    payment_proof_path,payment_proof_uploaded_at,settlement_proof_path,settlement_proof_uploaded_at,payment_verified_at,
    order_items(
      id,product_id,product_name,product_category,apparel_type,size,unit_price,quantity,subtotal
    ),
    order_payments(
      id,payment_type,expected_amount,reported_amount,proof_path,internal_status,internal_note,uploaded_at,checked_at,checked_by
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

function getOrderItemApparelType(item) {
  if (item?.apparel_type) return item.apparel_type;
  // Pesanan lama tetap menggunakan product_category TSHIRT/JACKET.
  if (item?.product_category === "TSHIRT" || item?.product_category === "JACKET") return item.product_category;
  return null;
}

function isOrderItemApparel(item) {
  return item?.product_category === "APPAREL" || Boolean(getOrderItemApparelType(item));
}

function productCategoryLabel(category, apparelType = null) {
  const type = apparelType || (category === "TSHIRT" || category === "JACKET" ? category : null);
  return type ? apparelTypeName(type) : "Merchandise";
}

function categoryItems(order, cat) {
  return (order.order_items || []).filter(i =>
    cat === "APPAREL" ? isOrderItemApparel(i) : i.product_category === cat
  );
}

function orderHasCategory(order, cats) {
  return (order.order_items || []).some(i =>
    (cats.includes("APPAREL") && isOrderItemApparel(i)) || cats.includes(i.product_category)
  );
}

// Angka yang ditampilkan mengikuti rencana customer sampai admin mencatat
// pembayaran yang benar-benar sudah dicek saat serah-terima.
function getOrderPaymentSummary(order) {
  const lineTotal = (order.order_items || []).reduce((sum, item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unit_price || 0);
    const subtotal = item.subtotal == null ? price * qty : Number(item.subtotal);
    return sum + Math.max(0, Number.isFinite(subtotal) ? subtotal : price * qty);
  }, 0);

  const storedTotal = Number(order.total_amount || 0);
  const total = storedTotal > 0 ? storedTotal : lineTotal;
  const isFullPlan = order.payment_plan === "FULL";
  const percentage = Number(settings.dp_percentage || 50);
  const calculatedDue = isFullPlan
    ? total
    : Math.min(total, Math.max(0, Math.ceil(total * percentage / 100)));
  const storedDue = Number(order.payment_amount_due || 0);
  const due = storedDue > 0 ? Math.min(total, storedDue) : calculatedDue;
  const storedPaid = Math.max(0, Number(order.paid_amount || 0));
  const verified = Boolean(order.payment_verified_at) || order.payment_status === "LUNAS" || storedPaid > 0;

  // Status customer langsung menjadi LUNAS setelah memilih FULL atau mengunggah
  // bukti pelunasan DP. Status internal tetap terpisah untuk verifikasi admin.
  const customerStatus = String(
    order.customer_payment_status || (isFullPlan ? "LUNAS" : "DP")
  ).trim().toUpperCase();
  const isPaidStatus = customerStatus === "LUNAS" || (verified && order.payment_status === "LUNAS");
  const statusLabel = isPaidStatus ? "LUNAS" : "DP";

  // Nominal terbayar mengikuti status pesanan customer. Untuk DP yang belum
  // lunas, tampilkan nominal DP; setelah LUNAS, seluruh total dianggap terbayar.
  const paid = isPaidStatus
    ? total
    : (verified ? Math.min(total, storedPaid) : due);
  const remaining = isPaidStatus ? 0 : Math.max(0, total - paid);

  return { total, due, paid, remaining, verified, statusLabel, isFullPlan, isPaidStatus };
}

function renderProductsPage() {
  const merch = orders.filter(o => orderHasCategory(o, ["MERCHANDISE"])).length;
  const apparel = orders.filter(o => orderHasCategory(o, ["APPAREL","TSHIRT","JACKET"])).length;

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
      <div class="stat-card"><span>Rencana DP</span><strong>${orders.filter(o=>o.payment_plan==="DP").length}</strong></div>
      <div class="stat-card"><span>Rencana Full Payment</span><strong>${orders.filter(o=>o.payment_plan==="FULL").length}</strong></div>
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
          <div class="form-grid two">
            <label>Kategori
              <select id="pCategory">
                <option value="MERCHANDISE">Merchandise</option>
                <option value="APPAREL">Apparel</option>
              </select>
            </label>
            <label id="apparelTypeField" class="hidden">Jenis Apparel
              <select id="pApparelType"></select>
            </label>
          </div>
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
    </div>

    <section class="panel-card apparel-type-manager" style="margin-top:22px">
      <div class="panel-head">
        <div><div class="kicker">PENGELOLAAN KATEGORI</div><h2>Jenis Apparel</h2><p class="muted">Tambah jenis pakaian tanpa mengubah kode website.</p></div>
      </div>
      <form id="apparelTypeForm" class="form-grid two" style="align-items:end">
        <label>Nama jenis baru<input id="newApparelTypeName" maxlength="50" placeholder="Contoh: Hoodie" required></label>
        <button class="btn primary" type="submit">Tambah Jenis Apparel</button>
      </form>
      <div id="apparelTypeList" style="margin-top:16px"></div>
    </section>`;

  renderApparelTypeOptions();
  renderApparelTypeManager();
  $("#apparelTypeForm").onsubmit = addApparelType;
  $("#productForm").onsubmit = saveProduct;
  $("#pCategory").onchange = syncApparelTypeField;
  syncApparelTypeField();
  $("#cancelEdit").onclick = resetProductForm;
  $("#productSearch").oninput = renderCatalogList;
  $("#exportOrders").onclick = exportAllOrders;
  renderCatalogList();
}

function makeApparelTypeCode(name) {
  const ascii = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const base = ascii.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return base.slice(0, 40);
}

function renderApparelTypeOptions(selected = null) {
  const select = $("#pApparelType");
  if (!select) return;
  const current = selected || select.value;
  const active = apparelTypes.filter(type => type.is_active || type.code === current);
  select.innerHTML = active.map(type => `<option value="${escapeHtml(type.code)}">${escapeHtml(type.name)}${type.is_active ? "" : " (Nonaktif - produk lama)"}</option>`).join("");
  if (current && active.some(type => type.code === current)) select.value = current;
  else if (active.length) select.value = active[0].code;
}

function renderApparelTypeManager() {
  const target = $("#apparelTypeList");
  if (!target) return;
  target.innerHTML = apparelTypes.length ? `
    <div class="table-wrap"><table class="admin-table"><thead><tr><th>Jenis</th><th>Kode</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
      ${apparelTypes.map(type => `<tr>
        <td><strong>${escapeHtml(type.name)}</strong></td><td><code>${escapeHtml(type.code)}</code></td>
        <td><span class="status-pill ${type.is_active ? "active" : "inactive"}">${type.is_active ? "AKTIF" : "NONAKTIF"}</span></td>
        <td><button class="btn ghost" type="button" data-toggle-apparel-type="${escapeHtml(type.code)}" data-active="${type.is_active ? "true" : "false"}">${type.is_active ? "Nonaktifkan" : "Aktifkan"}</button></td>
      </tr>`).join("")}
    </tbody></table></div>` : `<div class="empty-state">Belum ada jenis Apparel.</div>`;
  target.querySelectorAll("[data-toggle-apparel-type]").forEach(button => {
    button.onclick = () => toggleApparelType(button.dataset.toggleApparelType, button.dataset.active !== "true");
  });
}

async function addApparelType(event) {
  event.preventDefault();
  const name = $("#newApparelTypeName").value.trim();
  const code = makeApparelTypeCode(name);
  if (!code) return msg("Nama jenis tidak valid.", "error");
  if (apparelTypes.some(type => type.code === code || type.name.toLowerCase() === name.toLowerCase())) {
    return msg("Jenis Apparel tersebut sudah ada.", "error");
  }
  const { error } = await supabase.from("apparel_types").insert({
    code, name, is_active: true, sort_order: apparelTypes.length * 10
  });
  if (error) return msg("Gagal menambahkan jenis: " + error.message, "error");
  $("#newApparelTypeName").value = "";
  await loadApparelTypes();
  renderApparelTypeOptions();
  renderApparelTypeManager();
  msg("Jenis Apparel berhasil ditambahkan.", "success");
}

async function toggleApparelType(code, active) {
  const { error } = await supabase.from("apparel_types").update({is_active: active}).eq("code", code);
  if (error) return msg("Gagal mengubah status jenis: " + error.message, "error");
  await loadApparelTypes();
  renderApparelTypeOptions();
  renderApparelTypeManager();
  msg(active ? "Jenis Apparel diaktifkan." : "Jenis Apparel dinonaktifkan.", "success");
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
              <div><span>Kategori</span><strong>${productCategoryLabel(p.category, p.apparel_type)}</strong></div>
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

function syncApparelTypeField() {
  const isApparel = $("#pCategory")?.value === "APPAREL";
  $("#apparelTypeField")?.classList.toggle("hidden", !isApparel);
  const sizesLabel = $("#pSizes")?.closest("label");
  if (sizesLabel) sizesLabel.classList.toggle("hidden", !isApparel);
}

function editProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  editingProductId = id;
  $("#productFormTitle").textContent = "Edit Produk";
  $("#pCode").value = p.code || "";
  $("#pName").value = p.name || "";
  $("#pCategory").value = p.category === "TSHIRT" || p.category === "JACKET" ? "APPAREL" : (p.category || "MERCHANDISE");
  renderApparelTypeOptions(p.apparel_type || (p.category === "JACKET" ? "JACKET" : "TSHIRT"));
  syncApparelTypeField();
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
  renderApparelTypeOptions();
  syncApparelTypeField();
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
    const apparelType = category === "APPAREL" ? $("#pApparelType").value : null;
    if (category === "APPAREL" && !apparelType) throw new Error("Tambahkan jenis Apparel terlebih dahulu.");
    const sizes = $("#pSizes").value.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    if (category === "APPAREL" && !sizes.length) {
      throw new Error("Apparel harus memiliki minimal satu ukuran.");
    }

    let imageUrl = $("#pImageUrl").value.trim() || null;
    const file = $("#pImageFile").files?.[0];
    if (file) imageUrl = await uploadAsset("product-images","products",file);

    const payload = {
      code: $("#pCode").value.trim(),
      name: $("#pName").value.trim(),
      category,
      apparel_type: apparelType,
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
  if (categoryMode === "apparel") return orders.filter(o => orderHasCategory(o,["APPAREL","TSHIRT","JACKET"]));
  return orders;
}

function renderOrdersPage(mode) {
  currentPage = 1;
  const data = filteredOrders(mode);
  const isApparel = mode === "apparel";
  const isAllOrders = mode === "all";
  const pageKicker = isAllOrders ? "SEMUA ORDER" : isApparel ? "KAOS / JAKET" : "MERCHANDISE";
  const pageTitle = isAllOrders ? "Semua Order" : isApparel ? "Order Kaos / Jaket" : "Order Merchandise";
  const pageDescription = isAllOrders
    ? "Satu nomor invoice menampilkan semua item dari pesanan yang sama, termasuk merchandise, kaos, dan jaket."
    : isApparel
      ? "Order apparel lengkap dengan ukuran dan rekap jumlah per size."
      : "Daftar order merchandise yang masuk.";

  $("#pageContent").innerHTML = `
    <section class="page-title-row">
      <div>
        <div class="kicker">${pageKicker}</div>
        <h1>${pageTitle}</h1>
        <p class="muted">${pageDescription}</p>
      </div>
      <div class="page-count">${data.length} invoice</div>
    </section>

    ${(isApparel || isAllOrders) ? renderSizeSummary(data) : ""}

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
    </div>

    <div id="paymentEditModal" class="admin-modal hidden">
      <div class="modal-backdrop" data-close-payment></div>
      <div class="modal-card payment-edit-card">
        <div class="modal-head">
          <div><div class="kicker">PEMBAYARAN</div><h2>Edit Pembayaran / DP</h2><p class="muted">Atur status dan nominal pembayaran pada invoice ini.</p></div>
          <button class="btn ghost" type="button" data-close-payment>Tutup</button>
        </div>
        <div id="paymentEditMessage"></div>
        <form id="paymentEditForm" class="payment-edit-form">
          <input id="paymentEditOrderId" type="hidden">
          <div class="payment-edit-reference">
            <span>Nomor invoice</span><strong id="paymentEditInvoice">-</strong>
            <span>Total pesanan</span><strong id="paymentEditTotal">Rp0</strong>
          </div>
          <label>Status pembayaran
            <select id="paymentEditStatus">
              <option value="DP">DP / Pembayaran sebagian</option>
              <option value="LUNAS">LUNAS / Full payment</option>
            </select>
          </label>
          <label>Nominal dibayar (Rp)
            <input id="paymentEditAmount" type="number" min="0" step="1" required>
          </label>
          <p id="paymentEditHint" class="muted small">Untuk status DP, nominal harus lebih kecil dari total pesanan.</p>
          <div class="step-actions end">
            <button class="btn ghost" type="button" data-close-payment>Batal</button>
            <button class="btn primary" id="paymentEditSave" type="submit">Simpan Pembayaran</button>
          </div>
        </form>
      </div>
    </div>`;

  $("#perPage").value = String(ordersPerPage);
  $("#perPage").onchange = () => { ordersPerPage = Number($("#perPage").value); currentPage = 1; renderOrdersTable(mode); };
  $("#orderSearch").oninput = () => { currentPage = 1; renderOrdersTable(mode); };
  document.querySelectorAll("[data-close-proof]").forEach(el => el.onclick = closeProof);
  document.querySelectorAll("[data-close-payment]").forEach(el => el.onclick = closePaymentEditor);
  $("#paymentEditStatus").onchange = () => syncPaymentEditAmount(true);
  $("#paymentEditForm").onsubmit = event => savePaymentEdit(event, mode);
  renderOrdersTable(mode);
}

function renderSizeSummary(data) {
  const map = new Map();
  for (const order of data) {
    for (const item of order.order_items || []) {
      const apparelType = getOrderItemApparelType(item);
      if (!apparelType || !item.size) continue;
      const key = `${apparelType}|${item.size}`;
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
            const items = mode === "all"
              ? (o.order_items || [])
              : categoryItems(o, mode === "merchandise" ? "MERCHANDISE" : "APPAREL");
            const itemHtml = items.map(i => {
              const categoryLabel = productCategoryLabel(i.product_category, getOrderItemApparelType(i));
              const categoryTag = mode === "all" ? `<span class="category-tag">${categoryLabel}</span> ` : "";
              return `${categoryTag}${escapeHtml(i.product_name)}${i.size ? ` <span class="item-size">(${escapeHtml(i.size)})</span>`:""} × ${i.quantity}`;
            }).join("<br>") || "-";
            const payment = getOrderPaymentSummary(o);
            const initialPayment = (o.order_payments || []).find(p => p.payment_type === "INITIAL");
            const settlementPayment = (o.order_payments || []).find(p => p.payment_type === "SETTLEMENT");
            const hasInitialProof = Boolean(initialPayment?.proof_path || o.payment_proof_path);
            const hasSettlementProof = Boolean(settlementPayment?.proof_path || o.settlement_proof_path);
            return `<tr>
              <td><strong>${escapeHtml(o.invoice_no)}</strong><small>${formatDate(o.created_at)}</small></td>
              <td><strong>${escapeHtml(o.customer_name)}</strong><small>${escapeHtml(o.customer_email || "-")}</small><small>${escapeHtml(o.customer_phone || o.customer_contact || "-")}</small></td>
              <td>${itemHtml}</td>
              <td><strong>${o.delivery_method === "SHIP_TO_ADDRESS" ? "Dikirim" : "Booth CF24"}</strong><small>${o.delivery_method === "SHIP_TO_ADDRESS" ? escapeHtml(o.customer_address || "-") : "Ambil langsung"}</small></td>
              <td><strong>${formatRupiah(payment.total)}</strong><small>${o.payment_plan === "FULL" ? "Full Payment" : "DP"} · ${o.payment_method === "QRIS" ? "QRIS" : "Transfer BCA"}</small><small>Terbayar ${formatRupiah(payment.paid)}</small></td>
              <td><span class="status-pill ${payment.isPaidStatus ? "paid" : "pending"}">${escapeHtml(payment.statusLabel)}</span><small>Sisa aktual ${formatRupiah(payment.remaining)}</small></td>
              <td><div class="row-actions">
                <button class="btn tiny ghost" data-detail="${o.id}" type="button">Detail</button>
                <button class="btn tiny ghost" data-invoice="${o.id}" type="button">Invoice</button>
                ${hasInitialProof ? (initialPayment?.proof_path ? `<button class="btn tiny ghost" data-order-id="${o.id}" data-payment-proof="${initialPayment.id}" type="button">Bukti 1</button>` : `<button class="btn tiny ghost" data-proof="${o.id}" type="button">Bukti 1</button>`) : `<span class="no-proof">Bukti 1 belum ada</span>`}
                ${hasSettlementProof ? (settlementPayment?.proof_path ? `<button class="btn tiny ghost" data-order-id="${o.id}" data-payment-proof="${settlementPayment.id}" type="button">Bukti 2</button>` : `<button class="btn tiny ghost" data-settlement-proof-order="${o.id}" type="button">Bukti 2</button>`) : ""}

              </div></td>
            </tr>
            <tr id="detail-${o.id}" class="hidden"><td colspan="7">${renderOrderDetail(o,mode)}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>` : `<div class="empty-state">Tidak ada order yang cocok.</div>`;

  document.querySelectorAll("[data-detail]").forEach(b=>b.onclick=()=>$("#detail-"+b.dataset.detail).classList.toggle("hidden"));
  document.querySelectorAll("[data-proof]").forEach(b=>b.onclick=()=>viewProof(b.dataset.proof));
  document.querySelectorAll("[data-invoice]").forEach(b=>b.onclick=()=>viewOrderInvoice(b.dataset.invoice));
  document.querySelectorAll("[data-edit-payment]").forEach(b=>b.onclick=()=>openPaymentEditor(b.dataset.editPayment));
  document.querySelectorAll("[data-payment-proof]").forEach(b=>b.onclick=()=>viewOrderPaymentProof(b.dataset.orderId,b.dataset.paymentProof));
  document.querySelectorAll("[data-settlement-proof-order]").forEach(b=>b.onclick=()=>viewSettlementProofPath(b.dataset.settlementProofOrder));
  document.querySelectorAll("[data-save-payment-check]").forEach(b=>b.onclick=()=>saveInternalPaymentCheck(b.dataset.orderId,b.dataset.savePaymentCheck,mode));

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

  const items = mode === "all"
    ? (o.order_items || [])
    : (o.order_items || []).filter(i =>
        mode === "merchandise" ? i.product_category === "MERCHANDISE" : isOrderItemApparel(i)
      );

  const payment = getOrderPaymentSummary(o);
  const rawWaPhone = String(o.customer_phone || o.customer_contact || "").replace(/\D/g, "");
  const waPhone = rawWaPhone.startsWith("0") ? `62${rawWaPhone.slice(1)}` : rawWaPhone;
  const waMessage = encodeURIComponent(`Halo ${o.customer_name || ""}, kami dari tim Itabaka ingin mengonfirmasi pembayaran untuk invoice ${o.invoice_no}. Ada hal yang perlu kami cocokkan terkait nominal atau bukti transfer. Bisa dibantu cek kembali?`);

  return `<div class="detail-box">
    <div class="detail-grid">
      <div><span>Customer</span><strong>${escapeHtml(o.customer_name)}</strong><small>${escapeHtml(o.customer_email || "-")}</small><small>${escapeHtml(o.customer_phone || o.customer_contact || "-")}</small></div>
      <div><span>Pengiriman</span><strong>${delivery}</strong></div>
      <div><span>Pembayaran</span><strong>${o.payment_plan==="FULL"?"Full Payment":"DP"} · ${o.payment_method==="QRIS"?"QRIS":"Transfer BCA"}</strong><small>Status <span class="status-pill ${payment.isPaidStatus ? "paid" : "pending"}">${escapeHtml(payment.statusLabel)}</span></small><small>${payment.verified ? "Dibayar" : "Sesuai rencana"} ${formatRupiah(payment.paid)}</small><small>${payment.verified ? "Sisa" : "Sisa sesuai rencana"} ${formatRupiah(payment.remaining)}</small><small>${payment.verified ? (o.payment_verified_at ? "Dicek " + formatDate(o.payment_verified_at) : "Pembayaran tercatat") : "Akan dicek saat serah-terima"}</small></div>
    </div>
    <div class="detail-products"><span>Produk</span>
      ${items.map(i=>{
        const catLabel = productCategoryLabel(i.product_category, getOrderItemApparelType(i));
        const catText = mode === "all" ? `<span class="category-tag">${catLabel}</span> ` : "";
        return `<div class="detail-product-row"><span>${catText}${escapeHtml(i.product_name)}${i.size ? ` · Size ${escapeHtml(i.size)}`:""} × ${i.quantity}</span><strong>${formatRupiah(i.subtotal)}</strong></div>`;
      }).join("")}
    </div>
    <div class="detail-products"><span>Ringkasan Tagihan</span>
      <div class="detail-product-row"><span>Subtotal</span><strong>${formatRupiah(o.subtotal_amount ?? payment.total)}</strong></div>
      ${Number(o.discount_amount || 0) > 0 ? `<div class="detail-product-row"><span>Promo ${escapeHtml(o.promo_code || "Member")}</span><strong>-${formatRupiah(o.discount_amount)}</strong></div>` : ""}
      <div class="detail-product-row"><strong>Total setelah diskon</strong><strong>${formatRupiah(payment.total)}</strong></div>
      <div class="detail-product-row"><span>Status invoice customer</span><strong>${escapeHtml(o.customer_payment_status || (o.payment_plan === "FULL" ? "LUNAS" : "DP"))}</strong></div>
    </div>
    <div class="detail-products internal-payment-review"><span>Riwayat Bukti Pembayaran · Pengecekan Internal</span>
      ${(o.order_payments || []).length ? (o.order_payments || []).map(p => {
        const title = p.payment_type === "SETTLEMENT" ? "Bukti 2 · Pelunasan" : `Bukti 1 · ${o.payment_plan === "FULL" ? "Full Payment" : "DP"}`;
        const reviewLabel = p.internal_status === "MATCHED" ? "Sesuai" : p.internal_status === "CONTACT" ? "Perlu hubungi customer" : "Belum dicek";
        return `<div class="internal-payment-row" style="border:1px solid #e7e7e7;border-radius:12px;padding:13px;margin:10px 0;display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,1fr);gap:10px;align-items:end">
          <div><strong>${title}</strong><small style="display:block;color:#777;margin-top:4px">Upload ${formatDate(p.uploaded_at)} · Ekspektasi ${formatRupiah(p.expected_amount)}</small><small style="display:block;color:#777">Nominal dilaporkan ${formatRupiah(p.reported_amount)} · ${reviewLabel}</small>${p.proof_path ? `<button class="btn tiny ghost" data-order-id="${o.id}" data-payment-proof="${p.id}" type="button">Lihat Bukti</button>` : p.payment_type === "INITIAL" && o.payment_proof_path ? `<button class="btn tiny ghost" data-proof="${o.id}" type="button">Lihat Bukti Pembayaran Pertama</button>` : p.payment_type === "SETTLEMENT" && o.settlement_proof_path ? `<button class="btn tiny ghost" data-settlement-proof-order="${o.id}" type="button">Lihat Bukti Pelunasan</button>` : `<small class="muted">File bukti tidak tercatat.</small>`}${waPhone.length >= 8 ? `<a class="btn tiny ghost" href="https://wa.me/${waPhone}?text=${waMessage}" target="_blank" rel="noreferrer">Hubungi via WhatsApp</a>` : ""}</div>
          <div><label style="font-size:12px">Nominal yang terlihat di rekening<input data-reported-amount="${p.id}" type="number" min="1" step="1" value="${Number(p.reported_amount || p.expected_amount)}" style="margin:4px 0 8px"></label><label style="font-size:12px">Hasil pengecekan<select data-internal-status="${p.id}" style="margin:4px 0 8px"><option value="PENDING" ${p.internal_status === "PENDING" ? "selected" : ""}>Belum dicek</option><option value="MATCHED" ${p.internal_status === "MATCHED" ? "selected" : ""}>Sesuai</option><option value="CONTACT" ${p.internal_status === "CONTACT" ? "selected" : ""}>Perlu hubungi customer</option></select></label><input data-internal-note="${p.id}" type="text" maxlength="500" placeholder="Catatan internal / alasan hubungi customer" value="${escapeHtml(p.internal_note || "")}" style="margin:0 0 8px"><button class="btn tiny primary" data-order-id="${o.id}" data-save-payment-check="${p.id}" type="button">Simpan Pengecekan</button></div>
        </div>`;
      }).join("") : `<p class="muted small">Belum ada bukti pembayaran yang tercatat di riwayat verifikasi.</p>`}
      ${o.payment_proof_path && !(o.order_payments || []).some(p => p.payment_type === "INITIAL") ? `<div class="internal-payment-row" style="border:1px solid #e7e7e7;border-radius:12px;padding:13px;margin:10px 0"><strong>Bukti 1 · ${o.payment_plan === "FULL" ? "Full Payment" : "DP"}</strong><small style="display:block;color:#777;margin:4px 0 8px">${o.payment_proof_uploaded_at ? "Upload " + formatDate(o.payment_proof_uploaded_at) : "Bukti pembayaran awal tersimpan"}</small><button class="btn tiny ghost" data-proof="${o.id}" type="button">Lihat Bukti Pembayaran Pertama</button></div>` : ""}
      ${o.payment_plan === "DP" && !(o.order_payments || []).some(p => p.payment_type === "SETTLEMENT") ? `<div class="internal-payment-row" style="border:1px solid #e7e7e7;border-radius:12px;padding:13px;margin:10px 0"><strong>Bukti 2 · Pelunasan</strong>${o.settlement_proof_path ? `<small style="display:block;color:#777;margin:4px 0 8px">${o.settlement_proof_uploaded_at ? "Upload " + formatDate(o.settlement_proof_uploaded_at) : "Bukti pelunasan tersimpan"}</small><button class="btn tiny ghost" data-settlement-proof-order="${o.id}" type="button">Lihat Bukti Pelunasan</button>` : `<small style="display:block;color:#777;margin:4px 0 0">Belum diunggah oleh customer.</small>`}</div>` : ""}
    </div>
  </div>`;
}

function openPaymentEditor(id) {
  const o = orders.find(x => x.id === id);
  if (!o) return;

  const summary = getOrderPaymentSummary(o);
  const total = summary.total;
  $("#paymentEditOrderId").value = o.id;
  $("#paymentEditInvoice").textContent = o.invoice_no || "-";
  $("#paymentEditTotal").textContent = formatRupiah(total);
  $("#paymentEditStatus").value = summary.verified
    ? (o.payment_status === "LUNAS" ? "LUNAS" : "DP")
    : (o.payment_plan === "FULL" ? "LUNAS" : "DP");
  $("#paymentEditAmount").value = String(summary.paid);
  $("#paymentEditMessage").innerHTML = summary.verified
    ? ""
    : `<div class="admin-message">Nilai awal mengikuti rencana pembayaran customer. Pastikan bukti dan nominal aktual sudah cocok saat serah-terima sebelum menyimpan.</div>`;
  syncPaymentEditAmount();
  $("#paymentEditModal").classList.remove("hidden");
}

function syncPaymentEditAmount(forcePlanDefault = false) {
  const o = orders.find(x => x.id === $("#paymentEditOrderId").value);
  if (!o) return;
  const summary = getOrderPaymentSummary(o);
  const isFull = $("#paymentEditStatus").value === "LUNAS";
  $("#paymentEditAmount").disabled = isFull;
  if (isFull) {
    $("#paymentEditAmount").value = String(summary.total);
    $("#paymentEditHint").textContent = "Simpan status LUNAS hanya setelah nominal dan bukti pembayaran dicek admin.";
  } else {
    const configuredDp = Math.min(summary.total, Math.max(0, Math.ceil(summary.total * Number(settings.dp_percentage || 50) / 100)));
    const current = summary.verified
      ? (o.payment_status === "LUNAS" ? configuredDp : summary.paid)
      : configuredDp;
    const entered = Number($("#paymentEditAmount").value);
    if (forcePlanDefault || entered >= summary.total || !$("#paymentEditAmount").value) {
      $("#paymentEditAmount").value = String(Math.min(Math.max(0, summary.total - 1), current));
    }
    $("#paymentEditHint").textContent = "Untuk status DP, nominal harus nol atau lebih dan lebih kecil dari total pesanan. Simpan setelah nominal aktual dicek admin.";
  }
}

function closePaymentEditor() {
  $("#paymentEditModal")?.classList.add("hidden");
}

async function savePaymentEdit(event, mode) {
  event.preventDefault();
  const id = $("#paymentEditOrderId").value;
  const o = orders.find(x => x.id === id);
  if (!o) return;

  const status = $("#paymentEditStatus").value;
  const total = Number(o.total_amount || 0);
  let paid = status === "LUNAS" ? total : Number($("#paymentEditAmount").value);

  if (!Number.isFinite(paid) || !Number.isInteger(paid) || paid < 0 || (status === "DP" && paid >= total)) {
    $("#paymentEditMessage").innerHTML = `<div class="admin-message error">Untuk status DP, nominal harus bilangan bulat dari 0 sampai kurang dari total pesanan.</div>`;
    return;
  }
  if (status === "LUNAS" && paid !== total) {
    $("#paymentEditMessage").innerHTML = `<div class="admin-message error">Nominal LUNAS harus sama dengan total pesanan.</div>`;
    return;
  }

  const button = $("#paymentEditSave");
  button.disabled = true;
  button.textContent = "Menyimpan...";

  const { error } = await supabase.from("orders").update({
    payment_status: status,
    paid_amount: paid,
    payment_verified_at: new Date().toISOString()
  }).eq("id", id);

  button.disabled = false;
  button.textContent = "Simpan Pembayaran";

  if (error) {
    $("#paymentEditMessage").innerHTML = `<div class="admin-message error">Gagal menyimpan pembayaran: ${escapeHtml(error.message)}</div>`;
    return;
  }

  closePaymentEditor();
  await loadOrders();
  renderOrdersPage(mode);
  msg(`Pembayaran ${o.invoice_no} berhasil diperbarui.`, "success");
}

function viewOrderInvoice(id) {
  const o = orders.find(x => x.id === id);
  if (!o) return;

  // Open synchronously in the click handler so popup blockers are less likely to block it.
  const invoiceWindow = window.open("", "_blank");
  if (!invoiceWindow) {
    msg("Popup invoice diblokir browser. Izinkan pop-up untuk halaman admin ini lalu coba lagi.", "error");
    return;
  }

  const items = o.order_items || [];
  const itemSum = items.reduce((sum, item) => sum + Number(item.subtotal ?? Number(item.unit_price || 0) * Number(item.quantity || 0)), 0);
  const total = Number(o.total_amount || itemSum);
  const subtotal = Number(o.subtotal_amount ?? itemSum);
  const discount = Number(o.discount_amount || 0);
  const promoCode = String(o.promo_code || "");
  const dueFromPlan = o.payment_plan === "FULL"
    ? total
    : Math.min(total, Math.max(1, Math.ceil(total * Number(settings.dp_percentage || 50) / 100)));
  const due = Number(o.payment_amount_due || dueFromPlan);
  const storedPaid = Number(o.paid_amount || 0);
  // Customer invoice reflects the customer's reported plan/payment status.
  // Internal verification remains separate and is visible in the admin payment history.
  const customerReportedLunas = (o.customer_payment_status || (o.payment_plan === "FULL" ? "LUNAS" : "DP")) === "LUNAS";
  const paid = customerReportedLunas ? total : due;
  const remaining = Math.max(total - paid, 0);
  const logo = settings.logo_url
    ? `<img class="brand-logo" src="${escapeHtml(settings.logo_url)}" alt="${escapeHtml(settings.site_name || "Circle Itabaka")}">`
    : `<div class="brand-logo fallback">IT</div>`;
  const paymentPlan = o.payment_plan === "FULL" ? "Full Payment" : `DP (${Number(settings.dp_percentage || 50)}%)`;
  const paymentMethod = o.payment_method === "QRIS" ? "QRIS" : "Transfer Bank blu by BCA Digital";
  const statusLabel = o.customer_payment_status || (o.payment_plan === "FULL" ? "LUNAS" : "DP");
  const statusClass = statusLabel === "LUNAS" ? "paid" : "dp";
  const itemRows = items.map(item => {
    const category = productCategoryLabel(item.product_category, getOrderItemApparelType(item));
    const qty = Number(item.quantity || 0);
    const price = Number(item.unit_price || 0);
    const subtotal = Number(item.subtotal ?? price * qty);
    return `<tr>
      <td><strong>${escapeHtml(item.product_name || "-")}</strong><small>${category}${item.size ? ` · Ukuran ${escapeHtml(item.size)}` : ""}</small></td>
      <td>${qty}</td><td>${formatRupiah(price)}</td><td class="right">${formatRupiah(subtotal)}</td>
    </tr>`;
  }).join("");

  invoiceWindow.document.open();
  invoiceWindow.document.write(`<!doctype html>
<html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ${escapeHtml(o.invoice_no || "Itabaka")}</title>
<style>
@page{size:A4 portrait;margin:8mm}*{box-sizing:border-box}body{margin:0;background:#eef0f2;color:#17191c;font:12px/1.45 Arial,Helvetica,sans-serif}.toolbar{position:sticky;top:0;display:flex;justify-content:flex-end;gap:8px;padding:12px;background:#fff;border-bottom:1px solid #ddd}.toolbar button{border:0;border-radius:8px;background:#111;color:#fff;padding:10px 14px;font-weight:700;cursor:pointer}.toolbar button.secondary{background:#e9ecef;color:#111}.invoice{--primary:${/^#[0-9a-f]{6}$/i.test(settings.primary_color||"")?settings.primary_color:"#111111"};--accent:${/^#[0-9a-f]{6}$/i.test(settings.accent_color||"")?settings.accent_color:"#777777"};max-width:194mm;min-height:270mm;margin:18px auto;background:#fff;border:1px solid #e4e4e4;border-radius:14px;overflow:hidden;box-shadow:0 12px 38px #0001}.accent{height:6px;background:linear-gradient(90deg,var(--primary),var(--accent))}.inner{padding:8mm}.head{display:grid;grid-template-columns:1fr auto;gap:8mm;align-items:start}.brand{display:flex;align-items:center;gap:4mm}.brand-logo{width:22mm;height:22mm;object-fit:contain;border:1px solid #eee;border-radius:4mm}.brand-logo.fallback{display:grid;place-items:center;background:#111;color:white;font-size:16px;font-weight:900}.brand h2{margin:0;font-size:17px}.brand p{margin:2px 0 0;color:#777}.meta{text-align:right;min-width:48mm}.kicker{font-size:8px;font-weight:800;letter-spacing:.16em;color:#888}.meta h1{margin:2px 0 6px;font-size:20px}.meta-line{display:flex;justify-content:flex-end;gap:10px;font-size:9px;margin:2px 0}.status{display:inline-block;margin-top:4px;padding:4px 8px;border-radius:999px;font-size:8px;font-weight:800}.status.paid{border:1px solid #b7e4c7;background:#dcfce7;color:#166534}.status.dp{border:1px solid #e5d49d;background:#f8f0d8;color:#5b470c}.rule{height:1px;background:#e6e6e6;margin:5mm 0}.info{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.info-card{border:1px solid #e7e7e7;background:#fafafa;border-radius:3mm;padding:4mm}.label{display:block;font-size:7px;text-transform:uppercase;letter-spacing:.1em;color:#888;font-weight:800;margin-bottom:2mm}.info-card strong{font-size:10px}.info-card p{margin:1mm 0 0;font-size:9px}.table-wrap{margin-top:4mm;border:1px solid #e5e5e5;border-radius:3mm;overflow:hidden}.items{width:100%;border-collapse:collapse}.items th{background:#f5f5f5;text-align:left;color:#6d6d6d;font-size:7px;text-transform:uppercase;letter-spacing:.08em;padding:2.5mm}.items td{padding:2.7mm;border-top:1px solid #eee;font-size:8.5px;vertical-align:top}.items td small{display:block;margin-top:1mm;color:#777;font-size:7px}.right{text-align:right}.bottom{display:grid;grid-template-columns:1fr 72mm;gap:4mm;margin-top:4mm}.payment,.summary{border:1px solid #e5e5e5;border-radius:3mm;padding:4mm}.payment h3{font-size:9px;margin:0 0 3mm}.payrow{display:grid;grid-template-columns:24mm 1fr;gap:1.4mm;font-size:8.5px}.payrow span{color:#777}.sumrow{display:flex;justify-content:space-between;gap:4mm;padding:1.7mm 0;font-size:8.5px}.sumrow.grand{border-top:1px solid var(--primary);margin-top:1.5mm;padding-top:2.5mm;font-size:10px;font-weight:800}.sumrow.grand strong{font-size:12px}.note{font-size:7px;color:#777;line-height:1.4;margin-top:2.5mm}.foot{display:flex;justify-content:space-between;gap:5mm;border-top:1px solid #e5e5e5;padding-top:3mm;margin-top:5mm;font-size:7px;color:#888}.foot strong{color:#555}
@media print{body{background:#fff}.toolbar{display:none!important}.invoice{max-width:none;width:100%;min-height:0;margin:0;border:1px solid #ddd;border-radius:3mm;box-shadow:none;break-inside:avoid;page-break-inside:avoid}.inner{padding:7mm}.rule{margin:4mm 0}.info-card,.table-wrap,.payment,.summary{break-inside:avoid;page-break-inside:avoid}}
</style></head><body>
<div class="toolbar"><button class="secondary" onclick="window.close()">Tutup</button><button onclick="window.print()">Cetak / Simpan PDF</button></div>
<article class="invoice"><div class="accent"></div><div class="inner">
<div class="head"><div class="brand">${logo}<div><h2>${escapeHtml(settings.site_name || "Circle Itabaka")}</h2><p>${escapeHtml(settings.site_title || "Pre-Order CF24")}</p></div></div><div class="meta"><div class="kicker">INVOICE PRE-ORDER</div><h1>${escapeHtml(o.invoice_no || "-")}</h1><div class="meta-line"><span>Tanggal</span><strong>${escapeHtml(formatDate(o.created_at))}</strong></div><span class="status ${statusClass}">${statusLabel}</span></div></div>
<div class="rule"></div>
<div class="info"><div class="info-card"><span class="label">Pemesan</span><strong>${escapeHtml(o.customer_name || "-")}</strong><p>${escapeHtml(o.customer_email || "-")}<br>${escapeHtml(o.customer_phone || o.customer_contact || "-")}</p></div><div class="info-card"><span class="label">Pengambilan / Pengiriman</span><strong>${o.delivery_method === "SHIP_TO_ADDRESS" ? "Dikirim ke alamat" : "Ambil di Booth CF24"}</strong><p>${o.delivery_method === "SHIP_TO_ADDRESS" ? escapeHtml(o.customer_address || "Alamat belum tersedia") : "Pesanan diambil di booth CF24."}</p></div></div>
<div class="table-wrap"><table class="items"><thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th class="right">Subtotal</th></tr></thead><tbody>${itemRows || '<tr><td colspan="4">Tidak ada detail item</td></tr>'}</tbody></table></div>
<div class="bottom"><div><div class="payment"><h3>Informasi Pembayaran</h3><div class="payrow"><span>Rencana</span><strong>${paymentPlan}</strong><span>Metode</span><strong>${paymentMethod}</strong><span>Status</span><strong>${statusLabel}</strong></div></div><div class="note">Nominal invoice mengikuti rencana pembayaran yang dipilih customer. Bukti dan nominal aktual diperiksa admin saat pengambilan/pengiriman.</div></div>
<div class="summary"><div class="sumrow"><span>Subtotal</span><strong>${formatRupiah(subtotal)}</strong></div>${promoCode && discount > 0 ? `<div class="sumrow"><span>Kode Promo</span><strong>${escapeHtml(promoCode)}</strong></div><div class="sumrow"><span>Diskon Member</span><strong>-${formatRupiah(discount)}</strong></div>` : ""}<div class="sumrow"><span>Total Pesanan</span><strong>${formatRupiah(total)}</strong></div><div class="sumrow"><span>Bayar Sekarang</span><strong>${formatRupiah(due)}</strong></div><div class="sumrow"><span>Dibayar / sesuai rencana</span><strong>${formatRupiah(paid)}</strong></div><div class="sumrow grand"><span>Sisa Pembayaran</span><strong>${formatRupiah(remaining)}</strong></div></div></div>
<div class="foot"><span><strong>${escapeHtml(settings.site_name || "Circle Itabaka")}</strong> · ${escapeHtml(settings.site_title || "Pre-Order CF24")}</span><span>Terima kasih sudah melakukan pre-order.</span></div>
</div></article></body></html>`);
  invoiceWindow.document.close();
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

async function viewOrderPaymentProof(orderId, paymentId) {
  const order = orders.find(x => x.id === orderId);
  const payment = order?.order_payments?.find(x => x.id === paymentId);
  if (!payment?.proof_path) return;
  $("#proofModal").classList.remove("hidden");
  $("#proofBody").innerHTML = `<div class="loading">Memuat bukti pembayaran...</div>`;
  const bucket = payment.payment_type === "SETTLEMENT" ? "settlement-proofs" : "payment-proofs";
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(payment.proof_path, 600);
  if (error) {
    $("#proofBody").innerHTML = `<div class="admin-message error">${escapeHtml(error.message)}</div>`;
    return;
  }
  $("#proofBody").innerHTML = /\.pdf$/i.test(payment.proof_path)
    ? `<iframe class="proof-frame" src="${escapeHtml(data.signedUrl)}" title="Bukti pembayaran"></iframe><a class="btn primary" href="${escapeHtml(data.signedUrl)}" target="_blank" rel="noreferrer">Buka PDF</a>`
    : `<img class="proof-image" src="${escapeHtml(data.signedUrl)}" alt="Bukti pembayaran">`;
}


async function viewSettlementProofPath(orderId) {
  const order = orders.find(x => x.id === orderId);
  if (!order?.settlement_proof_path) return;
  $("#proofModal").classList.remove("hidden");
  $("#proofBody").innerHTML = `<div class="loading">Memuat bukti pelunasan...</div>`;
  const { data, error } = await supabase.storage.from("settlement-proofs").createSignedUrl(order.settlement_proof_path, 600);
  if (error) {
    $("#proofBody").innerHTML = `<div class="admin-message error">${escapeHtml(error.message)}</div>`;
    return;
  }
  $("#proofBody").innerHTML = /\.pdf$/i.test(order.settlement_proof_path)
    ? `<iframe class="proof-frame" src="${escapeHtml(data.signedUrl)}" title="Bukti pelunasan"></iframe><a class="btn primary" href="${escapeHtml(data.signedUrl)}" target="_blank" rel="noreferrer">Buka PDF</a>`
    : `<img class="proof-image" src="${escapeHtml(data.signedUrl)}" alt="Bukti pelunasan">`;
}

async function saveInternalPaymentCheck(orderId, paymentId, mode) {
  const order = orders.find(x => x.id === orderId);
  const payment = order?.order_payments?.find(x => x.id === paymentId);
  if (!payment) return;
  const status = document.querySelector(`[data-internal-status="${paymentId}"]`)?.value || "PENDING";
  const reportedAmount = Number(document.querySelector(`[data-reported-amount="${paymentId}"]`)?.value);
  const note = document.querySelector(`[data-internal-note="${paymentId}"]`)?.value.trim() || null;
  if (!Number.isInteger(reportedAmount) || reportedAmount <= 0) {
    msg("Nominal yang dicek harus berupa angka bulat lebih dari 0.", "error");
    return;
  }
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("order_payments").update({
    reported_amount: reportedAmount,
    internal_status: status,
    internal_note: note,
    checked_at: status === "PENDING" ? null : new Date().toISOString(),
    checked_by: status === "PENDING" ? null : user?.id || null
  }).eq("id", paymentId);
  if (error) {
    msg(`Gagal menyimpan pengecekan internal: ${error.message}`, "error");
    return;
  }
  await loadOrders();
  renderOrdersPage(mode);
  msg(`Pengecekan ${order.invoice_no} berhasil disimpan. Status invoice customer tidak berubah.`, "success");
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
          <label>Nama Pemilik Rekening BCA<input id="sBcaName"></label>
          <label>Nomor Rekening BCA<input id="sBcaNumber"></label>
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
  const rows=[["Invoice","Tanggal","Customer","Email","HP","Pengiriman","Alamat","Rencana Pembayaran","Metode","Subtotal","Kode Promo","Diskon","Total Akhir","Bayar Sekarang","Dibayar / Rencana","Sisa / Rencana","Status tampilan","Bukti","Produk","Kategori","Size","Qty"]];
  for (const o of list) {
    for (const i of o.order_items || []) {
      rows.push([
        o.invoice_no, formatDate(o.created_at), o.customer_name, o.customer_email || "",
        o.customer_phone || o.customer_contact || "",
        o.delivery_method === "SHIP_TO_ADDRESS" ? "Dikirim" : "Booth CF24",
        o.customer_address || "",
        o.payment_plan === "FULL" ? "Full Payment" : "DP",
        o.payment_method === "QRIS" ? "QRIS" : "Transfer BCA",
        Number(o.subtotal_amount ?? getOrderPaymentSummary(o).total), o.promo_code || "", Number(o.discount_amount || 0),
        getOrderPaymentSummary(o).total, getOrderPaymentSummary(o).due, getOrderPaymentSummary(o).paid,
        getOrderPaymentSummary(o).remaining, getOrderPaymentSummary(o).statusLabel,
        o.payment_proof_path ? "Ada" : "Belum",
        i.product_name, productCategoryLabel(i.product_category, getOrderItemApparelType(i)), i.size || "", Number(i.quantity || 0)
      ]);
    }
  }
  return rows;
}
function exportAllOrders() {
  const apparel=orders.filter(o=>orderHasCategory(o,["APPAREL","TSHIRT","JACKET"]));
  const merch=orders.filter(o=>orderHasCategory(o,["MERCHANDISE"]));
  const sizeMap = new Map();
  for (const o of apparel) {
    for (const i of o.order_items || []) {
      const apparelType = getOrderItemApparelType(i);
      if (!apparelType || !i.size) continue;
      const key=`${productCategoryLabel("APPAREL", apparelType)}|${i.size}`;
      sizeMap.set(key,(sizeMap.get(key)||0)+Number(i.quantity||0));
    }
  }
  const sizeRows=[["Kategori","Size","Total Qty"]];
  [...sizeMap.entries()].sort().forEach(([key,n])=>sizeRows.push([...key.split("|"),n]));
  const orderOverview=[["Invoice","Tanggal","Customer","Email","HP","Pengiriman","Rencana","Metode","Subtotal","Kode Promo","Diskon","Total Akhir","Dibayar / Rencana","Sisa / Rencana","Status tampilan","Kategori Order"]];
  for(const o of orders){
    const cats=[...new Set((o.order_items||[]).map(i=>productCategoryLabel(i.product_category, getOrderItemApparelType(i))))].join(", ");
    const payment = getOrderPaymentSummary(o);
    orderOverview.push([o.invoice_no,formatDate(o.created_at),o.customer_name,o.customer_email||"",o.customer_phone||o.customer_contact||"",o.delivery_method==="SHIP_TO_ADDRESS"?"Dikirim":"Booth CF24",o.payment_plan==="FULL"?"Full Payment":"DP",o.payment_method==="QRIS"?"QRIS":"Transfer BCA",Number(o.subtotal_amount ?? payment.total),o.promo_code||"",Number(o.discount_amount||0),payment.total,payment.paid,payment.remaining,payment.statusLabel,cats]);
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
    await Promise.all([loadProducts(),loadOrders(),loadApparelTypes()]);
    renderProductsPage();
  } else if (page === "allOrders") {
    await Promise.all([loadOrders(),loadSettings(),loadApparelTypes()]);
    renderOrdersPage("all");
  } else if (page === "merchandise") {
    await Promise.all([loadOrders(),loadSettings(),loadApparelTypes()]);
    renderOrdersPage("merchandise");
  } else if (page === "apparel") {
    await Promise.all([loadOrders(),loadSettings(),loadApparelTypes()]);
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
