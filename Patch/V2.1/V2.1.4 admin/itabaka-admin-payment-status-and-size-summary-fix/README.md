# Itabaka admin payment status and size summary fix

## What changed
- When payment has not been edited/checked by admin, the displayed status follows the customer's plan: `FULL` -> green `LUNAS`, `DP` -> yellow `DP`.
- Once admin saves the Edit Pembayaran popup, the displayed badge follows the saved `payment_status` rather than the originally selected plan. Thus switching a Full Payment order to DP shows a yellow DP badge; switching a DP order to LUNAS shows green LUNAS.
- Status badge styling now follows the displayed status label.
- Recalculated/reprinted invoices use the chosen payment plan before a handover check and the saved payment status/amount afterward.
- The Kaos/Jaket size summary cards now appear on the Semua Order page as well as the Apparel page.

## Install
1. Back up the current `src/admin.js`.
2. Replace `src/admin.js` with the included file.
3. Run `npm run build`.
4. If the build passes, commit and push manually to GitHub so Vercel deploys it.

No database migration or SQL changes are required.
