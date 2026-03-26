import { Router } from 'express';
import prisma from '../db/prisma.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { ensureWarehouseAccess, getAccessContext, getScopedWarehouseId } from '../utils/access.js';
import { roundMoney } from '../utils/money.js';

const router = Router();

const normalizeOptionalString = (value: unknown) => {
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
};

const normalizePositiveAmount = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error('Сумма расхода должна быть больше нуля'), { status: 400 });
  }

  return roundMoney(amount);
};

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const warehouseId = getScopedWarehouseId(access, req.query.warehouseId);
    const start = normalizeOptionalString(req.query.start);
    const end = normalizeOptionalString(req.query.end);

    const expenses = await prisma.expense.findMany({
      where: {
        warehouseId: warehouseId ?? undefined,
        expenseDate: start || end
          ? {
              gte: start ? new Date(`${start}T00:00:00.000Z`) : undefined,
              lte: end ? new Date(`${end}T23:59:59.999Z`) : undefined,
            }
          : undefined,
      },
      include: {
        warehouse: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, username: true },
        },
      },
      orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
    });

    res.json(expenses);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const requestedWarehouseId = Number(req.body?.warehouseId);
    const warehouseId = access.isAdmin ? requestedWarehouseId : access.warehouseId;

    if (!warehouseId || !Number.isFinite(Number(warehouseId))) {
      return res.status(400).json({ error: 'Склад обязателен' });
    }

    if (!access.isAdmin && !ensureWarehouseAccess(access, Number(warehouseId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const title = String(req.body?.title || '').trim();
    if (!title) {
      return res.status(400).json({ error: 'Название расхода обязательно' });
    }

    const category = String(req.body?.category || 'Прочее').trim() || 'Прочее';
    const amount = normalizePositiveAmount(req.body?.amount);
    const expenseDate = req.body?.expenseDate ? new Date(req.body.expenseDate) : new Date();

    const created = await prisma.expense.create({
      data: {
        warehouseId: Number(warehouseId),
        userId: req.user!.id,
        category,
        title,
        amount,
        expenseDate,
        note: normalizeOptionalString(req.body?.note),
      },
      include: {
        warehouse: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, username: true },
        },
      },
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const expenseId = Number(req.params.id);
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: {
        id: true,
        warehouseId: true,
        userId: true,
      },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Расход не найден' });
    }

    const canDelete = access.isAdmin || expense.userId === access.userId;
    if (!canDelete || !ensureWarehouseAccess(access, expense.warehouseId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.expense.delete({ where: { id: expenseId } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
