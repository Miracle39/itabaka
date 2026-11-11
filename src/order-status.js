import "./styles.css";
import { supabase } from "./lib/supabase.js";
import { escapeHtml, formatDate, formatRupiah } from "./lib/format.js";

const app = document.querySelector("#app");
let currentLookup = null;
const $ = (id) => document.getElementById(id);

function showMessage(message, type = "error") {
  const el = $("lookupMessage");
  if (el) el.innerHTML = `<div class="notice ${type}">${escapeHtml(message)}</div>`;
}

function statusBadge(status) {
  return status === "LUNAS"
    ? `<span class="order-status-badge paid">LUNAS</span>`
    : `<span class="order-status-badge dp">DP</span>`;
}

function renderShell() {
  app.innerHTML = `
    <header class="topbar order-status-topbar">
      <a class="brand-link" href="index.html">← Kembali ke Produk</a>
      <div class="checkout-brand"><strong>Circle Itabaka</strong><span class="muted">Cek Pesanan</span></div>
    </header>
    <main class="section container order-lookup-page">
      <section class="order-lookup-intro">
        <p class="eyebrow">ORDER TRACKING</p>
        <h1>Cek Pesanan</h1>
        <p class="muted">Masukkan nomor invoice dan nomor HP yang digunakan saat checkout.</p>
      </section>
      <section class="card form-card order-lookup-card">
        <form id="lookupForm" novalidate>
          <label>Nomor Invoice<input id="invoiceNo" required maxlength="80" autocomplete="off" placeholder="Contoh: ITB-PO-2026-000001"></label>
          <label>Nomor HP<input id="customerPhone" required inputmode="tel" autocomplete="tel" maxlength="30" placeholder="Nomor HP saat pemesanan"></label>
          <button class="primary full" id="lookupButton" type="submit">Periksa Pesanan</button>
        </form>
        <div id="lookupMessage" aria-live="polite"></div>
      </section>
      <section id="orderResult" class="order-result" hidden></section>
    </main>
    <footer class="footer">Circle Itabaka · Cek Pesanan</footer>
    <style>
      .order-lookup-page{max-width:900px;padding-top:42px;padding-bottom:60px}
      .order-lookup-intro{margin-bottom:24px}.order-lookup-intro h1{font-size:clamp(30px,5vw,44px);margin:6px 0 10px}
      .order-lookup-card{max-width:560px;margin:0 auto 26px}.order-result{max-width:900px;margin:28px auto 0}
      .order-result[hidden]{display:none}.order-status-badge{display:inline-flex;padding:7px 12px;border-radius:999px;font-size:12px;font-weight:900;letter-spacing:.04em}
      .order-status-badge.paid{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}.order-status-badge.dp{background:#fff4d6;color:#875b08;border:1px solid #f5dfa0}
      .order-result-card{background:#fff;border:1px solid #e7e7e7;border-radius:18px;padding:22px;margin-bottom:16px}
      .order-result-head{display:flex;justify-content:space-between;align-items:flex-start;gap:15px;flex-wrap:wrap}
      .order-result-head h2{margin:4px 0;font-size:22px}.order-muted{color:#777;font-size:13px}
      .order-money-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}
      .order-money-cell{background:#f8f8f8;border-radius:12px;padding:13px}.order-money-cell span{display:block;color:#777;font-size:12px;margin-bottom:5px}.order-money-cell strong{font-size:17px}
      .order-items{margin-top:16px;border-top:1px solid #eee;padding-top:12px}.order-item{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #f0f0f0;font-size:14px}
      .payment-history{display:grid;gap:10px;margin-top:14px}.payment-history-row{border:1px solid #e8e8e8;border-radius:12px;padding:13px;display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap}
      .payment-history-row strong{display:block}.payment-history-row small{display:block;color:#777;margin-top:4px}
      .settlement-panel{margin-top:18px;padding:17px;border:1px solid #eadcae;background:#fffcf3;border-radius:14px}.settlement-panel h3{margin:0 0 7px}.settlement-panel p{font-size:13px;color:#666;line-height:1.5}
      .settlement-panel .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.settlement-panel label{font-size:13px}
      .settlement-panel input[readonly]{background:#f1f1f1;color:#555;cursor:not-allowed;border-color:#ddd}
      .order-result-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px}
      @media(max-width:600px){.order-money-grid,.settlement-panel .form-grid,.order-result-card{padding:16px}.order-result-head{flex-direction:column}}
      @media print{.order-status-topbar,.order-lookup-intro,.order-lookup-card,.order-result-actions,.settlement-panel,.footer{display:none!important}.order-lookup-page{padding:0;max-width:none}.order-result{margin:0}.order-result-card{break-inside:avoid;box-shadow:none}}
    </style>`;
  $("lookupForm").addEventListener("submit", lookupOrder);
}

async function lookupOrder(event) {
  event.preventDefault();
  const invoiceNo = $("invoiceNo").value.trim();
  const phone = $("customerPhone").value.trim();
  if (!invoiceNo || phone.replace(/\D/g, "").length < 8) {
    showMessage("Masukkan nomor invoice dan nomor HP yang valid.");
    return;
  }
  const button = $("lookupButton");
  button.disabled = true;
  button.textContent = "Memeriksa...";
  $("orderResult").hidden = true;
  try {
    const { data, error } = await supabase.rpc("lookup_public_order", {
      p_invoice_no: invoiceNo,
      p_customer_phone: phone
    });
    if (error) throw error;
    if (!data?.order) throw new Error("Data pesanan tidak ditemukan.");
    currentLookup = { invoiceNo, phone, data };
    renderOrder(data);
    $("lookupMessage").replaceChildren();
  } catch (error) {
    currentLookup = null;
    showMessage(error?.message || "Pesanan tidak dapat ditemukan. Periksa kembali data yang dimasukkan.");
  } finally {
    button.disabled = false;
    button.textContent = "Periksa Pesanan";
  }
}

function renderOrder(data) {
  const order = data.order;
  const items = data.items || [];
  const payments = data.payments || [];
  const status = order.customer_payment_status || (order.payment_plan === "FULL" ? "LUNAS" : "DP");
  const settlement = payments.find(p => p.payment_type === "SETTLEMENT");
  const initial = payments.find(p => p.payment_type === "INITIAL");
  const due = Number(order.payment_amount_due || 0);
  const expectedSettlement = Math.max(0, Number(order.total_amount || 0) - due);
  const result = $("orderResult");

  result.innerHTML = `
    <section class="order-result-card">
      <div class="order-result-head">
        <div><p class="eyebrow">DETAIL PESANAN</p><h2>${escapeHtml(order.invoice_no)}</h2><div class="order-muted">${escapeHtml(order.customer_name || "")} · ${escapeHtml(formatDate(order.created_at))}</div></div>
        ${statusBadge(status)}
      </div>
      <div class="order-money-grid">
        <div class="order-money-cell"><span>Total pesanan</span><strong>${formatRupiah(order.total_amount)}</strong></div>
        <div class="order-money-cell"><span>Rencana pembayaran</span><strong>${order.payment_plan === "FULL" ? "Full Payment" : "DP"}</strong></div>
        <div class="order-money-cell"><span>Nominal awal</span><strong>${formatRupiah(due)}</strong></div>
        <div class="order-money-cell"><span>Nominal pelunasan</span><strong>${formatRupiah(expectedSettlement)}</strong></div>
      </div>
      <div class="order-items"><strong>Produk yang dipesan</strong>
        ${items.map(item => `<div class="order-item"><span>${escapeHtml(item.name || "-")}${item.size ? ` · ${escapeHtml(item.size)}` : ""} × ${Number(item.quantity || 0)}</span><strong>${formatRupiah(item.subtotal)}</strong></div>`).join("") || `<p class="order-muted">Detail produk tidak tersedia.</p>`}
      </div>
      <div class="order-items"><strong>Riwayat bukti pembayaran</strong>
        <div class="payment-history">
          ${initial ? `<div class="payment-history-row"><div><strong>Bukti pertama · ${order.payment_plan === "FULL" ? "Full Payment" : "DP"}</strong><small>${escapeHtml(formatDate(initial.uploaded_at))} · Nominal dilaporkan ${formatRupiah(initial.reported_amount)}</small></div><span class="order-muted">Sudah diunggah</span></div>` : `<div class="payment-history-row"><div><strong>Bukti pertama</strong><small>Belum ada bukti pembayaran yang tercatat.</small></div></div>`}
          ${settlement ? `<div class="payment-history-row"><div><strong>Bukti kedua · Pelunasan</strong><small>${escapeHtml(formatDate(settlement.uploaded_at))} · Nominal dilaporkan ${formatRupiah(settlement.reported_amount)}</small></div><span class="order-status-badge paid">LUNAS dilaporkan</span></div>` : `<div class="payment-history-row"><div><strong>Bukti kedua · Pelunasan</strong><small>${status === "LUNAS" ? "Tidak diperlukan untuk pesanan Full Payment." : "Belum diunggah."}</small></div></div>`}
        </div>
      </div>
      ${order.settlement_available ? `
        <section class="settlement-panel">
          <h3>Upload Bukti Pelunasan</h3>
          <p>Setelah bukti pelunasan berhasil dikirim, status invoice akan langsung berubah menjadi LUNAS. Tim Itabaka akan mengecek nominal dan bukti secara internal.</p>
          <form id="settlementForm">
            <div class="form-grid">
              <label>Nominal transfer pelunasan (Rp)<input id="settlementAmount" type="number" min="1" step="1" value="${expectedSettlement}" readonly aria-readonly="true" title="Nominal pelunasan dihitung otomatis dan tidak dapat diubah."></label>
              <label>File bukti (maks. 2 MB)<input id="settlementFile" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required></label>
            </div>
            <button class="primary full" id="settlementSubmit" type="submit">Kirim Bukti Pelunasan</button>
          </form>
        </section>` : status === "LUNAS" && order.payment_plan === "DP" ? `<div class="settlement-panel"><strong>Status invoice sudah LUNAS.</strong><p>Bukti pelunasan sudah diterima. Tim internal Itabaka akan mengecek nominal dan bukti transfer.</p></div>` : ""}
      <div class="order-result-actions"><button class="primary" id="saveInvoice" type="button">Cetak / Simpan Invoice PDF</button><button class="secondary" id="newLookup" type="button">Cek Pesanan Lain</button></div>
    </section>`;

  result.hidden = false;
  $("saveInvoice").onclick = () => openSharedInvoice(order, items, payments, status);
  $("newLookup").onclick = () => { currentLookup = null; result.hidden = true; $("invoiceNo").focus(); };
  const form = $("settlementForm");
  if (form) form.addEventListener("submit", submitSettlement);
}

function fileExtension(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "pdf"].includes(ext)) return ext;
  return file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "application/pdf" ? "pdf" : "jpg";
}

async function submitSettlement(event) {
  event.preventDefault();
  if (!currentLookup?.data?.order?.settlement_token) return;
  const file = $("settlementFile").files?.[0];
  const order = currentLookup.data.order;
  // Always report the calculated remaining balance, never a value from an editable field.
  const amount = Math.max(0, Number(order.total_amount || 0) - Number(order.payment_amount_due || 0));
  if (!file) return showMessage("Pilih file bukti pelunasan terlebih dahulu.");
  if (file.size > 2 * 1024 * 1024) return showMessage("Ukuran bukti pembayaran maksimal 2 MB.");
  if (!/^(image\/png|image\/jpeg|image\/webp|application\/pdf)$/.test(file.type)) return showMessage("Format bukti harus PNG, JPG, WEBP, atau PDF.");
  if (!Number.isInteger(amount) || amount <= 0) return showMessage("Nominal pelunasan tidak valid.");

  const button = $("settlementSubmit");
  button.disabled = true;
  button.textContent = "Mengunggah...";
  const token = order.settlement_token;
  const path = `settlements/${order.id}/${token}.${fileExtension(file)}`;
  try {
    const { error: uploadError } = await supabase.storage.from("settlement-proofs").upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: "3600"
    });
    if (uploadError) throw uploadError;

    const { error: attachError } = await supabase.rpc("attach_settlement_proof", {
      p_invoice_no: currentLookup.invoiceNo,
      p_customer_phone: currentLookup.phone,
      p_settlement_token: token,
      p_proof_path: path,
      p_reported_amount: amount
    });
    if (attachError) {
      await supabase.storage.from("settlement-proofs").remove([path]).catch(() => {});
      throw attachError;
    }

    const { data, error } = await supabase.rpc("lookup_public_order", {
      p_invoice_no: currentLookup.invoiceNo,
      p_customer_phone: currentLookup.phone
    });
    if (error) throw error;
    currentLookup.data = data;
    renderOrder(data);
    showMessage("Bukti pelunasan berhasil dikirim. Status invoice sekarang LUNAS.", "success");
  } catch (error) {
    showMessage(error?.message || "Bukti pelunasan gagal dikirim. Silakan coba lagi.");
    button.disabled = false;
    button.textContent = "Kirim Bukti Pelunasan";
  }
}

function openSharedInvoice(order, items, payments, status) {
  // Reuse invoice.html so Cek Pesanan and the initial checkout invoice
  // always use exactly the same layout and print stylesheet.
  const initial = payments.find(p => p.payment_type === "INITIAL");
  const payload = {
    order: {
      ...order,
      customer_payment_status: status,
      proof_uploaded: Boolean(initial || order.payment_proof_path),
      items
    },
    items
  };

  try {
    sessionStorage.setItem("itabaka_last_order_v1", JSON.stringify(payload));
  } catch {
    showMessage("Invoice tidak dapat dibuka karena penyimpanan sesi browser tidak tersedia.");
    return;
  }

  const invoiceWindow = window.open("invoice.html", "_blank");
  if (!invoiceWindow) {
    showMessage("Pop-up diblokir. Izinkan pop-up untuk membuka invoice.");
  }
}

renderShell();
