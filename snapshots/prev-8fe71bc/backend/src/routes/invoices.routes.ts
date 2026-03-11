import { Router } from 'express';
import prisma from '../db/prisma.js';
import { InvoiceService } from '../services/invoice.service.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

const router = Router();
const canCancelInvoice = (req: AuthRequest) => {
  const role = req.user?.role?.toUpperCase();
  return role === 'ADMIN' || role === 'MANAGER' || Boolean(req.user?.canCancelInvoices);
};

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { warehouseId } = req.query;
    const invoices = await prisma.invoice.findMany({
      where: {
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
      },
      include: {
        customer: true,
        user: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invoices.map(inv => {
      const totalProfit = inv.items.reduce((sum, item) => {
        return sum + (item.sellingPrice - item.costPrice) * (item.quantity - item.returnedQty);
      }, 0);

      return {
        ...inv,
        customer_name: inv.customer.name,
        staff_name: inv.user.username,
        totalProfit: req.user?.role === 'ADMIN' || req.user?.role === 'admin' || req.user?.role === 'MANAGER' ? totalProfit : undefined,
      };
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const invoice = await InvoiceService.getInvoiceDetails(Number(req.params.id));
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const warehouseId = req.user!.warehouseId || req.body.warehouseId;
    if (!warehouseId) {
      return res.status(400).json({ error: 'Warehouse ID is required' });
    }

    const invoice = await InvoiceService.createInvoice({
      ...req.body,
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

    const userId = req.user!.id;
    const result = await InvoiceService.cancelInvoice(Number(req.params.id), userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/return', async (req: AuthRequest, res, next) => {
  try {
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

    const invoiceId = Number(req.params.id);
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, cancelled: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
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
