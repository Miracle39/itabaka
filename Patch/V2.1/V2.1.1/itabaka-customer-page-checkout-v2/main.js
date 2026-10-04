import "./styles.css";
import { supabase } from "./lib/supabase.js";
import { escapeHtml, formatRupiah } from "./lib/format.js";

const app = document.querySelector("#app");

const CART_KEY = "itabaka_cart_v2";
const SETTINGS_KEY = "itabaka_settings_v1";

let products = [];
let cart = readCart();
let settings = {
  site_name: "Circle Itabaka",
  site_title: "Pre-Order CF24",
  site_description: "Pesan merchandise Itabaka untuk CF24.",
  logo_url: null,
  banner_url: null,
  qris_image_url: null,
  bca_account_name: "",
  bca_account_number: "",
  dp_percentage: 50
};

const $ = id => document.getElementById(id);
const isApparel = p => p?.category === "TSHIRT" || p?.category === "JACKET";
const cartTotal = () => cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);

function readCart() {
  try {
    const raw = sessionStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart() {
  sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function saveSettings() {
  sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function showNotice(message, type = "") {
  const box = $("notice");
  if (!box) return;
  box.innerHTML = `<div class="notice ${type}">${escapeHtml(message)}</div>`;
}

function applySettings() {
  const siteName = $("siteName");
  const siteTitle = $("siteTitle");
  const heroTitle = $("heroTitle");
  const heroDescription = $("heroDescription");
  const hero = $("hero");

  if (siteName) {
    siteName.innerHTML = settings.logo_url
      ? `<img src="${escapeHtml(settings.logo_url)}" alt="${escapeHtml(settings.site_name || "Circle Itabaka")}" style="height:38px;max-width:180px;object-fit:contain">`
      : escapeHtml(settings.site_name || "Circle Itabaka");
  }
  if (siteTitle) siteTitle.textContent = settings.site_title || "Pre-Order";
  if (heroTitle) heroTitle.textContent = settings.site_title || "Pre-Order CF24";
  if (heroDescription) {
    heroDescription.textContent =
      settings.site_description || "Pilih produk, masukkan ke keranjang, lalu checkout saat sudah siap.";
  }
  if (hero && settings.banner_url) {
    hero.style.backgroundImage =
      `linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55)),url("${String(settings.banner_url).replaceAll('"','%22')}")`;
    hero.style.backgroundSize = "cover";
    hero.style.backgroundPosition = "center";
  }
}

async function loadSettings() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("site_name,site_title,site_description,logo_url,banner_url,qris_image_url,bca_account_name,bca_account_number,dp_percentage")
    .eq("id", 1)
    .maybeSingle();

  if (!error && data) {
    settings = { ...settings, ...data };
    saveSettings();
    applySettings();
  }
}

async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id,code,name,description,price,image_url,stock,category,available_sizes")
    .eq("active", true)
    .order("sort_order")
    .order("name");

  if (error) {
    showNotice("Produk gagal dimuat: " + error.message, "error");
    return;
  }

  products = data || [];
  renderProducts();
}

function renderProducts() {
  const grid = $("productGrid");
  if (!grid) return;

  grid.innerHTML = products.length
    ? products.map(product => `
      <article class="product-card">
        <div class="product-image">
          ${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}">` : "IMAGE"}
        </div>
        <div class="product-body">
          <h3>${escapeHtml(product.name)}</h3>
          ${product.description ? `<p class="muted">${escapeHtml(product.description)}</p>` : ""}
          <div class="price">${formatRupiah(product.price)}</div>
          <p class="muted">${product.stock === null ? "Stok tidak dibatasi" : `Stok: ${product.stock}`}</p>

          ${isApparel(product) ? `
            <label class="size-picker">
              Ukuran
              <select data-size="${product.id}">
                ${(product.available_sizes || []).length
                  ? product.available_sizes.map(size => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`).join("")
                  : `<option value="">Belum ada ukuran</option>`}
              </select>
            </label>` : ""}

          <button
            class="primary full"
            type="button"
            data-add="${product.id}"
            ${(product.stock === 0 || (isApparel(product) && !(product.available_sizes || []).length)) ? "disabled" : ""}
          >Tambah ke Keranjang</button>
        </div>
      </article>
    `).join("")
    : `<div class="card form-card"><strong>Belum ada produk aktif.</strong></div>`;

  document.querySelectorAll("[data-add]").forEach(button => {
    button.addEventListener("click", () => {
      const product = products.find(item => item.id === button.dataset.add);
      const size = isApparel(product)
        ? document.querySelector(`[data-size="${product.id}"]`)?.value || null
        : null;
      addToCart(product, size);
    });
  });
}

function addToCart(product, size = null) {
  if (!product) return;
  if (isApparel(product) && !size) return showNotice("Pilih ukuran terlebih dahulu.", "error");
  if (product.stock === 0) return showNotice("Produk sedang habis.", "error");

  const cartKey = `${product.id}__${size || ""}`;
  const existing = cart.find(item => item.cartKey === cartKey);
  const nextQty = (existing?.qty || 0) + 1;

  if (product.stock !== null && nextQty > product.stock) {
    return showNotice("Jumlah melebihi stok.", "error");
  }

  if (existing) {
    existing.qty = nextQty;
  } else {
    cart.push({ ...product, qty: 1, size, cartKey });
  }

  saveCart();
  renderCart();
  showNotice(`${product.name}${size ? ` (${size})` : ""} ditambahkan ke keranjang.`, "success");
}

function changeQty(cartKey, delta) {
  const item = cart.find(entry => entry.cartKey === cartKey);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(entry => entry.cartKey !== cartKey);
  } else {
    const product = products.find(entry => entry.id === item.id);
    if (product?.stock !== null && item.qty > product.stock) item.qty = product.stock;
  }

  saveCart();
  renderCart();
}

function removeFromCart(cartKey) {
  cart = cart.filter(item => item.cartKey !== cartKey);
  saveCart();
  renderCart();
}

function openCart() {
  renderCart();
  $("cartModal")?.classList.remove("hidden");
  $("cartModal")?.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeCart() {
  $("cartModal")?.classList.add("hidden");
  $("cartModal")?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function renderCart() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  $("cartCount").textContent = String(count);
  $("cartTotal").textContent = formatRupiah(cartTotal());
  $("checkoutButton").disabled = !cart.length;

  $("cartItems").innerHTML = cart.length
    ? cart.map(item => `
      <div class="cart-line">
        <div class="cart-line-main">
          <div class="cart-line-image">
            ${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="">` : ""}
          </div>
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            ${item.size ? `<div class="muted small">Ukuran: ${escapeHtml(item.size)}</div>` : ""}
            <div class="muted small">${formatRupiah(item.price)} / item</div>
          </div>
        </div>
        <div class="cart-line-side">
          <strong>${formatRupiah(item.price * item.qty)}</strong>
          <div class="quantity-controls">
            <button type="button" data-minus="${encodeURIComponent(item.cartKey)}">−</button>
            <span>${item.qty}</span>
            <button type="button" data-plus="${encodeURIComponent(item.cartKey)}">+</button>
            <button class="remove" type="button" data-remove="${encodeURIComponent(item.cartKey)}">Hapus</button>
          </div>
        </div>
      </div>
    `).join("")
    : `
      <div class="empty-cart">
        <strong>Keranjang masih kosong.</strong>
        <p class="muted">Pilih produk terlebih dahulu, lalu buka keranjang untuk checkout.</p>
        <button class="primary" type="button" id="emptyCartBrowse">Lihat Produk</button>
      </div>
    `;

  document.querySelectorAll("[data-minus]").forEach(button => {
    button.onclick = () => changeQty(decodeURIComponent(button.dataset.minus), -1);
  });
  document.querySelectorAll("[data-plus]").forEach(button => {
    button.onclick = () => changeQty(decodeURIComponent(button.dataset.plus), 1);
  });
  document.querySelectorAll("[data-remove]").forEach(button => {
    button.onclick = () => removeFromCart(decodeURIComponent(button.dataset.remove));
  });

  $("emptyCartBrowse")?.addEventListener("click", () => {
    closeCart();
    $("products")?.scrollIntoView({ behavior: "smooth" });
  });
}

function goToCheckout() {
  if (!cart.length) {
    showNotice("Keranjang masih kosong. Tambahkan produk terlebih dahulu.", "error");
    return;
  }

  saveCart();
  saveSettings();
  window.location.href = "checkout.html";
}

app.innerHTML = `
<header class="topbar">
  <div class="brand-wrap">
    <div class="brand" id="siteName">CIRCLE ITABAKA</div>
    <div class="muted" id="siteTitle">Pre-Order CF24</div>
  </div>
  <button class="secondary cart-trigger" id="cartButton" type="button">
    Keranjang <span id="cartCount">0</span>
  </button>
</header>

<main>
  <section class="hero" id="hero">
    <p class="eyebrow">PRE-ORDER</p>
    <h1 id="heroTitle">Pesan merchandise Itabaka untuk CF24.</h1>
    <p class="muted" id="heroDescription">
      Pilih produk, masukkan ke keranjang, lalu checkout saat sudah siap.
    </p>
    <a class="primary hero-button" href="#products">Lihat Produk</a>
  </section>

  <section class="section container" id="products">
    <div class="section-head">
      <div>
        <p class="eyebrow">CATALOG</p>
        <h2>Produk</h2>
      </div>
    </div>
    <div id="notice"></div>
    <div id="productGrid" class="grid"></div>
  </section>
</main>

<div class="modal hidden" id="cartModal" aria-hidden="true">
  <div class="modal-backdrop" data-close-cart="true"></div>
  <div class="cart-modal-card" role="dialog" aria-modal="true" aria-labelledby="cartTitle">
    <div class="modal-header">
      <div>
        <p class="eyebrow">CART</p>
        <h2 id="cartTitle">Keranjang</h2>
      </div>
      <button class="icon-button" id="closeCart" type="button" aria-label="Tutup">×</button>
    </div>
    <div id="cartItems" class="cart-items"></div>
    <div class="cart-total"><span>Total</span><strong id="cartTotal">Rp0</strong></div>
    <div class="cart-actions">
      <button class="secondary" id="continueShopping" type="button">Lanjut Belanja</button>
      <button class="primary" id="checkoutButton" type="button">Checkout →</button>
    </div>
  </div>
</div>

<footer class="footer">Circle Itabaka · Development build</footer>
`;

$("cartButton").addEventListener("click", openCart);
$("closeCart").addEventListener("click", closeCart);
$("continueShopping").addEventListener("click", closeCart);
$("checkoutButton").addEventListener("click", goToCheckout);
$("cartModal").addEventListener("click", event => {
  if (event.target.dataset.closeCart === "true") closeCart();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !$("cartModal").classList.contains("hidden")) closeCart();
});

await Promise.all([loadSettings(), loadProducts()]);
renderCart();
