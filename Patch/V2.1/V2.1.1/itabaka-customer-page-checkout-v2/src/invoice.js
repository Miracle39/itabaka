import "./styles.css";
import { escapeHtml, formatDate, formatRupiah } from "./lib/format.js";

const app = document.querySelector("#app");
const payload = readSession("itabaka_last_order_v1");
const warning = sessionStorage.getItem("itabaka_invoice_warning_v1");

function readSession(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeDate(value) {
  try {
    return formatDate(value);
  } catch {
    return value || "-";
  }
}

if (!payload?.order) {
  app.innerHTML = `
    <main class="invoice-missing container">
      <div class="card form-card">
        <p class="eyebrow">INVOICE</p>
        <h1>Invoice tidak ditemukan</h1>
        <p class="muted">Data invoice pada sesi browser ini sudah tidak tersedia.</p>
        <a class="primary inline-button" href="index.html">Kembali ke Produk</a>
      </div>
    </main>`;
} else {
  renderInvoice(payload);
}

function renderInvoice({ order, items }) {
  const detailItems = order.items?.length ? order.items : items || [];
  const paymentPlanText =
    order.payment_plan === "FULL"
      ? "Full Payment"
      : `DP (${Number(order.dp_percentage || 50)}%)`;
  const paymentMethodText =
    order.payment_method === "QRIS"
      ? "QRIS"
      : "Transfer Bank blu by BCA Digital";

  const warningHtml = warning
    ? `<div class="notice error"><strong>Perhatian:</strong> ${escapeHtml(warning)}</div>`
    : `<div class="notice success"><strong>Pesanan berhasil dibuat.</strong> Simpan invoice ini untuk arsip pemesanan.</div>`;

  app.innerHTML = `
    <header class="topbar">
      <a class="brand-link" href="index.html">← Kembali ke Produk</a>
      <div class="checkout-brand">
        <strong>Invoice</strong>
        <span class="muted">Circle Itabaka</span>
      </div>
    </header>

    <main class="section container invoice-page">
      <div class="invoice-actions">
        <div>
          <p class="eyebrow">ORDER CREATED</p>
          <h1>Invoice PO</h1>
          <p class="muted">Simpan invoice ini sebagai bukti pemesanan.</p>
        </div>
        <div class="invoice-action-buttons">
          <a class="secondary inline-button" href="index.html">Pesan Lagi</a>
          <button id="printInvoice" class="primary" type="button">Cetak / Simpan PDF</button>
        </div>
      </div>

      ${warningHtml}

      <div id="invoice" class="invoice card">
        <div class="invoice-head">
          <div>
            <div class="invoice-brand-name">${escapeHtml(order.site_name || "Circle Itabaka")}</div>
            <h2>${escapeHtml(order.invoice_no || "Invoice PO")}</h2>
            <p class="muted">${escapeHtml(order.site_title || "Pre-Order CF24")}</p>
          </div>
          <div class="invoice-meta">
            <strong>${escapeHtml(order.invoice_no || "-")}</strong>
            <span>${safeDate(order.created_at)}</span>
            <span class="status dp">MENUNGGU VERIFIKASI</span>
          </div>
        </div>

        <div class="customer-grid">
          <p>
            <strong>Pemesan</strong><br>
            ${escapeHtml(order.customer_name || "-")}<br>
            ${escapeHtml(order.customer_email || "-")}<br>
            ${escapeHtml(order.customer_phone || "-")}
          </p>
          <p>
            <strong>Pengambilan / Pengiriman</strong><br>
            ${order.delivery_method === "SHIP_TO_ADDRESS" ? "Dikirim ke Alamat" : "Ambil di Booth CF24"}
            ${order.delivery_method === "SHIP_TO_ADDRESS" && order.customer_address
              ? `<br>${escapeHtml(order.customer_address)}`
              : ""}
          </p>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Produk</th>
              <th>Qty</th>
              <th>Harga</th>
              <th class="right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${detailItems.map(item => {
              const name = item.name || item.product_name || "-";
              const qty = Number(item.qty ?? item.quantity ?? 0);
              const unit = Number(item.price ?? item.unit_price ?? 0);
              const subtotal = Number(item.subtotal ?? unit * qty);
              const size = item.size || null;
              return `
                <tr>
                  <td>
                    ${escapeHtml(name)}
                    ${size ? `<div class="muted small">Ukuran: ${escapeHtml(size)}</div>` : ""}
                  </td>
                  <td>${qty}</td>
                  <td>${formatRupiah(unit)}</td>
                  <td class="right">${formatRupiah(subtotal)}</td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>

        <div class="invoice-total">
          <div><span>Total Pesanan</span><strong>${formatRupiah(order.total_amount)}</strong></div>
          <div><span>Bayar Sekarang</span><strong>${formatRupiah(order.payment_amount_due)}</strong></div>
          <div><span>Dibayar</span><strong>${formatRupiah(order.paid_amount)}</strong></div>
          <div class="grand"><span>Sisa Pembayaran</span><strong>${formatRupiah(order.remaining_amount)}</strong></div>
        </div>

        <div class="notice">
          <strong>Rencana:</strong> ${escapeHtml(paymentPlanText)}<br>
          <strong>Metode:</strong> ${escapeHtml(paymentMethodText)}<br>
          <strong>Bukti pembayaran:</strong> ${order.proof_uploaded ? "✓ Berhasil diunggah" : "⚠ Perlu pengecekan admin"}
        </div>
      </div>
    </main>

    <footer class="footer">Circle Itabaka · Development build</footer>
  `;

  $("printInvoice").addEventListener("click", () => window.print());
  sessionStorage.removeItem("itabaka_invoice_warning_v1");
}
