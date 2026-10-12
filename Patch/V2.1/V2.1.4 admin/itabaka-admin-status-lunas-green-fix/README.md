# Itabaka Admin — Status Full Payment / DP

Replace `src/admin.js` with the file in this patch.

- Orders whose selected plan is `FULL` show **LUNAS** with the green status pill.
- Orders whose selected plan is `DP` show **DP** with the yellow status pill.
- The payment summary label still distinguishes amounts that follow the selected plan from actual amounts recorded by admin.
- The detail card includes the same colored status badge.
- This is a display behavior only; it does not automatically modify database payment status or verification timestamp.

Run `npm run build`, then commit and push your changes manually to deploy to Vercel. No SQL change is required.
