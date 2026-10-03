import "./styles.css";
import { supabase } from "./lib/supabase.js";
import { escapeHtml, formatDate, formatRupiah } from "./lib/format.js";

const app = document.querySelector("#app");
let products = [];
let cart = [];
let settings = {
  site_name:"Circle Itabaka",
  site_title:"Pre-Order CF24",
  site_description:"Pesan merchandise Itabaka untuk CF24.",
  logo_url:null, banner_url:null, qris_image_url:null,
  bca_account_name:"", bca_account_number:"", dp_percentage:50
};

app.innerHTML = `
<header class="topbar">
  <div><div class="brand" id="siteName">CIRCLE ITABAKA</div><div class="muted" id="siteTitle">Pre-Order CF24</div></div>
  <button class="secondary" id="cartButton" type="button">Keranjang <span id="cartCount">0</span></button>
</header>
<main>
  <section class="hero" id="hero"><p class="eyebrow">PRE-ORDER</p><h1 id="heroTitle">Pesan merchandise Itabaka untuk CF24.</h1><p class="muted" id="heroDescription">Pilih produk, tentukan pembayaran, lalu upload bukti.</p><a class="primary" href="#products">Lihat Produk</a></section>
  <section class="section container" id="products"><div class="section-head"><div><p class="eyebrow">CATALOG</p><h2>Produk</h2></div></div><div id="productGrid" class="grid"></div></section>
  <section class="section container" id="checkout"><p class="eyebrow">CHECKOUT</p><h2>Data Pemesan</h2><div id="notice"></div>
    <div class="checkout-grid">
      <form id="orderForm" class="card form-card">
        <label>Nama<input id="customerName" required maxlength="120" autocomplete="name" placeholder="Nama lengkap"></label>
        <label>Email<input id="customerEmail" required type="email" maxlength="160" autocomplete="email" placeholder="nama@email.com"></label>
        <label>Nomor HP<input id="customerPhone" required maxlength="30" autocomplete="tel" placeholder="08xxxxxxxxxx"></label>
        <label>Pilihan Pengambilan / Pengiriman
          <select id="deliveryMethod">
            <option value="BOOTH_CF24">Ambil di Booth CF24</option>
            <option value="SHIP_TO_ADDRESS">Dikirim ke Alamat</option>
          </select>
        </label>
        <div id="addressFieldWrap" class="hidden">
          <label>Alamat Pengiriman<textarea id="customerAddress" maxlength="500" rows="4" autocomplete="street-address" placeholder="Alamat lengkap untuk pengiriman"></textarea></label>
        </div>
        <label>Rencana Pembayaran
          <select id="paymentPlan"><option value="DP">DP</option><option value="FULL">Full Payment</option></select>
        </label>
        <label>Metode Pembayaran
          <select id="paymentMethod"><option value="QRIS">QRIS</option><option value="BCA_TRANSFER">Transfer Bank BCA</option></select>
        </label>
        <div id="paymentInfo" class="payment-box"></div>
        <label>Bukti Pembayaran<input id="paymentProofFile" type="file" required accept="image/png,image/jpeg,image/webp,application/pdf"></label>
        <p class="muted small">PNG, JPG/JPEG, WEBP, atau PDF. Maksimal 5 MB.</p>
        <div id="paymentProofPreview" class="file-preview"></div>
        <button class="primary full" id="submitButton" type="submit">Buat Pesanan</button>
      </form>
      <aside class="card summary-card"><h3>Ringkasan</h3><div id="summaryItems"></div><div class="total-row"><span>Total</span><strong id="grandTotal">Rp0</strong></div><div class="total-row"><span>Bayar sekarang</span><strong id="paymentDue">Rp0</strong></div></aside>
    </div>
  </section>
  <section class="section container hidden" id="invoiceSection">
    <div class="invoice-actions"><div><p class="eyebrow">ORDER CREATED</p><h2>Invoice PO</h2></div><button id="printInvoice" class="secondary" type="button">Cetak / Simpan PDF</button></div>
    <div id="invoice" class="invoice card"></div>
  </section>
</main>
<footer class="footer">Circle Itabaka · Development build</footer>`;

const $ = id => document.getElementById(id);
const total = () => cart.reduce((s,i) => s + Number(i.price) * i.qty, 0);

function paymentDue() {
  const t = total();
  return $("paymentPlan").value === "FULL"
    ? t
    : Math.min(t, Math.max(1, Math.ceil(t * Number(settings.dp_percentage || 50) / 100)));
}

function showNotice(msg, type="") {
  $("notice").innerHTML = `<div class="notice ${type}">${escapeHtml(msg)}</div>`;
}

function applySettings() {
  $("siteName").innerHTML = settings.logo_url
    ? `<img src="${escapeHtml(settings.logo_url)}" alt="${escapeHtml(settings.site_name)}" style="height:38px;max-width:180px;object-fit:contain">`
    : escapeHtml(settings.site_name || "Circle Itabaka");
  $("siteTitle").textContent = settings.site_title || "Pre-Order";
  $("heroTitle").textContent = settings.site_title || "Pre-Order CF24";
  $("heroDescription").textContent = settings.site_description || "Pilih produk, tentukan pembayaran, lalu upload bukti.";
  if (settings.banner_url) {
    $("hero").style.backgroundImage = `linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55)),url("${settings.banner_url.replaceAll('"','%22')}")`;
    $("hero").style.backgroundSize = "cover";
    $("hero").style.backgroundPosition = "center";
  }
}

async function loadSettings() {
  const { data, error } = await supabase.from("site_settings").select("site_name,site_title,site_description,logo_url,banner_url,qris_image_url,bca_account_name,bca_account_number,dp_percentage").eq("id",1).maybeSingle();
  if (!error && data) { settings = {...settings, ...data}; applySettings(); }
}

async function loadProducts() {
  const { data, error } = await supabase.from("products").select("id,code,name,description,price,image_url,stock,category,available_sizes").eq("active",true).order("sort_order").order("name");
  if (error) return showNotice("Produk gagal dimuat: " + error.message, "error");
  products = data || [];
  renderProducts();
}

function renderProducts() {
  $("productGrid").innerHTML = products.length ? products.map(p => `
    <article class="product-card">
      <div class="product-image">${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}">` : "IMAGE"}</div>
      <div class="product-body">
        <span class="product-code">${escapeHtml(p.code)}</span>
        <h3>${escapeHtml(p.name)}</h3>
        <p class="muted">${escapeHtml(p.description || "")}</p>
        <div class="price">${formatRupiah(p.price)}</div>
        <p class="muted">${p.stock === null ? "Stok tidak dibatasi" : `Stok: ${p.stock}`}</p>
        ${p.category === "TSHIRT" || p.category === "JACKET" ? `
          <label class="size-picker">Ukuran
            <select data-size="${p.id}">
              ${(p.available_sizes || []).length
                ? (p.available_sizes || []).map(size => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`).join("")
                : `<option value="">Belum ada ukuran</option>`}
            </select>
          </label>` : ""}
        <button class="primary full" type="button" data-add="${p.id}"
          ${(p.stock === 0 || ((p.category === "TSHIRT" || p.category === "JACKET") && !(p.available_sizes || []).length)) ? "disabled":""}>
          Tambah
        </button>
      </div>
    </article>`).join("") : '<div class="card form-card"><strong>Belum ada produk aktif.</strong></div>';

  document.querySelectorAll("[data-add]").forEach(b => {
    b.onclick = () => {
      const p = products.find(x => x.id === b.dataset.add);
      const size = (p?.category === "TSHIRT" || p?.category === "JACKET")
        ? document.querySelector(`[data-size="${p.id}"]`)?.value || null
        : null;
      addToCart(b.dataset.add, size);
    };
  });
}

function addToCart(id, size = null) {
  const p = products.find(x => x.id === id);
  if (!p) return;

  const isApparel = p.category === "TSHIRT" || p.category === "JACKET";
  if (isApparel && !size) return showNotice("Pilih ukuran terlebih dahulu.", "error");

  const cartKey = `${id}__${size || ""}`;
  const item = cart.find(x => x.cartKey === cartKey);
  const next = (item?.qty || 0) + 1;

  if (p.stock !== null && next > p.stock) {
    return showNotice("Jumlah melebihi stok.", "error");
  }

  if (item) {
    item.qty = next;
  } else {
    cart.push({...p, qty:1, size, cartKey});
  }

  renderSummary();
  renderPaymentInfo();
  $("checkout").scrollIntoView({behavior:"smooth"});
}

function changeQty(cartKey, delta) {
  const item = cart.find(x => x.cartKey === cartKey);
  if (!item) return;

  item.qty += delta;

  if (item.qty <= 0) {
    cart = cart.filter(x => x.cartKey !== cartKey);
  } else {
    const p = products.find(x => x.id === item.id);
    if (p?.stock !== null && item.qty > p.stock) item.qty = p.stock;
  }

  renderSummary();
  renderPaymentInfo();
}

function renderSummary() {
  $("cartCount").textContent = cart.reduce((s,i)=>s+i.qty,0);
  $("grandTotal").textContent = formatRupiah(total());
  $("paymentDue").textContent = formatRupiah(paymentDue());

  $("summaryItems").innerHTML = cart.length ? cart.map(i => `
    <div class="summary-line">
      <div>
        <strong>${escapeHtml(i.name)}</strong>
        ${i.size ? `<div class="muted small">Ukuran: ${escapeHtml(i.size)}</div>` : ""}
        <div class="quantity-controls">
          <button type="button" data-minus="${encodeURIComponent(i.cartKey)}">−</button>
          <span>${i.qty}</span>
          <button type="button" data-plus="${encodeURIComponent(i.cartKey)}">+</button>
          <button class="remove" type="button" data-remove="${encodeURIComponent(i.cartKey)}">Hapus</button>
        </div>
      </div>
      <strong>${formatRupiah(i.price*i.qty)}</strong>
    </div>`).join("") : '<p class="muted">Belum ada produk.</p>';

  document.querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>changeQty(decodeURIComponent(b.dataset.minus),-1));
  document.querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>changeQty(decodeURIComponent(b.dataset.plus),1));
  document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{
    const key = decodeURIComponent(b.dataset.remove);
    cart=cart.filter(x=>x.cartKey!==key);
    renderSummary();
    renderPaymentInfo();
  });
}

function renderPaymentInfo() {
  const due = paymentDue();
  const planText = $("paymentPlan").value === "FULL" ? "Full Payment" : `DP ${settings.dp_percentage || 50}%`;
  if ($("paymentMethod").value === "QRIS") {
    $("paymentInfo").innerHTML = `<strong>${escapeHtml(planText)}</strong><p class="small">Bayar sekarang: <strong>${formatRupiah(due)}</strong></p>
      ${settings.qris_image_url ? `<img src="${escapeHtml(settings.qris_image_url)}" alt="QRIS">` : '<p class="muted small">QRIS belum diatur admin.</p>'}
      <p class="small">Setelah membayar, upload bukti pembayaran di bawah.</p>`;
  } else {
    $("paymentInfo").innerHTML = `<strong>${escapeHtml(planText)}</strong><p class="small">Bayar sekarang: <strong>${formatRupiah(due)}</strong></p>
      <p class="small">Bank: <strong>BCA</strong><br>Atas nama: <strong>${escapeHtml(settings.bca_account_name || "Belum diatur")}</strong><br>No. rekening: <strong>${escapeHtml(settings.bca_account_number || "Belum diatur")}</strong></p>
      <p class="small">Setelah transfer, upload bukti pembayaran di bawah.</p>`;
  }
}

function previewProof() {
  const file = $("paymentProofFile").files?.[0];
  if (!file) return $("paymentProofPreview").innerHTML = "";
  if (file.size > 5*1024*1024) return $("paymentProofPreview").innerHTML = `<div class="notice error">Maksimal 5 MB.</div>`;
  if (file.type.startsWith("image/")) {
    const url = URL.createObjectURL(file);
    $("paymentProofPreview").innerHTML = `<img src="${url}" alt="Preview">`;
  } else $("paymentProofPreview").innerHTML = `<div class="notice">Siap diupload: <strong>${escapeHtml(file.name)}</strong></div>`;
}

async function uploadProof(orderId, proofToken, file) {
  const allowed = ["image/png","image/jpeg","image/webp","application/pdf"];
  if (!allowed.includes(file.type)) throw new Error("Format bukti pembayaran tidak didukung.");
  if (file.size > 5*1024*1024) throw new Error("Ukuran bukti pembayaran maksimal 5 MB.");
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `orders/${orderId}/${proofToken}.${ext}`;
  const { error } = await supabase.storage.from("payment-proofs").upload(path, file, {upsert:false,cacheControl:"3600",contentType:file.type});
  if (error) throw error;
  return path;
}

function syncDeliveryMethod() {
  const shipping = $("deliveryMethod").value === "SHIP_TO_ADDRESS";
  $("addressFieldWrap").classList.toggle("hidden", !shipping);
  $("customerAddress").required = shipping;
  if (!shipping) $("customerAddress").value = "";
}

async function submitOrder(e) {
  e.preventDefault();
  if (!cart.length) return showNotice("Tambahkan minimal satu produk.", "error");
  const deliveryMethod = $("deliveryMethod").value;
  const address = $("customerAddress").value.trim();
  if (deliveryMethod === "SHIP_TO_ADDRESS" && !address) {
    return showNotice("Alamat pengiriman wajib diisi.", "error");
  }

  const proof = $("paymentProofFile").files?.[0];
  if (!proof) return showNotice("Bukti pembayaran wajib diunggah.", "error");

  $("submitButton").disabled = true;
  showNotice("Memproses pesanan...", "");

  const {data,error} = await supabase.rpc("create_public_order", {
    p_customer_name:$("customerName").value.trim(),
    p_customer_email:$("customerEmail").value.trim(),
    p_customer_address:deliveryMethod === "SHIP_TO_ADDRESS" ? address : null,
    p_customer_phone:$("customerPhone").value.trim(),
    p_delivery_method:deliveryMethod,
    p_payment_plan:$("paymentPlan").value,
    p_payment_method:$("paymentMethod").value,
    p_items:cart.map(i=>({product_id:i.id,quantity:i.qty,size:i.size || null}))
  });

  if (error) {
    $("submitButton").disabled=false;
    return showNotice("PO gagal dibuat: " + error.message, "error");
  }

  try {
    const proofPath = await uploadProof(data.id, data.proof_token, proof);
    const {error: attachError} = await supabase.rpc("attach_payment_proof", {
      p_order_id:data.id, p_proof_token:data.proof_token, p_proof_path:proofPath
    });
    if (attachError) throw attachError;
  } catch (proofError) {
    showNotice("PO sudah dibuat, tetapi bukti pembayaran gagal diupload: " + proofError.message, "error");
    renderInvoice({...data, proof_uploaded:false});
    $("submitButton").disabled=false;
    return;
  }

  renderInvoice({...data, proof_uploaded:true});
  showNotice("PO dan bukti pembayaran berhasil dikirim.", "success");
  cart=[]; $("orderForm").reset(); $("deliveryMethod").value="BOOTH_CF24"; $("paymentPlan").value="DP"; $("paymentMethod").value="QRIS"; $("paymentProofPreview").innerHTML="";
  syncDeliveryMethod(); $("submitButton").disabled=false; renderSummary(); renderPaymentInfo(); await loadProducts();
}

function renderInvoice(order) {
  $("invoice").innerHTML = `
    <div class="invoice-head"><div>${settings.logo_url ? `<img src="${escapeHtml(settings.logo_url)}" alt="" style="height:46px;max-width:180px;object-fit:contain">` : ""}
      <h2>${escapeHtml(settings.site_name || "Circle Itabaka")}</h2><p class="muted">${escapeHtml(settings.site_title || "Pre-Order CF24")}</p></div>
      <div class="invoice-meta"><strong>${escapeHtml(order.invoice_no)}</strong><span>${formatDate(order.created_at)}</span><span class="status dp">MENUNGGU VERIFIKASI</span></div></div>
    <div class="customer-grid"><p><strong>Pemesan</strong><br>${escapeHtml(order.customer_name)}<br>${escapeHtml(order.customer_email)}<br>${escapeHtml(order.customer_phone)}</p>
      <p><strong>Pengambilan / Pengiriman</strong><br>${order.delivery_method === "SHIP_TO_ADDRESS" ? "Dikirim ke Alamat" : "Ambil di Booth CF24"}${order.delivery_method === "SHIP_TO_ADDRESS" && order.customer_address ? `<br>${escapeHtml(order.customer_address)}` : ""}</p></div>
    <table class="table"><thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th class="right">Subtotal</th></tr></thead><tbody>
      ${(order.items||[]).map(i=>`<tr><td>${escapeHtml(i.name)}${i.size ? `<div class="muted small">Ukuran: ${escapeHtml(i.size)}</div>` : }</td><td>${i.quantity}</td><td>${formatRupiah(i.unit_price)}</td><td class="right">${formatRupiah(i.subtotal)}</td></tr>`).join("")}</tbody></table>
    <div class="invoice-total"><div><span>Total Pesanan</span><strong>${formatRupiah(order.total_amount)}</strong></div>
      <div><span>Bayar Sekarang</span><strong>${formatRupiah(order.payment_amount_due)}</strong></div>
      <div><span>Dibayar</span><strong>${formatRupiah(order.paid_amount)}</strong></div>
      <div class="grand"><span>Sisa Pembayaran</span><strong>${formatRupiah(order.remaining_amount)}</strong></div></div>
    <div class="notice"><strong>Rencana:</strong> ${escapeHtml(order.payment_plan==="FULL"?"Full Payment":`DP (${settings.dp_percentage||50}%)`)}<br>
      <strong>Metode:</strong> ${escapeHtml(order.payment_method==="QRIS"?"QRIS":"Transfer Bank BCA")}<br>
      <strong>Bukti pembayaran:</strong> ${order.proof_uploaded ? "✓ Berhasil diunggah" : "⚠ Belum berhasil diunggah"}</div>`;
  $("invoiceSection").classList.remove("hidden");
  $("invoiceSection").scrollIntoView({behavior:"smooth"});
}

$("orderForm").addEventListener("submit", submitOrder);
$("deliveryMethod").addEventListener("change", syncDeliveryMethod);
$("paymentPlan").addEventListener("change", ()=>{renderPaymentInfo();renderSummary();});
$("paymentMethod").addEventListener("change", renderPaymentInfo);
$("paymentProofFile").addEventListener("change", previewProof);
$("cartButton").addEventListener("click", ()=>$("checkout").scrollIntoView({behavior:"smooth"}));
$("printInvoice").addEventListener("click", ()=>window.print());

await Promise.all([loadSettings(),loadProducts()]);
syncDeliveryMethod(); renderSummary(); renderPaymentInfo();
