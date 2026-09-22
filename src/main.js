import "./styles.css";
import { supabase } from "./lib/supabase.js";
import { escapeHtml, formatDate, formatRupiah } from "./lib/format.js";

const app = document.querySelector("#app");
let products = [];
let cart = [];

app.innerHTML = `
<header class="topbar">
  <div><div class="brand">CIRCLE ITABAKA</div><div class="muted">Pre-Order CF24</div></div>
  <button id="cartButton" class="secondary" type="button">Keranjang <span id="cartCount">0</span></button>
</header>
<main>
  <section class="hero">
    <p class="eyebrow">PRE-ORDER</p>
    <h1>Pesan merchandise Itabaka untuk CF24.</h1>
    <p class="muted">Versi development dengan Supabase. Branding dan aset final dapat ditambahkan belakangan.</p>
    <a class="primary" href="#products">Lihat Produk</a>
  </section>
  <section id="products" class="section container">
    <div class="section-head"><div><p class="eyebrow">CATALOG</p><h2>Produk</h2></div><span class="muted">Pilih item untuk dimasukkan ke keranjang.</span></div>
    <div id="productGrid" class="grid"></div>
  </section>
  <section id="checkout" class="section container">
    <div><p class="eyebrow">CHECKOUT</p><h2>Data Pemesan</h2></div>
    <div id="checkoutNotice"></div>
    <div class="checkout-grid">
      <form id="orderForm" class="card form-card">
        <label>Nama<input id="customerName" required maxlength="120" autocomplete="name" placeholder="Nama lengkap"></label>
        <label>Kontak / WhatsApp<input id="customerContact" required maxlength="120" autocomplete="tel" placeholder="08xxxxxxxxxx"></label>
        <label>Pengambilan<select id="pickupMethod"><option value="Ambil di CF24">Ambil di CF24</option><option value="Lainnya">Lainnya</option></select></label>
        <label>Catatan<textarea id="notes" maxlength="1000" rows="3" placeholder="Catatan pesanan (opsional)"></textarea></label>
        <label>Status pembayaran<select id="paymentStatus"><option value="DP">DP</option><option value="LUNAS">LUNAS</option></select></label>
        <label>Nominal dibayar<input id="paidAmount" type="number" min="0" step="1000" value="0" required inputmode="numeric"></label>
        <button class="primary full" type="submit">Konfirmasi PO</button>
      </form>
      <aside class="card summary-card"><h3>Ringkasan</h3><div id="summaryItems"></div><div class="total-row"><span>Total</span><strong id="grandTotal">Rp0</strong></div><div class="total-row"><span>Dibayar</span><strong id="paidPreview">Rp0</strong></div><div class="total-row"><span>Sisa</span><strong id="remainingPreview">Rp0</strong></div></aside>
    </div>
  </section>
  <section id="invoiceSection" class="section container hidden">
    <div class="invoice-actions"><div><p class="eyebrow">CONFIRMED</p><h2>Invoice PO</h2></div><button id="printInvoice" class="secondary" type="button">Cetak / Simpan PDF</button></div>
    <div id="invoice" class="invoice card"></div>
  </section>
</main>
<footer class="footer">Circle Itabaka · Development build</footer>`;

const $ = (id) => document.getElementById(id);
const total = () => cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);

function showNotice(message, kind = "") {
  $("checkoutNotice").innerHTML = `<div class="notice ${kind}">${escapeHtml(message)}</div>`;
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => $("checkoutNotice").replaceChildren(), 5000);
}

function renderProducts() {
  $("productGrid").innerHTML = products.length ? products.map((p) => `
    <article class="product-card"><div class="product-image">${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}">` : "IMAGE"}</div><div class="product-body">
      <span class="product-code">${escapeHtml(p.code)}</span><h3>${escapeHtml(p.name)}</h3><p class="muted">${escapeHtml(p.description)}</p><div class="price">${formatRupiah(p.price)}</div>
      <p class="muted">${p.stock === null ? "Stok tidak dibatasi" : `Stok: ${p.stock}`}</p><button class="primary full" type="button" data-add="${p.id}" ${p.stock === 0 ? "disabled" : ""}>Tambah</button>
    </div></article>`).join("") : `<div class="card panel"><strong>Belum ada produk aktif.</strong><p class="muted">Tambahkan produk melalui admin.</p></div>`;
  document.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => addToCart(b.dataset.add));
}

function addToCart(id) {
  const product = products.find((p) => p.id === id);
  if (!product) return;
  const existing = cart.find((item) => item.id === id);
  const nextQty = (existing?.qty || 0) + 1;
  if (product.stock !== null && nextQty > product.stock) return showNotice("Jumlah melebihi stok.", "error");
  if (existing) existing.qty = nextQty; else cart.push({ ...product, qty: 1 });
  renderSummary();
  $("checkout").scrollIntoView({ behavior: "smooth" });
}

function changeQty(id, delta) {
  const item = cart.find((i) => i.id === id); const product = products.find((p) => p.id === id);
  if (!item || !product) return;
  const next = item.qty + delta;
  if (next <= 0) cart = cart.filter((i) => i.id !== id);
  else if (product.stock !== null && next > product.stock) return showNotice("Jumlah melebihi stok.", "error");
  else item.qty = next;
  renderSummary();
}
function removeItem(id){ cart = cart.filter((i)=>i.id !== id); renderSummary(); }

function renderSummary() {
  $("cartCount").textContent = cart.reduce((sum, item) => sum + item.qty, 0);
  $("summaryItems").innerHTML = cart.length ? cart.map((item) => `
    <div class="summary-line"><div><strong>${escapeHtml(item.name)}</strong><div class="quantity-controls"><button type="button" data-minus="${item.id}">−</button><span>${item.qty}</span><button type="button" data-plus="${item.id}">+</button><button class="remove" type="button" data-remove="${item.id}">Hapus</button></div></div><strong>${formatRupiah(item.price * item.qty)}</strong></div>`).join("") : '<p class="muted">Belum ada produk.</p>';
  $("grandTotal").textContent = formatRupiah(total());
  updatePaidPreview();
  document.querySelectorAll("[data-minus]").forEach((b)=>b.onclick=()=>changeQty(b.dataset.minus,-1));
  document.querySelectorAll("[data-plus]").forEach((b)=>b.onclick=()=>changeQty(b.dataset.plus,1));
  document.querySelectorAll("[data-remove]").forEach((b)=>b.onclick=()=>removeItem(b.dataset.remove));
}

function updatePaidPreview(){const paid=Math.min(Math.max(Number($("paidAmount").value||0),0),total());$("paidPreview").textContent=formatRupiah(paid);$("remainingPreview").textContent=formatRupiah(total()-paid);}
function syncPaymentStatus(){const isLunas=$("paymentStatus").value === "LUNAS";$("paidAmount").readOnly=isLunas;if(isLunas)$("paidAmount").value=total();updatePaidPreview();}

async function loadProducts(){
  const {data,error}=await supabase.from("products").select("id,code,name,description,price,image_url,stock").eq("active",true).order("sort_order").order("name");
  if(error) return showNotice("Produk gagal dimuat: "+error.message,"error");
  products=data||[];renderProducts();
}

function renderInvoice(order){
  $("invoice").innerHTML=`<div class="invoice-head"><div><h2>CIRCLE ITABAKA</h2><p class="muted">Pre-Order CF24</p></div><div class="invoice-meta"><strong>${escapeHtml(order.invoice_no)}</strong><span>${formatDate(order.created_at)}</span><span class="status ${order.payment_status==='LUNAS'?'lunas':'dp'}">${escapeHtml(order.payment_status)}</span></div></div>
  <div class="customer-grid"><p><strong>Pemesan</strong><br>${escapeHtml(order.customer_name)}<br>${escapeHtml(order.customer_contact)}</p><p><strong>Pengambilan</strong><br>${escapeHtml(order.pickup_method)}</p></div>
  <table class="table"><thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th class="right">Subtotal</th></tr></thead><tbody>${(order.items||[]).map((i)=>`<tr><td>${escapeHtml(i.name)}</td><td>${i.quantity}</td><td>${formatRupiah(i.unit_price)}</td><td class="right">${formatRupiah(i.subtotal)}</td></tr>`).join("")}</tbody></table>
  <div class="invoice-total"><div><span>Total Pesanan</span><strong>${formatRupiah(order.total_amount)}</strong></div><div><span>Dibayar</span><strong>${formatRupiah(order.paid_amount)}</strong></div><div class="grand"><span>Sisa Pembayaran</span><strong>${formatRupiah(order.remaining_amount)}</strong></div></div>
  ${order.notes?`<p><strong>Catatan:</strong> ${escapeHtml(order.notes)}</p>`:""}`;
  $("invoiceSection").classList.remove("hidden");$("invoiceSection").scrollIntoView({behavior:"smooth"});
}

$("orderForm").addEventListener("submit",async(e)=>{
  e.preventDefault();if(!cart.length)return showNotice("Tambahkan minimal satu produk.","error");
  const status=$("paymentStatus").value, paid=Number($("paidAmount").value||0);
  if(status==='DP' && paid<=0)return showNotice("Untuk DP, nominal pembayaran harus lebih dari 0.","error");
  const {data,error}=await supabase.rpc("create_public_order",{
    p_customer_name:$("customerName").value.trim(),p_customer_contact:$("customerContact").value.trim(),p_pickup_method:$("pickupMethod").value,
    p_notes:$("notes").value.trim()||null,p_payment_status:status,p_paid_amount:paid,
    p_items:cart.map((i)=>({product_id:i.id,quantity:i.qty}))
  });
  if(error)return showNotice("PO gagal dibuat: "+error.message,"error");
  const order=Array.isArray(data)?data[0]:data;if(!order?.invoice_no)return showNotice("PO berhasil tetapi invoice tidak diterima.","error");
  renderInvoice(order);showNotice("PO berhasil dibuat.","success");cart=[];$("orderForm").reset();$("paymentStatus").value="DP";$("paidAmount").value=0;renderSummary();await loadProducts();
});

$("paymentStatus").addEventListener("change",syncPaymentStatus);$("paidAmount").addEventListener("input",updatePaidPreview);$("cartButton").addEventListener("click",()=>$("checkout").scrollIntoView({behavior:"smooth"}));$("printInvoice").addEventListener("click",()=>window.print());
await loadProducts();renderSummary();syncPaymentStatus();
