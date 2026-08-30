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
          (sum: number, payment: any) => sum + (Number(payment.amount || 0) < 0 ? Math.abs(Number(payment.amount || 0)) : 0),
          0,
        ),
      )
    : 0;

const normalizeExpenseResponse = (expense: any) => ({
  ...expense,
  refundedAmount: getExpenseRefundedAmount(expense),
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

  const paidAmount = roundMoney(payments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0));
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

const trimExpensePaymentsToAmount = async (tx: any, expenseId: number, targetPaidAmount: number) => {
  const payments = await tx.expensePayment.findMany({
    where: { expenseId },
    orderBy: [{ paymentDate: 'desc' as const }, { id: 'desc' as const }],
    select: { id: true, amount: true },
  });

  let currentPaidAmount = roundMoney(payments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0));
  let amountToTrim = roundMoney(currentPaidAmount - targetPaidAmount);

  if (amountToTrim <= 0) {
    return;
  }

  for (const payment of payments) {
    if (amountToTrim <= 0) {
      break;
    }

    const paymentAmount = Number(payment.amount || 0);
    if (paymentAmount <= 0) {
      continue;
    }

    const trimFromPayment = Math.min(paymentAmount, amountToTrim);
    const nextPaymentAmount = roundMoney(paymentAmount - trimFromPayment);

    if (nextPaymentAmount <= 0) {
      await tx.expensePayment.delete({ where: { id: payment.id } });
    } else {
      await tx.expensePayment.update({
        where: { id: payment.id },
        data: { amount: nextPaymentAmount },
      });
    }

    amountToTrim = roundMoney(amountToTrim - trimFromPayment);
  }

  currentPaidAmount = roundMoney(
    (await tx.expensePayment.findMany({
      where: { expenseId },
      select: { amount: true },
    })).reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0),
  );

  if (currentPaidAmount > targetPaidAmount) {
    throw Object.assign(new Error('Не удалось скорректировать оплаты расхода'), { status: 400 });
  }
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

    const created = await prisma.$transaction(async (tx: any) => {
      const expense = await tx.expense.create({
        data: {
          warehouseId: Number(warehouseId),
          userId: req.user!.id,
          category,
          title,
          amount,
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
      const paidAmount = roundMoney(payments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0));

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

    const updated = await prisma.$transaction(async (tx: any) => {
      // Lock the expense row first so concurrent payments against the same expense
      // serialize instead of each recomputing paidAmount from a pre-commit snapshot
      // that's missing the other's not-yet-visible insert (last writer silently wins).
      const locked = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM expenses WHERE id = ${expenseId} FOR UPDATE
      `;
      if (!locked[0]) {
        throw Object.assign(new Error('Расход не найден'), { status: 404 });
      }

      await tx.expensePayment.create({
        data: {
          expenseId,
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
    const access = await getAccessContext(req);
    ensureAdminOnly(access.isAdmin);
    const expenseId = Number(req.params.id);
    const expenseExists = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: { id: true },
    });

    if (!expenseExists) {
      return res.status(404).json({ error: 'Расход не найден' });
    }

    const amount = normalizeRefundAmount(req.body?.amount);

    const updated = await prisma.$transaction(async (tx: any) => {
      // Lock (and re-read inside the lock) so a concurrent payment/refund/update
      // against the same expense can't be silently overwritten by this write, which
      // otherwise computes nextAmount/nextPaidAmount from a pre-transaction snapshot.
      const locked: Array<{ amount: unknown; paidAmount: unknown }> = await tx.$queryRaw`
        SELECT amount, paid_amount as "paidAmount" FROM expenses WHERE id = ${expenseId} FOR UPDATE
      `;
      if (!locked[0]) {
        throw Object.assign(new Error('Расход не найден'), { status: 404 });
      }

      const currentAmount = Number(locked[0].amount || 0);
      const currentPaidAmount = Number(locked[0].paidAmount || 0);

      if (amount > currentAmount) {
        throw Object.assign(new Error('Сумма возврата не может быть больше суммы расхода'), { status: 400 });
      }

      const nextAmount = roundMoney(currentAmount - amount);
      const nextPaidAmount = roundMoney(Math.min(currentPaidAmount, nextAmount));

      await trimExpensePaymentsToAmount(tx, expenseId, nextPaidAmount);

      return tx.expense.update({
        where: { id: expenseId },
        data: {
          amount: nextAmount,
          paidAmount: nextPaidAmount,
        },
        include: includeExpenseDetails,
      });
    });

    res.json(normalizeExpenseResponse(updated));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/payments/:paymentId', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    ensureAdminOnly(access.isAdmin);
    const expenseId = Number(req.params.id);
    const paymentId = Number(req.params.paymentId);

    const payment = await (prisma as any).expensePayment.findUnique({
      where: { id: paymentId },
      select: { id: true, expenseId: true, amount: true },
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

      const paymentAmount = Number(payment.amount || 0);
      if (paymentAmount < 0) {
        await tx.expense.update({
          where: { id: expenseId },
          data: {
            amount: { increment: Math.abs(paymentAmount) },
          },
        });
      }

      await tx.expensePayment.delete({ where: { id: paymentId } });
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
