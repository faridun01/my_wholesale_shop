import { Router } from 'express';
import prisma from '../db/prisma.js';
import { InvoiceService } from '../services/invoice.service.js';
import { AuditService } from '../services/audit.service.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { ensureWarehouseAccess, getAccessContext, getScopedWarehouseId } from '../utils/access.js';
import { getCanonicalDefaultCustomer } from '../utils/defaultCustomer.js';
import { parsePaginationQuery, setPaginationHeaders } from '../utils/pagination.js';
import { getLineCost, getLineNetRevenue } from './reports.helpers.js';

const router = Router();

const isAdminRequest = (req: AuthRequest) => String(req.user?.role || '').toUpperCase() === 'ADMIN';
// A user with the canCancelInvoices grant (Settings → Users → "Может отменять
// накладные") may cancel/delete invoices in their own warehouse without being a
// full admin — this flag exists on the User model and is set via the admin UI
// specifically for this, but neither route was actually reading it (both endpoints
// hard-required ADMIN), so granting it had no effect at all until now.
const canCancelRequest = (req: AuthRequest) => isAdminRequest(req) || Boolean(req.user?.canCancelInvoices);
const canAccessInvoice = (
  access: Awaited<ReturnType<typeof getAccessContext>>,
  invoiceMeta: { warehouseId: number | null; userId: number | null },
) => access.isAdmin || (ensureWarehouseAccess(access, invoiceMeta.warehouseId) && invoiceMeta.userId === access.userId);

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const warehouseId = getScopedWarehouseId(access, req.query.warehouseId);
    const { page, limit, skip } = parsePaginationQuery(req.query, { defaultLimit: 500, maxLimit: 1000 });
    const where = {
      cancelled: false,
      warehouseId: warehouseId ?? undefined,
      userId: access.isAdmin ? undefined : (access.userId ?? -1),
    };

    // saleAllocations (real per-batch cost) are only pulled for admins, since they're
    // the only ones who see totalProfit below — avoids the extra join for every
    // regular staff request against this hot, paginated list.
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: true,
          user: true,
          items: access.isAdmin
            ? { include: { saleAllocations: { select: { quantity: true, batch: { select: { costPrice: true } } } } } }
            : true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where }),
    ]);

    setPaginationHeaders(res, { page, limit, total });

    res.json(
      invoices.map((inv: any) => {
        // Same revenue/cost methodology as the Reports "Прибыль" endpoint
        // (proportional net revenue per line + real batch-allocation cost), so an
        // invoice's profit never disagrees depending on which screen shows it.
        const totalProfit = access.isAdmin
          ? inv.items.reduce((sum: number, item: any) => sum + (getLineNetRevenue(inv, item) - getLineCost(item)), 0)
          : undefined;

        return {
          ...inv,
          customer_name: inv.customerNameSnapshot || inv.customer?.name || 'Клиент',
          staff_name: inv.user?.username || '—',
          totalProfit,
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
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
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
    if (!access.isAdmin && Number(invoiceMeta.userId || 0) !== Number(access.userId || 0)) {
      return res.status(403).json({ error: 'Можно редактировать только свои накладные' });
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

    const hasItemsUpdate = Array.isArray(req.body.items);
    const invoice = hasItemsUpdate
      ? await InvoiceService.updateInvoice(invoiceId, {
          customerId,
          userId: req.user!.id,
          isAdmin: access.isAdmin,
          items: req.body.items,
          discount: req.body.discount !== undefined ? Number(req.body.discount) : undefined,
        })
      : await InvoiceService.reassignCustomer(invoiceId, customerId);
    res.json(invoice);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/:id/cancel', async (req: AuthRequest, res, next) => {
  try {
    if (!canCancelRequest(req)) {
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
    const invoiceId = Number(req.params.id);
    // Only a full admin may force past the payment/return safety guard — a
    // canCancelInvoices grant covers ordinary cancellation, not overriding it.
    const force = access.isAdmin && String(req.query.force || '').toLowerCase() === 'true';
    const result = await InvoiceService.cancelInvoice(invoiceId, userId, { force });

    await AuditService.log({
      userId,
      action: 'CANCEL_INVOICE',
      entity: 'Invoice',
      entityId: invoiceId,
      ipAddress: req.ip,
      details: { forced: force },
    });

    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
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
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (!canCancelRequest(req)) {
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
      // Only a full admin may force past the payment/return safety guard — a
      // canCancelInvoices grant covers ordinary cancellation, not overriding it.
      const force = access.isAdmin && String(req.query.force || '').toLowerCase() === 'true';
      await InvoiceService.cancelInvoice(invoiceId, req.user!.id, { force });
    }

    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

export default router;
