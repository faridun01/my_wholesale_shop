import { Router } from 'express';
import prisma from '../db/prisma.js';
import { authorize } from '../middlewares/auth.middleware.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { getAccessContext, ensureWarehouseAccess } from '../utils/access.js';

const router = Router();

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const warehouses = await prisma.warehouse.findMany({
      where: access.isAdmin
        ? { active: true }
        : {
            active: true,
            id: access.warehouseId ?? -1,
            city: access.city ?? undefined,
          },
    });
    res.json(warehouses);
  } catch (error) {
    next(error);
  }
});

router.post('/', authorize(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const warehouse = await prisma.warehouse.create({ data: req.body });
    res.status(201).json(warehouse);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authorize(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const warehouseId = Number(req.params.id);
    if (!access.isAdmin && !ensureWarehouseAccess(access, warehouseId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const warehouse = await prisma.warehouse.update({
      where: { id: warehouseId },
      data: req.body
    });
    res.json(warehouse);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authorize(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const warehouseId = Number(req.params.id);
    if (!access.isAdmin && !ensureWarehouseAccess(access, warehouseId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.warehouse.update({
      where: { id: warehouseId },
      data: { active: false }
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
