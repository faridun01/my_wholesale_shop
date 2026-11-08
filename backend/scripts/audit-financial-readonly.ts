import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
// Runs against the pre-migration schema as well. No names, credentials or amounts
// belonging to individual customers are emitted. No writes/backfills are possible.
const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid/invalid');
url.searchParams.set('connect_timeout', '5');
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
try {
  const result = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '10s'");
    return tx.$queryRaw`
      SELECT
        (SELECT COUNT(*)::int FROM invoices WHERE paid_amount < 0 OR net_amount < 0) AS invalid_balances,
        (SELECT COUNT(*)::int FROM invoice_items WHERE quantity <> trunc(quantity) OR returned_qty <> trunc(returned_qty) OR returned_qty > quantity OR returned_qty < 0) AS invalid_quantities,
        (SELECT COUNT(*)::int FROM invoices i WHERE i.paid_amount <> COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0)) AS payment_mismatches,
        (SELECT COUNT(*)::int FROM invoices i WHERE i.returned_amount <> COALESCE((SELECT SUM(r.total_value) FROM returns r WHERE r.invoice_id = i.id), 0)) AS return_mismatches,
        (SELECT COUNT(*)::int FROM invoices i WHERE i.total_amount <> COALESCE((SELECT SUM(ii.total_price) FROM invoice_items ii WHERE ii.invoice_id = i.id), 0)) AS subtotal_mismatches,
        (SELECT COUNT(*)::int FROM invoices WHERE discount < 0 OR discount > 100) AS invalid_discounts,
        (SELECT COUNT(*)::int FROM invoices WHERE returned_amount > total_amount - round(total_amount * discount::numeric / 100, 2)) AS excessive_returns,
        (SELECT COUNT(*)::int FROM expenses e WHERE paid_amount <> COALESCE((SELECT SUM(ep.amount) FROM expense_payments ep WHERE ep.expense_id = e.id), 0)) AS expense_payment_mismatches,
        (SELECT COUNT(*)::int FROM returns) AS historical_return_count
    `;
  }, { timeout: 15000 });
  console.log(JSON.stringify(result, null, 2));
} catch (error: any) {
  console.error('Read-only financial audit could not run:', error.code || error.name);
  process.exitCode = 1;
} finally { await db.$disconnect(); }
