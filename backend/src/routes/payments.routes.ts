import { assertNoTaxPayload, balancePaidAmount, financialError } from '../utils/financial.js';
import { addMoney, toCents } from '../utils/financial.js';
import { operationKey, requestHash, assertReplay } from '../utils/financial-operation.js';
import { Router } from 'express';
import prisma from '../db/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { ensureWarehouseAccess, getAccessContext, isAdminRole } from '../utils/access.js';
import { normalizeMoney, roundMoney, getInvoiceStatus } from '../utils/money.js';
import { PUBLIC_USER_SELECT } from '../utils/publicUser.js';
import { NO_PAYMENT_PERMISSION_ERROR } from '../services/cash.service.js';
import { AuditService } from '../services/audit.service.js';
import { publishCashEvent } from '../services/cash-events.js';

const router = Router();
const PAYMENT_EPSILON = 0.01;
const ADMIN_ONLY_PAYMENT_ERROR = 'Отменять оплаты и выдавать деньги может только администратор';

// An administrator, or a staff member granted "Может принимать оплату", records client
// payments. Staff cash then stays in their cash-to-hand-over until an administrator
// confirms receiving it (see cash.service.ts); cancelling or refunding stays admin-only.
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    assertNoTaxPayload(req.body);
    const isAdmin = isAdminRole(req.user?.role);
    if (!isAdmin && !req.user?.canAcceptPayments) return res.status(403).json({ error: NO_PAYMENT_PERMISSION_ERROR });
    const amount = normalizeMoney(req.body.amount, 'Amount', { allowZero: false });
    const key = operationKey(req.body.idempotency_key);
    const invoiceId = req.body.invoice_id ? Number(req.body.invoice_id) : null;
    if (!isAdmin && !invoiceId) throw financialError('Выберите накладную, в счёт которой принята оплата');
    const access = isAdmin ? null : await getAccessContext(req);
    // Staff simply take the money; it is cash they later hand to an administrator.
    const method = isAdmin ? String(req.body.method || 'cash') : 'cash';
    if (!['cash', 'card', 'transfer'].includes(method)) throw financialError('Invalid payment method');
    const hash = requestHash({ invoiceId, customerId: req.body.customer_id, amount, method, userId: req.user!.id });
    const result = await prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
      const existing = await tx.payment.findUnique({ where: { idempotencyKey: key } });
      if (existing) { assertReplay(existing, hash); return existing; }
      let invoice: any = null;
      if (invoiceId) {
        await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`;
        invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
        if (!invoice || invoice.cancelled) throw financialError('Invoice not found or cancelled');
        if (access && !ensureWarehouseAccess(access, invoice.warehouseId)) throw Object.assign(new Error('Накладная другого склада'), { status: 403 });
        const appliedPaid = balancePaidAmount(invoice.payments, invoice.paidAmount);
        if (toCents(appliedPaid) < 0 || toCents(addMoney(appliedPaid, amount)) > toCents(invoice.netAmount)) throw financialError('Payment exceeds outstanding debt');
      }
      const payment = await tx.payment.create({ data: { customerId: invoice?.customerId ?? Number(req.body.customer_id), invoiceId, userId: req.user!.id, amount, method, idempotencyKey: key, requestHash: hash } });
      if (invoice) {
        const paidAmount = addMoney(invoice.paidAmount, amount);
        const appliedPaid = addMoney(balancePaidAmount(invoice.payments, invoice.paidAmount), amount);
        await tx.invoice.update({ where: { id: invoiceId }, data: { paidAmount, status: getInvoiceStatus(appliedPaid, Number(invoice.netAmount)) } });
      }
      await AuditService.record(tx, { userId: req.user!.id, action: 'PAYMENT_ACCEPTED', entity: 'Payment', entityId: payment.id, ipAddress: req.ip, details: { invoiceId, customerId: payment.customerId, amount, method } });
      return payment;
    });
    publishCashEvent({ type: 'payment_accepted', userId: req.user!.id, username: req.user!.username, amount: addMoney(result.amount) });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

// Records money the seller handed back when an invoice ended up paid above its total
// (a goods return, or a legacy edit). An append-only negative entry: the received
// payments stay as they were.
router.post('/give-back', async (req: AuthRequest, res, next) => {
  try {
    if (!isAdminRole(req.user?.role)) return res.status(403).json({ error: ADMIN_ONLY_PAYMENT_ERROR });
    const amount = normalizeMoney(req.body.amount, 'Amount', { allowZero: false });
    const key = operationKey(req.body.idempotency_key);
    const invoiceId = Number(req.body.invoice_id);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) throw financialError('Invoice is required');
    const method = String(req.body.method || 'cash');
    if (!['cash', 'card', 'transfer'].includes(method)) throw financialError('Invalid payment method');
    const hash = requestHash({ operation: 'give-back', invoiceId, amount, method, userId: req.user!.id });
    const result = await prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
      const existing = await tx.payment.findUnique({ where: { idempotencyKey: key } });
      if (existing) { assertReplay(existing, hash); return existing; }
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
      if (!invoice || invoice.cancelled) throw financialError('Invoice not found or cancelled');
      const received = balancePaidAmount(invoice.payments, invoice.paidAmount);
      if (toCents(amount) > toCents(received) - toCents(invoice.netAmount)) throw financialError('Сумма больше, чем нужно вернуть покупателю');
      const payment = await tx.payment.create({ data: { customerId: invoice.customerId, invoiceId, userId: req.user!.id, amount: -amount, method, idempotencyKey: key, requestHash: hash } });
      await tx.invoice.update({ where: { id: invoiceId }, data: { paidAmount: addMoney(invoice.paidAmount, -amount), status: getInvoiceStatus(addMoney(received, -amount), Number(invoice.netAmount)) } });
      await AuditService.record(tx, { userId: req.user!.id, action: 'MONEY_RETURNED', entity: 'Payment', entityId: payment.id, ipAddress: req.ip, details: { invoiceId, amount, method } });
      return payment;
    });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

// Backward-compatible endpoint, now an append-only reversal, never a delete.
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (!isAdminRole(req.user?.role)) return res.status(403).json({ error: ADMIN_ONLY_PAYMENT_ERROR });
    const id = Number(req.params.id);
    const meta = await prisma.payment.findUnique({ where: { id } });
    if (!meta?.invoiceId) throw financialError('Only invoice payments can be reversed');
    const result = await prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${meta.invoiceId} FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({ where: { id: meta.invoiceId } });
      if (!invoice || invoice.cancelled) throw financialError('Invoice not found or cancelled');
      const payments = await tx.payment.findMany({ where: { invoiceId: meta.invoiceId } });
      const original = payments.find((p: any) => p.id === id);
      if (!original || Number(original.amount) <= 0 || original.reversalOfId) throw new Error('Refund and reversal entries cannot be deleted; use an explicit adjustment');
      const inPendingHandover = await tx.cashHandoverItem.findFirst({ where: { paymentId: id, active: true, handover: { status: 'pending' } }, select: { handoverId: true } });
      if (inPendingHandover) throw Object.assign(new Error(`Оплата входит в сдачу кассы №${inPendingHandover.handoverId}, которая ждёт подтверждения. Сначала подтвердите приём или верните кассу сотруднику.`), { status: 409 });
      if (!payments.some((p: any) => p.reversalOfId === id)) {
        if (payments.some((p: any) => p.returnId || (Number(p.amount) < 0 && !p.reversalOfId))) throw financialError('Payments with dependent refunds require an explicit reconciliation');
        const paid = addMoney(...payments.map((p: any) => p.amount));
        if (toCents(paid) !== toCents(invoice.paidAmount) || toCents(paid) < toCents(original.amount)) throw financialError('Payment reversal would create a negative balance');
        const reversal = await tx.payment.create({ data: { customerId: original.customerId, invoiceId: original.invoiceId, userId: req.user!.id, amount: -Number(original.amount), method: original.method, reversalOfId: id, idempotencyKey: `payment-reversal:${id}` } });
        await AuditService.record(tx, { userId: req.user!.id, action: 'PAYMENT_REVERSED', entity: 'Payment', entityId: reversal.id, ipAddress: req.ip, details: { reversalOf: id, invoiceId: original.invoiceId, amount: original.amount } });
      }
      const all = await tx.payment.findMany({ where: { invoiceId: meta.invoiceId } });
      const paidAmount = addMoney(...all.map((p: any) => p.amount));
      const appliedPaid = balancePaidAmount(all, paidAmount);
      const updated = await tx.invoice.update({ where: { id: meta.invoiceId }, data: { paidAmount, status: getInvoiceStatus(appliedPaid, Number(invoice.netAmount)) }, include: { customer: true, user: { select: PUBLIC_USER_SELECT }, items: true } });
      return { success: true, invoice: updated };
    });
    publishCashEvent({ type: 'payment_reversed', userId: meta.userId, amount: addMoney(meta.amount), by: req.user!.username });
    res.json(result);
  } catch (error) { next(error); }
});
export default router;
