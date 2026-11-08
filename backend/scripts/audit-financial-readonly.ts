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
        current_database() AS database_name,
        (SELECT COUNT(*)::int FROM invoices WHERE paid_amount < 0 OR net_amount < 0) AS invalid_balances,
        (SELECT COUNT(*)::int FROM invoice_items WHERE quantity <> trunc(quantity) OR returned_qty <> trunc(returned_qty) OR returned_qty > quantity OR returned_qty < 0) AS invalid_quantities,
        (SELECT COUNT(*)::int FROM invoices i WHERE i.paid_amount <> COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0)) AS payment_mismatches,
        (SELECT COUNT(*)::int FROM invoices i WHERE i.returned_amount <> COALESCE((SELECT SUM(r.total_value) FROM returns r WHERE r.invoice_id = i.id), 0)) AS return_mismatches,
        (SELECT COUNT(*)::int FROM invoices i WHERE i.total_amount <> COALESCE((SELECT SUM(ii.total_price) FROM invoice_items ii WHERE ii.invoice_id = i.id), 0)) AS subtotal_mismatches,
        (SELECT COUNT(*)::int FROM invoices WHERE net_amount + returned_amount <> total_amount - round(total_amount * discount::numeric / 100, 2)) AS invoice_total_mismatches,
        (SELECT COUNT(*)::int FROM invoices WHERE discount < 0 OR discount > 100) AS invalid_discounts,
        (SELECT COUNT(*)::int FROM invoices WHERE COALESCE(tax, 0) <> 0) AS invoices_with_recorded_tax,
        (SELECT COALESCE(SUM(tax), 0) FROM invoices) AS total_recorded_tax,
        (SELECT COUNT(*)::int FROM invoices WHERE returned_amount > total_amount - round(total_amount * discount::numeric / 100, 2)) AS excessive_returns,
        (SELECT COUNT(*)::int FROM returns r LEFT JOIN invoices i ON i.id = r.invoice_id WHERE i.id IS NULL) AS orphan_returns,
        (SELECT COUNT(*)::int FROM payments p LEFT JOIN invoices i ON i.id = p.invoice_id WHERE p.invoice_id IS NOT NULL AND i.id IS NULL) AS orphan_invoice_payments,
        (SELECT COUNT(*)::int FROM expenses e WHERE paid_amount <> COALESCE((SELECT SUM(ep.amount) FROM expense_payments ep WHERE ep.expense_id = e.id), 0)) AS expense_payment_mismatches,
        (SELECT COUNT(*)::int FROM returns) AS historical_return_count
    `;
  }, { timeout: 15000 });
  const columns = await db.$queryRaw<Array<{ table_name: string; column_name: string }>>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('returns', 'return_items', 'inventory_transactions')
  `;
  const schema = new Map<string, Set<string>>();
  for (const { table_name, column_name } of columns) {
    if (!schema.has(table_name)) schema.set(table_name, new Set());
    schema.get(table_name)!.add(column_name);
  }

  let returnDetails: unknown;
  let inventoryReturnEvents: unknown = { unavailable: true };
  const inventoryColumns = schema.get('inventory_transactions');
  if (['id', 'type', 'reason', 'reference_id', 'qty_change', 'product_id'].every(column => inventoryColumns?.has(column))) {
    inventoryReturnEvents = await db.$queryRaw`
      SELECT type, COUNT(*)::int AS event_count,
        COUNT(DISTINCT reference_id)::int AS invoice_count,
        COUNT(DISTINCT product_id)::int AS product_count,
        COALESCE(SUM(qty_change), 0) AS quantity
      FROM inventory_transactions
      WHERE LOWER(type) LIKE '%return%' OR LOWER(COALESCE(reason, '')) LIKE '%return%'
      GROUP BY type
      ORDER BY type
    `;
  }

  if (schema.has('return_items')) {
    returnDetails = await db.$queryRaw`
      SELECT r.id AS return_id, r.invoice_id, r.total_value,
        COUNT(ri.id)::int AS item_lines,
        COALESCE(SUM(ri.quantity), 0) AS returned_quantity,
        COALESCE(SUM(ri.total_value), 0) AS item_value
      FROM returns r
      LEFT JOIN return_items ri ON ri.return_id = r.id
      GROUP BY r.id, r.invoice_id, r.total_value
      ORDER BY r.id
    `;
  } else {
    const canCorrelateInventory = ['id', 'type', 'reason', 'reference_id', 'qty_change', 'product_id', 'created_at']
      .every(column => inventoryColumns?.has(column));
    if (canCorrelateInventory) {
      returnDetails = await db.$queryRaw`
        SELECT r.id AS return_id, r.invoice_id, r.total_value,
          COUNT(t.id)::int AS matching_stock_events,
          COUNT(DISTINCT t.product_id)::int AS matched_products,
          COALESCE(SUM(t.qty_change), 0) AS matched_quantity,
          COUNT(t.id) FILTER (WHERE t.reason ~ ('Return #' || r.id::text || '([^0-9]|$)'))::int AS exact_return_id_matches,
          COUNT(t.id) FILTER (WHERE t.reference_id = r.invoice_id
            AND ABS(EXTRACT(EPOCH FROM (t.created_at - r.created_at))) <= 600)::int AS same_invoice_time_candidates,
          COALESCE(BOOL_AND(t.reference_id = r.invoice_id), true) AS invoice_reference_matches
        FROM returns r
        LEFT JOIN inventory_transactions t
          ON t.type = 'return'
          AND (t.reason ~ ('Return #' || r.id::text || '([^0-9]|$)')
            OR (t.reference_id = r.invoice_id
              AND ABS(EXTRACT(EPOCH FROM (t.created_at - r.created_at))) <= 600))
        GROUP BY r.id, r.invoice_id, r.total_value
        ORDER BY r.id
      `;
    } else {
      returnDetails = { unavailable: true, reason: 'No return-item table or correlatable stock audit fields' };
    }
  }
  console.log(JSON.stringify({ financialTotals: result, returnDetailSources: {
    returnItemsTable: schema.has('return_items'),
    inventoryTransactionsTable: schema.has('inventory_transactions'),
  }, inventoryReturnEvents, returnDetails }, null, 2));
} catch (error: any) {
  console.error('Read-only financial audit could not run:', error.code || error.name);
  process.exitCode = 1;
} finally { await db.$disconnect(); }
