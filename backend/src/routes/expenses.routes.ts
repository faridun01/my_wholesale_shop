import { assertNoTaxPayload, financialError } from '../utils/financial.js';
import { addMoney, refundByMethod, toCents } from '../utils/financial.js';
import { operationKey, requestHash, assertReplay } from '../utils/financial-operation.js';
import { Router } from 'express';
import prisma from '../db/prisma.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { ensureWarehouseAccess, getAccessContext, getScopedWarehouseId } from '../utils/access.js';
import { normalizeMoney, roundMoney } from '../utils/money.js';
import { parsePaginationQuery, setPaginationHeaders } from '../utils/pagination.js';

const router = Router();

const normalizeOptionalString = (value: unknown) => {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
};

const normalizePositiveAmount = (value: unknown) => {
  const amount = normalizeMoney(value, 'Expense amount', { allowZero: false });
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error('Сумма расхода должна быть больше нуля'), { status: 400 });
  }

  return amount;
};

const normalizePaidAmount = (value: unknown, totalAmount: number) => {
  const amount = normalizeMoney(value ?? 0, 'Expense paid amount');
  if (!Number.isFinite(amount) || amount < 0) {
    throw Object.assign(new Error('Сумма оплаты не может быть отрицательной'), { status: 400 });
  }

  if (amount > totalAmount) {
    throw Object.assign(new Error('Сумма оплаты не может быть больше суммы расхода'), { status: 400 });
  }

  return amount;
};

const normalizeRefundAmount = (value: unknown) => {
  const amount = normalizeMoney(value, 'Expense refund amount', { allowZero: false });
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error('Сумма возврата должна быть больше нуля'), { status: 400 });
  }

  return amount;
};

const normalizeExpenseDate = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return new Date();
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw Object.assign(new Error('Дата расхода указана некорректно'), { status: 400 });
  }

  return parsed;
};

const normalizePaymentDate = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return new Date();
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw Object.assign(new Error('Дата оплаты указана некорректно'), { status: 400 });
  }

  return parsed;
};

const includeExpenseDetails = {
  refunds: true,
  warehouse: {
    select: { id: true, name: true },
  },
  user: {
    select: { id: true, username: true },
  },
  payments: {
    include: {
      user: {
        select: { id: true, username: true },
      },
    },
    orderBy: [{ paymentDate: 'desc' as const }, { id: 'desc' as const }],
  },
};

const getExpenseRefundedAmount = (expense: any) =>
  Array.isArray(expense?.payments)
    ? roundMoney(
        expense.payments.reduce(
          (sum: number, payment: any) => sum + (!payment.reversalOfId && Number(payment.amount || 0) < 0 ? Math.abs(Number(payment.amount || 0)) : 0),
          0,
        ),
      )
    : 0;

const normalizeExpenseResponse = (expense: any) => ({
  ...expense,
  refundedAmount: getExpenseRefundedAmount(expense),
  returnedValue: addMoney(...(expense.refunds || []).map((r: any) => r.amount)),
  payments: Array.isArray(expense?.payments)
    ? expense.payments.map((payment: any) => ({
        ...payment,
        staff_name: payment.user?.username || '',
      }))
    : [],
});

const recalculateExpensePaidAmount = async (tx: any, expenseId: number) => {
  const payments = await tx.expensePayment.findMany({
    where: { expenseId },
    select: { amount: true },
  });

  const paidAmount = addMoney(...payments.map((payment: any) => payment.amount));
  const expense = await tx.expense.findUnique({
    where: { id: expenseId },
    select: { amount: true },
  });

  if (!expense) {
    throw Object.assign(new Error('Расход не найден'), { status: 404 });
  }

  if (paidAmount < 0) {
    throw Object.assign(new Error('Сумма возвратов не может быть больше внесенных оплат'), { status: 400 });
  }

  if (paidAmount > Number(expense.amount || 0)) {
    throw Object.assign(new Error('Сумма оплат не может быть больше суммы расхода'), { status: 400 });
  }

  return tx.expense.update({
    where: { id: expenseId },
    data: { paidAmount },
    include: includeExpenseDetails,
  });
};

const ensureAdminOnly = (isAdmin: boolean) => {
  if (!isAdmin) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
};

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    ensureAdminOnly(access.isAdmin);
    const warehouseId = getScopedWarehouseId(access, req.query.warehouseId);
    const start = normalizeOptionalString(req.query.start);
    const end = normalizeOptionalString(req.query.end);
    // Was previously unbounded (no pagination anywhere in this route, unlike every
    // other list endpoint) — a generous default cap so existing callers that don't
    // pass page/limit keep seeing their full expense list, while very large
    // warehouses no longer force an unbounded table scan + JSON payload.
    const { page, limit, skip } = parsePaginationQuery(req.query, { defaultLimit: 2000, maxLimit: 5000 });

    const where = {
      warehouseId: warehouseId ?? undefined,
      expenseDate: start || end
        ? {
            gte: start ? new Date(`${start}T00:00:00.000Z`) : undefined,
            lte: end ? new Date(`${end}T23:59:59.999Z`) : undefined,
          }
        : undefined,
    };

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          ...includeExpenseDetails,
        },
        orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ]);
    setPaginationHeaders(res, { page, limit, total });

    res.json(expenses.map(normalizeExpenseResponse));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    assertNoTaxPayload(req.body);
    const access = await getAccessContext(req);
    ensureAdminOnly(access.isAdmin);
    const requestedWarehouseId = Number(req.body?.warehouseId);
    const warehouseId = requestedWarehouseId;

    if (!warehouseId || !Number.isFinite(Number(warehouseId))) {
      return res.status(400).json({ error: 'Склад обязателен' });
    }

    const title = String(req.body?.title || '').trim();
    if (!title) {
      return res.status(400).json({ error: 'Название расхода обязательно' });
    }

    const category = String(req.body?.category || 'Прочее').trim() || 'Прочее';
    const amount = normalizePositiveAmount(req.body?.amount);
    const paidAmount = normalizePaidAmount(req.body?.paidAmount, amount);
    const expenseDate = normalizeExpenseDate(req.body?.expenseDate);
    const paymentDate = normalizePaymentDate(req.body?.paymentDate);

    const key = operationKey(req.body.idempotency_key);
    const hash = requestHash({ ...req.body, userId: req.user!.id });
    const created = await prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
      const existing = await tx.expense.findUnique({ where: { idempotencyKey: key }, include: includeExpenseDetails });
      if (existing) { assertReplay(existing, hash); return existing; }
      const expense = await tx.expense.create({
        data: {
          warehouseId: Number(warehouseId),
          userId: req.user!.id,
          category,
          title,
          amount,
          originalAmount: amount,
          idempotencyKey: key,
          requestHash: hash,
          paidAmount: 0,
          expenseDate,
          note: normalizeOptionalString(req.body?.note),
        },
      });

      if (paidAmount > 0) {
        await tx.expensePayment.create({
          data: {
            expenseId: expense.id,
            userId: req.user!.id,
            amount: paidAmount,
            method: String(req.body?.paymentMethod || 'cash').trim() || 'cash',
            paymentDate,
            note: normalizeOptionalString(req.body?.paymentNote),
          },
        });
      }

      return recalculateExpensePaidAmount(tx, expense.id);
    });

    res.status(201).json(normalizeExpenseResponse(created));
  } catch (error) {
    next(error);
  }
});

const updateExpenseHandler = async (req: AuthRequest, res: any, next: any) => {
  try {
    assertNoTaxPayload(req.body);
    const access = await getAccessContext(req);
    ensureAdminOnly(access.isAdmin);

    const expenseId = Number(req.params.id);
    const existingExpense = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: {
        id: true,
        warehouseId: true,
      },
    });

    if (!existingExpense) {
      return res.status(404).json({ error: 'Расход не найден' });
    }

    const requestedWarehouseId = Number(req.body?.warehouseId ?? existingExpense.warehouseId);
    const warehouseId = Number.isFinite(requestedWarehouseId) ? requestedWarehouseId : null;
    if (!warehouseId) {
      return res.status(400).json({ error: 'Склад обязателен' });
    }

    const title = String(req.body?.title || '').trim();
    if (!title) {
      return res.status(400).json({ error: 'Название расхода обязательно' });
    }

    const category = String(req.body?.category || 'Прочее').trim() || 'Прочее';
    const amount = normalizePositiveAmount(req.body?.amount);
    const expenseDate = normalizeExpenseDate(req.body?.expenseDate);

    const updated = await prisma.$transaction(async (tx: any) => {
      // Lock first: a concurrent payment/refund against this expense must not be
      // able to insert between our paidAmount read and this write.
      const locked = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM expenses WHERE id = ${expenseId} FOR UPDATE
      `;
      if (!locked[0]) {
        throw Object.assign(new Error('Расход не найден'), { status: 404 });
      }

      const payments = await tx.expensePayment.findMany({
        where: { expenseId },
        select: { amount: true },
      });
      const paidAmount = addMoney(...payments.map((payment: any) => payment.amount));

      if (paidAmount > amount) {
        throw Object.assign(new Error('Сумма расхода не может быть меньше уже внесенных оплат'), { status: 400 });
      }

      return tx.expense.update({
        where: { id: expenseId },
        data: {
          warehouseId,
          category,
          title,
          amount,
          paidAmount,
          expenseDate,
          note: normalizeOptionalString(req.body?.note),
        },
        include: includeExpenseDetails,
      });
    });

    res.json(normalizeExpenseResponse(updated));
  } catch (error) {
    next(error);
  }
};

router.put('/:id', updateExpenseHandler);
router.patch('/:id', updateExpenseHandler);

router.post('/:id/payments', async (req: AuthRequest, res, next) => {
  try {
    assertNoTaxPayload(req.body);
    const access = await getAccessContext(req);
    ensureAdminOnly(access.isAdmin);
    const expenseId = Number(req.params.id);
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: {
        id: true,
        warehouseId: true,
        amount: true,
        paidAmount: true,
      },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Расход не найден' });
    }

    const amount = normalizePositiveAmount(req.body?.amount);

    const key = operationKey(req.body.idempotency_key);
    const hash = requestHash({ expenseId, ...req.body, userId: req.user!.id });
    const updated = await prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
      // Lock the expense row first so concurrent payments against the same expense
      // serialize instead of each recomputing paidAmount from a pre-commit snapshot
      // that's missing the other's not-yet-visible insert (last writer silently wins).
      const locked = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM expenses WHERE id = ${expenseId} FOR UPDATE
      `;
      if (!locked[0]) {
        throw Object.assign(new Error('Расход не найден'), { status: 404 });
      }

      const existing = await tx.expensePayment.findUnique({ where: { idempotencyKey: key } });
      if (existing) { assertReplay(existing, hash); return tx.expense.findUnique({ where: { id: expenseId }, include: includeExpenseDetails }); }
      await tx.expensePayment.create({
        data: {
          expenseId,
          idempotencyKey: key,
          requestHash: hash,
          userId: req.user!.id,
          amount,
          method: String(req.body?.method || 'cash').trim() || 'cash',
          paymentDate: normalizePaymentDate(req.body?.paymentDate),
          note: normalizeOptionalString(req.body?.note),
        },
      });

      return recalculateExpensePaidAmount(tx, expenseId);
    });

    res.json(normalizeExpenseResponse(updated));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/refunds', async (req: AuthRequest, res, next) => {
  try {
    assertNoTaxPayload(req.body);
    ensureAdminOnly((await getAccessContext(req)).isAdmin);
    const expenseId = Number(req.params.id);
    const amount = normalizeRefundAmount(req.body.amount);
    const key = operationKey(req.body.idempotency_key);
    const hash = requestHash({ expenseId, amount, method: req.body.method, note: req.body.note, userId: req.user!.id });
    const updated = await prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
      const locked = await tx.$queryRaw`SELECT * FROM expenses WHERE id = ${expenseId} FOR UPDATE`;
      if (!locked[0]) throw financialError('Expense not found');
      const existing = await tx.expenseRefund.findUnique({ where: { idempotencyKey: key } });
      if (existing) { assertReplay(existing, hash); return tx.expense.findUnique({ where: { id: expenseId }, include: includeExpenseDetails }); }
      const expense = await tx.expense.findUnique({ where: { id: expenseId } });
      if (toCents(amount) > toCents(expense.amount)) throw financialError('Refund exceeds expense value');
      const currentPaid = Number(expense.paidAmount);
      const nextAmount = addMoney(expense.amount, -amount);
      // Preserve the existing expense policy: reduce debt before refunding paid money.
      const nextPaid = Math.min(currentPaid, nextAmount);
      const refundedAmount = addMoney(currentPaid, -nextPaid);
      const payments = await tx.expensePayment.findMany({ where: { expenseId } });
      if (toCents(addMoney(...payments.map((p: any) => p.amount))) !== toCents(currentPaid)) throw financialError('Expense payment history requires reconciliation');
      const breakdown = refundedAmount > 0 ? refundByMethod(payments, refundedAmount) : [];
      const method = breakdown.length > 1 ? 'mixed' : breakdown[0]?.method || null;
      await tx.expenseRefund.create({ data: { expenseId, userId: req.user!.id, amount, refundedAmount, debtReduction: addMoney(amount, -refundedAmount), method, reason: req.body.note || null, idempotencyKey: key, requestHash: hash } });
      for (const part of breakdown) await tx.expensePayment.create({ data: { expenseId, userId: req.user!.id, amount: -part.amount, method: part.method, note: req.body.note || 'Expense refund', idempotencyKey: `expense-refund:${key}:${part.method}` } });
      return tx.expense.update({ where: { id: expenseId }, data: { originalAmount: expense.originalAmount ?? expense.amount, amount: nextAmount, paidAmount: nextPaid }, include: includeExpenseDetails });
    });
    res.json(normalizeExpenseResponse(updated));
  } catch (error) { next(error); }
});

router.delete('/:id/payments/:paymentId', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    ensureAdminOnly(access.isAdmin);
    const expenseId = Number(req.params.id);
    const paymentId = Number(req.params.paymentId);

    const payment = await (prisma as any).expensePayment.findUnique({
      where: { id: paymentId },
      select: { id: true, expenseId: true },
    });

    if (!payment || Number(payment.expenseId) !== expenseId) {
      return res.status(404).json({ error: 'Оплата расхода не найдена' });
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const locked = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM expenses WHERE id = ${expenseId} FOR UPDATE
      `;
      if (!locked[0]) {
        throw Object.assign(new Error('Расход не найден'), { status: 404 });
      }

      const original = await tx.expensePayment.findUnique({ where: { id: paymentId } });
      if (Number(original.amount) <= 0 || original.reversalOfId) throw financialError('Refunds and reversal entries cannot be deleted');
      const previous = await tx.expensePayment.findUnique({ where: { reversalOfId: paymentId } });
      if (!previous) await tx.expensePayment.create({ data: { expenseId, userId: req.user!.id, amount: -Number(original.amount), method: original.method, reversalOfId: paymentId, idempotencyKey: `expense-payment-reversal:${paymentId}`, note: 'Payment reversal' } });
      return recalculateExpensePaidAmount(tx, expenseId);
    });

    res.json({
      success: true,
      expense: normalizeExpenseResponse(updated),
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    ensureAdminOnly(access.isAdmin);
    const expenseId = Number(req.params.id);
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: {
        id: true,
        warehouseId: true,
        userId: true,
        paidAmount: true,
      },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Расход не найден' });
    }

    if (Number(expense.paidAmount || 0) > 0) {
      return res.status(400).json({
        error: 'Нельзя удалить расход с зарегистрированными оплатами. Сначала удалите или отмените оплаты.',
      });
    }

    await prisma.expense.delete({ where: { id: expenseId } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
