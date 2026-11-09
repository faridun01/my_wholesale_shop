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

suite('invoice list: server-side paging, search, filters and sorting', () => {
  let db: PrismaClient;
  let server: Server;
  let baseUrl: string;
  let warehouseId: number, adminId: number, sellerId: number, alexeyId: number, borisId: number, otherWarehouseId: number;
  const ids: Record<string, number> = {};

  const makeInvoice = async (key: string, data: { net: number; paid?: number; status?: string; customerId?: number; snapshot?: string | null; userId?: number; createdAt: string; warehouseId?: number; cancelled?: boolean }) => {
    const invoice = await db.invoice.create({ data: {
      customerId: data.customerId ?? alexeyId,
      userId: data.userId ?? adminId,
      warehouseId: data.warehouseId ?? warehouseId,
      totalAmount: data.net,
      netAmount: data.net,
      paidAmount: data.paid ?? 0,
      status: data.status ?? 'unpaid',
      cancelled: data.cancelled ?? false,
      customerNameSnapshot: data.snapshot === undefined ? 'Алексей' : data.snapshot,
      createdAt: new Date(data.createdAt),
    } });
    ids[key] = invoice.id;
    return invoice;
  };
  const pay = (invoiceId: number, amount: number, method = 'cash') =>
    db.payment.create({ data: { customerId: alexeyId, invoiceId, userId: adminId, amount, method } });

  const list = async (query: Record<string, string | number>, role = 'ADMIN', actorId = adminId) => {
    const params = new URLSearchParams({ warehouseId: String(warehouseId), ...Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)])) });
    const response = await fetch(`${baseUrl}/invoices?${params}`, { headers: { 'x-test-role': role, 'x-test-user': String(actorId) } });
    expect(response.status).toBe(200);
    return { rows: await response.json() as any[], total: Number(response.headers.get('x-total-count')), hasMore: response.headers.get('x-has-more') };
  };
  const listIds = async (query: Record<string, string | number>) => (await list({ limit: 100, ...query })).rows.map((row) => row.id);
  const named = (...keys: string[]) => keys.map((key) => ids[key]);

  beforeAll(async () => {
    const parsed = new URL(testUrl!);
    if (!parsed.pathname.endsWith('_financial_test')) throw new Error('Refusing a non-isolated financial test database');
    db = new PrismaClient({ datasources: { db: { url: testUrl! } } });
    (globalThis as any).prisma = db;

    const stamp = crypto.randomUUID();
    warehouseId = (await db.warehouse.create({ data: { name: `List ${stamp}` } })).id;
    otherWarehouseId = (await db.warehouse.create({ data: { name: `List other ${stamp}` } })).id;
    adminId = (await db.user.create({ data: { username: `a-${stamp}`, passwordHash: 'test-only', role: 'ADMIN', warehouseId } })).id;
    sellerId = (await db.user.create({ data: { username: `b-${stamp}`, passwordHash: 'test-only', role: 'SELLER', warehouseId } })).id;
    alexeyId = (await db.customer.create({ data: { name: `Алексей ${stamp}` } })).id;
    borisId = (await db.customer.create({ data: { name: 'Борис' } })).id;

    await makeInvoice('unpaid', { net: 300, createdAt: '2026-10-01T10:00:00Z' });
    const partial = await makeInvoice('partial', { net: 100, paid: 40, status: 'partial', customerId: borisId, snapshot: 'Борис', createdAt: '2026-10-02T10:00:00Z' });
    await pay(partial.id, 40);
    const paid = await makeInvoice('paid', { net: 200, paid: 200, status: 'paid', userId: sellerId, snapshot: 'Скидка 100% оптом', createdAt: '2026-10-03T10:00:00Z' });
    await pay(paid.id, 200);
    // The stored status is stale: payments say it is settled, as the table's badge does.
    const stale = await makeInvoice('stale', { net: 50, paid: 50, status: 'unpaid', snapshot: null, customerId: borisId, createdAt: '2026-10-04T10:00:00Z' });
    await pay(stale.id, 50);
    // A legacy goods-return adjustment must not count against the money received.
    const adjusted = await makeInvoice('adjusted', { net: 80, paid: 80, status: 'paid', createdAt: '2026-10-05T10:00:00Z' });
    await pay(adjusted.id, 80);
    await pay(adjusted.id, -30, 'refund');
    // 2026-10-05 21:30 UTC is already 2026-10-06 in UTC+5.
    await makeInvoice('lateUtc', { net: 10, createdAt: '2026-10-05T21:30:00Z' });
    await makeInvoice('cancelled', { net: 999, cancelled: true, createdAt: '2026-10-07T10:00:00Z' });
    await makeInvoice('elsewhere', { net: 999, warehouseId: otherWarehouseId, createdAt: '2026-10-07T10:00:00Z' });

    const app = express();
    app.set('json replacer', financialJsonReplacer);
    app.use((req, _res, next) => {
      (req as any).user = { id: Number(req.headers['x-test-user']), role: req.headers['x-test-role'], warehouseId };
      next();
    });
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

  it('keeps the default newest-first order and excludes cancelled and other-warehouse invoices', async () => {
    expect(await listIds({})).toEqual(named('lateUtc', 'adjusted', 'stale', 'paid', 'partial', 'unpaid'));
  });

  it('pages without repeating or losing rows and reports the filtered total', async () => {
    const first = await list({ limit: 4, page: 1, sort: 'customer_name', order: 'asc' });
    const second = await list({ limit: 4, page: 2, sort: 'customer_name', order: 'asc' });
    expect(first.total).toBe(6);
    expect(first.hasMore).toBe('true');
    expect(second.hasMore).toBe('false');
    expect(first.rows).toHaveLength(4);
    expect(second.rows).toHaveLength(2);
    expect(new Set([...first.rows, ...second.rows].map((row) => row.id)).size).toBe(6);
  });

  it('searches names case-insensitively, including the fallback to the customer record', async () => {
    expect(await listIds({ search: 'алЕКсей' })).toEqual(named('lateUtc', 'adjusted', 'unpaid'));
    expect(await listIds({ search: 'борис' })).toEqual(named('stale', 'partial'));
  });

  it('searches invoice numbers by substring and treats LIKE wildcards literally', async () => {
    expect(await listIds({ search: String(ids.paid) })).toContain(ids.paid);
    expect(await listIds({ search: '100%' })).toEqual(named('paid'));
    expect(await listIds({ search: '%' })).toEqual(named('paid'));
    expect(await listIds({ search: '_' })).toEqual([]);
  });

  it('filters on the payment status shown in the table rather than the stored field', async () => {
    expect(await listIds({ paymentStatus: 'paid' })).toEqual(named('adjusted', 'stale', 'paid'));
    expect(await listIds({ paymentStatus: 'partial' })).toEqual(named('partial'));
    expect(await listIds({ paymentStatus: 'unpaid' })).toEqual(named('lateUtc', 'unpaid'));
    expect((await list({ paymentStatus: 'paid', limit: 1 })).total).toBe(3);
  });

  it('sorts by derived money columns', async () => {
    // Debts: unpaid 300, partial 60, lateUtc 10, the settled three 0 (newest first).
    expect(await listIds({ sort: 'balance', order: 'desc' })).toEqual(named('unpaid', 'partial', 'lateUtc', 'adjusted', 'stale', 'paid'));
    // Money received: paid 200, adjusted 80, stale 50, partial 40, the rest 0.
    expect(await listIds({ sort: 'paidAmount', order: 'desc' })).toEqual(named('paid', 'adjusted', 'stale', 'partial', 'lateUtc', 'unpaid'));
    expect(await listIds({ sort: 'netAmount', order: 'asc' })).toEqual(named('lateUtc', 'stale', 'adjusted', 'partial', 'paid', 'unpaid'));
  });

  it('ignores an unknown sort key instead of interpolating it', async () => {
    expect(await listIds({ sort: 'id; DROP TABLE invoices', order: 'sideways' })).toEqual(named('lateUtc', 'adjusted', 'stale', 'paid', 'partial', 'unpaid'));
  });

  it('applies exact day boundaries from the browser, whatever the server time zone', async () => {
    // The UTC+5 calendar day 2026-10-06.
    expect(await listIds({ from: '2026-10-05T19:00:00.000Z', to: '2026-10-06T18:59:59.999Z' })).toEqual(named('lateUtc'));
    // The UTC+5 calendar day 2026-10-05 excludes that invoice but keeps the morning one.
    expect(await listIds({ from: '2026-10-04T19:00:00.000Z', to: '2026-10-05T18:59:59.999Z' })).toEqual(named('adjusted'));
    expect(await listIds({ from: 'not-a-date' })).toHaveLength(6);
  });

  it('combines filters and keeps the admin-only staff filter', async () => {
    expect(await listIds({ userId: sellerId })).toEqual(named('paid'));
    expect(await listIds({ userId: adminId, paymentStatus: 'paid', search: 'алексей' })).toEqual(named('adjusted'));
  });

  it('pins a seller to their own invoices through search, sort and userId', async () => {
    const seller = await list({ search: 'а', userId: adminId, sort: 'balance', limit: 100 }, 'SELLER', sellerId);
    expect(seller.rows.map((row) => row.id)).toEqual(named('paid'));
    expect(seller.total).toBe(1);
    expect(seller.rows[0]).not.toHaveProperty('totalProfit');
  });

  it('returns the same row shape as before', async () => {
    const [row] = (await list({ search: String(ids.adjusted), limit: 1 })).rows;
    expect(row).toMatchObject({ id: ids.adjusted, customer_name: 'Алексей', balancePaidAmount: '80', grossPaidAmount: '80', returnPaymentAdjustments: '30' });
    expect(row.totalProfit).toBeDefined();
  });

  it('reports list metadata for the whole warehouse, independent of filters', async () => {
    const response = await fetch(`${baseUrl}/invoices/list-meta?warehouseId=${warehouseId}`, { headers: { 'x-test-role': 'ADMIN', 'x-test-user': String(adminId) } });
    const meta = await response.json();
    expect(meta.total).toBe(6);
    expect(meta.staff.map((staff: any) => staff.id)).toEqual([adminId, sellerId]);
    expect(Object.keys(meta.staff[0]).sort()).toEqual(['id', 'username']);
  });
});
