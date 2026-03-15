import { Router } from 'express';
import prisma from '../db/prisma.js';
import { InvoiceService } from '../services/invoice.service.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { ensureWarehouseAccess, getAccessContext, getScopedWarehouseId } from '../utils/access.js';

const router = Router();
const DEFAULT_CUSTOMER_NAME = 'Без названия';
const canCancelInvoice = (req: AuthRequest) => {
  const role = req.user?.role?.toUpperCase();
  return role === 'ADMIN' || role === 'MANAGER' || Boolean(req.user?.canCancelInvoices);
};

const resolveDefaultCustomerId = async (warehouseId: number, userId: number, fallbackCity?: string | null) => {
  const warehouse = await prisma.warehouse.findUnique({
    where: { id: warehouseId },
    select: { city: true },
  });
  const city = warehouse?.city ?? fallbackCity ?? null;

  let customer = await prisma.customer.findFirst({
    where: {
      active: true,
      name: DEFAULT_CUSTOMER_NAME,
      city,
    },
    select: { id: true },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: DEFAULT_CUSTOMER_NAME,
        city,
        createdByUserId: userId,
        notes: 'Технический клиент по умолчанию',
      },
      select: { id: true },
    });
  }

  return customer.id;
};

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const warehouseId = getScopedWarehouseId(access, req.query.warehouseId);
    const invoices = await prisma.invoice.findMany({
      where: {
        warehouseId: warehouseId ?? undefined,
      },
      include: {
        customer: true,
        user: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invoices.map((inv: any) => {
      const totalProfit = inv.items.reduce((sum: number, item: any) => {
        return sum + (item.sellingPrice - item.costPrice) * (item.quantity - item.returnedQty);
      }, 0);

      return {
        ...inv,
        customer_name: inv.customer.name,
        staff_name: inv.user.username,
        totalProfit: String(req.user?.role || '').toUpperCase() === 'ADMIN' ? totalProfit : undefined,
      };
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const invoiceMeta = await prisma.invoice.findUnique({
      where: { id: Number(req.params.id) },
      select: { warehouseId: true },
    });
    if (!invoiceMeta) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (!access.isAdmin && !ensureWarehouseAccess(access, invoiceMeta.warehouseId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const invoice = await InvoiceService.getInvoiceDetails(Number(req.params.id));
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const userId = req.user!.id;
    const warehouseId = access.isAdmin ? Number(req.body.warehouseId) : access.warehouseId;
    if (!warehouseId) {
      return res.status(400).json({ error: 'Warehouse ID is required' });
    }

    const requestedCustomerId = Number(req.body.customerId);
    const customerId =
      Number.isFinite(requestedCustomerId) && requestedCustomerId > 0
        ? requestedCustomerId
        : await resolveDefaultCustomerId(warehouseId, userId, access.city);

    const invoice = await InvoiceService.createInvoice({
      ...req.body,
      customerId,
      userId,
      warehouseId,
    });
    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/cancel', async (req: AuthRequest, res, next) => {
  try {
    if (!canCancelInvoice(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const access = await getAccessContext(req);
    const invoiceMeta = await prisma.invoice.findUnique({
      where: { id: Number(req.params.id) },
      select: { warehouseId: true },
    });
    if (!invoiceMeta) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (!access.isAdmin && !ensureWarehouseAccess(access, invoiceMeta.warehouseId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const userId = req.user!.id;
    const result = await InvoiceService.cancelInvoice(Number(req.params.id), userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/return', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const invoiceMeta = await prisma.invoice.findUnique({
      where: { id: Number(req.params.id) },
      select: { warehouseId: true },
    });
    if (!invoiceMeta) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (!access.isAdmin && !ensureWarehouseAccess(access, invoiceMeta.warehouseId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const userId = req.user!.id;
    const result = await InvoiceService.returnItems(Number(req.params.id), {
      ...req.body,
      userId,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (!canCancelInvoice(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const access = await getAccessContext(req);

    const invoiceId = Number(req.params.id);
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, cancelled: true, warehouseId: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (!access.isAdmin && !ensureWarehouseAccess(access, invoice.warehouseId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!invoice.cancelled) {
      await InvoiceService.cancelInvoice(invoiceId, req.user!.id);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
