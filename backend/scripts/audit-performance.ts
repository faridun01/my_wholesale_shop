import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { performance } from 'node:perf_hooks';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { getInvoiceLineRevenues, getRemainingQuantity } from '../src/routes/reports.helpers.js';
import { allocateCents, fromCents, invoiceLines, toCents } from '../src/utils/financial.js';

// Frozen pre-optimization formula, not a call to the optimized function.
function before(invoice: any, item: any) {
  const index = invoice.items.indexOf(item);
  if (index < 0 || getRemainingQuantity(item) <= 0 || toCents(invoice.netAmount ?? 0) <= 0) return 0;
  const weights = invoiceLines(invoice).map(line => toCents(line.remainingNetAmount));
  if (weights.every(weight => weight === 0)) return 0;
  return fromCents(allocateCents(toCents(invoice.netAmount), weights)[index]);
}
function measure(fn: () => unknown) {
  fn(); // warm-up
  const samples = Array.from({ length: 7 }, () => { const start = performance.now(); fn(); return performance.now() - start; }).sort((a,b) => a-b);
  return Number(samples[3].toFixed(3));
}
const calculations = [10, 50, 100, 300].map(count => {
  const invoice = { discount: '7.5', netAmount: String(count * 18.5), items: Array.from({ length: count }, (_, id) => ({ id, quantity: 2, returnedQty: 0, sellingPrice: '10', totalPrice: '20' })) };
  const oldResult = () => invoice.items.map(item => before(invoice, item));
  const newResult = () => getInvoiceLineRevenues(invoice);
  assert.deepEqual(oldResult(), newResult());
  const beforeMs = measure(oldResult), afterMs = measure(newResult);
  return { lines: count, beforeMs, afterMs, speedup: Number((beforeMs / afterMs).toFixed(1)), identical: true };
});
const db = new PrismaClient();
let database: unknown;
try {
  database = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '10s'");
    const counts = await tx.$queryRaw`SELECT
      (SELECT count(*)::int FROM invoices) AS invoices,
      (SELECT count(*)::int FROM invoice_items) AS invoice_items,
      (SELECT count(*)::int FROM products) AS products,
      (SELECT count(*)::int FROM product_batches) AS batches,
      (SELECT count(*)::int FROM product_batches WHERE remaining_quantity = 0) AS depleted_batches,
      (SELECT max(n)::int FROM (SELECT count(*) n FROM invoice_items GROUP BY invoice_id) s) AS largest_invoice`;
    const plan = await tx.$queryRawUnsafe('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT remaining_quantity FROM product_batches WHERE remaining_quantity <> 0');
    return { counts, nonzeroBatchPlan: plan };
  }, { timeout: 15000 });
} finally { await db.$disconnect(); }
const assets = readdirSync('frontend/dist/assets').filter(file => /\.(js|css)$/.test(file)).map(file => {
  const bytes = readFileSync(`frontend/dist/assets/${file}`);
  return { file, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
}).sort((a,b) => b.bytes-a.bytes);
const result = { capturedAt: new Date().toISOString(), methodology: 'Local warmed CPU median of 7 samples; synthetic invoice, exact result comparison. DB read-only EXPLAIN; not production HTTP latency.', calculations, database, largestAssets: assets.slice(0, 12) };
writeFileSync('docs/performance-results.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ calculations, database, largestAssets: assets.slice(0, 5) }, null, 2));
