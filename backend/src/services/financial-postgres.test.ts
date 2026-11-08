import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
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
