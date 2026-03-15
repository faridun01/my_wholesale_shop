import { Router } from 'express';
import prisma from '../db/prisma.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { getAccessContext } from '../utils/access.js';

const router = Router();
const PAYMENT_EPSILON = 0.01;
const DEFAULT_CUSTOMER_NAME = 'Без названия';

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
    const access = await getAccessContext(req);
    const defaultCustomerCity = access.isAdmin ? null : (access.city ?? null);
    let defaultCustomer = await prisma.customer.findFirst({
      where: {
        active: true,
        name: DEFAULT_CUSTOMER_NAME,
        city: defaultCustomerCity,
      },
    });

    if (!defaultCustomer) {
      defaultCustomer = await prisma.customer.create({
        data: {
          name: DEFAULT_CUSTOMER_NAME,
          city: defaultCustomerCity,
          createdByUserId: req.user?.id || null,
          notes: 'Технический клиент по умолчанию',
        },
      });
    }

    let where: any = { active: true };

    if (!access.isAdmin) {
      where = {
        ...where,
        city: access.city ?? '__no_city__',
      };
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

    const mappedCustomers = customers.map(mapCustomerWithTotals);
    mappedCustomers.sort((a: any, b: any) => {
      if (a.id === defaultCustomer?.id) return -1;
      if (b.id === defaultCustomer?.id) return 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    res.json(mappedCustomers);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);

    let customer;

    try {
      customer = await prisma.customer.create({
        data: {
          ...req.body,
          city: access.isAdmin ? (req.body.city || null) : (access.city || null),
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

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const current = await prisma.customer.findUnique({
      where: { id: Number(req.params.id) },
      select: { city: true },
    });
    if (!current) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }
    if (!access.isAdmin && current.city !== access.city) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const customer = await prisma.customer.update({
      where: { id: Number(req.params.id) },
      data: access.isAdmin ? req.body : { ...req.body, city: access.city || null }
    });
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const current = await prisma.customer.findUnique({
      where: { id: Number(req.params.id) },
      select: { city: true },
    });
    if (!current) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }
    if (!access.isAdmin && current.city !== access.city) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.customer.update({
      where: { id: Number(req.params.id) },
      data: { active: false }
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/invoices', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const invoices = await prisma.invoice.findMany({
      where: {
        customerId: Number(req.params.id),
        cancelled: false,
        warehouseId: access.isAdmin ? undefined : (access.warehouseId ?? -1),
      },
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

router.get('/:id/payments', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const payments = await prisma.payment.findMany({
      where: {
        customerId: Number(req.params.id),
        invoice: access.isAdmin ? undefined : { warehouseId: access.warehouseId ?? -1 },
      },
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

router.get('/:id/returns', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const returns = await prisma.return.findMany({
      where: {
        customerId: Number(req.params.id),
        invoice: access.isAdmin ? undefined : { warehouseId: access.warehouseId ?? -1 },
      },
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

router.get('/:id/history', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const invoices = await prisma.invoice.findMany({
      where: {
        customerId: Number(req.params.id),
        cancelled: false,
        warehouseId: access.isAdmin ? undefined : (access.warehouseId ?? -1),
      },
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
