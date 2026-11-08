# Financial remediation — 2026-11-09

## Confirmed business policy

Goods returns reduce the discounted invoice value. Original receipts of money
remain in the payment ledger. Outstanding debt is max(0, current invoice value
minus recorded applicable payments). No customer credit is created and no cash
disbursement is automatically recorded. Payments made outside the application
cannot be reconciled to a physical cash balance by this application.

Example: sale 1000, three payments of 200, goods return 150: current invoice 850,
recorded payments 600, debt 250. If another return lowers the invoice to 500,
recorded payments remain 600, debt is zero, and no transferable credit is created.

Taxes are unsupported. Nonzero input is rejected before monetary rounding;
historical database columns remain intact and are ignored by the Prisma model.

## Arithmetic and storage

Monetary database fields use Decimal(12,2). Shared financial.ts uses rational
BigInt arithmetic and integer minor units for discount allocation and cumulative
returns. Its frontend copy is generated and checked byte for byte. Addition and
quantity multiplication now accumulate in BigInt before checked conversion.
Purchase expense markup and backend rounding use Prisma.Decimal with explicit
rounding modes. Discounted unit prices retain the established upward cent rounding.

This is not a claim that every TypeScript variable has a Decimal type: API/UI
values are still numbers, percentage and quantity columns retain existing types,
and presentation/statistical calculations can still use numbers. The reviewed
core monetary calculations use exact arithmetic, with explicit cent boundaries.

## Changes in this implementation

- Goods returns no longer create new credit; historical fields are retained.
- Customer-credit displays removed; original payments and return history retained.
- Sub-cent nonzero tax values rejected instead of rounded into accepted zero.
- Revenue, inventory valuation and profit aggregations in dashboard, invoice,
  warehouse, report and staff helpers moved to exact money helpers.
- Purchase expense markup uses Decimal rather than floating-point multiplication.
- Legacy negative payments linked to goods returns are flagged by reconciliation
  as needing review; their historical meaning is not silently rewritten.
- Added migration 20261109000100_goods_return_without_credit to allow a goods
  return to reduce debt by less than the return value without creating credit.
  Historical rows are preserved; the revised constraint is NOT VALID.

## Validation

- All 87 tests passed across 11 files, including ten PostgreSQL integration tests.
- All 22 migrations applied successfully to a newly created isolated local test
  database; that database was deleted by the test runner afterwards.
- Backend production build, frontend production build and Prisma validation passed.
- Tests cover the user's example, overpaid historical receipts after returns,
  tax rejection below one cent, decimal boundaries, generated discount/refund
  conservation cases, actual PDF generation, concurrent requests, idempotency,
  transaction rollback and immutable ledger records.
- Initial integration failures were stale expectations for tax-era payment totals
  and automatic cash-refund behavior. Expectations now assert preserved payments
  and an explicit reversal of an erroneous payment as a separate ledger entry.

## Deployment and limits

No migration or historical-record rewrite was performed against the working
database. Apply the pending migrations as part of the reviewed deployment before
using the updated return flow. Browser interaction and production deployment were
not verified in this run. Historical negative payments remain a reconciliation
question; no assumption about actual cash issued can resolve them automatically.
Passing tests establish the listed scenarios, not a universal guarantee that all
historical records or every untested path is free of discrepancies.
