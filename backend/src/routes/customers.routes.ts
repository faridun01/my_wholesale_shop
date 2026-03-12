import { Router } from 'express';
import prisma from '../db/prisma.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';

const router = Router();
const PAYMENT_EPSILON = 0.01;

const getInvoiceBalance = (invoice: { netAmount: number; paidAmount: number }) => {
  const balance = Number(invoice.netAmount || 0) - Number(invoice.paidAmount || 0);
  return balance > PAYMENT_EPSILON ? balance : 0;
};

const mapCustomerWithTotals = (customer: any) => {
  const invoices = Array.isArray(customer.invoices) ? customer.invoices : [];
  const totalInvoiced = invoices.reduce((sum: number, invoice: any) => sum + Number(invoice.netAmount || 0), 0);
  const totalPaid = invoices.reduce(
    (sum: number, invoice: any) => sum + Math.min(Number(invoice.paidAmount || 0), Number(invoice.netAmount || 0)),
    0,
  );
  const balance = invoices.reduce((sum: number, invoice: any) => sum + getInvoiceBalance(invoice), 0);

  return {
    ...customer,
    total_invoiced: totalInvoiced,
    total_paid: totalPaid,
    balance,
  };
};

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const role = req.user?.role?.toUpperCase();
    const isAdmin = role === 'ADMIN';

    let where: any = { active: true };

    if (!isAdmin && req.user?.id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { warehouse: true },
      });

      where = {
        ...where,
        createdByUserId: req.user.id,
      };

      if (currentUser?.warehouse?.city) {
        where.city = currentUser.warehouse.city;
      }
    }

    let customers;

    try {
      customers = await prisma.customer.findMany({
        where,
        include: {
          invoices: {
            where: { cancelled: false },
            select: {
              netAmount: true,
              paidAmount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      customers = await prisma.customer.findMany({
        where: { active: true },
        include: {
          invoices: {
            where: { cancelled: false },
            select: {
              netAmount: true,
              paidAmount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    res.json(customers.map(mapCustomerWithTotals));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const currentUser = req.user?.id
      ? await prisma.user.findUnique({
          where: { id: req.user.id },
          include: { warehouse: true },
        })
      : null;

    let customer;

    try {
      customer = await prisma.customer.create({
        data: {
          ...req.body,
          city: req.body.city || currentUser?.warehouse?.city || null,
          createdByUserId: req.user?.id || null,
        },
      });
    } catch {
      customer = await prisma.customer.create({ data: req.body });
    }

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
      where: { customerId: Number(req.params.id), cancelled: false },
      include: {
        items: { include: { product: true } },
        payments: {
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        },
        returns: {
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        },
        warehouse: true,
        user: true,
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
    res.json(payments.map((p: any) => ({
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
    res.json(returns.map((r: any) => ({
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
      where: { customerId: Number(req.params.id), cancelled: false },
      include: {
        items: { include: { product: true } },
        payments: {
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        },
        returns: {
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        },
        warehouse: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    const history = invoices.map((invoice: any) => ({
      ...invoice,
      invoiceBalance: getInvoiceBalance(invoice),
      paymentEvents: invoice.payments.map((payment: any) => ({
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        createdAt: payment.createdAt,
        staff_name: payment.user.username,
      })),
      returnEvents: invoice.returns.map((itemReturn: any) => ({
        id: itemReturn.id,
        totalValue: itemReturn.totalValue,
        reason: itemReturn.reason,
        createdAt: itemReturn.createdAt,
        staff_name: itemReturn.user.username,
      })),
    }));

    res.json(history);
  } catch (error) {
    next(error);
  }
});

export default router;
