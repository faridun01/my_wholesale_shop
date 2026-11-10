import prisma from '../db/prisma.js';
import { addMoney, balancePaidAmount, financialError, toCents } from '../utils/financial.js';
import { assertReplay, operationKey, requestHash } from '../utils/financial-operation.js';
import { isAdminRole, type AccessContext } from '../utils/access.js';
import { buildCreatedAtRange, toLocalDateKey } from '../routes/reports.helpers.js';
import { AuditService } from './audit.service.js';

// Staff cash sits beside client payments and only refers to them: a payment is recorded
// once, and handing its cash to an administrator never creates or changes a payment.
//
// - Cash an administrator receives is in the main cash at once.
// - Cash a staff member receives is "on hand" until they send it and an administrator
//   confirms receiving it.
// - A payment cancelled while still on hand leaves nothing to hand over; one cancelled
//   after it was handed over is the administrator's outflow.

const conflict = (message: string) => Object.assign(new Error(message), { status: 409 });
const forbidden = (message: string) => Object.assign(new Error(message), { status: 403 });
const notFound = (message: string) => Object.assign(new Error(message), { status: 404 });
const sum = (values: unknown[]) => addMoney(...values);

export const NO_PAYMENT_PERMISSION_ERROR = 'Нет права принимать оплату. Его выдаёт администратор в Настройки → Пользователи.';

export const assertCanAcceptPayments = (user: { role?: string; canAcceptPayments?: boolean } | undefined) => {
  if (!isAdminRole(user?.role) && !user?.canAcceptPayments) throw forbidden(NO_PAYMENT_PERMISSION_ERROR);
};

const PAYMENT_SELECT = {
  id: true,
  userId: true,
  invoiceId: true,
  amount: true,
  method: true,
  reversalOfId: true,
  createdAt: true,
  customer: { select: { name: true } },
  reversal: { select: { id: true } },
  cashHandoverItem: { select: { handoverId: true, handover: { select: { status: true } } } },
} as const;

const HANDOVER_INCLUDE = {
  user: { select: { id: true, username: true } },
  confirmedBy: { select: { id: true, username: true } },
  items: {
    orderBy: { id: 'asc' as const },
    select: { amount: true, payment: { select: { id: true, invoiceId: true, createdAt: true, customer: { select: { name: true } } } } },
  },
};

const isReceipt = (payment: any) => !payment.reversalOfId && toCents(payment.amount) > 0;
// Cash a staff member is accountable for: received in cash and not cancelled before it was handed over.
const owesCash = (payment: any) => isReceipt(payment) && payment.method === 'cash' && (!payment.reversal || Boolean(payment.cashHandoverItem));

const operationOf = (payment: any) => ({
  paymentId: payment.id,
  at: payment.createdAt,
  customer: payment.customer?.name ?? null,
  invoiceId: payment.invoiceId,
  amount: payment.amount,
  cancelled: Boolean(payment.reversal),
  handoverId: payment.cashHandoverItem?.handoverId ?? null,
  handoverStatus: payment.cashHandoverItem?.handover?.status ?? null,
  // Still on hand, can be sent.
  available: owesCash(payment) && !payment.cashHandoverItem,
});

const handoverOut = (handover: any) => ({
  id: handover.id,
  user: handover.user,
  status: handover.status,
  amount: handover.amount,
  createdAt: handover.createdAt,
  confirmedBy: handover.confirmedBy,
  confirmedAt: handover.confirmedAt,
  items: handover.items.map((item: any) => ({
    paymentId: item.payment.id,
    invoiceId: item.payment.invoiceId,
    at: item.payment.createdAt,
    customer: item.payment.customer?.name ?? null,
    amount: item.amount,
  })),
});

function summarize(payments: any[], handovers: any[]) {
  const today = buildCreatedAtRange({ start: toLocalDateKey(new Date()), end: toLocalDateKey(new Date()) });
  const received = sum(payments.filter(owesCash).map((p) => p.amount));
  const confirmed = sum(handovers.filter((h) => h.status === 'confirmed').map((h) => h.amount));
  const pending = handovers.filter((h) => h.status === 'pending');
  const pendingAmount = sum(pending.map((h) => h.amount));
  return {
    today: sum(payments.filter((p) => isReceipt(p) && new Date(p.createdAt) >= today.gte! && new Date(p.createdAt) <= today.lte!).map((p) => p.amount)),
    onHand: addMoney(received, -confirmed, -pendingAmount),
    pendingAmount,
    pendingCount: pending.length,
    confirmed,
  };
}

export class CashService {
  private static async ledger(userIds?: number[]) {
    const where = userIds ? { userId: { in: userIds } } : {};
    const [payments, handovers] = await Promise.all([
      prisma.payment.findMany({ where, select: PAYMENT_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      prisma.cashHandover.findMany({ where, include: HANDOVER_INCLUDE, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    ]);
    return { payments, handovers };
  }

  /** The signed-in staff member's own payments, cash on hand and handovers. */
  static async myCash(userId: number) {
    const { payments, handovers } = await this.ledger([userId]);
    const since = Date.now() - 30 * 86400000;
    return {
      summary: summarize(payments, handovers),
      operations: payments.filter(isReceipt).map(operationOf).filter((op) => op.available || new Date(op.at).getTime() >= since),
      handovers: handovers.slice(0, 50).map(handoverOut),
    };
  }

  static async createHandover(userId: number, body: any) {
    const key = operationKey(body.idempotencyKey ?? body.idempotency_key);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || isAdminRole(user.role)) throw financialError('Деньги администратора уже в кассе, сдавать их не нужно');
    const paymentIds = [...new Set((Array.isArray(body.paymentIds) ? body.paymentIds : []).map(Number))] as number[];
    if (!paymentIds.length || paymentIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw financialError('Сдавать нечего');
    const hash = requestHash({ operation: 'cash-handover', userId, paymentIds: [...paymentIds].sort((a, b) => a - b) });

    return prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`cash-handover-user:${userId}`}, 0))::text`;
      const existing = await tx.cashHandover.findUnique({ where: { idempotencyKey: key } });
      if (existing) { assertReplay(existing, hash); return existing; }
      const payments = await tx.payment.findMany({ where: { id: { in: paymentIds } }, select: PAYMENT_SELECT });
      const usable = payments.filter((p: any) => p.userId === userId && owesCash(p) && !p.cashHandoverItem);
      if (usable.length !== paymentIds.length) throw conflict('Часть денег уже сдана или оплата отменена. Обновите страницу.');
      const amount = sum(usable.map((p: any) => p.amount));
      const handover = await tx.cashHandover.create({
        data: { userId, amount, idempotencyKey: key, requestHash: hash, items: { create: usable.map((p: any) => ({ paymentId: p.id, amount: p.amount })) } },
      });
      await AuditService.record(tx, { userId, action: 'CASH_HANDOVER_SENT', entity: 'CashHandover', entityId: handover.id, details: { amount, paymentIds } });
      return handover;
    });
  }

  static async confirmHandover(id: number, adminId: number) {
    return prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM cash_handovers WHERE id = ${id} FOR UPDATE`;
      const handover = await tx.cashHandover.findUnique({ where: { id } });
      if (!handover) throw notFound('Сдача кассы не найдена');
      // A repeated click returns the confirmation already made.
      if (handover.status === 'confirmed') return handover;
      const confirmed = await tx.cashHandover.update({ where: { id }, data: { status: 'confirmed', confirmedById: adminId, confirmedAt: new Date() } });
      await AuditService.record(tx, { userId: adminId, action: 'CASH_HANDOVER_CONFIRMED', entity: 'CashHandover', entityId: id, details: { amount: handover.amount, staffId: handover.userId } });
      return confirmed;
    });
  }

  static async listHandovers(status?: string) {
    const handovers = await prisma.cashHandover.findMany({
      where: status === 'pending' || status === 'confirmed' ? { status } : {},
      include: HANDOVER_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });
    return handovers.map(handoverOut);
  }

  /**
   * A staff member's cash must be handed over before they stop being staff: an
   * administrator's or customer's receipts are not handed over, so whatever they still
   * held would drop out of the cash control.
   */
  static async assertCashSettledBeforeLeavingStaff(userId: number, change: { role?: string; active?: boolean }) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || isAdminRole(user.role)) return;
    const newRole = String(change.role || '').toUpperCase();
    if (newRole !== 'ADMIN' && newRole !== 'CUSTOMER' && change.active !== false) return;
    const { payments, handovers } = await this.ledger([userId]);
    const { onHand, pendingAmount } = summarize(payments, handovers);
    if (toCents(onHand) > 0 || toCents(pendingAmount) > 0) {
      const money = (value: unknown) => addMoney(value).toFixed(2).replace('.', ',');
      throw conflict(`Сначала касса сотрудника: на руках ${money(onHand)}, ждёт подтверждения ${money(pendingAmount)}. Пусть он передаст деньги в «Моя касса», а вы подтвердите приём в «Контроль кассы».`);
    }
  }

  static pendingCount() {
    return prisma.cashHandover.count({ where: { status: 'pending' } });
  }

  /** How much cash each staff member holds, has sent and has handed over. */
  static async staffBalances() {
    const users = await prisma.user.findMany({
      where: { role: { not: 'ADMIN' }, OR: [{ canAcceptPayments: true, active: true }, { cashHandovers: { some: {} } }, { payments: { some: { method: 'cash' } } }] },
      select: { id: true, username: true, active: true },
      orderBy: { username: 'asc' },
    });
    const { payments, handovers } = await this.ledger(users.map((u) => u.id));
    return users.map((user) => ({ ...user, ...summarize(payments.filter((p) => p.userId === user.id), handovers.filter((h) => h.userId === user.id)) }));
  }

  /** Customers who owe on invoices of the caller's warehouse: only what is needed to take a payment. */
  static async debtors(access: AccessContext, search: unknown) {
    if (!access.isAdmin && !access.warehouseId) return [];
    const query = String(search || '').trim().slice(0, 80);
    const customerMatch = query ? { OR: [{ name: { contains: query, mode: 'insensitive' as const } }, { phone: { contains: query } }] } : undefined;
    const invoiceNumber = /^\d{1,9}$/.test(query) ? Number(query) : null;
    const invoices = await prisma.invoice.findMany({
      where: {
        cancelled: false,
        status: { in: ['unpaid', 'partial'] },
        ...(access.isAdmin ? {} : { warehouseId: access.warehouseId! }),
        ...(customerMatch ? { OR: [{ customer: customerMatch }, ...(invoiceNumber ? [{ id: invoiceNumber }] : [])] } : {}),
      },
      select: {
        id: true,
        createdAt: true,
        netAmount: true,
        paidAmount: true,
        customer: { select: { id: true, name: true, phone: true } },
        payments: { select: { amount: true, method: true, reversalOfId: true, returnId: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 2000,
    });
    const customers = new Map<number, any>();
    for (const invoice of invoices) {
      const paid = balancePaidAmount(invoice.payments, invoice.paidAmount);
      const remaining = addMoney(invoice.netAmount, -paid);
      if (toCents(remaining) <= 0) continue;
      const entry = customers.get(invoice.customer.id) || { ...invoice.customer, debt: 0, invoices: [] as any[] };
      entry.debt = addMoney(entry.debt, remaining);
      entry.invoices.push({ id: invoice.id, createdAt: invoice.createdAt, netAmount: invoice.netAmount, paidAmount: paid, remaining });
      customers.set(invoice.customer.id, entry);
    }
    return [...customers.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru')).slice(0, 100);
  }
}
