---
name: production-review
description: Perform a complete production-readiness review and fix bugs across frontend, backend, database, tests and deployment.
---

# Production Review

Treat the application as one system:

Frontend → API → Backend → Business Logic → Prisma → PostgreSQL → Reports

Check:
- every page
- every button
- every form
- CRUD operations
- sales
- purchases
- inventory
- warehouses
- customers
- debts/payments
- returns
- expenses
- reports
- authentication
- permissions
- database integrity
- mobile UI
- Docker/deployment

If a real bug is found, fix it.

Do not change correct business logic.

Run available:
- typecheck
- lint
- tests
- frontend build
- backend build
- Prisma validation
- migrations
- Docker build
- end-to-end checks

Report remaining blockers only after attempting to fix issues.