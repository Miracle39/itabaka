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

document.getElementById("printInvoice")?.addEventListener("click", () => {
  printInvoiceDocument();
});

function printInvoiceDocument() {
  const invoice = document.getElementById("invoice");
  if (!invoice) return;

  const printWindow = window.open("", "_blank", "width=900,height=900");
  if (!printWindow) {
    alert("Popup cetak diblokir browser. Izinkan pop-up untuk localhost lalu coba lagi.");
    return;
  }

  const invoiceHtml = invoice.outerHTML;

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(order.invoice_no || "Invoice Circle Itabaka")}</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
* { box-sizing: border-box; }
html, body { margin:0; padding:0; background:#fff; color:#111; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:1.45; }
.invoice { width:100%; max-width:190mm; margin:0 auto; padding:0; background:#fff; border:1px solid #d9d9d9; border-radius:0; box-shadow:none; }
.invoice-head { display:flex; justify-content:space-between; gap:20px; padding:0 0 14px; border-bottom:2px solid #111; }
.invoice-brand-name { font-size:20px; font-weight:800; margin-bottom:3px; }
.invoice-head h2 { margin:0; font-size:16px; }
.invoice-head p { margin:3px 0 0; color:#666; }
.invoice-meta { display:flex; flex-direction:column; align-items:flex-end; gap:2px; text-align:right; }
.invoice-meta strong { font-size:14px; }
.status { display:inline-block; margin-top:5px; padding:4px 8px; border:1px solid #999; border-radius:999px; font-size:9px; font-weight:700; }
.customer-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; padding:14px 0; border-bottom:1px solid #ddd; }
.customer-grid p { margin:0; }
.table { width:100%; border-collapse:collapse; margin-top:12px; }
.table th,.table td { padding:7px 6px; border-bottom:1px solid #ddd; text-align:left; vertical-align:top; }
.table th { font-size:10px; text-transform:uppercase; letter-spacing:.4px; border-bottom:2px solid #111; }
.table th.right,.table td.right { text-align:right; }
.small { font-size:10px; }
.muted { color:#666; }
.invoice-total { width:62%; margin:14px 0 0 auto; border-top:1px solid #ccc; }
.invoice-total > div { display:flex; justify-content:space-between; gap:20px; padding:5px 0; border-bottom:1px solid #eee; }
.invoice-total .grand { padding-top:8px; border-top:2px solid #111; border-bottom:0; font-size:14px; font-weight:800; }
.notice { margin-top:14px; padding:9px 11px; border:1px solid #ccc; border-radius:6px; background:#fafafa; }
@media print {
  html,body { width:210mm; min-height:297mm; }
  .invoice,.table tr,.customer-grid,.invoice-total,.notice { break-inside:avoid; page-break-inside:avoid; }
}
</style>
</head>
<body>${invoiceHtml}</body>
</html>`);

  printWindow.document.close();
  printWindow.focus();

  const doPrint = () => {
    printWindow.focus();
    printWindow.print();
    printWindow.addEventListener("afterprint", () => printWindow.close(), { once: true });
  };

  setTimeout(doPrint, 150);
}
  sessionStorage.removeItem("itabaka_invoice_warning_v1");
}
