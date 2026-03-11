import { Router } from 'express';
import prisma from '../db/prisma.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({ where: { active: true } });
    res.json(customers);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const customer = await prisma.customer.create({ data: req.body });
    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const customer = await prisma.customer.update({
      where: { id: Number(req.params.id) },
      data: req.body
    });
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.customer.update({
      where: { id: Number(req.params.id) },
      data: { active: false }
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/invoices', async (req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { customerId: Number(req.params.id) },
      include: {
        items: { include: { product: true } },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(invoices);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/payments', async (req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { customerId: Number(req.params.id) },
      include: {
        user: true,
        invoice: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(payments.map(p => ({
      ...p,
      staff_name: p.user.username
    })));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/returns', async (req, res, next) => {
  try {
    const returns = await prisma.return.findMany({
      where: { customerId: Number(req.params.id) },
      include: {
        user: true,
        invoice: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(returns.map(r => ({
      ...r,
      staff_name: r.user.username
    })));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { customerId: Number(req.params.id) },
      include: {
        items: { include: { product: true } },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(invoices);
  } catch (error) {
    next(error);
  }
});

export default router;
