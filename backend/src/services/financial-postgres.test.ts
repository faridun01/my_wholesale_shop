import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import { once } from 'node:events';
import { ReferenceInvoice } from '../testing/financial-reference.js';
import jwt from 'jsonwebtoken';
import { financialJsonReplacer } from '../utils/financial.js';
// This suite NEVER uses DATABASE_URL. Provision/migrate an isolated database whose
// name ends in _financial_test, then explicitly supply FINANCIAL_TEST_DATABASE_URL.
const testUrl = process.env.FINANCIAL_TEST_DATABASE_URL;
const suite = testUrl ? describe : describe.skip;
suite('PostgreSQL financial transaction integration', () => {
  let db: PrismaClient, service: typeof import('./invoice.service.js').InvoiceService;
  let warehouseId: number, customerId: number, userId: number, productId: number;
  beforeAll(async () => {
    const parsed = new URL(testUrl!);
    if (!parsed.pathname.endsWith('_financial_test')) throw new Error('Refusing a non-isolated financial test database');
    db = new PrismaClient({ datasources: { db: { url: testUrl! } } });
    // The service uses the supplied test client; never import its default client
    // until the isolated global has been installed.
    (globalThis as any).prisma = db;
    service = (await import('./invoice.service.js')).InvoiceService;
    const stamp = crypto.randomUUID();
    const warehouse = await db.warehouse.create({ data: { name: `Financial test ${stamp}` } }); warehouseId = warehouse.id;
    const customer = await db.customer.create({ data: { name: `Financial test ${stamp}` } }); customerId = customer.id;
    const user = await db.user.create({ data: { username: stamp, passwordHash: 'test-only', role: 'ADMIN', warehouseId } }); userId = user.id;
    const category = await db.category.create({ data: { name: stamp } });
    const product = await db.product.create({ data: { name: stamp, nameKey: stamp, unit: 'pcs', warehouseId, categoryId: category.id, costPrice: .01, sellingPrice: .05, stock: 100 } }); productId = product.id;
    await db.productBatch.create({ data: { productId, warehouseId, quantity: 100, remainingQuantity: 100, costPrice: .01 } });
  });
  afterAll(async () => { await db?.$disconnect(); delete (globalThis as any).prisma; });
  const sale = () => service.createInvoice({ customerId, userId, warehouseId, items: [{ productId, quantity: 3, sellingPrice: .05 }], discount: 10, paidAmount: .13, paymentMethod: 'card', idempotencyKey: crypto.randomUUID() });
  async function withApi(run: (request: (path: string, body?: any, role?: string, method?: string) => Promise<{ status: number; data: any }>) => Promise<void>) {
    // Real loopback HTTP, production routers and PostgreSQL. Authentication is
    // replaced by the isolated test actor; authentication itself is outside this suite.
    const app = express(); app.set('json replacer', financialJsonReplacer); app.use(express.json());
    app.use((req, _res, next) => { (req as any).user = { id: userId, role: req.headers['x-test-role'] || 'ADMIN', warehouseId, customerId }; next(); });
    app.use('/invoices', (await import('../routes/invoices.routes.js')).default);
    app.use('/payments', (await import('../routes/payments.routes.js')).default);
    app.use('/orders', (await import('../routes/customer-orders.routes.js')).default);
    app.use('/products', (await import('../routes/products.routes.js')).default);
    app.use('/reports', (await import('../routes/reports.routes.js')).default);
    app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status || 400).json({ error: error.message }));
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const address = server.address() as { port: number };
    try {
      await run(async (path, body, role = 'ADMIN', method = body === undefined ? 'GET' : 'POST') => {
        const token = jwt.sign({ id: userId }, process.env.JWT_SECRET!, { issuer: process.env.JWT_ISSUER || 'my-wholesale-shop', audience: process.env.JWT_AUDIENCE || 'my-wholesale-shop-users' });
        const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method, headers: { 'Content-Type': 'application/json', 'x-test-role': role, Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
        return { status: response.status, data: await response.json() };
      });
    } finally { await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }); }
  }
  it('HTTP sale, three payments and goods returns reconcile with the independent model and reports', async () => {
    await withApi(async request => {
      const stockBefore = Number((await db.product.findUniqueOrThrow({ where: { id: productId } })).stock);
      const model = new ReferenceInvoice([{ quantity: 20, sellingPrice: '50' }], '0');
      const created = await request('/invoices', { customerId, warehouseId, items: [{ productId, quantity: 20, sellingPrice: '50.00' }], idempotencyKey: crypto.randomUUID() });
      expect(created.status).toBe(201); const id = created.data.id;
      for (let n = 0; n < 3; n++) {
        model.pay('200');
        expect((await request('/payments', { customer_id: customerId, invoice_id: id, amount: '200.00', method: ['cash', 'card', 'transfer'][n], idempotency_key: crypto.randomUUID() })).status).toBe(201);
      }
      const original = await db.invoiceItem.findFirstOrThrow({ where: { invoiceId: id } });
      for (const qty of [3, 8]) {
        model.returnGoods(0, qty);
        const body = { items: [{ invoiceItemId: original.id, quantity: qty }], reason: 'HTTP reference lifecycle', idempotencyKey: crypto.randomUUID() };
        const first = await request(`/invoices/${id}/return`, body);
        expect(first.status).toBe(200);
        expect((await request(`/invoices/${id}/return`, body)).data).toEqual(first.data);
        const detail = (await request(`/invoices/${id}`)).data;
        expect(Number(detail.netAmount)).toBe(model.net.div(100).toNumber());
        expect(Number(detail.paidAmount)).toBe(600);
        expect(Number(detail.financialSummary.debtAmount)).toBe(model.debt.div(100).toNumber());
        expect(Number(detail.financialSummary.customerCredit || 0)).toBe(0);
        expect(Number(detail.originalInvoice.netAmount)).toBe(1000);
        expect(detail.payments).toHaveLength(3);
        const state = await db.invoice.findUniqueOrThrow({ where: { id } });
        expect(Number(state.netAmount)).toBe(Number(detail.netAmount));
        expect(Number((await db.payment.aggregate({ where: { invoiceId: id }, _sum: { amount: true } }))._sum.amount)).toBe(600);
        const rows = await request(`/reports/sales?warehouse_id=${warehouseId}`);
        expect(rows.status).toBe(200);
        const ownRows = rows.data.filter((row: any) => row.invoice_id === id);
        expect(ownRows.reduce((sum: number, row: any) => sum + Math.round(Number(row.total_sales) * 100), 0)).toBe(model.net.toNumber());
      }
      expect(await db.return.count({ where: { invoiceId: id } })).toBe(2);
      expect(Number((await db.product.findUniqueOrThrow({ where: { id: productId } })).stock)).toBe(stockBefore - 9);
    });
  });
  it('HTTP rejects nonzero sub-cent tax and preserves an explicitly free customer order', async () => {
    await withApi(async request => {
      const base = { customerId, warehouseId, items: [{ productId, quantity: 1, sellingPrice: '0.00' }], idempotencyKey: crypto.randomUUID() };
      expect((await request('/invoices', { ...base, tax: '0.004' })).status).toBe(400);
      const order = await request('/orders', { ...base, items: [{ productId, quantity: 1, sellingPrice: 0 }], idempotency_key: crypto.randomUUID() }, 'CUSTOMER');
      expect(order.status).toBe(201);
      expect(Number(order.data.totalAmount)).toBe(0);
      expect(Number(order.data.items[0].sellingPrice)).toBe(0);
    });
  });
  it('HTTP rejects invalid negative customer-order discounts instead of silently making them zero', async () => {
    await withApi(async request => {
      const response = await request('/orders', { warehouseId, items: [{ productId, quantity: 1, sellingPrice: 10, discount: -1 }], idempotency_key: crypto.randomUUID() }, 'CUSTOMER');
      expect(response.status).toBe(400);
    });
  });
  it('HTTP serializes different concurrent payments so their sum cannot exceed debt', async () => {
    await withApi(async request => {
      const created = await request('/invoices', { customerId, warehouseId, items: [{ productId, quantity: 2, sellingPrice: 100 }], idempotencyKey: crypto.randomUUID() });
      const invoiceId = created.data.id;
      const results = await Promise.all([1, 2].map(() => request('/payments', { customer_id: customerId, invoice_id: invoiceId, amount: '150.00', method: 'cash', idempotency_key: crypto.randomUUID() })));
      expect(results.map(r => r.status).sort()).toEqual([201, 400]);
      const state = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      expect(Number(state.paidAmount)).toBe(150);
      expect(await db.payment.count({ where: { invoiceId } })).toBe(1);
    });
  });
  it('SQL dashboard debt agrees with preserved historical payment adjustments', async () => {
    const isolatedWarehouse = await db.warehouse.create({ data: { name: crypto.randomUUID() } });
    const invoice = await db.invoice.create({ data: { warehouseId: isolatedWarehouse.id, customerId, userId, totalAmount: 100, netAmount: 80, paidAmount: 80, returnedAmount: 20, discount: 0 } });
    await db.payment.createMany({ data: [
      { customerId, invoiceId: invoice.id, userId, amount: 100, method: 'cash' },
      { customerId, invoiceId: invoice.id, userId, amount: -20, method: 'refund' },
    ] });
    const { getTotalOutstandingDebt } = await import('../utils/defaultCustomer.js');
    expect(await getTotalOutstandingDebt(db, isolatedWarehouse.id)).toBe(0);
    expect((await service.getInvoiceDetails(invoice.id)).financialSummary.debtAmount).toBe(0);
  });
  it('preserves a high-precision discount through HTTP, database and cent rounding', async () => {
    await withApi(async request => {
      const discount = '49.9999999999999999999';
      const created = await request('/invoices', { customerId, warehouseId, items: [{ productId, quantity: 1, sellingPrice: '0.01' }], discount, idempotencyKey: crypto.randomUUID() });
      expect(created.status).toBe(201);
      expect(Number(created.data.netAmount)).toBe(.01);
      expect(created.data.discount).toBe(discount);
      const state = await db.invoice.findUniqueOrThrow({ where: { id: created.data.id } });
      expect(state.discount.toString()).toBe(discount);
    });
  });
  it('preserves exact FIFO write-off value and stock value through partial returns', async () => {
    const parent = await db.product.findUniqueOrThrow({ where: { id: productId } });
    const product = await db.product.create({ data: { name: crypto.randomUUID(), nameKey: crypto.randomUUID(), categoryId: parent.categoryId, warehouseId, unit: 'pcs', costPrice: .02, sellingPrice: 1, stock: 2 } });
    await db.productBatch.createMany({ data: [
      { productId: product.id, warehouseId, quantity: 1, remainingQuantity: 1, costPrice: .01, createdAt: new Date('2026-01-01') },
      { productId: product.id, warehouseId, quantity: 1, remainingQuantity: 1, costPrice: .02, createdAt: new Date('2026-01-02') },
    ] });
    const { StockService } = await import('./stock.service.js');
    await StockService.writeOffStock(product.id, warehouseId, 2, userId, 'FIFO reference');
    const transaction = await db.inventoryTransaction.findFirstOrThrow({ where: { productId: product.id, qtyChange: -2 } });
    await withApi(async request => {
      const before = (await request(`/reports/writeoffs?warehouse_id=${warehouseId}`)).data.find((row: any) => row.transaction_id === transaction.id);
      expect(Number(before.total_value)).toBe(.03);
      await StockService.returnWriteOffTransaction(transaction.id, 1, userId);
      const partial = (await request(`/reports/writeoffs?warehouse_id=${warehouseId}`)).data.find((row: any) => row.transaction_id === transaction.id);
      expect(Number(partial.total_value)).toBe(.02);
      await StockService.returnWriteOffTransaction(transaction.id, 1, userId);
    });
    const batches = await db.productBatch.findMany({ where: { productId: product.id } });
    expect(batches.reduce((sum, batch) => sum + Math.round(Number(batch.costPrice) * 100) * batch.remainingQuantity, 0)).toBe(3);
    expect(Number((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock)).toBe(2);
    await expect(StockService.returnWriteOffTransaction(transaction.id, 1, userId)).rejects.toThrow();
    await StockService.writeOffStock(product.id, warehouseId, 2, userId, 'Competing restoration');
    const second = await db.inventoryTransaction.findFirstOrThrow({ where: { productId: product.id, qtyChange: -2 }, orderBy: { id: 'desc' } });
    const outcomes = await Promise.allSettled([1, 2].map(() => StockService.returnWriteOffTransaction(second.id, 2, userId)));
    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(Number((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock)).toBe(2);
    await StockService.writeOffStock(product.id, warehouseId, 2, userId, 'Cancellation history');
    const third = await db.inventoryTransaction.findFirstOrThrow({ where: { productId: product.id, qtyChange: -2 }, orderBy: { id: 'desc' } });
    await StockService.deleteWriteOffTransactionPermanently(third.id, userId);
    expect(await db.inventoryTransaction.findUnique({ where: { id: third.id } })).not.toBeNull();
    expect(await db.inventoryTransaction.count({ where: { referenceId: third.id, qtyChange: 2 } })).toBe(1);
  });
  it('cancels the exact incoming batch rather than a newer batch of equal quantity', async () => {
    const parent = await db.product.findUniqueOrThrow({ where: { id: productId } });
    const product = await db.product.create({ data: { name: crypto.randomUUID(), nameKey: crypto.randomUUID(), categoryId: parent.categoryId, warehouseId, unit: 'pcs', costPrice: 1, sellingPrice: 3 } });
    const { StockService } = await import('./stock.service.js');
    const first = await StockService.addStock(product.id, warehouseId, 2, 1, userId, 'First exact batch');
    const second = await StockService.addStock(product.id, warehouseId, 2, 2, userId, 'Second exact batch');
    const incoming = await db.inventoryTransaction.findFirstOrThrow({ where: { productId: product.id, type: 'incoming', reason: 'First exact batch' } });
    await StockService.reverseIncomingTransaction(incoming.id, userId);
    expect(await db.productBatch.findUnique({ where: { id: first.id } })).toBeNull();
    expect(await db.productBatch.findUnique({ where: { id: second.id } })).not.toBeNull();
    expect(Number((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock)).toBe(2);
    await expect(StockService.reverseIncomingTransaction(incoming.id, userId)).rejects.toThrow();
  });
  it('rolls back restock prices on failure and deduplicates retrying purchases', async () => {
    const parent = await db.product.findUniqueOrThrow({ where: { id: productId } });
    const product = await db.product.create({ data: { name: crypto.randomUUID(), nameKey: crypto.randomUUID(), categoryId: parent.categoryId, warehouseId, unit: 'pcs', costPrice: 1, sellingPrice: 5 } });
    await withApi(async request => {
      const payload = { warehouseId, quantity: 0, costPrice: '10', sellingPrice: '20', idempotency_key: crypto.randomUUID() };
      expect((await request(`/products/${product.id}/restock`, payload)).status).toBe(400);
      expect(Number((await db.product.findUniqueOrThrow({ where: { id: product.id } })).costPrice)).toBe(1);
      const valid = { ...payload, quantity: 2, idempotency_key: crypto.randomUUID() };
      const responses = await Promise.all([1, 2].map(() => request(`/products/${product.id}/restock`, valid)));
      expect(responses.map(response => response.status)).toEqual([200, 200]);
      expect(responses[0].data.id).toBe(responses[1].data.id);
      expect(await db.productBatch.count({ where: { productId: product.id } })).toBe(1);
      expect(Number((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock)).toBe(2);
      expect((await request(`/products/${product.id}/restock`, { ...valid, quantity: 3 })).status).toBe(400);
    });
  });
  it('deduplicates HTTP write-offs, partial restorations and transfers', async () => {
    const parent = await db.product.findUniqueOrThrow({ where: { id: productId } });
    const product = await db.product.create({ data: { name: crypto.randomUUID(), nameKey: crypto.randomUUID(), categoryId: parent.categoryId, warehouseId, unit: 'pcs', costPrice: .1, sellingPrice: 1, stock: 4 } });
    await db.productBatch.create({ data: { productId: product.id, warehouseId, quantity: 4, remainingQuantity: 4, costPrice: .1 } });
    const destination = await db.warehouse.create({ data: { name: crypto.randomUUID() } });
    await withApi(async request => {
      const writeoff = { quantity: 1, reason: 'Retry write-off', idempotency_key: crypto.randomUUID() };
      const outcomes = await Promise.all([1, 2].map(() => request(`/products/${product.id}/write-off`, writeoff)));
      expect(outcomes.map(row => row.status)).toEqual([200, 200]);
      expect(outcomes[0].data).toEqual(outcomes[1].data);
      const id = outcomes[0].data.transactionId;
      const restoration = { quantity: 1, reason: 'Retry return', idempotency_key: crypto.randomUUID() };
      const restored = await Promise.all([1, 2].map(() => request(`/products/history/${id}/return-writeoff`, restoration)));
      expect(restored.map(row => row.status)).toEqual([200, 200]);
      expect(restored[0].data).toEqual(restored[1].data);
      expect(Number((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock)).toBe(4);
      const transfer = { fromWarehouseId: warehouseId, toWarehouseId: destination.id, quantity: 2, idempotency_key: crypto.randomUUID() };
      const moved = await Promise.all([1, 2].map(() => request(`/products/${product.id}/transfer`, transfer)));
      expect(moved.map(row => row.status)).toEqual([200, 200]);
      expect(moved[0].data).toEqual(moved[1].data);
      expect(Number((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock)).toBe(2);
      expect(Number((await db.product.findUniqueOrThrow({ where: { id: moved[0].data.destinationProductId } })).stock)).toBe(2);
      expect(await db.inventoryTransaction.count({ where: { productId: product.id, type: 'transfer' } })).toBe(1);
    });
  });
  it('preserves inventory financial history when permanent product deletion is requested', async () => {
    const parent = await db.product.findUniqueOrThrow({ where: { id: productId } });
    const product = await db.product.create({ data: { name: crypto.randomUUID(), nameKey: crypto.randomUUID(), categoryId: parent.categoryId, warehouseId, unit: 'pcs', costPrice: 1, sellingPrice: 2 } });
    const event = await db.inventoryTransaction.create({ data: { productId: product.id, warehouseId, userId, type: 'adjustment', qtyChange: -1, costAtTime: 1, sellingAtTime: 2, reason: 'Historical write-off' } });
    await withApi(async request => expect((await request(`/products/${product.id}?force=true`, undefined, 'ADMIN', 'DELETE')).status).toBe(400));
    expect(await db.inventoryTransaction.findUnique({ where: { id: event.id } })).not.toBeNull();
  });
  it('lists the same batch-backed stock with and without a warehouse filter', async () => {
    const parent = await db.product.findUniqueOrThrow({ where: { id: productId } });
    const product = await db.product.create({ data: { name: crypto.randomUUID(), nameKey: crypto.randomUUID(), categoryId: parent.categoryId, warehouseId, unit: 'pcs', costPrice: 1, sellingPrice: 2, stock: 100 } });
    await db.productBatch.create({ data: { productId: product.id, warehouseId, quantity: 3, remainingQuantity: 3, costPrice: 1 } });
    await withApi(async request => {
      for (const path of ['/products', `/products?warehouseId=${warehouseId}`]) {
        const response = await request(path);
        expect(response.status).toBe(200);
        const row = response.data.find((item: any) => item.id === product.id);
        expect(row.stock).toBe(3);
        expect(row.batches[0]).toHaveProperty('costPrice');
        expect(row.batches.every((batch: any) => Number(batch.remainingQuantity) !== 0)).toBe(true);
        const staffResponse = await request(path, undefined, 'MANAGER');
        expect(staffResponse.status).toBe(200);
        const staffRow = staffResponse.data.find((item: any) => item.id === product.id);
        expect(staffRow.batches[0]).not.toHaveProperty('costPrice');
      }
    });
    // Reading must not silently repair historical caches.
    expect(Number((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock)).toBe(100);
  });
  it('cannot reject an order after a competing approval has already created its invoice', async () => {
    const order = await db.customerOrder.create({ data: { customerId, userId, warehouseId, totalAmount: 1, items: { create: [{ productId, quantity: 1, sellingPrice: 1 }] } } });
    let release!: () => void, ready!: () => void;
    const hold = new Promise<void>(resolve => { release = resolve; });
    const locked = new Promise<void>(resolve => { ready = resolve; });
    const blocker = db.$transaction(async tx => { await tx.$queryRaw`SELECT id FROM customer_orders WHERE id = ${order.id} FOR UPDATE`; ready(); await hold; }, { timeout: 10000 });
    await locked;
    async function waitForLocks(minimum: number) {
      for (let attempt = 0; attempt < 150; attempt++) {
        const [row] = await db.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()`;
        if (row.count >= minimum) return;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw new Error('Could not stage the competing order locks');
    }
    try {
      await withApi(async request => {
        const approval = request(`/orders/${order.id}/approve`, {});
        await waitForLocks(1);
        const rejection = request(`/orders/${order.id}/reject`, {});
        await waitForLocks(2);
        release(); await blocker;
        const results = await Promise.all([approval, rejection]);
        expect(results.map(result => result.status)).toEqual([200, 400]);
      });
      const state = await db.customerOrder.findUniqueOrThrow({ where: { id: order.id } });
      expect(state.status).toBe('approved'); expect(state.invoiceId).not.toBeNull();
    } finally { release(); await blocker; }
  });
  it('serializes duplicate concurrent returns and preserves inventory/ledger history', async () => {
    const stockBefore = Number((await db.product.findUniqueOrThrow({ where: { id: productId }, select: { stock: true } })).stock);
    const invoice = await sale(); const original = await db.invoiceItem.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    const data = { userId, reason: 'integration', items: [{ invoiceItemId: original.id, quantity: 1 }], idempotencyKey: crypto.randomUUID() };
    const results = await Promise.all([service.returnItems(invoice.id, data), service.returnItems(invoice.id, data)]);
    expect(results[0]).toEqual(results[1]);
    expect(await db.return.count({ where: { invoiceId: invoice.id } })).toBe(1);
    expect((await db.invoiceItem.findUniqueOrThrow({ where: { id: original.id } })).returnedQty).toBe(1);
    const rows = await db.payment.findMany({ where: { invoiceId: invoice.id } });
    const state = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(rows.reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0)).toBe(Math.round(Number(state.paidAmount) * 100));
    const alloc = await db.saleAllocation.aggregate({ where: { invoiceItemId: original.id }, _sum: { quantity: true } });
    expect(alloc._sum.quantity).toBe(2);
    expect(Number(original.quantity)).toBe(3);
    expect(Number((await db.product.findUniqueOrThrow({ where: { id: productId }, select: { stock: true } })).stock)).toBe(stockBefore - 2);
  });
  it('rejects competing full returns without stock or monetary over-refund', async () => {
    const invoice = await sale(); const item = await db.invoiceItem.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    const results = await Promise.allSettled([1, 2].map(() => service.returnItems(invoice.id, { userId, reason: 'race', items: [{ invoiceItemId: item.id, quantity: 3 }], idempotencyKey: crypto.randomUUID() })));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const state = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(Number(state.netAmount)).toBe(0); expect(Number(state.returnedAmount)).toBe(.13);
    const rows = await db.returnItem.findMany({ where: { invoiceItemId: item.id } }); expect(rows).toHaveLength(1);
    await expect(db.returnItem.update({ where: { id: rows[0].id }, data: { totalValue: 100 } })).rejects.toThrow();
  });
  it('leaves legacy tax columns untouched while new returns ignore them', async () => {
    const invoice = await sale(); const item = await db.invoiceItem.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    await db.$executeRaw`UPDATE invoices SET tax = 0.02 WHERE id = ${invoice.id}`;
    await db.$executeRaw`UPDATE invoice_items SET allocated_tax = 0.02 WHERE id = ${item.id}`;
    for (let i = 0; i < 3; i++) await service.returnItems(invoice.id, { userId, reason: 'sequential', items: [{ invoiceItemId: item.id, quantity: 1 }], idempotencyKey: crypto.randomUUID() });
    const details: any = await service.getInvoiceDetails(invoice.id);
    expect(details.items).toHaveLength(0); expect(details).not.toHaveProperty('tax');
    expect(Number(details.netAmount)).toBe(0); expect(Number(details.paidAmount)).toBe(.13);
    expect(Number(details.returnedAmount)).toBe(.13);
    expect(details.financialSummary.debtAmount).toBe(0);
    expect(Number((await db.invoiceItem.findUniqueOrThrow({ where: { id: item.id } })).returnedQty)).toBe(3);
    expect(details.originalInvoice.items[0].quantity).toBe(3);
    expect(details.originalInvoice).not.toHaveProperty('tax');
    expect(Number(details.originalInvoice.netAmount)).toBe(.13);
    expect(details.returns).toHaveLength(3);
    expect(details.returns.every((r: any) => r.items.length === 1 && r.payments.length === 0)).toBe(true);
    expect(details.returns.every((r: any) => !Object.hasOwn(r.items[0], 'taxAmount'))).toBe(true);
    const [persisted] = await db.$queryRaw<Array<{ tax: number; allocated_tax: number }>>`
      SELECT i.tax, ii.allocated_tax FROM invoices i JOIN invoice_items ii ON ii.invoice_id = i.id WHERE i.id = ${invoice.id}
    `;
    expect(Number(persisted.tax)).toBe(.02);
    expect(Number(persisted.allocated_tax)).toBe(.02);
    expect(details.payments.filter((p: any) => Number(p.amount) > 0)).toHaveLength(1);
  });
  it('reduces debt without subtracting the original payment on a goods return', async () => {
    const invoice = await service.createInvoice({ customerId, userId, warehouseId, items: [{ productId, quantity: 2, sellingPrice: 100 }], paidAmount: 50, paymentMethod: 'transfer' });
    const item = await db.invoiceItem.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    const result = await service.returnItems(invoice.id, { userId, reason: '', items: [{ invoiceItemId: item.id, quantity: 1 }], idempotencyKey: crypto.randomUUID() });
    expect(result.refundedAmount).toBe(0); expect(result.debtReduction).toBe(100); expect(result.creditAmount).toBe(0);
    const state = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(Number(state.netAmount)).toBe(100); expect(Number(state.paidAmount)).toBe(50);
    expect(await db.payment.count({ where: { invoiceId: invoice.id, amount: { gt: 0 } } })).toBe(1);
    expect(await db.payment.count({ where: { returnId: result.returnId } })).toBe(0);
  });
  async function invokeRoute(router: any, path: string, method: string, body: any, params: any = {}) {
    let output: any; const res: any = { status: () => res, json: (value: any) => { output = value; } };
    const route = router.stack.find((l: any) => l.route?.path === path && l.route.methods[method]).route;
    await route.stack.at(-1).handle({ body, params, user: { id: userId, role: 'ADMIN' } }, res, (e: any) => { throw e; }); return output;
  }
  it('preserves mixed payment history and deduplicates payment retries after a goods return', async () => {
    const router = (await import('../routes/payments.routes.js')).default;
    const invoice = await service.createInvoice({ customerId, userId, warehouseId, items: [{ productId, quantity: 2, sellingPrice: 100 }], paidAmount: 150, paymentMethod: 'cash' });
    const payload = { invoice_id: invoice.id, customer_id: customerId, amount: 50, method: 'card', idempotency_key: crypto.randomUUID() };
    await Promise.all([invokeRoute(router, '/', 'post', payload), invokeRoute(router, '/', 'post', payload)]);
    const item = await db.invoiceItem.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    const result = await service.returnItems(invoice.id, { userId, reason: '', items: [{ invoiceItemId: item.id, quantity: 1 }], idempotencyKey: crypto.randomUUID() });
    expect(result).toMatchObject({ cashRefundAmount: 0, debtReduction: 0, creditAmount: 0 });
    expect(await db.payment.count({ where: { returnId: result.returnId } })).toBe(0);
    expect(await db.payment.count({ where: { invoiceId: invoice.id, amount: { gt: 0 } } })).toBe(2);
    await expect(invokeRoute(router, '/', 'post', { ...payload, amount: 40 })).rejects.toThrow(/different operation/);
    const original = await db.payment.findFirstOrThrow({ where: { invoiceId: invoice.id, amount: 150 } });
    const reversed = await invokeRoute(router, '/:id', 'delete', {}, { id: original.id });
    expect(Number(reversed.invoice.paidAmount)).toBe(50);
    expect(await db.payment.count({ where: { reversalOfId: original.id } })).toBe(1);
  });
  it('reverses ordinary payments by appending a single immutable ledger entry', async () => {
    const router = (await import('../routes/payments.routes.js')).default;
    const invoice = await service.createInvoice({ customerId, userId, warehouseId, items: [{ productId, quantity: 1, sellingPrice: 100 }], paidAmount: 100 });
    const original = await db.payment.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    await invokeRoute(router, '/:id', 'delete', {}, { id: original.id }); await invokeRoute(router, '/:id', 'delete', {}, { id: original.id });
    expect(await db.payment.count({ where: { invoiceId: invoice.id } })).toBe(2);
    expect(Number((await db.payment.findUniqueOrThrow({ where: { id: original.id } })).amount)).toBe(100);
    expect(Number((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).paidAmount)).toBe(0);
    await expect(db.payment.delete({ where: { id: original.id } })).rejects.toThrow();
  });
  it('rejects unknown payment methods without persisting a sale or expense payment', async () => {
    const count = await db.invoice.count();
    await expect(service.createInvoice({ customerId, userId, warehouseId, items: [{ productId, quantity: 1, sellingPrice: 10 }], paidAmount: 1, paymentMethod: 'unknown' })).rejects.toThrow(/payment method/i);
    expect(await db.invoice.count()).toBe(count);
    const router = (await import('../routes/expenses.routes.js')).default;
    const expenseCount = await db.expense.count();
    await expect(invokeRoute(router, '/', 'post', { warehouseId, title: 'Invalid method', amount: 10, paidAmount: 1, paymentMethod: 'unknown', expenseDate: '2026-11-09', idempotency_key: crypto.randomUUID() })).rejects.toThrow(/payment method/i);
    expect(await db.expense.count()).toBe(expenseCount);
    const expense = await invokeRoute(router, '/', 'post', { warehouseId, title: 'Valid unpaid expense', amount: 10, expenseDate: '2026-11-09', idempotency_key: crypto.randomUUID() });
    await expect(invokeRoute(router, '/:id/payments', 'post', { amount: 1, method: 'unknown', idempotency_key: crypto.randomUUID() }, { id: expense.id })).rejects.toThrow(/payment method/i);
    expect(await db.expensePayment.count({ where: { expenseId: expense.id } })).toBe(0);
  });
  it('preserves expense payments and records immutable, idempotent refunds', async () => {
    const router = (await import('../routes/expenses.routes.js')).default;
    const expense = await invokeRoute(router, '/', 'post', { warehouseId, title: 'Integration expense', amount: 100, paidAmount: 100, paymentMethod: 'card', expenseDate: '2026-11-08', idempotency_key: crypto.randomUUID() });
    const payload = { amount: 40, note: 'Refund', idempotency_key: crypto.randomUUID() };
    await invokeRoute(router, '/:id/refunds', 'post', payload, { id: expense.id });
    const result = await invokeRoute(router, '/:id/refunds', 'post', payload, { id: expense.id });
    expect(result.refundedAmount).toBe(40); expect(Number(result.paidAmount)).toBe(60); expect(result.payments).toHaveLength(2);
    expect(result.payments.map((p: any) => Number(p.amount)).sort((a: number, b: number) => b - a)).toEqual([100, -40]);
    expect(await db.expenseRefund.count({ where: { expenseId: expense.id } })).toBe(1);
  });
  it('preserves the initial sale snapshot when an unpaid invoice is revised', async () => {
    const invoice = await service.createInvoice({ customerId, userId, warehouseId, items: [{ productId, quantity: 1, sellingPrice: 100 }] });
    await service.updateInvoice(invoice.id, { customerId, userId, items: [{ productId, quantity: 1, sellingPrice: 150 }] });
    const details: any = await service.getInvoiceDetails(invoice.id);
    expect(Number(details.netAmount)).toBe(150); expect(Number(details.originalInvoice.netAmount)).toBe(100);
    expect(await db.invoiceRevision.count({ where: { invoiceId: invoice.id } })).toBe(1);
  });
  it('rolls back a return completely if stock restoration fails', async () => {
    const invoice = await sale(); const item = await db.invoiceItem.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    await db.saleAllocation.deleteMany({ where: { invoiceItemId: item.id } }); // isolated corruption fixture
    await expect(service.returnItems(invoice.id, { userId, reason: '', items: [{ invoiceItemId: item.id, quantity: 1 }], idempotencyKey: crypto.randomUUID() })).rejects.toThrow(/allocations require reconciliation/);
    expect(await db.return.count({ where: { invoiceId: invoice.id } })).toBe(0);
    expect((await db.invoiceItem.findUniqueOrThrow({ where: { id: item.id } })).returnedQty).toBe(0);
    expect(Number((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).paidAmount)).toBe(.13);
  });
  it('does not leave an orphan invoice if customer-order approval cannot be linked', async () => {
    const router = (await import('../routes/customer-orders.routes.js')).default;
    const order = await db.customerOrder.create({ data: { customerId, userId, warehouseId, note: 'fail-link', totalAmount: 100, items: { create: [{ productId, quantity: 1, sellingPrice: 100 }] } } });
    await db.$executeRawUnsafe(`CREATE FUNCTION fail_test_order_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.note = 'fail-link' AND NEW.status = 'approved' THEN RAISE EXCEPTION 'test order link failure'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe('CREATE TRIGGER test_order_link BEFORE UPDATE ON customer_orders FOR EACH ROW EXECUTE FUNCTION fail_test_order_link()');
    try {
      await expect(invokeRoute(router, '/:id/approve', 'post', {}, { id: order.id })).rejects.toThrow();
      expect(await db.invoice.count({ where: { idempotencyKey: `customer-order:${order.id}` } })).toBe(0);
      expect((await db.customerOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('pending');
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER test_order_link ON customer_orders');
      await db.$executeRawUnsafe('DROP FUNCTION fail_test_order_link()');
    }
  });
});
