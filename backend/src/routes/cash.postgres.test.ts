import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { financialJsonReplacer } from '../utils/financial.js';

// Never uses DATABASE_URL: runs only against the isolated *_financial_test database
// provisioned by scripts/test-financial-postgres.mjs.
const testUrl = process.env.FINANCIAL_TEST_DATABASE_URL;
const suite = testUrl ? describe : describe.skip;

suite('staff cash: taken from clients, sent to an administrator, confirmed', () => {
  let db: PrismaClient;
  let server: Server;
  let baseUrl: string;
  let warehouseId: number, otherWarehouseId: number, adminId: number;

  const call = async (as: number, method: string, path: string, body?: unknown) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-test-user': String(as) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() as any };
  };
  const key = () => `cash-${crypto.randomUUID()}`;
  const newSeller = async (canAcceptPayments = true) =>
    (await db.user.create({ data: { username: `seller-${crypto.randomUUID()}`, passwordHash: 'test-only', role: 'SELLER', warehouseId, canAcceptPayments } })).id;
  const newInvoice = async (net: number, warehouse = warehouseId) => {
    const customer = await db.customer.create({ data: { name: `Клиент ${crypto.randomUUID()}` } });
    const invoice = await db.invoice.create({ data: { customerId: customer.id, userId: adminId, warehouseId: warehouse, totalAmount: net, netAmount: net, discount: 0 } });
    return { invoiceId: invoice.id, customerId: customer.id, customerName: customer.name };
  };
  const pay = (as: number, invoiceId: number, amount: number | string, extra: Record<string, unknown> = {}) =>
    call(as, 'POST', '/payments', { invoice_id: invoiceId, amount, idempotency_key: key(), ...extra });
  const mine = async (as: number) => (await call(as, 'GET', '/cash/me')).data;

  beforeAll(async () => {
    const parsed = new URL(testUrl!);
    if (!parsed.pathname.endsWith('_financial_test')) throw new Error('Refusing a non-isolated financial test database');
    db = new PrismaClient({ datasources: { db: { url: testUrl! } } });
    (globalThis as any).prisma = db;
    const stamp = crypto.randomUUID();
    warehouseId = (await db.warehouse.create({ data: { name: `Cash ${stamp}` } })).id;
    otherWarehouseId = (await db.warehouse.create({ data: { name: `Cash other ${stamp}` } })).id;
    adminId = (await db.user.create({ data: { username: `cash-admin-${stamp}`, passwordHash: 'test-only', role: 'ADMIN', warehouseId } })).id;

    const app = express();
    app.set('json replacer', financialJsonReplacer);
    app.use(express.json());
    // Stands in for the real authenticate middleware: the user and grants come from the database.
    app.use(async (req, _res, next) => {
      const user = await db.user.findUniqueOrThrow({ where: { id: Number(req.headers['x-test-user']) } });
      (req as any).user = { id: user.id, username: user.username, role: user.role, warehouseId: user.warehouseId ?? undefined, canAcceptPayments: user.canAcceptPayments };
      next();
    });
    app.use('/payments', (await import('./payments.routes.js')).default);
    app.use('/cash', (await import('./cash.routes.js')).default);
    app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status || 500).json({ error: error.message }));
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterAll(async () => {
    server?.close();
    await db?.$disconnect();
    delete (globalThis as any).prisma;
  });

  it('lets a seller with the grant take money once, only for invoices of their warehouse', async () => {
    const ali = await newSeller();
    const withoutGrant = await newSeller(false);
    const a = await newInvoice(500);
    const elsewhere = await newInvoice(100, otherWarehouseId);

    expect((await pay(withoutGrant, a.invoiceId, 10)).status).toBe(403);
    expect((await call(ali, 'POST', '/payments', { customer_id: a.customerId, amount: 10, idempotency_key: key() })).status).toBe(400);
    expect((await pay(ali, elsewhere.invoiceId, 10)).status).toBe(403);
    expect((await pay(ali, a.invoiceId, 600)).status).toBe(400);

    const repeatKey = key();
    const first = await pay(ali, a.invoiceId, 500, { idempotency_key: repeatKey, method: 'transfer' });
    const again = await pay(ali, a.invoiceId, 500, { idempotency_key: repeatKey, method: 'transfer' });
    expect([first.status, again.status, again.data.id, first.data.method]).toEqual([201, 201, first.data.id, 'cash']);
    expect(await db.payment.count({ where: { invoiceId: a.invoiceId } })).toBe(1);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: a.invoiceId } })).status).toBe('paid');

    expect((await call(ali, 'GET', `/cash/debtors?search=${encodeURIComponent(elsewhere.customerName)}`)).data).toEqual([]);
    const b = await newInvoice(1200);
    const found = (await call(ali, 'GET', `/cash/debtors?search=${b.invoiceId}`)).data;
    expect(Object.keys(found[0]).sort()).toEqual(['debt', 'id', 'invoices', 'name', 'phone']);
    expect(found[0].debt).toBe('1200');
    expect((await call(withoutGrant, 'GET', '/cash/debtors')).status).toBe(403);

    for (const path of ['/cash/staff', '/cash/handovers', '/cash/pending-count']) expect((await call(ali, 'GET', path)).status).toBe(403);
    expect((await call(ali, 'DELETE', `/payments/${first.data.id}`)).status).toBe(403);
    const me = await mine(ali);
    expect(me.operations.map((op: any) => op.paymentId)).toEqual([first.data.id]);
    expect([me.summary.today, me.summary.onHand]).toEqual([500, 500]);
    expect(await db.auditLog.count({ where: { action: 'PAYMENT_ACCEPTED', entityId: first.data.id } })).toBe(1);
  });

  it('sends 500 + 1200 + 800 = 2500 for confirmation; the administrator confirms once', async () => {
    const ali = await newSeller();
    const invoices = await Promise.all([500, 1200, 800].map((net) => newInvoice(net)));
    const paid = [];
    for (const [index, amount] of [500, 1200, 800].entries()) paid.push((await pay(ali, invoices[index].invoiceId, amount)).data.id);
    const ownPayments = () => db.payment.count({ where: { invoiceId: { in: invoices.map((i) => i.invoiceId) } } });

    let me = await mine(ali);
    expect([me.summary.today, me.summary.onHand]).toEqual([2500, 2500]);
    expect(me.operations.filter((op: any) => op.available).map((op: any) => op.paymentId).sort()).toEqual([...paid].sort());

    const pendingBefore = (await call(adminId, 'GET', '/cash/pending-count')).data.count;
    const sendKey = key();
    const sent = await call(ali, 'POST', '/cash/handovers', { paymentIds: paid, idempotencyKey: sendKey });
    expect([sent.status, sent.data.amount, sent.data.status]).toEqual([201, '2500', 'pending']);
    expect((await call(ali, 'POST', '/cash/handovers', { paymentIds: paid, idempotencyKey: sendKey })).data.id).toBe(sent.data.id);
    expect((await call(ali, 'POST', '/cash/handovers', { paymentIds: [paid[0]], idempotencyKey: key() })).status).toBe(409);
    expect((await call(adminId, 'GET', '/cash/pending-count')).data.count).toBe(pendingBefore + 1);
    me = await mine(ali);
    expect([me.summary.onHand, me.summary.pendingAmount, me.summary.pendingCount]).toEqual([0, 2500, 1]);

    expect((await call(adminId, 'DELETE', `/payments/${paid[0]}`)).status).toBe(409);
    expect((await call(ali, 'POST', `/cash/handovers/${sent.data.id}/confirm`)).status).toBe(403);
    const listed = (await call(adminId, 'GET', '/cash/handovers?status=pending')).data.find((h: any) => h.id === sent.data.id);
    expect([listed.user.id, listed.items.length]).toEqual([ali, 3]);

    const confirmed = await call(adminId, 'POST', `/cash/handovers/${sent.data.id}/confirm`);
    const repeated = await call(adminId, 'POST', `/cash/handovers/${sent.data.id}/confirm`);
    expect([confirmed.data.status, confirmed.data.confirmedById, repeated.status, repeated.data.status]).toEqual(['confirmed', adminId, 200, 'confirmed']);
    me = await mine(ali);
    expect([me.summary.onHand, me.summary.pendingAmount, me.summary.confirmed]).toEqual([0, 0, 2500]);
    expect(await ownPayments()).toBe(3);
    expect(await db.auditLog.count({ where: { entity: 'CashHandover', entityId: sent.data.id } })).toBe(2);
    await expect(db.cashHandover.update({ where: { id: sent.data.id }, data: { amount: 1 } })).rejects.toThrow();
    await expect(db.cashHandoverItem.deleteMany({ where: { handoverId: sent.data.id } })).rejects.toThrow();

    // Cancelled after it was handed over: the administrator returns it, the seller owes nothing more.
    expect((await call(adminId, 'DELETE', `/payments/${paid[0]}`)).status).toBe(200);
    expect((await mine(ali)).summary.onHand).toBe(0);
    const row = (await call(adminId, 'GET', '/cash/staff')).data.find((s: any) => s.id === ali);
    expect([row.onHand, row.pendingAmount, row.confirmed]).toEqual([0, 0, 2500]);
  });

  it('keeps exact kopecks and drops a payment cancelled before it was sent', async () => {
    const ali = await newSeller();
    const invoice = await newInvoice(40);
    const small = (await pay(ali, invoice.invoiceId, '0.1')).data.id;
    const small2 = (await pay(ali, invoice.invoiceId, '0.2')).data.id;
    expect((await call(ali, 'POST', '/cash/handovers', { paymentIds: [small, small2], idempotencyKey: key() })).data.amount).toBe('0.3');

    const mistaken = (await pay(ali, invoice.invoiceId, 10)).data.id;
    expect((await mine(ali)).summary.onHand).toBe(10);
    expect((await call(adminId, 'DELETE', `/payments/${mistaken}`)).status).toBe(200);
    const me = await mine(ali);
    expect([me.summary.onHand, me.operations.find((op: any) => op.paymentId === mistaken).available]).toEqual([0, false]);
    expect((await call(ali, 'POST', '/cash/handovers', { paymentIds: [mistaken], idempotencyKey: key() })).status).toBe(409);
    expect((await call(adminId, 'POST', '/cash/handovers', { paymentIds: [small], idempotencyKey: key() })).status).toBe(400);
  });
});
