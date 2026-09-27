import "./styles.css";
import { supabase } from "./lib/supabase.js";
import { escapeHtml, formatDate, formatRupiah } from "./lib/format.js";

const app = document.querySelector("#app");
let orders = [];
let products = [];
let settings = {};
let editingId = null;
let bootRunning = false;

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

const $ = (selector) => document.querySelector(selector);

function showNotice(message, type = "") {
  const el = $("#adminNotice");
  if (el) {
    el.innerHTML = `<div class="notice ${type}">${escapeHtml(message)}</div>`;
  }
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
  $("#loginForm").onsubmit = login;
}

async function login(event) {
  event.preventDefault();

  const button = event.submitter;
  button.disabled = true;

  const { error } = await supabase.auth.signInWithPassword({
    email: $("#email").value.trim(),
    password: $("#password").value
  });

  if (error) {
    button.disabled = false;
    loginView(error.message);
    return;
  }

  await boot();
}

async function getAdmin() {
  const {
    data: { user }
  } = await supabase.auth.getUser();

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

  return { user, profile };
}

async function boot() {
  const session = await getAdmin();

  if (!session) {
    topActions.innerHTML = "";
    loginView();
    return;
  }

  topActions.innerHTML = `
    <button id="logout" class="secondary" type="button">Keluar</button>`;

  $("#logout").onclick = async () => {
    await supabase.auth.signOut();
    loginView();
  };

  renderShell(session);

  await Promise.all([
    loadOrders(),
    loadProducts(),
    loadSettings()
  ]);
}

function renderShell(session) {
  main.innerHTML = `
    <div id="adminNotice"></div>

    <div class="toolbar">
      <div>
        <p class="eyebrow">DASHBOARD</p>
        <h1>PO Management</h1>
        <p class="muted">${escapeHtml(session.profile.display_name || session.user.email)}</p>
      </div>
      <div class="actions">
        <a class="secondary" href="/">Halaman Customer</a>
      </div>
    </div>

    <div class="stat-grid">
      <div class="card stat">
        <span class="muted">Total PO</span>
        <strong id="statOrders">0</strong>
      </div>
      <div class="card stat">
        <span class="muted">DP</span>
        <strong id="statDp">0</strong>
      </div>
      <div class="card stat">
        <span class="muted">Lunas</span>
        <strong id="statLunas">0</strong>
      </div>
    </div>

    <div class="admin-grid">
      <section class="card panel">
        <div class="toolbar">
          <div>
            <p class="eyebrow">PRODUCT</p>
            <h2 id="productTitle">Tambah Produk</h2>
          </div>
        </div>

        <form id="productForm">
          <label>Kode<input id="pCode" required maxlength="40"></label>
          <label>Nama<input id="pName" required maxlength="120"></label>
          <label>Deskripsi<textarea id="pDesc" rows="3"></textarea></label>
          <label>Harga<input id="pPrice" type="number" min="0" step="1000" required></label>
          <label>Stok<input id="pStock" type="number" min="0"></label>
          <label>Foto Produk<input id="pImageFile" type="file" accept="image/png,image/jpeg,image/webp"></label>
          <label>URL gambar (opsional)<input id="pImage" placeholder="https://..."></label>
          <label>Aktif
            <select id="pActive">
              <option value="true">Ya</option>
              <option value="false">Tidak</option>
            </select>
          </label>
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
          <div>
            <p class="eyebrow">ORDER</p>
            <h2>Pesanan</h2>
          </div>
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
          <label>Warna utama<input id="sPrimaryColor" type="color"></label>
          <label>Warna aksen<input id="sAccentColor" type="color"></label>
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
          <label>Nama pemilik rekening BCA<input id="sBcaName"></label>
          <label>Nomor rekening BCA<input id="sBcaNumber" inputmode="numeric"></label>
          <div class="notice">Bukti pembayaran customer disimpan privat dan dapat dibuka admin.</div>
        </div>
      </div>
    </section>

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

  $("#productForm").onsubmit = saveProduct;
  $("#cancelEdit").onclick = resetForm;
  $("#search").oninput = renderOrders;
  $("#saveSettingsButton").onclick = saveSettings;

  document.querySelectorAll("[data-close-proof]").forEach((el) => {
    el.onclick = closeProof;
  });
}

async function loadSettings() {
  const { data, error } = await supabase
    .from("site_settings")
    .select(`
      id,
      site_name,
      site_title,
      site_description,
      logo_url,
      banner_url,
      qris_image_url,
      bca_account_name,
      bca_account_number,
      dp_percentage,
      primary_color,
      accent_color
    `)
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    showNotice("Pengaturan gagal dimuat: " + error.message, "error");
    return;
  }

  settings = data || {};
  fillSettings();
}

function fillSettings() {
  const s = settings;

  const set = (selector, value) => {
    const el = $(selector);
    if (el) el.value = value ?? "";
  };

  set("#sSiteName", s.site_name);
  set("#sSiteTitle", s.site_title);
  set("#sSiteDescription", s.site_description);
  set("#sDpPercentage", s.dp_percentage ?? 50);
  set("#sBcaName", s.bca_account_name);
  set("#sBcaNumber", s.bca_account_number);
  set("#sPrimaryColor", s.primary_color || "#111111");
  set("#sAccentColor", s.accent_color || "#777777");

  $("#assetPreview").innerHTML = `
    ${s.logo_url
      ? `<div><small>Logo saat ini</small><br><img src="${escapeHtml(s.logo_url)}" alt="Logo"></div>`
      : ""}
    ${s.banner_url
      ? `<div><small>Banner saat ini</small><br><img class="banner-preview" src="${escapeHtml(s.banner_url)}" alt="Banner"></div>`
      : ""}
    ${s.qris_image_url
      ? `<div><small>QRIS saat ini</small><br><img src="${escapeHtml(s.qris_image_url)}" alt="QRIS"></div>`
      : ""}
  `;
}

async function uploadPublicAsset(bucket, folder, file) {
  if (!file) return null;

  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) {
    throw new Error("Format gambar harus PNG, JPG/JPEG, atau WEBP.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Ukuran gambar maksimal 8 MB.");
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";

  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert: false,
      cacheControl: "3600",
      contentType: file.type
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return data.publicUrl;
}

async function saveSettings() {
  const button = $("#saveSettingsButton");
  button.disabled = true;

  try {
    let logo_url = settings.logo_url || null;
    let banner_url = settings.banner_url || null;
    let qris_image_url = settings.qris_image_url || null;

    logo_url =
      await uploadPublicAsset(
        "site-media",
        "logo",
        $("#sLogoFile").files?.[0]
      ) || logo_url;

    banner_url =
      await uploadPublicAsset(
        "site-media",
        "banner",
        $("#sBannerFile").files?.[0]
      ) || banner_url;

    qris_image_url =
      await uploadPublicAsset(
        "site-media",
        "qris",
        $("#sQrisFile").files?.[0]
      ) || qris_image_url;

    const payload = {
      id: 1,
      site_name: $("#sSiteName").value.trim(),
      site_title: $("#sSiteTitle").value.trim(),
      site_description: $("#sSiteDescription").value.trim(),
      primary_color: $("#sPrimaryColor").value || "#111111",
      accent_color: $("#sAccentColor").value || "#777777",
      dp_percentage: Number($("#sDpPercentage").value),
      bca_account_name: $("#sBcaName").value.trim(),
      bca_account_number: $("#sBcaNumber").value.trim(),
      logo_url,
      banner_url,
      qris_image_url,
      updated_at: new Date().toISOString()
    };

    if (!payload.site_name || !payload.site_title || !payload.site_description) {
      throw new Error("Nama, judul, dan deskripsi situs wajib diisi.");
    }

    if (
      !Number.isInteger(payload.dp_percentage) ||
      payload.dp_percentage < 1 ||
      payload.dp_percentage > 99
    ) {
      throw new Error("DP harus 1–99%.");
    }

    const { error } = await supabase
      .from("site_settings")
      .upsert(payload, { onConflict: "id" });

    if (error) throw error;

    settings = {...settings, ...payload};
    fillSettings();
    showNotice("Pengaturan berhasil disimpan.", "success");
  } catch (error) {
    showNotice("Gagal menyimpan pengaturan: " + error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("sort_order")
    .order("name");

  if (error) {
    $("#productList").innerHTML =
      `<div class="notice error">${escapeHtml(error.message)}</div>`;
    return;
  }

  products = data || [];
  renderProducts();
}

function renderProducts() {
  $("#productList").innerHTML = products.length
    ? products.map((product) => `
      <div class="admin-product-row">
        <div>
          ${
            product.image_url
              ? `<img class="admin-thumb" src="${escapeHtml(product.image_url)}" alt="">`
              : `<div class="admin-thumb placeholder">IMG</div>`
          }
        </div>
        <div class="grow">
          <strong>${escapeHtml(product.name)}</strong>
          <div class="muted">
            ${escapeHtml(product.code)}
            · ${formatRupiah(product.price)}
            · stok ${product.stock ?? "∞"}
            · ${product.active ? "aktif" : "nonaktif"}
          </div>
        </div>
        <button class="secondary" type="button" data-edit="${product.id}">
          Edit
        </button>
      </div>
    `).join("")
    : '<p class="muted">Belum ada produk.</p>';

  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.onclick = () => editProduct(button.dataset.edit);
  });
}

function editProduct(id) {
  const product = products.find((item) => item.id === id);
  if (!product) return;

  editingId = id;

  $("#productTitle").textContent = "Edit Produk";
  $("#pCode").value = product.code;
  $("#pName").value = product.name;
  $("#pDesc").value = product.description || "";
  $("#pPrice").value = product.price;
  $("#pStock").value = product.stock ?? "";
  $("#pImage").value = product.image_url || "";
  $("#pActive").value = String(product.active);
  $("#cancelEdit").classList.remove("hidden");

  window.scrollTo({top: 0, behavior: "smooth"});
}

function resetForm() {
  editingId = null;
  $("#productForm").reset();
  $("#pActive").value = "true";
  $("#productTitle").textContent = "Tambah Produk";
  $("#cancelEdit").classList.add("hidden");
}

async function saveProduct(event) {
  event.preventDefault();

  const button = event.submitter;
  button.disabled = true;

  try {
    let image_url = $("#pImage").value.trim() || null;
    const file = $("#pImageFile").files?.[0];

    if (file) {
      image_url = await uploadPublicAsset(
        "product-images",
        "products",
        file
      );
    }

    const payload = {
      code: $("#pCode").value.trim(),
      name: $("#pName").value.trim(),
      description: $("#pDesc").value.trim() || null,
      price: Number($("#pPrice").value),
      stock:
        $("#pStock").value === ""
          ? null
          : Number($("#pStock").value),
      image_url,
      active: $("#pActive").value === "true"
    };

    if (!payload.code || !payload.name) {
      throw new Error("Kode dan nama produk wajib diisi.");
    }

    if (!Number.isFinite(payload.price) || payload.price < 0) {
      throw new Error("Harga tidak valid.");
    }

    if (
      payload.stock !== null &&
      (!Number.isInteger(payload.stock) || payload.stock < 0)
    ) {
      throw new Error("Stok tidak valid.");
    }

    const result = editingId
      ? await supabase
          .from("products")
          .update(payload)
          .eq("id", editingId)
      : await supabase
          .from("products")
          .insert(payload);

    if (result.error) throw result.error;

    resetForm();
    await loadProducts();
    showNotice("Produk berhasil disimpan.", "success");
  } catch (error) {
    showNotice("Gagal menyimpan produk: " + error.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function loadOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      invoice_no,
      created_at,
      customer_name,
      customer_email,
      customer_contact,
      customer_phone,
      customer_address,
      delivery_method,
      payment_status,
      payment_plan,
      payment_method,
      payment_amount_due,
      total_amount,
      paid_amount,
      remaining_amount,
      payment_proof_path,
      payment_proof_uploaded_at,
      payment_verified_at,
      order_items(
        id,
        product_name,
        unit_price,
        quantity,
        subtotal
      )
    `)
    .order("created_at", {ascending: false});

  if (error) {
    $("#ordersList").innerHTML =
      `<div class="notice error">${escapeHtml(error.message)}</div>`;
    return;
  }

  orders = data || [];
  renderOrders();
}

function renderOrders() {
  const query = ($("#search")?.value || "").toLowerCase().trim();

  const filtered = orders.filter((order) =>
    [
      order.invoice_no,
      order.customer_name,
      order.customer_email,
      order.customer_phone,
      order.customer_contact
    ]
      .join(" ")
      .toLowerCase()
      .includes(query)
  );

  $("#statOrders").textContent = orders.length;
  $("#statDp").textContent =
    orders.filter((order) => order.payment_status === "DP").length;
  $("#statLunas").textContent =
    orders.filter((order) => order.payment_status === "LUNAS").length;

  $("#ordersList").innerHTML = filtered.length
    ? `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Pemesan</th>
              <th>Total</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((order) => `
              <tr>
                <td>
                  <strong>${escapeHtml(order.invoice_no)}</strong><br>
                  <small>${formatDate(order.created_at)}</small>
                </td>

                <td>
                  ${escapeHtml(order.customer_name)}<br>
                  <small>
                    ${escapeHtml(
                      order.customer_email ||
                      order.customer_phone ||
                      order.customer_contact ||
                      "-"
                    )}
                  </small>
                </td>

                <td>
                  ${formatRupiah(order.total_amount)}<br>
                  <small>
                    Bayar sekarang ${formatRupiah(order.payment_amount_due || 0)}
                  </small><br>
                  <small>
                    Dibayar ${formatRupiah(order.paid_amount)}
                  </small>
                </td>

                <td>
                  <span class="status ${
                    order.payment_status === "LUNAS" ? "lunas" : "dp"
                  }">
                    ${escapeHtml(order.payment_status)}
                  </span><br>
                  <small>
                    ${
                      order.payment_plan === "FULL"
                        ? "Full Payment"
                        : "DP"
                    }
                    ·
                    ${
                      order.payment_method === "QRIS"
                        ? "QRIS"
                        : "Transfer BCA"
                    }
                  </small><br>
                  <small>
                    Sisa ${formatRupiah(order.remaining_amount)}
                  </small>
                </td>

                <td>
                  <div class="actions">
                    ${
                      order.payment_status === "DP"
                        ? `<button class="primary" type="button" data-lunas="${order.id}">Tandai Lunas</button>`
                        : `<button class="secondary" type="button" data-dp="${order.id}">Ubah DP</button>`
                    }
                    <button class="secondary" type="button" data-detail="${order.id}">
                      Detail
                    </button>
                    ${
                      order.payment_proof_path
                        ? `<button class="secondary" type="button" data-proof="${order.id}">Bukti</button>`
                        : ""
                    }
                  </div>
                </td>
              </tr>

              <tr id="detail-${order.id}" class="hidden">
                <td colspan="5">${renderDetail(order)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`
    : '<p class="muted">Tidak ada pesanan.</p>';

  document.querySelectorAll("[data-lunas]").forEach((button) => {
    button.onclick = () => setStatus(button.dataset.lunas, "LUNAS");
  });

  document.querySelectorAll("[data-dp]").forEach((button) => {
    button.onclick = () => setStatus(button.dataset.dp, "DP");
  });

  document.querySelectorAll("[data-detail]").forEach((button) => {
    button.onclick = () => {
      const row = document.querySelector(
        "#detail-" + button.dataset.detail
      );
      if (row) row.classList.toggle("hidden");
    };
  });

  document.querySelectorAll("[data-proof]").forEach((button) => {
    button.onclick = () => viewProof(button.dataset.proof);
  });
}

function renderDetail(order) {
  const delivery =
    order.delivery_method === "SHIP_TO_ADDRESS"
      ? `<strong>Dikirim ke Alamat</strong><br>${escapeHtml(order.customer_address || "-")}`
      : `<strong>Ambil di Booth CF24</strong>`;

  return `
    <div class="detail-grid">
      <div>
        <strong>Data Customer</strong>
        <p>
          ${escapeHtml(order.customer_name)}<br>
          ${escapeHtml(order.customer_email || "-")}<br>
          ${escapeHtml(order.customer_phone || order.customer_contact || "-")}
        </p>
      </div>

      <div>
        <strong>Pengambilan / Pengiriman</strong>
        <p>${delivery}</p>
      </div>

      <div>
        <strong>Pembayaran</strong>
        <p>
          Rencana:
          ${escapeHtml(
            order.payment_plan === "FULL" ? "Full Payment" : "DP"
          )}<br>
          Metode:
          ${escapeHtml(
            order.payment_method === "QRIS"
              ? "QRIS"
              : "Transfer Bank BCA"
          )}<br>
          Bayar sekarang:
          ${formatRupiah(order.payment_amount_due || 0)}<br>
          Dibayar:
          ${formatRupiah(order.paid_amount)}<br>
          Sisa:
          ${formatRupiah(order.remaining_amount)}<br>
          ${
            order.payment_verified_at
              ? `Diverifikasi: ${formatDate(order.payment_verified_at)}`
              : "Belum diverifikasi"
          }
        </p>
      </div>

      <div>
        <strong>Produk</strong>
        <table class="table">
          <tbody>
            ${(order.order_items || []).map((item) => `
              <tr>
                <td>${escapeHtml(item.product_name)}</td>
                <td>${item.quantity}×</td>
                <td class="right">${formatRupiah(item.subtotal)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="actions">
      ${
        order.payment_proof_path
          ? `<button class="primary" type="button" data-proof="${order.id}">
               Lihat Bukti Pembayaran
             </button>`
          : `<span class="muted">Bukti pembayaran belum tersedia.</span>`
      }
    </div>`;
}

async function viewProof(orderId) {
  const order = orders.find((item) => item.id === orderId);
  if (!order?.payment_proof_path) return;

  $("#proofModal").classList.remove("hidden");
  $("#proofBody").innerHTML =
    `<p class="muted">Memuat bukti pembayaran...</p>`;

  const { data, error } = await supabase.storage
    .from("payment-proofs")
    .createSignedUrl(order.payment_proof_path, 600);

  if (error) {
    $("#proofBody").innerHTML =
      `<div class="notice error">${escapeHtml(error.message)}</div>`;
    return;
  }

  if (/\.pdf$/i.test(order.payment_proof_path)) {
    $("#proofBody").innerHTML = `
      <iframe
        class="proof-frame"
        src="${escapeHtml(data.signedUrl)}"
        title="Bukti pembayaran PDF">
      </iframe>
      <p>
        <a
          class="primary"
          href="${escapeHtml(data.signedUrl)}"
          target="_blank"
          rel="noreferrer">
          Buka PDF di tab baru
        </a>
      </p>`;
  } else {
    $("#proofBody").innerHTML = `
      <img
        class="proof-image"
        src="${escapeHtml(data.signedUrl)}"
        alt="Bukti pembayaran">`;
  }
}

function closeProof() {
  $("#proofModal").classList.add("hidden");
  $("#proofBody").replaceChildren();
}

async function setStatus(id, status) {
  const order = orders.find((item) => item.id === id);
  if (!order) return;

  let paid = Number(order.paid_amount || 0);

  if (status === "LUNAS") {
    paid = Number(order.total_amount);
  } else {
    const max = Math.max(1, Number(order.total_amount) - 1);
    const suggested = Math.min(
      max,
      Number(order.paid_amount || order.payment_amount_due || 1)
    );

    const answer = prompt(
      `Masukkan nominal pembayaran untuk ${order.invoice_no}:`,
      String(suggested)
    );

    if (answer === null) return;

    paid = Number(answer);

    if (
      !Number.isInteger(paid) ||
      paid <= 0 ||
      paid >= Number(order.total_amount)
    ) {
      alert("Nominal DP harus lebih dari 0 dan kurang dari total.");
      return;
    }
  }

  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: status,
      paid_amount: paid,
      payment_verified_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    alert("Gagal mengubah status: " + error.message);
    return;
  }

  await loadOrders();
  showNotice(
    `Status ${order.invoice_no} berhasil diubah menjadi ${status}.`,
    "success"
  );
}

supabase.auth.onAuthStateChange(() => {
  if (!bootRunning) {
    setTimeout(() => start(), 0);
  }
});

async function start() {
  if (bootRunning) return;
  bootRunning = true;

  try {
    await boot();
  } finally {
    bootRunning = false;
  }
}

start();
