import "./styles.css";
import { supabase } from "./lib/supabase.js";
import { escapeHtml, formatDate, formatRupiah } from "./lib/format.js";

const app = document.querySelector("#app");
const payload = readSession("itabaka_last_order_v1");
const warning = sessionStorage.getItem("itabaka_invoice_warning_v1");

const DEFAULT_SETTINGS = {
  site_name: "Circle Itabaka",
  site_title: "Pre-Order CF24",
  logo_url: "",
  primary_color: "#111111",
  accent_color: "#777777",
  dp_percentage: 50
};

function readSession(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}


function showInvoiceNotice(message) {
  const root = document.createElement("div");
  root.className = "invoice-popup-backdrop";
  root.setAttribute("role", "presentation");
  root.innerHTML = `<section class="invoice-popup-card" role="dialog" aria-modal="true" aria-labelledby="invoicePopupTitle"><h3 id="invoicePopupTitle">Tidak dapat membuka cetak invoice</h3><p>${escapeHtml(message)}</p><button type="button" class="invoice-popup-close">Mengerti</button></section>`;
  const style = document.createElement("style");
  style.textContent = ".invoice-popup-backdrop{position:fixed;inset:0;z-index:10000;background:rgba(15,15,15,.5);display:grid;place-items:center;padding:18px}.invoice-popup-card{width:min(420px,100%);background:#fff;border-radius:16px;padding:22px;box-shadow:0 20px 70px rgba(0,0,0,.22);font-family:Arial,sans-serif}.invoice-popup-card h3{margin:0 0 8px;font-size:18px}.invoice-popup-card p{color:#555;line-height:1.5}.invoice-popup-card button{width:100%;border:0;border-radius:9px;padding:11px 14px;background:#151515;color:#fff;font-weight:700;cursor:pointer}";
  document.head.append(style);
  document.body.append(root);
  const close = () => { root.remove(); style.remove(); };
  root.querySelector(".invoice-popup-close").addEventListener("click", close);
  root.addEventListener("click", event => { if (event.target === root) close(); });
}

function safeDate(value) {
  try {
    return formatDate(value);
  } catch {
    return value || "-";
  }
}

function money(value) {
  return formatRupiah(Number(value || 0));
}

function paymentPlanText(order, settings) {
  return order.payment_plan === "FULL"
    ? "Full Payment"
    : `DP (${Number(order.dp_percentage || settings.dp_percentage || 50)}%)`;
}

function paymentMethodText(order) {
  return order.payment_method === "QRIS"
    ? "QRIS"
    : "Transfer Bank blu by BCA Digital";
}

function paymentStatusText(order) {
  // Status invoice mengikuti laporan customer, terpisah dari verifikasi internal.
  return order.customer_payment_status || (order.payment_plan === "FULL" ? "LUNAS" : "DP");
}

async function loadSiteSettings() {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("site_name,site_title,logo_url,primary_color,accent_color,dp_percentage")
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return { ...DEFAULT_SETTINGS, ...data };
    }
  } catch {
    // Tetap tampilkan invoice dengan fallback jika settings gagal diambil.
  }

  return DEFAULT_SETTINGS;
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
  const settings = await loadSiteSettings();
  renderInvoice(payload, settings);
}

function renderInvoice({ order, items }, settings) {
  const detailItems = order.items?.length ? order.items : items || [];
  const primary = settings.primary_color || "#111111";
  const accent = settings.accent_color || "#777777";

  // The public-order RPC may omit total_amount from its JSON response.
  // Rebuild the total from saved line items when that field is unavailable.
  const itemsTotal = detailItems.reduce((sum, item) => {
    const qty = Number(item.qty ?? item.quantity ?? 0);
    const unitPrice = Number(item.price ?? item.unit_price ?? 0);
    const lineSubtotal = item.subtotal != null ? Number(item.subtotal) : NaN;
    const lineTotal = Number.isFinite(lineSubtotal) && lineSubtotal >= 0
      ? lineSubtotal
      : unitPrice * qty;
    return sum + Math.max(0, lineTotal);
  }, 0);

  const storedTotal = Number(order.total_amount);
  const totalAmount = Number.isFinite(storedTotal) && storedTotal >= 0
    ? storedTotal
    : itemsTotal;
  const subtotalAmount = Number.isFinite(Number(order.subtotal_amount))
    ? Number(order.subtotal_amount)
    : itemsTotal;
  const discountAmount = Math.max(0, Number(order.discount_amount || 0));
  const promoCode = String(order.promo_code || "");

  // Prefer the DP percentage saved by checkout, so later admin setting changes
  // do not retroactively change the amount due on this invoice.
  const checkoutSettings = readSession("itabaka_settings_v1") || {};
  const percentageValue = Number(
    order.dp_percentage ?? checkoutSettings.dp_percentage ?? settings.dp_percentage ?? 50
  );
  const dpPercentage = Number.isFinite(percentageValue) && percentageValue > 0
    ? Math.min(99, percentageValue)
    : 50;

  // "Bayar Sekarang" follows the selected payment plan, not a missing/stale RPC field.
  const storedDue = Number(order.payment_amount_due);
  const paymentDue = Number.isFinite(storedDue) && storedDue > 0
    ? Math.min(totalAmount, storedDue)
    : order.payment_plan === "FULL"
      ? totalAmount
      : Math.min(totalAmount, Math.max(1, Math.ceil(totalAmount * dpPercentage / 100)));

  // Invoice is issued immediately using the customer's chosen plan.
  // The admin checks the transfer/proof at pickup or delivery; we do not wait
  // for that check before showing the planned amount on the customer invoice.
  const paidAmount = paymentDue;
  const remainingAmount = Math.max(totalAmount - paymentDue, 0);

  const warningHtml = warning
    ? `<div class="invoice-notice invoice-notice-error invoice-screen-only"><strong>Perhatian:</strong> ${escapeHtml(warning)}</div>`
    : `<div class="invoice-notice invoice-notice-success invoice-screen-only"><strong>Pesanan berhasil dibuat.</strong> Simpan invoice ini sebagai bukti pemesanan.</div>`;

  const logoHtml = settings.logo_url
    ? `<img class="invoice-logo" src="${escapeHtml(settings.logo_url)}" alt="${escapeHtml(settings.site_name)}">`
    : `<div class="invoice-logo-fallback">${escapeHtml((settings.site_name || "IT").slice(0, 2).toUpperCase())}</div>`;

  app.innerHTML = `
    <style>
      .invoice-page.polished{padding-top:38px;padding-bottom:58px}
      .invoice-page.polished .invoice-actions{margin-bottom:18px}
      .invoice-shell{max-width:980px;margin:0 auto}
      .invoice-document{--invoice-primary:${escapeHtml(primary)};--invoice-accent:${escapeHtml(accent)};background:#fff;border:1px solid #e5e5e5;border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.08);overflow:hidden}
      .invoice-top-accent{height:8px;background:linear-gradient(90deg,var(--invoice-primary),var(--invoice-accent))}
      .invoice-inner{padding:30px}
      .invoice-header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:30px;align-items:start}
      .invoice-brand-row{display:flex;align-items:center;gap:15px}
      .invoice-logo,.invoice-logo-fallback{width:76px;height:76px;object-fit:contain;border-radius:17px;border:1px solid #ececec;background:#fff}
      .invoice-logo-fallback{display:grid;place-items:center;background:#111;color:#fff;font-size:21px;font-weight:900}
      .invoice-brand-text h2{margin:0;font-size:24px;line-height:1.08}
      .invoice-brand-text p{margin:5px 0 0;color:#707070;font-size:13px}
      .invoice-kicker{font-size:11px;font-weight:900;letter-spacing:.16em;color:#8a8a8a;text-transform:uppercase;margin-bottom:7px}
      .invoice-title{margin:0;font-size:30px;line-height:1}
      .invoice-meta-card{text-align:right;min-width:205px}
      .invoice-meta-row{display:flex;justify-content:flex-end;gap:13px;margin:5px 0;font-size:12px}
      .invoice-meta-row span:first-child{color:#7d7d7d}
      .invoice-status{display:inline-flex;margin-top:10px;padding:7px 12px;border-radius:999px;background:#f7efd8;border:1px solid #e9d79d;color:#5c490e;font-size:10px;font-weight:900;letter-spacing:.05em}
      .invoice-status.is-paid{background:#eaf7ed;border-color:#c8e5ce;color:#236132}
      .invoice-divider{height:1px;background:#e7e7e7;margin:24px 0}
      .invoice-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .invoice-info-card{border:1px solid #e7e7e7;border-radius:15px;padding:16px;background:#fafafa}
      .invoice-info-card .label{display:block;color:#858585;font-size:10px;font-weight:900;letter-spacing:.10em;text-transform:uppercase;margin-bottom:8px}
      .invoice-info-card strong{font-size:14px}
      .invoice-info-card p{margin:5px 0 0;line-height:1.5}
      .invoice-table-wrap{margin-top:20px;border:1px solid #e6e6e6;border-radius:15px;overflow:hidden}
      .invoice-table{width:100%;border-collapse:collapse}
      .invoice-table th{background:#f5f5f5;color:#696969;font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:12px;text-align:left}
      .invoice-table td{padding:12px;border-top:1px solid #ededed;vertical-align:top;font-size:12px}
      .invoice-table th.right,.invoice-table td.right{text-align:right}
      .invoice-product-name{font-weight:850}
      .invoice-size{display:inline-block;margin-top:5px;padding:3px 8px;border-radius:999px;background:#f0f0f0;color:#666;font-size:10px;font-weight:800}
      .invoice-bottom{display:grid;grid-template-columns:minmax(0,1fr) 325px;gap:22px;margin-top:20px}
      .invoice-payment-card{border:1px solid #e7e7e7;border-radius:15px;padding:17px}
      .invoice-payment-card h3{margin:0 0 13px;font-size:14px}
      .payment-detail{display:grid;grid-template-columns:125px 1fr;gap:7px 12px;font-size:12px}
      .payment-detail span{color:#777}
      .invoice-summary{border:1px solid #dedede;border-radius:15px;padding:17px;background:#fafafa}
      .summary-row{display:flex;justify-content:space-between;gap:18px;padding:6px 0;font-size:12px}
      .summary-row.discount{color:#16713a}
      .summary-row strong{font-weight:850}
      .summary-row.grand{margin-top:8px;padding-top:12px;border-top:2px solid var(--invoice-primary);font-size:14px}
      .summary-row.grand strong{font-size:18px}
      .invoice-notice{margin-top:18px;padding:11px 13px;border-radius:12px;font-size:11px;line-height:1.5}
      .invoice-notice-success{background:#eef8f0;border:1px solid #cde8d1;color:#255b30}
      .invoice-notice-error{background:#fff0f0;border:1px solid #f2caca;color:#8a1d1d}
      .invoice-note{margin-top:10px;color:#777;font-size:10px;line-height:1.5}
      .invoice-footer{margin-top:22px;padding-top:14px;border-top:1px solid #e8e8e8;display:flex;justify-content:space-between;gap:20px;color:#858585;font-size:10px}
      .invoice-footer strong{color:#555}
      @media(max-width:800px){
        .invoice-page.polished{padding-top:24px}
        .invoice-inner{padding:20px}
        .invoice-header,.invoice-info-grid,.invoice-bottom{grid-template-columns:1fr}
        .invoice-meta-card{text-align:left}
        .invoice-meta-row{justify-content:flex-start}
        .invoice-table-wrap{overflow-x:auto}
        .invoice-table{min-width:650px}
        .invoice-footer{flex-direction:column}
      }
    </style>

    <header class="topbar invoice-screen-only">
      <a class="brand-link" href="index.html">← Kembali ke Produk</a>
      <div class="checkout-brand">
        <strong>Invoice</strong>
        <span class="muted">${escapeHtml(settings.site_name)}</span>
      </div>
    </header>

    <main class="section container invoice-page polished">
      <div class="invoice-actions invoice-screen-only">
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

      <div class="invoice-shell">
        <div id="invoice" class="invoice-document">
          <div class="invoice-top-accent"></div>
          <div class="invoice-inner">
            <div class="invoice-header">
              <div class="invoice-brand-row">
                ${logoHtml}
                <div class="invoice-brand-text">
                  <h2>${escapeHtml(settings.site_name)}</h2>
                  <p>${escapeHtml(settings.site_title)}</p>
                </div>
              </div>

              <div class="invoice-meta-card">
                <div class="invoice-kicker">Invoice</div>
                <h1 class="invoice-title">${escapeHtml(order.invoice_no || "-")}</h1>
                <div class="invoice-meta-row">
                  <span>Tanggal</span>
                  <strong>${safeDate(order.created_at)}</strong>
                </div>
                <span class="invoice-status ${(order.customer_payment_status || (order.payment_plan === "FULL" ? "LUNAS" : "DP")) === "LUNAS" ? "is-paid" : ""}">${escapeHtml(paymentStatusText(order))}</span>
              </div>
            </div>

            <div class="invoice-divider"></div>

            <div class="invoice-info-grid">
              <div class="invoice-info-card">
                <span class="label">Pemesan</span>
                <strong>${escapeHtml(order.customer_name || "-")}</strong>
                <p>
                  ${escapeHtml(order.customer_email || "-")}<br>
                  ${escapeHtml(order.customer_phone || order.customer_contact || "-")}
                </p>
              </div>

              <div class="invoice-info-card">
                <span class="label">Pengambilan / Pengiriman</span>
                <strong>${order.delivery_method === "SHIP_TO_ADDRESS" ? "Dikirim ke Alamat" : "Ambil di Booth CF24"}</strong>
                ${order.delivery_method === "SHIP_TO_ADDRESS" && order.customer_address
                  ? `<p>${escapeHtml(order.customer_address)}</p>`
                  : `<p class="muted">Pesanan diambil langsung di booth CF24.</p>`}
              </div>
            </div>

            <div class="invoice-table-wrap">
              <table class="invoice-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Qty</th>
                    <th>Harga</th>
                    <th class="right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${detailItems.length ? detailItems.map(item => {
                    const name = item.name || item.product_name || "-";
                    const qty = Number(item.qty ?? item.quantity ?? 0);
                    const unit = Number(item.price ?? item.unit_price ?? 0);
                    const subtotal = Number(item.subtotal ?? unit * qty);
                    const size = item.size || null;

                    return `
                      <tr>
                        <td>
                          <div class="invoice-product-name">${escapeHtml(name)}</div>
                          ${size ? `<span class="invoice-size">Ukuran ${escapeHtml(size)}</span>` : ""}
                        </td>
                        <td>${qty}</td>
                        <td>${money(unit)}</td>
                        <td class="right"><strong>${money(subtotal)}</strong></td>
                      </tr>`;
                  }).join("") : `
                    <tr>
                      <td colspan="4" class="muted">Tidak ada detail produk.</td>
                    </tr>`}
                </tbody>
              </table>
            </div>

            <div class="invoice-bottom">
              <div>
                <div class="invoice-payment-card">
                  <h3>Informasi Pembayaran</h3>
                  <div class="payment-detail">
                    <span>Rencana</span>
                    <strong>${escapeHtml(paymentPlanText(order, settings))}</strong>

                    <span>Metode</span>
                    <strong>${escapeHtml(paymentMethodText(order))}</strong>

                    <span>Bukti</span>
                    <strong>${order.proof_uploaded ? "✓ Berhasil diunggah" : "⚠ Perlu pengecekan admin"}</strong>
                  </div>
                </div>

                <div class="invoice-note">
                  ${order.payment_plan === "FULL"
                    ? "Full Payment dipilih. Status invoice langsung LUNAS. Simpan invoice ini sebagai bukti pemesanan."
                    : "Rencana pembayaran DP dipilih. Nominal DP dan sisa pembayaran mengikuti pilihan saat checkout; bukti pembayaran akan dicocokkan admin saat pengambilan atau pengiriman."}
                </div>
              </div>

              <div class="invoice-summary">
                <div class="summary-row">
                  <span>Subtotal</span>
                  <strong>${money(subtotalAmount)}</strong>
                </div>
                ${promoCode && discountAmount > 0 ? `
                  <div class="summary-row">
                    <span>Kode Promo</span>
                    <strong>${escapeHtml(promoCode)}</strong>
                  </div>
                  <div class="summary-row discount">
                    <span>Diskon Member</span>
                    <strong>-${money(discountAmount)}</strong>
                  </div>` : ""}
                <div class="summary-row">
                  <span>Total Pesanan</span>
                  <strong>${money(totalAmount)}</strong>
                </div>
                <div class="summary-row">
                  <span>Dibayar</span>
                  <strong>${money(paidAmount)}</strong>
                </div>
                <div class="summary-row grand">
                  <span>Sisa Pembayaran</span>
                  <strong>${money(remainingAmount)}</strong>
                </div>
              </div>
            </div>

            <div class="invoice-footer">
              <span><strong>${escapeHtml(settings.site_name)}</strong> · ${escapeHtml(settings.site_title)}</span>
              <span>Terima kasih sudah melakukan pre-order.</span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer class="footer invoice-screen-only">
      ${escapeHtml(settings.site_name)} · Pre-Order
    </footer>
  `;

  document.getElementById("printInvoice")?.addEventListener("click", () => {
    printInvoiceDocument(order, settings);
  });

  sessionStorage.removeItem("itabaka_invoice_warning_v1");
}

function printInvoiceDocument(order, settings) {
  const invoice = document.getElementById("invoice");
  if (!invoice) return;

  const printWindow = window.open("", "_blank", "width=1000,height=900");

  if (!printWindow) {
    showInvoiceNotice("Popup cetak diblokir browser. Izinkan popup untuk halaman ini lalu coba lagi.");
    return;
  }

  const primary = settings.primary_color || "#111111";
  const accent = settings.accent_color || "#777777";
  const invoiceHtml = invoice.outerHTML;

  const printCss = `
    @page{size:A4 portrait;margin:9mm}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;color:#151515;font-family:Arial,Helvetica,sans-serif}
    body{font-size:11px;line-height:1.42}
    .invoice-document{--invoice-primary:${escapeHtml(primary)};--invoice-accent:${escapeHtml(accent)};background:#fff;border:1px solid #ddd;border-radius:4mm;overflow:hidden;width:100%;max-width:190mm;margin:0 auto}
    .invoice-top-accent{height:3mm;background:linear-gradient(90deg,var(--invoice-primary),var(--invoice-accent))}
    .invoice-inner{padding:7mm}
    .invoice-header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7mm;align-items:start}
    .invoice-brand-row{display:flex;align-items:center;gap:4mm}
    .invoice-logo,.invoice-logo-fallback{width:20mm;height:20mm;object-fit:contain;border-radius:4mm;border:1px solid #ececec;background:#fff}
    .invoice-logo-fallback{display:grid;place-items:center;background:#111;color:#fff;font-size:16px;font-weight:900}
    .invoice-brand-text h2{margin:0;font-size:17px;line-height:1.1}
    .invoice-brand-text p{margin:1.5mm 0 0;color:#666;font-size:9px}
    .invoice-kicker{font-size:8px;font-weight:900;letter-spacing:.15em;color:#888;text-transform:uppercase;margin-bottom:1mm}
    .invoice-title{margin:0;font-size:21px;line-height:1}
    .invoice-meta-card{text-align:right;min-width:55mm}
    .invoice-meta-row{display:flex;justify-content:flex-end;gap:3mm;margin:1mm 0;font-size:8.5px}
    .invoice-meta-row span:first-child{color:#777}
    .invoice-status{display:inline-flex;margin-top:2mm;padding:1.7mm 2.5mm;border-radius:999px;background:#f4ead0;border:1px solid #ebd69b;color:#5d480d;font-size:7.5px;font-weight:900}
    .invoice-status.is-paid{background:#eaf7ed;border-color:#c8e5ce;color:#236132}
    .invoice-divider{height:1px;background:#e7e7e7;margin:5mm 0}
    .invoice-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
    .invoice-info-card{border:1px solid #e6e6e6;border-radius:3mm;padding:3.3mm;background:#fafafa}
    .invoice-info-card .label{display:block;color:#858585;font-size:7px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;margin-bottom:2mm}
    .invoice-info-card strong{font-size:9.5px}
    .invoice-info-card p{margin:1mm 0 0;line-height:1.4}
    .invoice-table-wrap{margin-top:4mm;border:1px solid #e6e6e6;border-radius:3mm;overflow:hidden}
    .invoice-table{width:100%;border-collapse:collapse}
    .invoice-table th{background:#f6f6f6;color:#666;font-size:7px;text-transform:uppercase;letter-spacing:.08em;padding:2.5mm;text-align:left}
    .invoice-table td{padding:2.7mm 2.5mm;border-top:1px solid #ededed;vertical-align:top;font-size:8.5px}
    .invoice-table th.right,.invoice-table td.right{text-align:right}
    .invoice-product-name{font-weight:800}
    .invoice-size{display:inline-block;margin-top:1.2mm;padding:.7mm 1.4mm;border-radius:999px;background:#f0f0f0;color:#666;font-size:7px;font-weight:800}
    .invoice-bottom{display:grid;grid-template-columns:minmax(0,1fr) 72mm;gap:4mm;margin-top:4mm}
    .invoice-payment-card{border:1px solid #e6e6e6;border-radius:3mm;padding:3.5mm}
    .invoice-payment-card h3{margin:0 0 2.5mm;font-size:9px}
    .payment-detail{display:grid;grid-template-columns:26mm 1fr;gap:1.3mm 2.5mm;font-size:8.5px}
    .payment-detail span{color:#777}
    .invoice-summary{border:1px solid #dedede;border-radius:3mm;padding:3.5mm;background:#fafafa}
    .summary-row{display:flex;justify-content:space-between;gap:4mm;padding:1.5mm 0;font-size:8.5px}
    .summary-row.discount{color:#16713a}
    .summary-row.grand{margin-top:1mm;padding-top:2.5mm;border-top:1px solid var(--invoice-primary);font-size:9.5px}
    .summary-row.grand strong{font-size:12px}
    .invoice-note{margin-top:2.5mm;color:#777;font-size:7px;line-height:1.4}
    .invoice-footer{margin-top:4mm;padding-top:2.5mm;border-top:1px solid #e7e7e7;display:flex;justify-content:space-between;gap:5mm;color:#858585;font-size:7px}
    @media print{
      .invoice-document,.invoice-table-wrap,.invoice-info-card,.invoice-payment-card,.invoice-summary{break-inside:avoid;page-break-inside:avoid}
      .invoice-document{box-shadow:none}
    }
  `;

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(order.invoice_no || "Invoice Circle Itabaka")}</title>
<style>${printCss}</style>
</head>
<body>${invoiceHtml}</body>
</html>`);
  printWindow.document.close();

  const imagePromises = Array.from(printWindow.document.images).map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  });

  const fontsReady = printWindow.document.fonts?.ready || Promise.resolve();

  Promise.all([Promise.all(imagePromises), fontsReady]).then(() => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.addEventListener(
        "afterprint",
        () => printWindow.close(),
        { once: true }
      );
    }, 200);
  });
}
