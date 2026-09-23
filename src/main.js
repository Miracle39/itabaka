import "./styles.css";
import { supabase } from "./lib/supabase.js";
import { escapeHtml, formatDate, formatRupiah } from "./lib/format.js";

const app = document.querySelector("#app");
let products = [];
let cart = [];
let settings = { site_name:"Circle Itabaka", site_title:"Pre-Order CF24", site_description:"Pesan merchandise Itabaka untuk CF24.", logo_url:null, banner_url:null };

app.innerHTML = `
<header class="topbar">
  <div><div class="brand" id="siteName">CIRCLE ITABAKA</div><div class="muted" id="siteTitle">Pre-Order CF24</div></div>
  <button id="cartButton" class="secondary" type="button">Keranjang <span id="cartCount">0</span></button>
</header>
<main>
  <section class="hero" id="heroSection">
    <p class="eyebrow">PRE-ORDER</p><h1 id="heroTitle">Pesan merchandise Itabaka untuk CF24.</h1>
    <p class="muted" id="heroDescription">Silakan pilih produk dan isi data pemesan.</p>
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
        <label>Email<input id="customerEmail" type="email" required maxlength="160" autocomplete="email" placeholder="nama@email.com"></label>
        <label>Alamat<textarea id="customerAddress" required maxlength="500" rows="4" autocomplete="street-address" placeholder="Alamat lengkap"></textarea></label>
        <label>Nomor HP<input id="customerPhone" required maxlength="30" autocomplete="tel" placeholder="08xxxxxxxxxx"></label>
        <button class="primary full" type="submit">Buat Pesanan</button>
      </form>
      <aside class="card summary-card"><h3>Ringkasan</h3><div id="summaryItems"></div><div class="total-row"><span>Total</span><strong id="grandTotal">Rp0</strong></div></aside>
    </div>
  </section>
  <section id="invoiceSection" class="section container hidden">
    <div class="invoice-actions"><div><p class="eyebrow">ORDER CREATED</p><h2>Invoice PO</h2></div><button id="printInvoice" class="secondary" type="button">Cetak / Simpan PDF</button></div>
    <div id="invoice" class="invoice card"></div>
  </section>
</main>
<footer class="footer">Circle Itabaka · Development build</footer>`;

const $ = (id) => document.getElementById(id);
const total = () => cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);

function applySettings(){
  $("siteName").textContent = settings.site_name || "Circle Itabaka";
  $("siteTitle").textContent = settings.site_title || "Pre-Order CF24";
  $("heroTitle").textContent = settings.site_title || "Pre-Order CF24";
  $("heroDescription").textContent = settings.site_description || "Silakan pilih produk dan isi data pemesan.";
  document.documentElement.style.setProperty("--brand-primary", settings.primary_color || "#111111");
  document.documentElement.style.setProperty("--brand-accent", settings.accent_color || "#ffffff");
  if (settings.banner_url) {
    $("heroSection").style.backgroundImage = `linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55)),url("${encodeURI(settings.banner_url)}")`;
    $("heroSection").style.backgroundSize = "cover";
    $("heroSection").style.backgroundPosition = "center";
  }
}

async function loadSettings(){
  const {data,error}=await supabase.from("site_settings").select("*").eq("id",1).maybeSingle();
  if (!error && data){ settings={...settings,...data}; applySettings(); }
}

function renderProducts(){
  if (!products.length){ $("productGrid").innerHTML='<div class="card panel"><strong>Belum ada produk aktif.</strong><p class="muted">Silakan cek kembali nanti.</p></div>'; return; }
  $("productGrid").innerHTML=products.map(p=>`<article class="product-card"><div class="product-image">${p.image_url?`<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}">`:"IMAGE"}</div><div class="product-body"><span class="product-code">${escapeHtml(p.code)}</span><h3>${escapeHtml(p.name)}</h3><p class="muted">${escapeHtml(p.description)}</p><div class="price">${formatRupiah(p.price)}</div><p class="muted">${p.stock===null?"Stok tidak dibatasi":`Stok: ${p.stock}`}</p><button class="primary full" type="button" data-add="${p.id}" ${p.stock===0?"disabled":""}>Tambah</button></div></article>`).join("");
  document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>addToCart(b.dataset.add));
}

function addToCart(id){
  const product=products.find(p=>p.id===id); if(!product) return;
  const current=cart.find(i=>i.id===id)?.qty||0;
  if(product.stock!==null && current>=product.stock){ showNotice("Stok produk tersebut sudah maksimal.","error"); return; }
  const item=cart.find(i=>i.id===id); if(item)item.qty+=1; else cart.push({...product,qty:1});
  renderSummary(); $("checkout").scrollIntoView({behavior:"smooth"});
}
function changeQty(id,delta){
  const item=cart.find(i=>i.id===id), product=products.find(p=>p.id===id); if(!item||!product)return;
  const next=item.qty+delta;
  if(next<=0)cart=cart.filter(i=>i.id!==id);
  else if(product.stock!==null&&next>product.stock)showNotice("Jumlah melebihi stok.","error");
  else item.qty=next;
  renderSummary();
}
function removeItem(id){cart=cart.filter(i=>i.id!==id);renderSummary();}
function renderSummary(){
  $("cartCount").textContent=cart.reduce((sum,i)=>sum+i.qty,0); $("grandTotal").textContent=formatRupiah(total());
  $("summaryItems").innerHTML=cart.length?cart.map(i=>`<div class="summary-line"><div><strong>${escapeHtml(i.name)}</strong><div class="quantity-controls"><button type="button" data-minus="${i.id}">−</button><span>${i.qty}</span><button type="button" data-plus="${i.id}">+</button><button class="remove" type="button" data-remove="${i.id}">Hapus</button></div></div><strong>${formatRupiah(i.price*i.qty)}</strong></div>`).join(""):'<p class="muted">Belum ada produk.</p>';
  document.querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.minus,-1)); document.querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.plus,1)); document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>removeItem(b.dataset.remove));
}

async function loadProducts(){
  const {data,error}=await supabase.from("products").select("id,code,name,description,price,image_url,stock").eq("active",true).order("sort_order",{ascending:true}).order("name",{ascending:true});
  if(error){showNotice("Produk gagal dimuat: "+error.message,"error");return;} products=data||[];renderProducts();
}
function showNotice(message,kind=""){ $("checkoutNotice").innerHTML=`<div class="notice ${kind}">${escapeHtml(message)}</div>`; clearTimeout(showNotice.timer); showNotice.timer=setTimeout(()=>$("checkoutNotice").innerHTML="",6000); }

async function submitOrder(event){
  event.preventDefault();
  if(!cart.length){showNotice("Tambahkan minimal satu produk.","error");return;}
  const p={customer_name:$("customerName").value.trim(),customer_email:$("customerEmail").value.trim(),customer_address:$("customerAddress").value.trim(),customer_phone:$("customerPhone").value.trim(),items:cart.map(i=>({product_id:i.id,quantity:i.qty}))};
  if(!p.customer_name||!p.customer_email||!p.customer_address||!p.customer_phone){showNotice("Nama, email, alamat, dan nomor HP wajib diisi.","error");return;}
  const {data,error}=await supabase.rpc("create_public_order",{p_customer_name:p.customer_name,p_customer_email:p.customer_email,p_customer_address:p.customer_address,p_customer_phone:p.customer_phone,p_items:p.items});
  if(error){showNotice("PO gagal dibuat: "+error.message,"error");return;}
  if(!data?.invoice_no){showNotice("PO berhasil dibuat, tetapi invoice tidak dapat ditampilkan.","error");return;}
  renderInvoice(data); showNotice("PO berhasil dibuat. Tim Itabaka akan menghubungi kamu untuk pembayaran.","success"); cart=[]; $("orderForm").reset(); renderSummary(); await loadProducts();
}
function renderInvoice(order){
  $("invoice").innerHTML=`<div class="invoice-head"><div>${settings.logo_url?`<img src="${escapeHtml(settings.logo_url)}" alt="" style="height:48px;max-width:180px;object-fit:contain">`:""}<h2>${escapeHtml(settings.site_name||"Circle Itabaka")}</h2><p class="muted">${escapeHtml(settings.site_title||"Pre-Order CF24")}</p></div><div class="invoice-meta"><strong>${escapeHtml(order.invoice_no)}</strong><span>${formatDate(order.created_at)}</span><span class="status dp">DP</span></div></div><div class="customer-grid"><p><strong>Pemesan</strong><br>${escapeHtml(order.customer_name)}<br>${escapeHtml(order.customer_email)}<br>${escapeHtml(order.customer_phone)}</p><p><strong>Alamat</strong><br>${escapeHtml(order.customer_address)}</p></div><table class="table"><thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th class="right">Subtotal</th></tr></thead><tbody>${(order.items||[]).map(i=>`<tr><td>${escapeHtml(i.name)}</td><td>${i.quantity}</td><td>${formatRupiah(i.unit_price)}</td><td class="right">${formatRupiah(i.subtotal)}</td></tr>`).join("")}</tbody></table><div class="invoice-total"><div><span>Total Pesanan</span><strong>${formatRupiah(order.total_amount)}</strong></div><div><span>Dibayar</span><strong>${formatRupiah(order.paid_amount)}</strong></div><div class="grand"><span>Sisa Pembayaran</span><strong>${formatRupiah(order.remaining_amount)}</strong></div></div><p class="muted">Status awal pesanan: DP. Pembayaran diproses/dicatat oleh admin.</p>`;
  $("invoiceSection").classList.remove("hidden"); $("invoiceSection").scrollIntoView({behavior:"smooth"});
}

$("orderForm").addEventListener("submit",submitOrder); $("cartButton").addEventListener("click",()=>$("checkout").scrollIntoView({behavior:"smooth"})); $("printInvoice").addEventListener("click",()=>window.print());
await Promise.all([loadSettings(),loadProducts()]); renderSummary();
