# Itabaka — Auto-sync payment plan display in admin

## What changed
- Before admin has checked/recorded payment, displayed numbers follow the customer-selected plan:
  - FULL: amount according to plan = full order total; remaining according to plan = Rp0; status label shows FULL PAYMENT (still check at handover).
  - DP: amount according to plan = `payment_amount_due` (fallback to configured DP percentage); remaining according to plan = total minus that amount; status label shows DP.
- Once admin records/checks payment (`payment_verified_at`, a non-zero recorded amount, or status LUNAS), list/detail cards use the recorded actual payment values.
- The edit-payment popup defaults to the customer-selected plan until a payment has been recorded. Saving the popup records admin confirmation, so only save after checking proof/amount at pickup or delivery.
- Excel exports use the same display calculations and label the values as “Dibayar / Rencana” and “Sisa / Rencana”.
- No SQL changes.

## Install
Replace `src/admin.js` in your current Itabaka project with the file in this ZIP, run `npm run build`, then commit/push manually for Vercel deployment.
