import { Router } from 'express';
import prisma from '../db/prisma.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const warehouses = await prisma.warehouse.findMany({ where: { active: true } });
    res.json(warehouses);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const warehouse = await prisma.warehouse.create({ data: req.body });
    res.status(201).json(warehouse);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const warehouse = await prisma.warehouse.update({
      where: { id: Number(req.params.id) },
      data: req.body
    });
    res.json(warehouse);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.warehouse.update({
      where: { id: Number(req.params.id) },
      data: { active: false }
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
