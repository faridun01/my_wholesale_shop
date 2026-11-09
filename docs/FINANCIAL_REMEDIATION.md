# Financial remediation — 2026-11-09

The current report is [FINANCIAL_AUDIT_2026-11-09.md](FINANCIAL_AUDIT_2026-11-09.md).

Goods returns reduce the invoice and preserve payments; no automatic cash refund
or customer credit is created. Taxes are unsupported.
Financial arithmetic uses decimal.js-light; monetary JSON fields are decimal
strings, with number compatibility at existing API/display boundaries.

106 tests passed in 12 files, including 24 PostgreSQL integration tests and
4000 generated scenarios checked against an independent model. All 25 migrations
were tested on isolated databases. Backend/frontend builds and Prisma validation
passed. Working database migrations and historical corrections were not applied.

Read-only checks found two stock-cache discrepancies and missing item-level
history for four legacy returns. See the full report for evidence and limitations.
