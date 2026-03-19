import { Router } from 'express';
import prisma from '../db/prisma.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { getAccessContext } from '../utils/access.js';
import { DEFAULT_CUSTOMER_NAME, getCanonicalDefaultCustomer, isDefaultCustomerName } from '../utils/defaultCustomer.js';

const router = Router();
const PAYMENT_EPSILON = 0.01;
const normalizeCustomerName = (value: string | null | undefined) => String(value || '').trim().toLowerCase();

const findCustomerByNormalizedName = async (name: string, excludeCustomerId?: number) => {
  const normalizedName = normalizeCustomerName(name);
  if (!normalizedName) {
    return null;
  }

  const customers = await prisma.customer.findMany({
    where: {
      name: {
        equals: String(name || '').trim(),
        mode: 'insensitive',
      },
    },
    select: { id: true, name: true },
  });

  return (
    customers.find((customer: { id: number; name: string }) =>
      customer.id !== excludeCustomerId && normalizeCustomerName(customer.name) === normalizedName,
    ) || null
  );
};

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

const getCustomerAccess = async (access: Awaited<ReturnType<typeof getAccessContext>>, customerId: number) => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, createdByUserId: true },
  });

  if (!customer) {
    return { customer: null, allowed: false };
  }

  if (access.isAdmin) {
    return { customer, allowed: true };
  }

  return {
    customer,
    allowed: customer.createdByUserId === access.userId,
  };
};

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const defaultCustomer = await getCanonicalDefaultCustomer(prisma, req.user?.id || null);


    const baseWhere: any = {
      OR: [
        { active: true },
        { invoices: { some: {} } },
        { payments: { some: {} } },
        { returns: { some: {} } },
      ],
    };

    const where: any = access.isAdmin
      ? baseWhere
      : {
          AND: [
            baseWhere,
            {
              createdByUserId: access.userId ?? -1,
            },
          ],
        };

    const customers = await prisma.customer.findMany({
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

    const mappedCustomers = customers.map(mapCustomerWithTotals);
    mappedCustomers.sort((a: any, b: any) => {
      if (a.id === defaultCustomer?.id) return -1;
      if (b.id === defaultCustomer?.id) return 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    res.json(mappedCustomers.filter((customer: any) => customer.id !== defaultCustomer?.id));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const customerName = String(req.body?.name || '').trim();
    if (!customerName) {
      return res.status(400).json({ error: 'Название клиента обязательно' });
    }

    if (isDefaultCustomerName(req.body?.name)) {
      const defaultCustomer = await getCanonicalDefaultCustomer(prisma, req.user?.id || null);
      return res.json(defaultCustomer);
    }

    const duplicateCustomer = await findCustomerByNormalizedName(customerName);
    if (duplicateCustomer) {
      return res.status(400).json({ error: `Клиент с названием "${customerName}" уже существует` });
    }

    const customer = await prisma.customer.create({
      data: {
        ...req.body,
        name: customerName,
        city: access.isAdmin ? (req.body.city || null) : (access.city || null),
        createdByUserId: req.user?.id || null,
      },
    });

    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const customerId = Number(req.params.id);
    const customerName = String(req.body?.name || '').trim();
    const { customer: current, allowed } = await getCustomerAccess(access, customerId);
    if (!current) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!customerName) {
      return res.status(400).json({ error: 'Название клиента обязательно' });
    }

    if (isDefaultCustomerName(req.body?.name)) {
      const defaultCustomer = await getCanonicalDefaultCustomer(prisma, req.user?.id || null);
      if (defaultCustomer.id !== customerId) {
        return res.status(400).json({ error: `Клиент "${DEFAULT_CUSTOMER_NAME}" уже существует` });
      }
    }

    const duplicateCustomer = await findCustomerByNormalizedName(customerName, customerId);
    if (duplicateCustomer) {
      return res.status(400).json({ error: `Клиент с названием "${customerName}" уже существует` });
    }

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: access.isAdmin ? { ...req.body, name: customerName } : { ...req.body, name: customerName, city: access.city || null },
    });
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const customerId = Number(req.params.id);
    const { customer: current, allowed } = await getCustomerAccess(access, customerId);
    if (!current) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.customer.update({
      where: { id: customerId },
      data: { active: false },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/invoices', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const customerId = Number(req.params.id);
    const { customer, allowed } = await getCustomerAccess(access, customerId);
    if (!customer) {
      return res.status(404).json({ error: 'ÐšÐ»Ð¸ÐµÐ½Ñ‚ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½' });
    }
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const invoices = await prisma.invoice.findMany({
      where: {
        customerId,
        cancelled: false,
        warehouseId: access.isAdmin ? undefined : (access.warehouseId ?? -1),
        userId: access.isAdmin ? undefined : (access.userId ?? -1),
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
      orderBy: { createdAt: 'desc' },
    });
    res.json(invoices);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/payments', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const customerId = Number(req.params.id);
    const { customer, allowed } = await getCustomerAccess(access, customerId);
    if (!customer) {
      return res.status(404).json({ error: 'ÐšÐ»Ð¸ÐµÐ½Ñ‚ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½' });
    }
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const payments = await prisma.payment.findMany({
      where: {
        customerId,
        invoice: access.isAdmin ? undefined : { warehouseId: access.warehouseId ?? -1, userId: access.userId ?? -1 },
      },
      include: {
        user: true,
        invoice: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      payments.map((p: any) => ({
        ...p,
        staff_name: p.user.username,
      })),
    );
  } catch (error) {
    next(error);
  }
});

router.get('/:id/returns', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const customerId = Number(req.params.id);
    const { customer, allowed } = await getCustomerAccess(access, customerId);
    if (!customer) {
      return res.status(404).json({ error: 'ÐšÐ»Ð¸ÐµÐ½Ñ‚ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½' });
    }
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const returns = await prisma.return.findMany({
      where: {
        customerId,
        invoice: access.isAdmin ? undefined : { warehouseId: access.warehouseId ?? -1, userId: access.userId ?? -1 },
      },
      include: {
        user: true,
        invoice: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      returns.map((r: any) => ({
        ...r,
        staff_name: r.user.username,
      })),
    );
  } catch (error) {
    next(error);
  }
});

router.get('/:id/history', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const customerId = Number(req.params.id);
    const { customer, allowed } = await getCustomerAccess(access, customerId);
    if (!customer) {
      return res.status(404).json({ error: 'ÐšÐ»Ð¸ÐµÐ½Ñ‚ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½' });
    }
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const invoices = await prisma.invoice.findMany({
      where: {
        customerId,
        cancelled: false,
        warehouseId: access.isAdmin ? undefined : (access.warehouseId ?? -1),
        userId: access.isAdmin ? undefined : (access.userId ?? -1),
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
      orderBy: { createdAt: 'desc' },
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
