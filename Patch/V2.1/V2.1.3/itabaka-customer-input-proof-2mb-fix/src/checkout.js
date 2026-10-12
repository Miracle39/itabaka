import "./styles.css";
import { supabase } from "./lib/supabase.js";
import { escapeHtml, formatDate, formatRupiah } from "./lib/format.js";

const app = document.querySelector("#app");
const CART_KEY = "itabaka_cart_v2";
const SETTINGS_KEY = "itabaka_settings_v1";
const DRAFT_KEY = "itabaka_checkout_draft_v1";

let cart = readSession(CART_KEY) || [];
let settings = {
  site_name: "Circle Itabaka",
  site_title: "Pre-Order CF24",
  qris_image_url: null,
  bca_account_name: "",
  bca_account_number: "",
  dp_percentage: 50
};
let currentStep = 1;

const $ = id => document.getElementById(id);
const total = () => cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);

function readSession(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

function showNotice(message, type = "") {
  $("notice").innerHTML = `<div class="notice ${type}">${escapeHtml(message)}</div>`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function paymentDue() {
  const totalAmount = total();
  return $("paymentPlan").value === "FULL"
    ? totalAmount
    : Math.min(
        totalAmount,
        Math.max(1, Math.ceil(totalAmount * Number(settings.dp_percentage || 50) / 100))
      );
}

function loadSettingsFromSession() {
  const cached = readSession(SETTINGS_KEY);
  if (cached) settings = { ...settings, ...cached };
}

async function refreshSettings() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("site_name,site_title,qris_image_url,bca_account_name,bca_account_number,dp_percentage")
    .eq("id", 1)
    .maybeSingle();

  if (!error && data) {
    settings = { ...settings, ...data };
    writeSession(SETTINGS_KEY, settings);
  }
}

function renderShell() {
  app.innerHTML = `
  <header class="topbar">
    <a class="brand-link" href="index.html">← Kembali ke Produk</a>
    <div class="checkout-brand">
      <strong>${escapeHtml(settings.site_name || "Circle Itabaka")}</strong>
      <span class="muted">Checkout</span>
    </div>
  </header>

  <main>
    <section class="checkout-page container">
      <div class="checkout-page-head">
        <div>
          <p class="eyebrow">CHECKOUT</p>
          <h1>Selesaikan Pesanan</h1>
          <p class="muted">Isi data pemesan terlebih dahulu, kemudian lanjut ke pembayaran.</p>
        </div>
      </div>

      <div id="notice"></div>

      <div class="stepper">
        <div class="step active" data-step-indicator="1"><span>1</span><strong>Data Pemesan</strong></div>
        <div class="step-line"></div>
        <div class="step" data-step-indicator="2"><span>2</span><strong>Pembayaran</strong></div>
      </div>

      <div class="checkout-page-grid">
        <form id="checkoutForm" class="card form-card" novalidate>
          <section class="checkout-step-panel" data-panel="1">
            <div class="panel-title">
              <span class="panel-number">1</span>
              <div><h2>Data Pemesan</h2><p class="muted small">Data ini dipakai untuk konfirmasi dan invoice.</p></div>
            </div>

            <label>Nama<input id="customerName" type="text" required maxlength="120" autocomplete="name" placeholder="Nama lengkap"></label>
            <label>Email<input id="customerEmail" type="email" maxlength="160" autocomplete="email" placeholder="nama@email.com"></label>
            <label>Nomor HP<input id="customerPhone" type="tel" inputmode="numeric" pattern="[0-9]{8,15}" required maxlength="15" autocomplete="tel" placeholder="08xxxxxxxxxx"></label>
            <label>
              Pilihan Pengambilan / Pengiriman
              <select id="deliveryMethod">
                <option value="BOOTH_CF24">Ambil di Booth CF24</option>
                <option value="SHIP_TO_ADDRESS">Dikirim ke Alamat</option>
              </select>
            </label>

            <div id="addressFieldWrap" class="hidden">
              <label>Alamat Pengiriman<textarea id="customerAddress" maxlength="500" rows="5" autocomplete="street-address" placeholder="Alamat lengkap untuk pengiriman"></textarea></label>
            </div>

            <div class="step-actions end">
              <button class="primary" id="toPayment" type="button">Lanjut ke Pembayaran →</button>
            </div>
          </section>

          <section class="checkout-step-panel hidden" data-panel="2">
            <div class="panel-title">
              <span class="panel-number">2</span>
              <div><h2>Pembayaran</h2><p class="muted small">Bayar sesuai nominal, lalu upload bukti pembayaran.</p></div>
            </div>

            <label>
              Rencana Pembayaran
              <select id="paymentPlan">
                <option value="DP">DP</option>
                <option value="FULL">Full Payment</option>
              </select>
            </label>

            <label>
              Metode Pembayaran
              <select id="paymentMethod">
                <option value="QRIS">QRIS</option>
                <option value="BCA_TRANSFER">Transfer Bank blu by BCA Digital</option>
              </select>
            </label>

            <div id="paymentInfo" class="payment-box"></div>

            <label>Bukti Pembayaran
              <input id="paymentProofFile" type="file" accept="image/png,image/jpeg,image/webp,application/pdf">
            </label>
            <p class="muted small">PNG, JPG/JPEG, WEBP, atau PDF. Maksimal 2 MB.</p>
            <div id="paymentProofPreview" class="file-preview"></div>

            <div class="step-actions between">
              <button class="secondary" id="backToData" type="button">← Kembali ke Data</button>
              <button class="primary" id="submitButton" type="submit">Konfirmasi & Buat PO</button>
            </div>
          </section>
        </form>

        <aside id="checkoutSummary" class="card summary-card checkout-summary-card hidden">
          <div class="summary-header"><h3>Ringkasan Pesanan</h3></div>
          <div id="summaryItems"></div>
          <div class="total-row"><span>Total</span><strong id="grandTotal">Rp0</strong></div>
          <div class="total-row"><span>Bayar sekarang</span><strong id="paymentDue">Rp0</strong></div>
          <p class="muted small">Nominal “Bayar sekarang” mengikuti pilihan DP atau Full Payment.</p>
        </aside>
      </div>
    </section>
  </main>

  <footer class="footer">Circle Itabaka · Development build</footer>
  `;

  restoreDraft();
  syncDeliveryMethod();
  renderSummary();
  renderPaymentInfo();
}

function restoreDraft() {
  const draft = readSession(DRAFT_KEY);
  if (!draft) return;

  $("customerName").value = draft.customerName || "";
  $("customerEmail").value = draft.customerEmail || "";
  $("customerPhone").value = draft.customerPhone || "";
  $("deliveryMethod").value = draft.deliveryMethod || "BOOTH_CF24";
  $("customerAddress").value = draft.customerAddress || "";
  $("paymentPlan").value = draft.paymentPlan || "DP";
  $("paymentMethod").value = draft.paymentMethod || "QRIS";
}

function saveDraft() {
  writeSession(DRAFT_KEY, {
    customerName: $("customerName").value,
    customerEmail: $("customerEmail").value,
    customerPhone: $("customerPhone").value,
    deliveryMethod: $("deliveryMethod").value,
    customerAddress: $("customerAddress").value,
    paymentPlan: $("paymentPlan").value,
    paymentMethod: $("paymentMethod").value
  });
}

function renderSummary() {
  $("grandTotal").textContent = formatRupiah(total());
  $("paymentDue").textContent = formatRupiah(paymentDue());

  $("summaryItems").innerHTML = cart.length
    ? cart.map(item => `
      <div class="summary-line">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          ${item.size ? `<div class="muted small">Ukuran: ${escapeHtml(item.size)}</div>` : ""}
          <div class="muted small">${item.qty} × ${formatRupiah(item.price)}</div>
        </div>
        <strong>${formatRupiah(item.price * item.qty)}</strong>
      </div>
    `).join("")
    : `<p class="muted">Keranjang kosong.</p>`;
}

function setStep(step) {
  currentStep = step;

  document.querySelectorAll("[data-panel]").forEach(panel => {
    panel.classList.toggle("hidden", Number(panel.dataset.panel) !== step);
  });

  document.querySelectorAll("[data-step-indicator]").forEach(indicator => {
    const number = Number(indicator.dataset.stepIndicator);
    indicator.classList.toggle("active", number === step);
    indicator.classList.toggle("done", number < step);
  });

  const checkoutSummary = $("checkoutSummary");
  if (checkoutSummary) {
    checkoutSummary.classList.toggle("hidden", step !== 2);
  }

  if (step === 2) renderPaymentInfo();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function validateCustomerData() {
  const name = $("customerName").value.trim();
  const email = $("customerEmail").value.trim();
  const phone = $("customerPhone").value.trim();
  const method = $("deliveryMethod").value;
  const address = $("customerAddress").value.trim();

  if (!name) return "Nama wajib diisi.";
  if (!/\p{L}/u.test(name)) return "Nama harus berupa teks, bukan angka saja.";
  if (!email) return "Email wajib diisi.";
  if (!/^\S+@\S+\.\S+$/.test(email)) return "Format email belum benar.";
  if (!phone) return "Nomor HP wajib diisi.";
  if (!/^\d{8,15}$/.test(phone)) return "Nomor HP harus berupa angka 8–15 digit tanpa spasi atau tanda baca.";
  if (method === "SHIP_TO_ADDRESS" && !address) return "Alamat pengiriman wajib diisi.";
  return "";
}

function renderPaymentInfo() {
  const due = paymentDue();
  const planLabel =
    $("paymentPlan").value === "FULL"
      ? "Full Payment"
      : `DP ${settings.dp_percentage || 50}%`;

  if ($("paymentMethod").value === "QRIS") {
    $("paymentInfo").innerHTML = `
      <strong>${escapeHtml(planLabel)}</strong>
      <p class="small">Bayar sekarang: <strong>${formatRupiah(due)}</strong></p>
      ${settings.qris_image_url
        ? `<img src="${escapeHtml(settings.qris_image_url)}" alt="QRIS">`
        : `<p class="muted small">QRIS belum diatur admin.</p>`}
      <p class="small">Setelah membayar, upload bukti pembayaran di bawah.</p>
    `;
  } else {
    $("paymentInfo").innerHTML = `
      <strong>${escapeHtml(planLabel)}</strong>
      <p class="small">Bayar sekarang: <strong>${formatRupiah(due)}</strong></p>
      <p class="small">
        Bank: <strong>blu by BCA Digital</strong><br>
        Atas nama: <strong>${escapeHtml(settings.bca_account_name || "Belum diatur")}</strong><br>
        No. rekening: <strong>${escapeHtml(settings.bca_account_number || "Belum diatur")}</strong>
      </p>
      <p class="small">Setelah transfer, upload bukti pembayaran di bawah.</p>
    `;
  }
}

function syncDeliveryMethod() {
  const shipping = $("deliveryMethod").value === "SHIP_TO_ADDRESS";
  $("addressFieldWrap").classList.toggle("hidden", !shipping);
  $("customerAddress").required = shipping;
  if (!shipping) $("customerAddress").value = "";
}

function previewProof() {
  const file = $("paymentProofFile").files?.[0];
  if (!file) {
    $("paymentProofPreview").innerHTML = "";
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    $("paymentProofPreview").innerHTML = `<div class="notice error">Ukuran file maksimal 2 MB.</div>`;
    $("paymentProofFile").value = "";
    return;
  }

  if (file.type.startsWith("image/")) {
    const url = URL.createObjectURL(file);
    $("paymentProofPreview").innerHTML = `<img src="${url}" alt="Preview bukti pembayaran">`;
  } else {
    $("paymentProofPreview").innerHTML =
      `<div class="notice">Siap diupload: <strong>${escapeHtml(file.name)}</strong></div>`;
  }
}

async function uploadProof(orderId, proofToken, file) {
  const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
  if (!allowed.includes(file.type)) throw new Error("Format bukti pembayaran tidak didukung.");
  if (file.size > 2 * 1024 * 1024) throw new Error("Ukuran bukti pembayaran maksimal 2 MB.");

  const ext =
    file.type === "application/pdf" ? "pdf" :
    file.type === "image/png" ? "png" :
    file.type === "image/webp" ? "webp" : "jpg";

  const path = `orders/${orderId}/${proofToken}.${ext}`;
  const { error } = await supabase.storage
    .from("payment-proofs")
    .upload(path, file, {
      upsert: false,
      cacheControl: "3600",
      contentType: file.type
    });

  if (error) throw error;
  return path;
}

async function submitOrder(event) {
  event.preventDefault();
  if (currentStep !== 2) return;

  if (!cart.length) {
    showNotice("Keranjang kosong.", "error");
    return;
  }

  const customerError = validateCustomerData();
  if (customerError) {
    setStep(1);
    showNotice(customerError, "error");
    return;
  }

  const proof = $("paymentProofFile").files?.[0];
  if (!proof) {
    showNotice("Bukti pembayaran wajib diunggah.", "error");
    return;
  }

  const allowedProofTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
  if (!allowedProofTypes.includes(proof.type)) {
    showNotice("Format bukti pembayaran harus PNG, JPG/JPEG, WEBP, atau PDF.", "error");
    return;
  }
  if (proof.size > 2 * 1024 * 1024) {
    showNotice("Ukuran bukti pembayaran maksimal 2 MB. Pilih file yang lebih kecil.", "error");
    $("paymentProofFile").value = "";
    $("paymentProofPreview").innerHTML = "";
    return;
  }

  $("submitButton").disabled = true;
  showNotice("Membuat PO dan mengunggah bukti pembayaran...");

  const deliveryMethod = $("deliveryMethod").value;
  const address = $("customerAddress").value.trim();

  const { data, error } = await supabase.rpc("create_public_order", {
    p_customer_name: $("customerName").value.trim(),
    p_customer_email: $("customerEmail").value.trim(),
    p_customer_address: deliveryMethod === "SHIP_TO_ADDRESS" ? address : null,
    p_customer_phone: $("customerPhone").value.trim(),
    p_delivery_method: deliveryMethod,
    p_payment_plan: $("paymentPlan").value,
    p_payment_method: $("paymentMethod").value,
    p_items: cart.map(item => ({
      product_id: item.id,
      quantity: item.qty,
      size: item.size || null
    }))
  });

  if (error) {
    $("submitButton").disabled = false;
    showNotice("PO gagal dibuat: " + error.message, "error");
    return;
  }

  let proofUploaded = false;
  let proofPath = null;

  try {
    proofPath = await uploadProof(data.id, data.proof_token, proof);
    const { error: attachError } = await supabase.rpc("attach_payment_proof", {
      p_order_id: data.id,
      p_proof_token: data.proof_token,
      p_proof_path: proofPath
    });
    if (attachError) throw attachError;
    proofUploaded = true;
  } catch (proofError) {
    console.error(proofError);
  }

  const invoicePayload = {
    order: { ...data, proof_uploaded: proofUploaded, proof_path: proofPath },
    items: cart
  };

  writeSession("itabaka_last_order_v1", invoicePayload);
  sessionStorage.removeItem(CART_KEY);
  sessionStorage.removeItem(DRAFT_KEY);

  if (proofUploaded) {
    window.location.href = "invoice.html";
  } else {
    sessionStorage.setItem(
      "itabaka_invoice_warning_v1",
      "PO berhasil dibuat, tetapi bukti pembayaran belum berhasil diunggah. Simpan invoice dan hubungi admin untuk pengecekan."
    );
    window.location.href = "invoice.html";
  }
}

function bindEvents() {
  $("checkoutForm").addEventListener("submit", submitOrder);
  $("deliveryMethod").addEventListener("change", () => { syncDeliveryMethod(); saveDraft(); });
  $("paymentPlan").addEventListener("change", () => { saveDraft(); renderPaymentInfo(); renderSummary(); });
  $("paymentMethod").addEventListener("change", () => { saveDraft(); renderPaymentInfo(); });
  $("paymentProofFile").addEventListener("change", previewProof);

  ["customerName", "customerEmail", "customerAddress"].forEach(id => {
    $(id).addEventListener("input", saveDraft);
  });

  $("customerPhone").addEventListener("input", () => {
    // Keep only digits; phone numbers stay text to preserve leading zeroes.
    const digitsOnly = $("customerPhone").value.replace(/\D/g, "").slice(0, 15);
    if ($("customerPhone").value !== digitsOnly) {
      $("customerPhone").value = digitsOnly;
    }
    saveDraft();
  });

  $("toPayment").addEventListener("click", () => {
    const error = validateCustomerData();
    if (error) {
      showNotice(error, "error");
      return;
    }
    saveDraft();
    setStep(2);
  });

  $("backToData").addEventListener("click", () => setStep(1));
}

loadSettingsFromSession();
renderShell();
bindEvents();
await refreshSettings();
renderSummary();
renderPaymentInfo();

if (!cart.length) {
  showNotice("Keranjang kosong. Kembali ke produk untuk menambahkan pesanan.", "error");
  $("toPayment").disabled = true;
  $("submitButton").disabled = true;
}
