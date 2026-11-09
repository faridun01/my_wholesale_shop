import { assertNoTaxPayload, financialError } from '../utils/financial.js';
import { operationKey, requestHash, assertReplay } from '../utils/financial-operation.js';
import { saleTotals, quantity as wholeQuantity, percentText } from '../utils/financial.js';
import { Router } from 'express';
import prisma from '../db/prisma.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { InvoiceService } from '../services/invoice.service.js';
import { getAccessContext, ensureWarehouseAccess } from '../utils/access.js';
import { normalizeMoney } from '../utils/money.js';

const router = Router();

const PAYMENT_EPSILON = 0.01;
const isCustomerRole = (role?: string) => String(role || '').toUpperCase() === 'CUSTOMER';
const isStaffRole = (role?: string) => !isCustomerRole(role);
const normalizeNonNegative = (value: unknown) => {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const includeOrderDetails = {
  customer: true,
  user: { select: { id: true, username: true, role: true } },
  warehouse: true,
  invoice: { select: { id: true, createdAt: true } },
  approvedByUser: { select: { id: true, username: true } },
  items: {
    include: {
      product: { select: { id: true, name: true, rawName: true, photoUrl: true, stock: true, warehouseId: true } },
    },
  },
} as const;

const mapOrder = (order: any) => ({
  ...order,
  customer_name: order.customer?.name || order.user?.username || 'Клиент',
  staff_name: order.approvedByUser?.username || null,
});

const calculateOrderTotal = (items: any[], discount: unknown = 0) => saleTotals(items, discount).net;

const ensureCustomerOrderAccess = async (req: AuthRequest, orderId: number) => {
  const order = await (prisma as any).customerOrder.findUnique({
    where: { id: orderId },
    include: includeOrderDetails,
  });

  if (!order) {
    return { order: null, allowed: false };
  }

  if (isCustomerRole(req.user?.role)) {
    return {
      order,
      allowed: Number(order.customerId) === Number(req.user?.customerId),
    };
  }

  const access = await getAccessContext(req);
  return {
    order,
    allowed: access.isAdmin || ensureWarehouseAccess(access, order.warehouseId),
  };
};

router.get('/pending-count', async (req: AuthRequest, res, next) => {
  try {
    if (!isStaffRole(req.user?.role)) {
      return res.json({ count: 0 });
    }

    const access = await getAccessContext(req);
    const count = await (prisma as any).customerOrder.count({
      where: {
        status: 'pending',
        warehouseId: access.isAdmin ? undefined : access.warehouseId ?? -1,
      },
    });

    res.json({ count });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const status = String(req.query.status || '').trim() || undefined;
    const access = await getAccessContext(req);
    const where = isCustomerRole(req.user?.role)
      ? { customerId: req.user?.customerId ?? -1, status }
      : {
          status,
          warehouseId: access.isAdmin ? undefined : access.warehouseId ?? -1,
        };

    const orders = await (prisma as any).customerOrder.findMany({
      where,
      include: includeOrderDetails,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    res.json(orders.map(mapOrder));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    assertNoTaxPayload(req.body);
    if (!isCustomerRole(req.user?.role)) {
      return res.status(403).json({ error: 'Только клиент может оформить заявку через этот маршрут' });
    }

    if (!req.user?.customerId) {
      return res.status(400).json({ error: 'Пользователь не привязан к клиенту' });
    }

    const warehouseId = Number(req.body?.warehouseId || req.user?.warehouseId || 0);
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (req.user?.warehouseId && Number(req.user.warehouseId) !== warehouseId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!warehouseId) {
      return res.status(400).json({ error: 'Выберите склад' });
    }

    if (rawItems.length === 0) {
      return res.status(400).json({ error: 'Корзина пустая' });
    }

    const productIds = [...new Set(rawItems.map((item: any) => Number(item.productId)).filter(Boolean))] as number[];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, warehouseId, active: true },
      include: { packagings: { where: { active: true } } },
    });
    const productsById = new Map(products.map((product: any) => [Number(product.id), product]));

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'В заявке есть товар не из выбранного склада' });
    }

    const items = rawItems.map((item: any) => {
      const productId = Number(item.productId);
      const product = productsById.get(productId);
      const quantity = wholeQuantity(item.totalBaseUnits ?? item.quantity);
      if (!product || quantity <= PAYMENT_EPSILON) {
        throw Object.assign(new Error('Некорректная позиция заказа'), { status: 400 });
      }

      return {
        productId,
        quantity,
        totalBaseUnits: quantity,
        packageQuantity: wholeQuantity(item.packageQuantity ?? 0, true),
        extraUnitQuantity: wholeQuantity(item.extraUnitQuantity ?? 0, true),
        packagingId: item.packagingId ? Number(item.packagingId) : null,
        packageName: item.packageName || null,
        baseUnitName: item.baseUnitName || product.baseUnitName || product.unit || null,
        unitsPerPackage: item.unitsPerPackage ? Number(item.unitsPerPackage) : null,
        sellingPrice: normalizeMoney(item.sellingPrice ?? product.sellingPrice, 'Item price'),
        discount: percentText(item.discount ?? 0),
      };
    });

    const discount = percentText(req.body?.discount ?? 0);
    const totalAmount = calculateOrderTotal(items, discount);

    const key = operationKey(req.body.idempotency_key);
    const hash = requestHash({ ...req.body, userId: req.user.id });
    const order = await prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
      const existing = await tx.customerOrder.findUnique({ where: { idempotencyKey: key }, include: includeOrderDetails });
      if (existing) { assertReplay(existing, hash); return existing; }
      return tx.customerOrder.create({
      data: {
        idempotencyKey: key,
        requestHash: hash,
        customerId: req.user!.customerId,
        userId: req.user!.id,
        warehouseId,
        discount,
        totalAmount,
        note: typeof req.body?.note === 'string' ? req.body.note.trim() || null : null,
        items: { create: items },
      },
      include: includeOrderDetails,
    });
    });

    res.status(201).json(mapOrder(order));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/approve', async (req: AuthRequest, res, next) => {
  try {
    assertNoTaxPayload(req.body);
    if (!isStaffRole(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const orderId = Number(req.params.id);
    const { order, allowed } = await ensureCustomerOrderAccess(req, orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const result = await prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM customer_orders WHERE id = ${orderId} FOR UPDATE`;
      const current = await tx.customerOrder.findUnique({ where: { id: orderId }, include: includeOrderDetails });
      if (current.status === 'approved' && current.invoiceId) return { order: current, invoice: await tx.invoice.findUnique({ where: { id: current.invoiceId } }) };
      if (current.status !== 'pending') throw financialError('Order is not pending');
      const invoice = await InvoiceService.createInvoice({
        idempotencyKey: `customer-order:${current.id}`,
        customerId: current.customerId,
        userId: req.user!.id,
        warehouseId: current.warehouseId,
        items: current.items.map((item: any) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          totalBaseUnits: Number(item.totalBaseUnits ?? item.quantity),
          packageQuantity: Number(item.packageQuantity || 0),
          extraUnitQuantity: Number(item.extraUnitQuantity || 0),
          packagingId: item.packagingId || null,
          packageName: item.packageName || null,
          baseUnitName: item.baseUnitName || null,
          unitsPerPackage: item.unitsPerPackage || null,
          sellingPrice: String(item.sellingPrice ?? 0),
          discount: String(item.discount ?? 0),
        })),
        discount: String(current.discount ?? 0),
        paidAmount: 0,
        paymentMethod: 'cash',
      }, tx);
      const updatedOrder = await tx.customerOrder.update({ where: { id: orderId }, data: { status: 'approved', invoiceId: invoice.id, approvedByUserId: req.user!.id, approvedAt: new Date() }, include: includeOrderDetails });
      return { order: updatedOrder, invoice };
    }, { maxWait: 10000, timeout: 120000 });
    res.json({ order: mapOrder(result.order), invoice: result.invoice });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/reject', async (req: AuthRequest, res, next) => {
  try {
    if (!isStaffRole(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const orderId = Number(req.params.id);
    const { order, allowed } = await ensureCustomerOrderAccess(req, orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Заказ уже обработан' });
    }

    const result = await (prisma as any).customerOrder.updateMany({
      where: { id: orderId, status: 'pending' },
      data: {
        status: 'rejected',
        approvedByUserId: req.user!.id,
        approvedAt: new Date(),
      },
    });
    if (result.count !== 1) return res.status(400).json({ error: 'Order has already been processed' });
    const updatedOrder = await (prisma as any).customerOrder.findUnique({ where: { id: orderId }, include: includeOrderDetails });

    res.json(mapOrder(updatedOrder));
  } catch (error) {
    next(error);
  }
});

export default router;
