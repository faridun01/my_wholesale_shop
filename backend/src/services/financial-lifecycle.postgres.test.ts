import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import { once } from 'node:events';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { addMoney, financialJsonReplacer, lineTotal } from '../utils/financial.js';

// Prices that real invoices billed one cent too high per unit under binary floats.
describe('unit price arithmetic', () => {
  it.each([[9.3, 1000], [9.8, 600], [4.65, 540], [8.3, 480], [18.17, 100], [8.8, 144], [35.88, 136]])('bills %s x %s exactly', (price, qty) => {
    expect(lineTotal(qty, String(price))).toBe(addMoney(...Array.from({ length: 1 }, () => Math.round(price * 100) * qty / 100)));
    expect(lineTotal(qty, price)).toBe(lineTotal(qty, String(price)));
  });
});

// Never uses DATABASE_URL: runs only against the isolated *_financial_test database
// provisioned by scripts/test-financial-postgres.mjs.
const testUrl = process.env.FINANCIAL_TEST_DATABASE_URL;
const suite = testUrl ? describe : describe.skip;

suite('full financial lifecycle through the real routes', () => {
  let db: PrismaClient;
  let server: Server;
  let baseUrl: string;
  let token: string;
  let warehouseId: number, adminId: number, customerId: number, categoryId: number;
  let sequence = 0;

  const key = () => `lifecycle-${crypto.randomUUID()}`;
  const call = async (method: string, path: string, body?: unknown) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() as any };
  };
  const newProduct = async (sellingPrice: number) => {
    sequence += 1;
    const name = `Lifecycle ${sequence} ${crypto.randomUUID()}`;
    return (await db.product.create({ data: { name, nameKey: name, unit: 'шт', warehouseId, categoryId, costPrice: 0, sellingPrice, stock: 0 } })).id;
  };
  const restock = (productId: number, quantity: number, costPrice: number, extra: Record<string, unknown> = {}) =>
    call('POST', `/products/${productId}/restock`, { warehouseId, quantity, costPrice, purchaseCostPrice: costPrice, idempotency_key: key(), ...extra });
  const sell = (items: unknown[], discount = 0, paidAmount = 0) =>
    call('POST', '/invoices', { customerId, warehouseId, items, discount, paidAmount, idempotencyKey: key() });
  const pay = (invoiceId: number, amount: number) =>
    call('POST', '/payments', { invoice_id: invoiceId, customer_id: customerId, amount, method: 'cash', idempotency_key: key() });
  const giveBack = (invoiceId: number, amount: number) =>
    call('POST', '/payments/give-back', { invoice_id: invoiceId, amount, method: 'cash', idempotency_key: key() });
  const returnItems = (invoiceId: number, items: Array<{ invoiceItemId: number; quantity: number }>, idempotencyKey = key()) =>
    call('POST', `/invoices/${invoiceId}/return`, { items, reason: 'lifecycle', idempotencyKey, idempotency_key: idempotencyKey });
  const invoiceOf = async (id: number) => db.invoice.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { id: 'asc' } }, payments: true } });
  const stockOf = async (productId: number) => {
    const [product, batches, ledger] = await Promise.all([
      db.product.findUniqueOrThrow({ where: { id: productId } }),
      db.productBatch.aggregate({ where: { productId }, _sum: { remainingQuantity: true } }),
      db.inventoryTransaction.aggregate({ where: { productId }, _sum: { qtyChange: true } }),
    ]);
    return { cache: Number(product.stock), batches: Number(batches._sum.remainingQuantity || 0), ledger: Number(ledger._sum.qtyChange || 0) };
  };
  const expectStock = async (productId: number, expected: number) => {
    expect(await stockOf(productId)).toEqual({ cache: expected, batches: expected, ledger: expected });
  };
  const money = (value: unknown) => Number(value);

  beforeAll(async () => {
    const parsed = new URL(testUrl!);
    if (!parsed.pathname.endsWith('_financial_test')) throw new Error('Refusing a non-isolated financial test database');
    db = new PrismaClient({ datasources: { db: { url: testUrl! } } });
    (globalThis as any).prisma = db;

    const stamp = crypto.randomUUID();
    warehouseId = (await db.warehouse.create({ data: { name: `Lifecycle ${stamp}` } })).id;
    adminId = (await db.user.create({ data: { username: `l-${stamp}`, passwordHash: 'test-only', role: 'ADMIN', warehouseId } })).id;
    customerId = (await db.customer.create({ data: { name: `Lifecycle ${stamp}` } })).id;
    categoryId = (await db.category.create({ data: { name: `Lifecycle ${stamp}` } })).id;
    token = jwt.sign({ id: adminId }, process.env.JWT_SECRET!, { issuer: process.env.JWT_ISSUER || 'my-wholesale-shop', audience: process.env.JWT_AUDIENCE || 'my-wholesale-shop-users' });

    const app = express();
    app.set('json replacer', financialJsonReplacer);
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: adminId, role: req.headers['x-test-role'] || 'ADMIN', warehouseId };
      next();
    });
    app.use('/invoices', (await import('../routes/invoices.routes.js')).default);
    app.use('/payments', (await import('../routes/payments.routes.js')).default);
    app.use('/products', (await import('../routes/products.routes.js')).default);
    app.use('/reports', (await import('../routes/reports.routes.js')).default);
    app.use('/customers', (await import('../routes/customers.routes.js')).default);
    app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status || 400).json({ error: error.message }));
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterAll(async () => {
    server?.close();
    await db?.$disconnect();
    delete (globalThis as any).prisma;
  });

  it('keeps money, stock and profit exact from receipt to the final give-back', async () => {
    const a = await newProduct(9.3);
    const b = await newProduct(10);
    expect((await restock(a, 100, 7)).status).toBe(200);
    expect((await restock(b, 10, 4)).status).toBe(200);
    expect((await restock(b, 10, 6)).status).toBe(200);
    await expectStock(a, 100);
    await expectStock(b, 20);

    // 10 x 9.30 = 93.00; 15 x (10.00 - 10%) = 135.00; invoice discount 10% of 228.00.
    const sale = await sell([
      { productId: a, quantity: 10, sellingPrice: '9.3', discount: 0 },
      { productId: b, quantity: 15, sellingPrice: '10', discount: 10 },
    ], 10);
    expect(sale.status).toBe(201);
    const id = sale.data.id;
    let invoice = await invoiceOf(id);
    const [lineA, lineB] = invoice.items;
    expect([money(invoice.totalAmount), money(invoice.netAmount), invoice.status]).toEqual([228, 205.2, 'unpaid']);
    expect([money(lineA.totalPrice), money(lineB.totalPrice)]).toEqual([93, 135]);
    expect([money(lineA.eligibleNetAmount), money(lineB.eligibleNetAmount)]).toEqual([83.7, 121.5]);
    await expectStock(a, 90);
    await expectStock(b, 5);

    const profitOf = async () => {
      const rows = (await call('GET', `/reports/profit?warehouse_id=${warehouseId}`)).data as any[];
      return rows.filter((row) => row.invoice_id === id);
    };
    let rows = await profitOf();
    expect(addMoney(...rows.map((r) => r.net_sales))).toBe(205.2);
    expect(addMoney(...rows.map((r) => r.profit))).toBe(65.2); // cost 70 + 10x4 + 5x6

    expect((await pay(id, 100)).status).toBe(201);
    invoice = await invoiceOf(id);
    expect([money(invoice.paidAmount), invoice.status]).toEqual([100, 'partial']);

    // Partial return: goods value leaves the invoice, the payment stays.
    const first = await returnItems(id, [{ invoiceItemId: lineA.id, quantity: 3 }, { invoiceItemId: lineB.id, quantity: 5 }]);
    expect(first.status).toBe(200);
    invoice = await invoiceOf(id);
    expect([money(invoice.netAmount), money(invoice.returnedAmount), money(invoice.paidAmount), invoice.status]).toEqual([139.59, 65.61, 100, 'partial']);
    await expectStock(a, 93);
    await expectStock(b, 10);
    rows = await profitOf();
    expect(addMoney(...rows.map((r) => r.net_sales))).toBe(139.59);
    expect(addMoney(...rows.map((r) => r.profit))).toBe(40.59); // cost 49 + 5x4 + 5x6

    expect((await returnItems(id, [{ invoiceItemId: lineA.id, quantity: 8 }])).status).toBe(400);
    expect((await pay(id, 39.6)).status).toBe(400);
    expect((await pay(id, 39.59)).status).toBe(201);
    invoice = await invoiceOf(id);
    expect([money(invoice.paidAmount), invoice.status]).toEqual([139.59, 'paid']);

    // Full return: nothing left to owe, the whole payment goes back to the buyer.
    const full = await returnItems(id, [{ invoiceItemId: lineA.id, quantity: 7 }, { invoiceItemId: lineB.id, quantity: 10 }]);
    expect(full.status).toBe(200);
    invoice = await invoiceOf(id);
    expect([money(invoice.netAmount), money(invoice.returnedAmount), money(invoice.paidAmount)]).toEqual([0, 205.2, 139.59]);
    await expectStock(a, 100);
    await expectStock(b, 20);
    expect(await profitOf()).toEqual([]);

    const batches = await db.productBatch.findMany({ where: { productId: b }, orderBy: { id: 'asc' } });
    expect(batches.map((batch) => Number(batch.remainingQuantity))).toEqual([10, 10]);
    expect(await db.saleAllocation.count({ where: { invoiceItem: { invoiceId: id } } })).toBe(0);

    expect((await giveBack(id, 139.6)).status).toBe(400);
    expect((await giveBack(id, 139.59)).status).toBe(201);
    invoice = await invoiceOf(id);
    expect(money(invoice.paidAmount)).toBe(0);
    expect(addMoney(...invoice.payments.map((p) => p.amount))).toBe(0);
    expect(invoice.payments).toHaveLength(3);

    const returnsReport = ((await call('GET', `/reports/returns?warehouse_id=${warehouseId}`)).data as any[]).filter((row) => row.invoice_id === id);
    expect(addMoney(...returnsReport.map((r) => r.total_value))).toBe(205.2);
  });

  it('never loses a cent on repeated partial returns of a discounted line', async () => {
    const p = await newProduct(0.05);
    await restock(p, 10, 0.01);
    const sale = await sell([{ productId: p, quantity: 3, sellingPrice: '0.05' }], 10);
    const id = sale.data.id;
    const [line] = (await invoiceOf(id)).items;
    expect(money((await invoiceOf(id)).netAmount)).toBe(0.13);
    for (const expected of [0.09, 0.04, 0]) {
      expect((await returnItems(id, [{ invoiceItemId: line.id, quantity: 1 }])).status).toBe(200);
      expect(money((await invoiceOf(id)).netAmount)).toBe(expected);
    }
    expect(money((await invoiceOf(id)).returnedAmount)).toBe(0.13);
    expect((await returnItems(id, [{ invoiceItemId: line.id, quantity: 1 }])).status).toBe(400);
  });

  it('applies a repeated return once and refuses returning more than was sold', async () => {
    const p = await newProduct(10);
    await restock(p, 10, 1);
    const sale = await sell([{ productId: p, quantity: 5, sellingPrice: '10' }]);
    const id = sale.data.id;
    const [line] = (await invoiceOf(id)).items;
    const repeatKey = key();
    expect((await returnItems(id, [{ invoiceItemId: line.id, quantity: 2 }], repeatKey)).status).toBe(200);
    expect((await returnItems(id, [{ invoiceItemId: line.id, quantity: 2 }], repeatKey)).status).toBe(200);
    expect(money((await invoiceOf(id)).netAmount)).toBe(30);
    await expectStock(p, 7);
    expect((await returnItems(id, [{ invoiceItemId: line.id, quantity: 4 }])).status).toBe(400);
    await expectStock(p, 7);
  });

  it('lets only one of two simultaneous sales take the last units', async () => {
    const p = await newProduct(10);
    await restock(p, 5, 1);
    const results = await Promise.all([1, 2].map(() => sell([{ productId: p, quantity: 5, sellingPrice: '10' }])));
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    await expectStock(p, 0);
  });

  it('rolls a failed sale back completely', async () => {
    const p = await newProduct(10);
    const short = await newProduct(10);
    await restock(p, 5, 1);
    await restock(short, 1, 1);
    const before = await db.invoice.count({ where: { warehouseId } });
    expect((await sell([{ productId: p, quantity: 5, sellingPrice: '10' }, { productId: short, quantity: 2, sellingPrice: '10' }])).status).toBe(400);
    expect(await db.invoice.count({ where: { warehouseId } })).toBe(before);
    await expectStock(p, 5);
    await expectStock(short, 1);
  });

  it('keeps the stock ledger through an invoice edit', async () => {
    const p = await newProduct(10);
    await restock(p, 20, 1);
    const sale = await sell([{ productId: p, quantity: 5, sellingPrice: '10' }]);
    const id = sale.data.id;
    const before = await db.inventoryTransaction.findMany({ where: { referenceId: id, type: 'outgoing' } });
    const edit = await call('PUT', `/invoices/${id}`, { customerId, items: [{ productId: p, quantity: 8, sellingPrice: '10' }], discount: 0 });
    expect(edit.status).toBe(200);
    const stillThere = await db.inventoryTransaction.findMany({ where: { id: { in: before.map((t) => t.id) } } });
    expect(stillThere).toHaveLength(before.length);
    await expectStock(p, 12);
    expect(money((await invoiceOf(id)).netAmount)).toBe(80);
  });

  it('refuses to edit a cancelled invoice, even for an admin', async () => {
    const p = await newProduct(10);
    await restock(p, 20, 1);
    const sale = await sell([{ productId: p, quantity: 5, sellingPrice: '10' }]);
    const id = sale.data.id;
    expect((await call('POST', `/invoices/${id}/cancel`)).status).toBe(200);
    await expectStock(p, 20);
    expect((await call('PUT', `/invoices/${id}`, { customerId, items: [{ productId: p, quantity: 1, sellingPrice: '10' }] })).status).toBe(400);
    expect((await invoiceOf(id)).cancelled).toBe(true);
    await expectStock(p, 20);
  });

  it('never restores more of a write-off than was written off', async () => {
    const p = await newProduct(10);
    await restock(p, 20, 2);
    const writeOff = await call('POST', `/products/${p}/write-off`, { warehouseId, quantity: 10, reason: 'брак', idempotency_key: key() });
    expect(writeOff.status).toBeLessThan(300);
    const transactionId = writeOff.data.transactionId;
    const giveBackGoods = (quantity: number) => call('POST', `/products/history/${transactionId}/return-writeoff`, { quantity, reason: 'ошибка', idempotency_key: key() });
    expect((await giveBackGoods(6)).status).toBeLessThan(300);
    await expectStock(p, 16);
    expect((await giveBackGoods(6)).status).toBe(400);
    await expectStock(p, 16);
    expect((await giveBackGoods(4)).status).toBeLessThan(300);
    await expectStock(p, 20);
    expect((await giveBackGoods(1)).status).toBe(400);
    await expectStock(p, 20);
  });

  it('does not mistake a cancelled invoice with the same number for a write-off restoration', async () => {
    const p = await newProduct(10);
    await restock(p, 20, 2);
    const writeOff = await call('POST', `/products/${p}/write-off`, { warehouseId, quantity: 10, reason: 'брак', idempotency_key: key() });
    const transactionId = writeOff.data.transactionId;
    await db.inventoryTransaction.create({ data: { productId: p, warehouseId, userId: adminId, qtyChange: 4, type: 'adjustment', reason: `Invoice #${transactionId} Cancelled`, referenceId: transactionId } });

    const report = (await call('GET', `/reports/writeoffs?warehouse_id=${warehouseId}`)).data as any[];
    const row = report.find((r) => r.transaction_id === transactionId);
    expect(row).toMatchObject({ quantity: 10, returned_qty: 0, status: 'writeoff' });
    expect(money(row.total_value)).toBe(20);
  });

  it('asks for confirmation before accepting a cost above the selling price', async () => {
    const p = await newProduct(11);
    const refused = await restock(p, 10, 96.2, { sellingPrice: 11 });
    expect(refused.status).toBe(400);
    expect(refused.data.error).toContain('Себестоимость за 1 шт');
    await expectStock(p, 0);
    expect((await restock(p, 10, 96.2, { sellingPrice: 11, confirmCostAboveSelling: true })).status).toBe(200);
    await expectStock(p, 10);
  });

  it('values a legacy return against the stored total when old rules left a small gap', async () => {
    const p = await newProduct(10);
    await restock(p, 10, 1);
    const sale = await sell([{ productId: p, quantity: 10, sellingPrice: '10' }]);
    const id = sale.data.id;
    // Same shape as a pre-ledger invoice: no line snapshot, a total 1.70 under its lines.
    await db.$executeRaw`UPDATE invoices SET calculation_version = NULL, net_amount = 98.30, returned_amount = 359.68 WHERE id = ${id}`;
    await db.$executeRaw`UPDATE invoice_items SET eligible_net_amount = NULL, allocated_order_discount = NULL WHERE invoice_id = ${id}`;
    const [line] = (await invoiceOf(id)).items;
    expect((await returnItems(id, [{ invoiceItemId: line.id, quantity: 10 }])).status).toBe(200);
    expect(money((await invoiceOf(id)).netAmount)).toBe(0);
    await expectStock(p, 10);
  });

  it('keeps every figure in step when a batch cost is corrected', async () => {
    const p = await newProduct(50);
    await restock(p, 20, 30);
    await restock(p, 20, 40);
    const [older, newer] = await db.productBatch.findMany({ where: { productId: p }, orderBy: { id: 'asc' } });

    // 5 sold from the older batch, then 3 written off from it.
    const sale = await sell([{ productId: p, quantity: 5, sellingPrice: '50' }]);
    const writeOff = await call('POST', `/products/${p}/write-off`, { warehouseId, quantity: 3, reason: 'брак', idempotency_key: key() });
    const stockValue = async () => {
      const batches = await db.productBatch.findMany({ where: { productId: p } });
      return addMoney(...batches.map((b) => lineTotal(b.remainingQuantity, b.costPrice)));
    };
    const profit = async () => addMoney(...((await call('GET', `/reports/profit?warehouse_id=${warehouseId}`)).data as any[]).filter((r) => r.invoice_id === sale.data.id).map((r) => r.profit));
    expect(await stockValue()).toBe(1160); // 12 x 30 + 20 x 40
    expect(await profit()).toBe(100);

    const saved = await call('PUT', `/products/batches/${older.id}/cost`, { purchaseCostPrice: 20 });
    expect(saved.data).toMatchObject({ success: true, changed: true });

    expect(await stockValue()).toBe(1040); // 12 x 20 + 20 x 40
    expect(await profit()).toBe(150);
    const [line] = (await invoiceOf(sale.data.id)).items;
    expect(money(line.costPrice)).toBe(20);
    const outgoing = await db.inventoryTransaction.findFirstOrThrow({ where: { referenceId: sale.data.id, type: 'outgoing' } });
    expect(money(outgoing.costAtTime)).toBe(20);

    const report = (await call('GET', `/reports/writeoffs?warehouse_id=${warehouseId}`)).data as any[];
    expect(money(report.find((r) => r.transaction_id === writeOff.data.transactionId).total_value)).toBe(60);

    // Only the newest batch sets the product card, and quantities never move.
    expect(money((await db.product.findUniqueOrThrow({ where: { id: p } })).costPrice)).toBe(40);
    await call('PUT', `/products/batches/${newer.id}/cost`, { purchaseCostPrice: 35 });
    expect(money((await db.product.findUniqueOrThrow({ where: { id: p } })).costPrice)).toBe(35);
    await expectStock(p, 32);

    // A later restoration goes back into the same batch at the corrected cost.
    expect((await call('POST', `/products/history/${writeOff.data.transactionId}/return-writeoff`, { quantity: 3, reason: 'ошибка', idempotency_key: key() })).status).toBeLessThan(300);
    expect(await db.productBatch.count({ where: { productId: p } })).toBe(2);
    await expectStock(p, 35);

    const trail = await db.inventoryTransaction.count({ where: { productId: p, reason: { startsWith: 'Изменение себестоимости партии' } } });
    expect(trail).toBe(2);
    expect((await call('PUT', `/products/batches/${older.id}/cost`, { purchaseCostPrice: 20 })).data.changed).toBe(false);
  });

  it('refuses an invalid batch cost and asks before accepting one above the selling price', async () => {
    const p = await newProduct(11);
    await restock(p, 10, 9);
    const batch = await db.productBatch.findFirstOrThrow({ where: { productId: p } });
    expect((await call('PUT', `/products/batches/${batch.id}/cost`, { purchaseCostPrice: 0 })).status).toBe(400);
    expect((await call('PUT', `/products/batches/${batch.id}/cost`, { purchaseCostPrice: -1 })).status).toBe(400);
    expect((await call('PUT', `/products/batches/${batch.id}/cost`, { purchaseCostPrice: 96.2 })).status).toBe(400);
    expect(money((await db.productBatch.findUniqueOrThrow({ where: { id: batch.id } })).costPrice)).toBe(9);
    expect((await call('PUT', `/products/batches/${batch.id}/cost`, { purchaseCostPrice: 96.2, confirmCostAboveSelling: true })).status).toBe(200);
    expect(money((await db.productBatch.findUniqueOrThrow({ where: { id: batch.id } })).costPrice)).toBe(96.2);

    const seller = await fetch(`${baseUrl}/products/batches/${batch.id}/cost`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-test-role': 'SELLER' }, body: JSON.stringify({ purchaseCostPrice: 5 }) });
    expect(seller.status).toBe(403);
    expect(money((await db.productBatch.findUniqueOrThrow({ where: { id: batch.id } })).costPrice)).toBe(96.2);
  });

  it('allows deleting only an untouched batch and keeps the journal in step', async () => {
    const p = await newProduct(10);
    await restock(p, 10, 1);
    const second = await restock(p, 5, 2);
    const first = (await db.productBatch.findFirstOrThrow({ where: { productId: p }, orderBy: { id: 'asc' } })).id;
    await sell([{ productId: p, quantity: 1, sellingPrice: '10' }]);

    const shown = (await call('GET', `/products/${p}/batches`)).data as any[];
    expect(shown.find((b) => b.id === first).canDelete).toBe(false);
    expect(shown.find((b) => b.id === second.data.id).canDelete).toBe(true);

    expect((await call('DELETE', `/products/batches/${first}`)).status).toBe(400);
    await expectStock(p, 14);
    expect((await call('DELETE', `/products/batches/${second.data.id}`)).status).toBe(200);
    await expectStock(p, 9);
  });

  it('treats a cancelled invoice as annulled: stock comes back, no money figure includes it', async () => {
    const p = await newProduct(10);
    await restock(p, 10, 1);
    const sale = await sell([{ productId: p, quantity: 4, sellingPrice: '10' }]);
    await expectStock(p, 6);
    expect((await call('POST', `/invoices/${sale.data.id}/cancel`)).status).toBe(200);
    await expectStock(p, 10);
    expect(await db.payment.count({ where: { invoiceId: sale.data.id } })).toBe(0);

    // Older data: cancelled while still carrying a payment and a return.
    const buyer = (await db.customer.create({ data: { name: `Annulled ${crypto.randomUUID()}` } })).id;
    const legacy = await db.invoice.create({ data: { customerId: buyer, userId: adminId, warehouseId, totalAmount: 1260, netAmount: 1260, paidAmount: 1260, returnedAmount: 100, status: 'paid', cancelled: true } });
    await db.payment.create({ data: { customerId: buyer, invoiceId: legacy.id, userId: adminId, amount: 1260, method: 'cash' } });
    await db.return.create({ data: { invoiceId: legacy.id, customerId: buyer, userId: adminId, totalValue: 100 } });

    expect((await call('GET', `/customers/${buyer}/payments`)).data).toEqual([]);
    expect((await call('GET', `/customers/${buyer}/returns`)).data).toEqual([]);
    const report = (await call('GET', `/reports/returns?warehouse_id=${warehouseId}`)).data as any[];
    expect(report.filter((row) => row.invoice_id === legacy.id)).toEqual([]);
    expect((await call('POST', '/payments/give-back', { invoice_id: legacy.id, amount: 1, method: 'cash', idempotency_key: key() })).status).toBe(400);
  });

  it('counts old goods-return offsets as received money in staff totals', async () => {
    const { StaffStatsService } = await import('./staff-stats.service.js');
    const warehouse = (await db.warehouse.create({ data: { name: `Staff ${crypto.randomUUID()}` } })).id;
    const invoice = await db.invoice.create({ data: { customerId, userId: adminId, warehouseId: warehouse, totalAmount: 1000, netAmount: 850, paidAmount: 450, returnedAmount: 150, status: 'partial' } });
    await db.payment.create({ data: { customerId, invoiceId: invoice.id, userId: adminId, amount: 600, method: 'cash' } });
    await db.payment.create({ data: { customerId, invoiceId: invoice.id, userId: adminId, amount: -150, method: 'refund' } });

    const { totals } = await StaffStatsService.getStaffStatsList({ warehouseId: warehouse } as any, db as any);
    expect([totals.soldAmount, totals.paidAmount, totals.debtAmount]).toEqual([850, 600, 250]);
  });
});
