# Itabaka — Realtime invoice payment summary

## Install
Replace `src/invoice.js` with the `src/invoice.js` in this ZIP.

## Invoice behaviour
- Total Pesanan is calculated from the order total, or line items if the RPC response omits the total.
- Bayar Sekarang follows the selected payment plan and configured DP percentage.
- Dibayar on the customer invoice mirrors the amount expected under the selected plan, so the invoice is issued immediately.
- Sisa Pembayaran is Total Pesanan minus Bayar Sekarang.
- The status says the payment is checked at pickup/delivery. The admin does not need to verify the payment before the invoice is displayed.
- This is a display-only invoice adjustment. The database's paid amount stays admin-controlled until staff record/check payment; this patch does not change SQL.

## Examples
For an order total of Rp1,000,000 and DP=50%:
- DP: Total Rp1,000,000; Bayar Sekarang Rp500,000; Dibayar Rp500,000; Sisa Rp500,000.
- Full Payment: Total Rp1,000,000; Bayar Sekarang Rp1,000,000; Dibayar Rp1,000,000; Sisa Rp0.
