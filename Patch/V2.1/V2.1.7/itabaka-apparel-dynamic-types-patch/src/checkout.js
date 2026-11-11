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
let promoState = { code: "", valid: false, discount_amount: 0, member_name: "" };

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

function finalTotal() {
  return Math.max(0, total() - Number(promoState.discount_amount || 0));
}

function showPromoPopup(message, type = "success") {
  const root = $("promoPopupRoot");
  if (!root) return;
  root.innerHTML = `<div class="promo-popup-backdrop"><section class="promo-popup-card ${type}" role="dialog" aria-modal="true" aria-labelledby="promoPopupTitle"><h3 id="promoPopupTitle">${type === "success" ? "Promo berhasil" : "Promo tidak dapat digunakan"}</h3><p>${escapeHtml(message)}</p><button class="primary" id="closePromoPopup" type="button">Mengerti</button></section></div>`;
  const close = () => root.replaceChildren();
  $("closePromoPopup").onclick = close;
  root.querySelector(".promo-popup-backdrop").addEventListener("click", event => { if (event.target.classList.contains("promo-popup-backdrop")) close(); });
}

function paymentDue() {
  const totalAmount = finalTotal();
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
  <style>
    .field-feedback{display:block;color:#b91c1c;font-size:12px;font-weight:600;line-height:1.4;margin:5px 0 0}
    .field-feedback.hidden{display:none!important}
    .promo-entry-card{border:1px solid #e6e6e6;border-radius:14px;padding:16px;margin:16px 0;background:#fcfcfc}
    .promo-entry-card h3{margin:0 0 5px;font-size:15px}
    .promo-entry-row{display:flex;gap:9px;margin-top:10px}
    .promo-entry-row input{flex:1;min-width:0;text-transform:uppercase}
    .promo-feedback{font-size:12px;margin-top:8px;color:#666}
    .promo-feedback.success{color:#16713a;font-weight:700}
    .promo-feedback.error{color:#b42318;font-weight:700}
    @media(max-width:520px){.promo-entry-row{flex-direction:column}.promo-entry-row button{width:100%}}
    .promo-popup-backdrop{position:fixed;inset:0;background:rgba(15,15,15,.48);display:grid;place-items:center;padding:18px;z-index:9999}
    .promo-popup-card{width:min(390px,100%);background:#fff;border-radius:18px;padding:23px;box-shadow:0 25px 80px rgba(0,0,0,.22)}
    .promo-popup-card h3{margin:0 0 8px;font-size:18px}.promo-popup-card p{color:#555;line-height:1.55;margin:0 0 18px}.promo-popup-card.success h3{color:#16713a}.promo-popup-card.error h3{color:#b42318}
    .promo-popup-card button{width:100%}
  </style>
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
      <div id="promoPopupRoot"></div>

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

            <label>Nama
              <input id="customerName" type="text" required maxlength="120" autocomplete="name" placeholder="Nama lengkap" aria-describedby="customerNameFeedback">
              <small id="customerNameFeedback" class="field-feedback hidden" role="alert" aria-live="polite">Nama hanya boleh berisi huruf dan spasi.</small>
            </label>
            <label>Email<input id="customerEmail" type="email" maxlength="160" autocomplete="email" placeholder="nama@email.com"></label>
            <label>Nomor HP
              <input id="customerPhone" type="tel" inputmode="numeric" pattern="[0-9]{8,15}" required maxlength="15" autocomplete="tel" placeholder="08xxxxxxxxxx" aria-describedby="customerPhoneFeedback">
              <small id="customerPhoneFeedback" class="field-feedback hidden" role="alert" aria-live="polite">Nomor HP hanya boleh berisi angka.</small>
            </label>
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

            <section class="promo-entry-card" aria-labelledby="promoHeading">
              <h3 id="promoHeading">Voucher</h3>
              <div class="promo-entry-row">
                <input id="promoCode" type="text" maxlength="20" autocomplete="off" placeholder="Voucher Dari Akane" aria-label="Kode promo member">
                <button id="applyPromo" class="secondary" type="button">Gunakan Kode</button>
              </div>
              <div id="promoFeedback" class="promo-feedback" aria-live="polite"></div>
            </section>

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
          <div class="total-row"><span>Subtotal</span><strong id="subtotalAmount">Rp0</strong></div>
          <div class="total-row" id="promoDiscountRow" hidden><span>Voucher</span><strong id="promoDiscountAmount">-Rp0</strong></div>
          <div class="total-row"><span>Total Akhir</span><strong id="grandTotal">Rp0</strong></div>
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
  $("promoCode").value = draft.promoCode || "";
}

function saveDraft() {
  writeSession(DRAFT_KEY, {
    customerName: $("customerName").value,
    customerEmail: $("customerEmail").value,
    customerPhone: $("customerPhone").value,
    deliveryMethod: $("deliveryMethod").value,
    customerAddress: $("customerAddress").value,
    paymentPlan: $("paymentPlan").value,
    paymentMethod: $("paymentMethod").value,
    promoCode: $("promoCode")?.value || ""
  });
}

function renderSummary() {
  $("subtotalAmount").textContent = formatRupiah(total());
  $("grandTotal").textContent = formatRupiah(finalTotal());
  $("paymentDue").textContent = formatRupiah(paymentDue());
  const discountRow = $("promoDiscountRow");
const showVoucher = promoState.valid && promoState.discount_amount > 0;

if (discountRow) {
  discountRow.hidden = !showVoucher;
  discountRow.style.display = showVoucher ? "flex" : "none";
}
  if (discountRow) discountRow.hidden = !(promoState.valid && promoState.discount_amount > 0);
  if ($("promoDiscountAmount")) $("promoDiscountAmount").textContent = `-${formatRupiah(promoState.discount_amount)}`;

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

function setFieldFeedback(id, message) {
  const feedback = $(id);
  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.toggle("hidden", !message);
}

function validateCustomerData() {
  const name = $("customerName").value.trim();
  const email = $("customerEmail").value.trim();
  const phone = $("customerPhone").value.trim();
  const method = $("deliveryMethod").value;
  const address = $("customerAddress").value.trim();

  if (!name) {
    setFieldFeedback("customerNameFeedback", "Nama wajib diisi.");
    return "Nama wajib diisi.";
  }
  if (!/^[\p{L}\p{M} ]+$/u.test(name)) {
    setFieldFeedback("customerNameFeedback", "Nama hanya boleh berisi huruf dan spasi.");
    return "Nama hanya boleh berisi huruf dan spasi.";
  }
  setFieldFeedback("customerNameFeedback", "");

  if (!email) return "Email wajib diisi.";
  if (!/^\S+@\S+\.\S+$/.test(email)) return "Format email belum benar.";
  if (!phone) {
    setFieldFeedback("customerPhoneFeedback", "Nomor HP wajib diisi.");
    return "Nomor HP wajib diisi.";
  }
  if (!/^[0-9]{8,15}$/.test(phone)) {
    setFieldFeedback("customerPhoneFeedback", "Nomor HP harus 8–15 digit angka.");
    return "Nomor HP harus 8–15 digit angka.";
  }
  setFieldFeedback("customerPhoneFeedback", "");
  if (method === "SHIP_TO_ADDRESS" && !address) return "Alamat pengiriman wajib diisi.";
  return "";
}

function renderPaymentInfo() {
  const due = paymentDue();
  const payableTotal = finalTotal();
  const planLabel =
    $("paymentPlan").value === "FULL"
      ? "Full Payment"
      : `DP ${settings.dp_percentage || 50}%`;

  if ($("paymentMethod").value === "QRIS") {
    $("paymentInfo").innerHTML = `
      <strong>${escapeHtml(planLabel)}</strong>
      <p class="small">Total setelah diskon: <strong>${formatRupiah(payableTotal)}</strong></p>
      <p class="small">Bayar sekarang: <strong>${formatRupiah(due)}</strong></p>
      ${settings.qris_image_url
        ? `<img src="${escapeHtml(settings.qris_image_url)}" alt="QRIS">`
        : `<p class="muted small">QRIS belum diatur admin.</p>`}
      <p class="small">Setelah membayar, upload bukti pembayaran di bawah.</p>
    `;
  } else {
    $("paymentInfo").innerHTML = `
      <strong>${escapeHtml(planLabel)}</strong>
      <p class="small">Total setelah diskon: <strong>${formatRupiah(payableTotal)}</strong></p>
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

async function applyPromoCode() {
  const input = $("promoCode");
  const button = $("applyPromo");
  const code = (input?.value || "").trim().toUpperCase().replace(/\s+/g, " ");
  promoState = { code: "", valid: false, discount_amount: 0, member_name: "" };
  if (!code) {
    $("promoFeedback").textContent = "Masukkan nomor polisi member terlebih dahulu.";
    $("promoFeedback").className = "promo-feedback error";
    renderSummary(); renderPaymentInfo(); saveDraft();
    return;
  }
  button.disabled = true;
  button.textContent = "Memeriksa...";
  try {
    const { data, error } = await supabase.rpc("preview_public_promo", {
      p_code: code,
      p_items: cart.map(item => ({
        product_id: item.id,
        quantity: item.qty
      }))
    });
    if (error) throw error;
    if (!data?.valid) {
      $("promoFeedback").textContent = data?.message || "Kode promo tidak valid atau sudah digunakan.";
      $("promoFeedback").className = "promo-feedback error";
      showPromoPopup(data?.message || "Kode promo tidak valid atau sudah digunakan.", "error");
    } else {
      promoState = {
        code: data.code || code,
        valid: true,
        discount_amount: Math.min(total(), Math.max(0, Number(data.discount_amount || 0))),
        member_name: data.member_name || ""
      };
      input.value = promoState.code;
      $("promoFeedback").textContent = `Promo berhasil digunakan${promoState.member_name ? ` untuk ${promoState.member_name}` : ""}. Diskon ${formatRupiah(promoState.discount_amount)}.`;
      $("promoFeedback").className = "promo-feedback success";
      showPromoPopup(`Diskon ${formatRupiah(promoState.discount_amount)} berhasil diterapkan pada pesanan.`, "success");
    }
  } catch (error) {
    $("promoFeedback").textContent = `Gagal memeriksa promo: ${error.message}`;
    $("promoFeedback").className = "promo-feedback error";
    showPromoPopup(`Gagal memeriksa promo: ${error.message}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Gunakan Kode";
    renderSummary();
    renderPaymentInfo();
    saveDraft();
  }
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

  if ($("promoCode").value.trim() && !promoState.valid) {
    await applyPromoCode();
    if (!promoState.valid) {
      showNotice("Kode promo belum berhasil diterapkan. Periksa kembali kode member.", "error");
      return;
    }
  }

  $("submitButton").disabled = true;
  showNotice("Membuat PO dan mengunggah bukti pembayaran...");

  const deliveryMethod = $("deliveryMethod").value;
  const address = $("customerAddress").value.trim();

  let data;
  try {
    const result = await supabase.rpc("create_public_order", {
      p_customer_name: $("customerName").value.trim(),
      p_customer_email: $("customerEmail").value.trim(),
      p_customer_address: deliveryMethod === "SHIP_TO_ADDRESS" ? address : null,
      p_customer_phone: $("customerPhone").value.trim(),
      p_delivery_method: deliveryMethod,
      p_payment_plan: $("paymentPlan").value,
      p_payment_method: $("paymentMethod").value,
      p_promo_code: promoState.valid ? promoState.code : null,
      p_items: cart.map(item => ({
        product_id: item.id,
        quantity: item.qty,
        size: item.size || null
      }))
    });
    if (result.error) throw result.error;
    data = result.data;
    if (!data?.id || !data?.proof_token) {
      throw new Error("Respons server tidak lengkap (ID pesanan atau token bukti tidak ditemukan). Pesanan belum dapat dilanjutkan.");
    }
  } catch (error) {
    console.error("create_public_order failed:", error);
    $("submitButton").disabled = false;
    showNotice("PO gagal dibuat: " + (error?.message || "Terjadi kesalahan koneksi."), "error");
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
  $("applyPromo").addEventListener("click", applyPromoCode);
  $("promoCode").addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); applyPromoCode(); }
  });
  $("promoCode").addEventListener("input", () => {
    if (promoState.valid && $("promoCode").value.trim().toUpperCase() !== promoState.code) {
      promoState = { code: "", valid: false, discount_amount: 0, member_name: "" };
      $("promoFeedback").textContent = "Kode berubah. Gunakan kembali kode untuk menerapkan diskon.";
      $("promoFeedback").className = "promo-feedback";
      renderSummary(); renderPaymentInfo();
    }
    saveDraft();
  });

  ["customerEmail", "customerAddress"].forEach(id => {
    $(id).addEventListener("input", saveDraft);
  });

  $("customerName").addEventListener("input", () => {
    const input = $("customerName");
    const original = input.value;
    // Allow Unicode letters and spaces only; keep non-Latin names valid too.
    const lettersAndSpaces = original.replace(/[^\p{L}\p{M} ]/gu, "");
    if (original !== lettersAndSpaces) {
      input.value = lettersAndSpaces;
      setFieldFeedback("customerNameFeedback", "Nama hanya boleh berisi huruf dan spasi.");
    } else {
      setFieldFeedback("customerNameFeedback", "");
    }
    saveDraft();
  });

  $("customerName").addEventListener("blur", () => {
    const name = $("customerName").value.trim();
    if (!name) setFieldFeedback("customerNameFeedback", "Nama wajib diisi.");
    else if (!/^[\p{L}\p{M} ]+$/u.test(name)) {
      setFieldFeedback("customerNameFeedback", "Nama hanya boleh berisi huruf dan spasi.");
    }
  });

  $("customerPhone").addEventListener("input", () => {
    // Strip invalid characters but tell customers exactly why their input changed.
    const input = $("customerPhone");
    const original = input.value;
    const digitsOnly = original.replace(/[^0-9]/g, "").slice(0, 15);
    if (original !== digitsOnly) {
      input.value = digitsOnly;
      setFieldFeedback("customerPhoneFeedback", "Nomor HP hanya boleh berisi angka.");
    } else {
      setFieldFeedback("customerPhoneFeedback", "");
    }
    saveDraft();
  });

  $("customerPhone").addEventListener("blur", () => {
    const phone = $("customerPhone").value.trim();
    if (!phone) setFieldFeedback("customerPhoneFeedback", "Nomor HP wajib diisi.");
    else if (!/^[0-9]{8,15}$/.test(phone)) {
      setFieldFeedback("customerPhoneFeedback", "Nomor HP harus 8–15 digit angka.");
    }
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

  // Re-run validators for values restored from an older checkout draft.
  $("customerName").dispatchEvent(new Event("input", { bubbles: true }));
  $("customerPhone").dispatchEvent(new Event("input", { bubbles: true }));
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
