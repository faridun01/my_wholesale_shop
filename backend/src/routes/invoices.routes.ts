import { Router } from 'express';
import prisma from '../db/prisma.js';
import { InvoiceService } from '../services/invoice.service.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { ensureWarehouseAccess, getAccessContext, getScopedWarehouseId } from '../utils/access.js';
import { getCanonicalDefaultCustomer } from '../utils/defaultCustomer.js';

const router = Router();

const isAdminRequest = (req: AuthRequest) => String(req.user?.role || '').toUpperCase() === 'ADMIN';
const canAccessInvoice = (
  access: Awaited<ReturnType<typeof getAccessContext>>,
  invoiceMeta: { warehouseId: number | null; userId: number | null },
) => access.isAdmin || (ensureWarehouseAccess(access, invoiceMeta.warehouseId) && invoiceMeta.userId === access.userId);


router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const warehouseId = getScopedWarehouseId(access, req.query.warehouseId);
    const invoices = await prisma.invoice.findMany({
      where: {
        warehouseId: warehouseId ?? undefined,
        userId: access.isAdmin ? undefined : (access.userId ?? -1),
      },
      include: {
        customer: true,
        user: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      invoices.map((inv: any) => {
        const totalProfit = inv.items.reduce((sum: number, item: any) => {
          return sum + (item.sellingPrice - item.costPrice) * (item.quantity - item.returnedQty);
        }, 0);

        return {
          ...inv,
          customer_name: inv.customer.name,
          staff_name: inv.user.username,
          totalProfit: String(req.user?.role || '').toUpperCase() === 'ADMIN' ? totalProfit : undefined,
        };
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const invoiceMeta = await prisma.invoice.findUnique({
      where: { id: Number(req.params.id) },
      select: { warehouseId: true, userId: true },
    });
    if (!invoiceMeta) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (!canAccessInvoice(access, invoiceMeta)) {
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
        : (await getCanonicalDefaultCustomer(prisma, userId)).id;

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

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const invoiceId = Number(req.params.id);
    const invoiceMeta = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { warehouseId: true, userId: true },
    });
    if (!invoiceMeta) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (!canAccessInvoice(access, invoiceMeta)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const requestedCustomerId = Number(req.body.customerId);
    const customerId =
      Number.isFinite(requestedCustomerId) && requestedCustomerId > 0
        ? requestedCustomerId
        : (await getCanonicalDefaultCustomer(prisma, req.user?.id || null)).id;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, active: true },
    });
    if (!customer || !customer.active) {
      return res.status(400).json({ error: 'Customer not found' });
    }

    const invoice = await InvoiceService.reassignCustomer(invoiceId, customerId);
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/cancel', async (req: AuthRequest, res, next) => {
  try {
    if (!isAdminRequest(req)) {
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
      select: { warehouseId: true, userId: true },
    });
    if (!invoiceMeta) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (!canAccessInvoice(access, invoiceMeta)) {
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
    if (!isAdminRequest(req)) {
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
