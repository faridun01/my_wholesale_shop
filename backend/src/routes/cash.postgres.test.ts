import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import { once } from 'node:events';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
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
    app.use('/invoices', (await import('./invoices.routes.js')).default);
    app.use('/auth', (await import('./auth.routes.js')).default);
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

  it('will not make a staff member an administrator, a customer or inactive while they hold cash', async () => {
    const ali = await newSeller();
    const invoice = await newInvoice(300);
    const paymentId = (await pay(ali, invoice.invoiceId, 300)).data.id;
    // The user routes use the real sign-in check, so they get a real administrator token.
    const token = jwt.sign({ id: adminId }, process.env.JWT_SECRET!, { issuer: process.env.JWT_ISSUER || 'my-wholesale-shop', audience: process.env.JWT_AUDIENCE || 'my-wholesale-shop-users' });
    const asAdmin = async (method: string, body?: unknown) => {
      const response = await fetch(`${baseUrl}/auth/users/${ali}`, { method, headers: { 'Content-Type': 'application/json', 'x-test-user': String(adminId), Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: response.status, data: await response.json() as any };
    };

    const promoted = await asAdmin('PUT', { role: 'ADMIN' });
    expect([promoted.status, promoted.data.error]).toEqual([409, expect.stringContaining('на руках 300,00')]);
    expect((await asAdmin('PUT', { active: false })).status).toBe(409);
    expect((await asAdmin('DELETE')).status).toBe(409);
    expect((await asAdmin('PUT', { role: 'MANAGER' })).status).toBe(200);

    const sent = (await call(ali, 'POST', '/cash/handovers', { paymentIds: [paymentId], idempotencyKey: key() })).data;
    expect((await asAdmin('PUT', { role: 'ADMIN' })).data.error).toContain('ждёт подтверждения 300,00');
    await call(adminId, 'POST', `/cash/handovers/${sent.id}/confirm`);
    expect((await asAdmin('PUT', { role: 'ADMIN' })).status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: ali } })).role).toBe('ADMIN');
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

  it('serializes a cash handover against reversal of its payment', async () => {
    const seller = await newSeller();
    const invoice = await newInvoice(200);
    const paymentId = (await pay(seller, invoice.invoiceId, 200)).data.id;
    let release!: () => void, ready!: () => void;
    const hold = new Promise<void>(resolve => { release = resolve; });
    const locked = new Promise<void>(resolve => { ready = resolve; });
    const blocker = db.$transaction(async tx => {
      await tx.$executeRawUnsafe('LOCK TABLE cash_handovers IN SHARE MODE');
      ready(); await hold;
    }, { timeout: 15000 });
    await locked;
    const sent = call(seller, 'POST', '/cash/handovers', { paymentIds: [paymentId], idempotencyKey: key() });
    try {
      let waiting = false;
      for (let attempt = 0; attempt < 150; attempt++) {
        const rows = await db.$queryRaw<Array<{ count: number }>>`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%INSERT INTO%cash_handovers%'`;
        if (rows[0].count > 0) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
      const reversal = call(adminId, 'DELETE', `/payments/${paymentId}`);
      // Let the reversal reach its lock/check while the handover INSERT is held.
      await new Promise(resolve => setTimeout(resolve, 100));
      release(); await blocker;
      expect([(await sent).status, (await reversal).status]).toEqual([201, 409]);
      expect(await db.payment.count({ where: { reversalOfId: paymentId } })).toBe(0);
    } finally { release(); await blocker; await sent; }
  });

  it('returns a handover: the seller takes back a waiting one, an administrator any with a reason, and the money can be sent again', async () => {
    const ali = await newSeller();
    const bob = await newSeller();
    const invoice = await newInvoice(1000);
    const first = (await pay(ali, invoice.invoiceId, 300)).data.id;
    const second = (await pay(ali, invoice.invoiceId, 200)).data.id;

    const waiting = (await call(ali, 'POST', '/cash/handovers', { paymentIds: [first, second], idempotencyKey: key() })).data;
    expect((await call(bob, 'POST', `/cash/handovers/${waiting.id}/return`, {})).status).toBe(404);
    const takenBack = await call(ali, 'POST', `/cash/handovers/${waiting.id}/return`, {});
    expect([takenBack.status, takenBack.data.status, takenBack.data.returnReason]).toEqual([200, 'returned', 'Отозвано сотрудником']);
    expect((await call(adminId, 'POST', `/cash/handovers/${waiting.id}/confirm`)).status).toBe(409);
    let me = await mine(ali);
    expect([me.summary.onHand, me.summary.pendingAmount, me.operations.filter((op: any) => op.available).length]).toEqual([500, 0, 2]);

    // The seller now sends only part; the administrator confirms it by mistake and returns it.
    const partial = (await call(ali, 'POST', '/cash/handovers', { paymentIds: [first], idempotencyKey: key() })).data;
    await call(adminId, 'POST', `/cash/handovers/${partial.id}/confirm`);
    expect((await call(ali, 'POST', `/cash/handovers/${partial.id}/return`, {})).status).toBe(409);
    expect((await call(adminId, 'POST', `/cash/handovers/${partial.id}/return`, {})).status).toBe(400);
    const undone = await call(adminId, 'POST', `/cash/handovers/${partial.id}/return`, { reason: 'Деньги не получены' });
    expect([undone.data.status, undone.data.returnedById, undone.data.confirmedById]).toEqual(['returned', adminId, adminId]);
    me = await mine(ali);
    expect([me.summary.onHand, me.summary.confirmed]).toEqual([500, 0]);
    expect(me.handovers.find((h: any) => h.id === partial.id)).toMatchObject({ status: 'returned', returnReason: 'Деньги не получены', returnedBy: { id: adminId } });
    await expect(db.cashHandover.update({ where: { id: partial.id }, data: { status: 'confirmed' } })).rejects.toThrow();
    await expect(db.cashHandoverItem.updateMany({ where: { handoverId: partial.id }, data: { active: true } })).rejects.toThrow();

    const again = await call(ali, 'POST', '/cash/handovers', { paymentIds: [first, second], idempotencyKey: key() });
    expect(again.status).toBe(201);
    await call(adminId, 'POST', `/cash/handovers/${again.data.id}/confirm`);
    expect((await mine(ali)).summary).toMatchObject({ onHand: 0, pendingAmount: 0, confirmed: 500 });

    const events = (await call(adminId, 'GET', `/invoices/${invoice.invoiceId}/history`)).data.events.map((e: any) => e.type);
    expect(events.filter((t: string) => t === 'cash_handover_returned')).toHaveLength(2);
    expect(events.filter((t: string) => t === 'payment')).toHaveLength(2);
    expect(await db.auditLog.count({ where: { action: 'CASH_HANDOVER_RETURNED', entityId: { in: [waiting.id, partial.id] } } })).toBe(2);
    expect(Number((await db.invoice.findUniqueOrThrow({ where: { id: invoice.invoiceId } })).paidAmount)).toBe(500);
  });

  it('tells open pages at once: the administrator about every staff member, a seller only about their own cash', async () => {
    const ali = await newSeller();
    const bob = await newSeller();
    const listen = async (as: number) => {
      const controller = new AbortController();
      const response = await fetch(`${baseUrl}/cash/events`, { headers: { 'x-test-user': String(as) }, signal: controller.signal });
      const events: any[] = [];
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      void (async () => {
        let buffer = '';
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
              const data = buffer.slice(0, end).split('\n').find((line) => line.startsWith('data: '));
              buffer = buffer.slice(end + 2);
              if (data) events.push(JSON.parse(data.slice(6)));
            }
          }
        } catch { /* aborted */ }
      })();
      return { events, headers: response.headers, stop: () => controller.abort() };
    };
    const until = async (condition: () => boolean) => {
      for (let i = 0; i < 100 && !condition(); i += 1) await new Promise((resolve) => setTimeout(resolve, 20));
      return condition();
    };
    const admin = await listen(adminId);
    const aliPage = await listen(ali);
    const bobPage = await listen(bob);
    try {
      expect(admin.headers.get('content-type')).toContain('text/event-stream');
      expect(admin.headers.get('cache-control')).toContain('no-transform');
      const invoice = await newInvoice(100);
      const paymentId = (await pay(ali, invoice.invoiceId, 100)).data.id;
      const sent = (await call(ali, 'POST', '/cash/handovers', { paymentIds: [paymentId], idempotencyKey: key() })).data;
      expect(await until(() => admin.events.some((e) => e.type === 'handover_sent' && e.handoverId === sent.id))).toBe(true);
      expect(admin.events.find((e) => e.type === 'handover_sent')).toMatchObject({ userId: ali, amount: 100 });
      await call(adminId, 'POST', `/cash/handovers/${sent.id}/confirm`);
      expect(await until(() => aliPage.events.some((e) => e.type === 'handover_confirmed' && e.handoverId === sent.id))).toBe(true);
      expect(aliPage.events.map((e) => e.type)).toEqual(['payment_accepted', 'handover_sent', 'handover_confirmed']);
      expect(bobPage.events.filter((e) => e.userId === ali)).toEqual([]);
    } finally {
      admin.stop(); aliPage.stop(); bobPage.stop();
    }
  });

  it('records three receipts and a single invoice-specific handover and confirmation without paying twice', async () => {
    const seller = await newSeller();
    const invoice = await newInvoice(1000);
    const other = await newInvoice(42);
    const ids: number[] = [];
    for (let i = 0; i < 3; i++) ids.push((await pay(seller, invoice.invoiceId, 200)).data.id);
    ids.push((await pay(seller, other.invoiceId, 42)).data.id);
    const history = async () => (await call(adminId, 'GET', `/invoices/${invoice.invoiceId}/history`)).data.events;
    expect((await history()).filter((e: any) => e.type === 'payment')).toHaveLength(3);
    const sent = (await call(seller, 'POST', '/cash/handovers', { paymentIds: ids, idempotencyKey: key() })).data;
    expect(Number(sent.amount)).toBe(642);
    const pendingEvents = await history();
    expect(pendingEvents.filter((e: any) => e.type === 'cash_handover_sent')).toEqual([
      expect.objectContaining({ handoverId: sent.id, amount: '600', paymentIds: ids.slice(0, 3), user: expect.any(String) }),
    ]);
    expect(pendingEvents.some((e: any) => e.type === 'cash_handover_confirmed')).toBe(false);
    const confirmed = await Promise.all([1, 2].map(() => call(adminId, 'POST', `/cash/handovers/${sent.id}/confirm`)));
    expect(confirmed.map(r => r.status)).toEqual([200, 200]);
    const events = await history();
    expect(events.filter((e: any) => e.type === 'payment')).toHaveLength(3);
    expect(events.filter((e: any) => e.type === 'cash_handover_confirmed')).toEqual([
      expect.objectContaining({ handoverId: sent.id, amount: '600', user: expect.any(String) }),
    ]);
    expect(await db.auditLog.count({ where: { entity: 'CashHandover', entityId: sent.id, action: 'CASH_HANDOVER_CONFIRMED' } })).toBe(1);
    const stored = await db.invoice.findUniqueOrThrow({ where: { id: invoice.invoiceId } });
    expect([Number(stored.netAmount), Number(stored.paidAmount)]).toEqual([1000, 600]);
    expect(await db.payment.count({ where: { invoiceId: invoice.invoiceId } })).toBe(3);
    expect((await mine(seller)).summary).toMatchObject({ onHand: 0, pendingAmount: 0, confirmed: 642 });
  });
});
