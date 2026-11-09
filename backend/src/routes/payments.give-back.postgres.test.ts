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

suite('recording money given back to the buyer', () => {
  let db: PrismaClient;
  let server: Server;
  let baseUrl: string;
  let warehouseId: number, adminId: number, customerId: number;

  const makeInvoice = async (net: number, paid: number, returned: number, options: { cancelled?: boolean } = {}) => {
    const invoice = await db.invoice.create({ data: { customerId, userId: adminId, warehouseId, totalAmount: net + returned, netAmount: net, paidAmount: paid, returnedAmount: returned, status: 'paid', cancelled: options.cancelled ?? false } });
    if (paid) await db.payment.create({ data: { customerId, invoiceId: invoice.id, userId: adminId, amount: paid, method: 'cash' } });
    return invoice.id;
  };
  const giveBack = async (body: Record<string, unknown>, role = 'ADMIN') => {
    const response = await fetch(`${baseUrl}/payments/give-back`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-role': role },
      body: JSON.stringify({ idempotency_key: crypto.randomUUID(), method: 'cash', ...body }),
    });
    return { status: response.status, data: await response.json() as any };
  };
  const ledger = (invoiceId: number) => db.payment.findMany({ where: { invoiceId }, orderBy: { id: 'asc' } });
  const paidOf = async (invoiceId: number) => Number((await db.invoice.findUnique({ where: { id: invoiceId } }))!.paidAmount);

  beforeAll(async () => {
    const parsed = new URL(testUrl!);
    if (!parsed.pathname.endsWith('_financial_test')) throw new Error('Refusing a non-isolated financial test database');
    db = new PrismaClient({ datasources: { db: { url: testUrl! } } });
    (globalThis as any).prisma = db;

    const stamp = crypto.randomUUID();
    warehouseId = (await db.warehouse.create({ data: { name: `Give back ${stamp}` } })).id;
    adminId = (await db.user.create({ data: { username: `g-${stamp}`, passwordHash: 'test-only', role: 'ADMIN', warehouseId } })).id;
    customerId = (await db.customer.create({ data: { name: `Give back ${stamp}` } })).id;

    const app = express();
    app.set('json replacer', financialJsonReplacer);
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: adminId, role: req.headers['x-test-role'], warehouseId };
      next();
    });
    app.use('/payments', (await import('./payments.routes.js')).default);
    app.use('/invoices', (await import('./invoices.routes.js')).default);
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

  it('adds a separate entry, keeps the received payment and clears what is owed', async () => {
    const id = await makeInvoice(270, 324, 270);
    const result = await giveBack({ invoice_id: id, amount: '54', method: 'card' });

    expect(result.status).toBe(201);
    const entries = await ledger(id);
    expect(entries.map((p) => [Number(p.amount), p.method])).toEqual([[324, 'cash'], [-54, 'card']]);
    expect(await paidOf(id)).toBe(270);
    expect((await db.invoice.findUnique({ where: { id } }))!.status).toBe('paid');

    const response = await fetch(`${baseUrl}/invoices/${id}`, { headers: { 'x-test-role': 'ADMIN' } });
    const detail = await response.json() as any;
    expect(detail).toMatchObject({ balancePaidAmount: '270', moneyRefundedAmount: '54', grossPaidAmount: '324' });
  });

  it('allows handing the money back in parts, up to what is owed', async () => {
    const id = await makeInvoice(270, 324, 270);
    expect((await giveBack({ invoice_id: id, amount: 20 })).status).toBe(201);
    expect((await giveBack({ invoice_id: id, amount: 34.01 })).status).toBe(400);
    expect(await paidOf(id)).toBe(304);
    expect((await giveBack({ invoice_id: id, amount: 34 })).status).toBe(201);
    expect(await paidOf(id)).toBe(270);
    expect((await giveBack({ invoice_id: id, amount: 0.01 })).status).toBe(400);
  });

  it('refuses invoices with nothing to give back and leaves them untouched', async () => {
    const debt = await makeInvoice(405, 324, 135);
    const settled = await makeInvoice(100, 100, 0);

    for (const id of [debt, settled]) {
      const before = await paidOf(id);
      expect((await giveBack({ invoice_id: id, amount: 1 })).status).toBe(400);
      expect(await paidOf(id)).toBe(before);
      expect(await ledger(id)).toHaveLength(1);
    }
  });

  it('also settles an overpayment left by a legacy invoice edit, with no goods return', async () => {
    const id = await makeInvoice(38361.14, 38533.94, 0);
    expect((await giveBack({ invoice_id: id, amount: 172.81 })).status).toBe(400);
    expect((await giveBack({ invoice_id: id, amount: 172.8 })).status).toBe(201);
    expect(await paidOf(id)).toBe(38361.14);
  });

  it('records no money operation on a cancelled invoice', async () => {
    const id = await makeInvoice(1260, 1260, 0, { cancelled: true });
    expect((await giveBack({ invoice_id: id, amount: 1260 })).status).toBe(400);
    expect(await paidOf(id)).toBe(1260);
    expect(await ledger(id)).toHaveLength(1);
  });

  it('is admin-only and validates input', async () => {
    const id = await makeInvoice(270, 324, 270);
    expect((await giveBack({ invoice_id: id, amount: 54 }, 'SELLER')).status).toBe(403);
    expect((await giveBack({ invoice_id: id, amount: 54, method: 'crypto' })).status).toBe(400);
    expect((await giveBack({ invoice_id: id, amount: -5 })).status).toBe(400);
    expect((await giveBack({ invoice_id: id, amount: 0 })).status).toBe(400);
    expect(await ledger(id)).toHaveLength(1);
  });

  it('does not record a repeated submit twice and rejects a reused key', async () => {
    const id = await makeInvoice(270, 324, 270);
    const key = crypto.randomUUID();
    expect((await giveBack({ invoice_id: id, amount: 10, idempotency_key: key })).status).toBe(201);
    expect((await giveBack({ invoice_id: id, amount: 10, idempotency_key: key })).status).toBe(201);
    expect(await ledger(id)).toHaveLength(2);
    expect((await giveBack({ invoice_id: id, amount: 11, idempotency_key: key })).status).toBe(409);
    expect(await paidOf(id)).toBe(314);
  });

  it('lets only one of two simultaneous submits take the full amount', async () => {
    const id = await makeInvoice(270, 324, 270);
    const results = await Promise.all([giveBack({ invoice_id: id, amount: 54 }), giveBack({ invoice_id: id, amount: 54 })]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(await paidOf(id)).toBe(270);
  });

  it('keeps the entry itself immutable and not cancellable', async () => {
    const id = await makeInvoice(270, 324, 270);
    const { data } = await giveBack({ invoice_id: id, amount: 54 });
    const response = await fetch(`${baseUrl}/payments/${data.id}`, { method: 'DELETE', headers: { 'x-test-role': 'ADMIN' } });
    expect(response.status).toBeGreaterThanOrEqual(400);
    await expect(db.payment.delete({ where: { id: data.id } })).rejects.toThrow();
    expect(await paidOf(id)).toBe(270);
  });
});
