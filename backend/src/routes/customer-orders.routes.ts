import { Router } from 'express';
import prisma from '../db/prisma.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { InvoiceService } from '../services/invoice.service.js';
import { getAccessContext, ensureWarehouseAccess } from '../utils/access.js';
import { ceilMoney, roundMoney } from '../utils/money.js';

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

const calculateOrderTotal = (items: any[], discount = 0) => {
  const subtotal = roundMoney(items.reduce((sum, item) => {
    const quantity = normalizeNonNegative(item.totalBaseUnits ?? item.quantity);
    const sellingPrice = normalizeNonNegative(item.sellingPrice);
    const lineDiscount = Math.min(100, normalizeNonNegative(item.discount));
    const discountedUnitPrice = ceilMoney(sellingPrice * (1 - lineDiscount / 100));
    return roundMoney(sum + roundMoney(quantity * discountedUnitPrice));
  }, 0));

  const invoiceDiscountAmount = roundMoney(subtotal * (Math.min(100, normalizeNonNegative(discount)) / 100));
  return roundMoney(Math.max(0, subtotal - invoiceDiscountAmount));
};

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
      const quantity = normalizeNonNegative(item.totalBaseUnits ?? item.quantity);
      if (!product || quantity <= PAYMENT_EPSILON) {
        throw Object.assign(new Error('Некорректная позиция заказа'), { status: 400 });
      }

      return {
        productId,
        quantity,
        totalBaseUnits: quantity,
        packageQuantity: normalizeNonNegative(item.packageQuantity),
        extraUnitQuantity: normalizeNonNegative(item.extraUnitQuantity),
        packagingId: item.packagingId ? Number(item.packagingId) : null,
        packageName: item.packageName || null,
        baseUnitName: item.baseUnitName || product.baseUnitName || product.unit || null,
        unitsPerPackage: item.unitsPerPackage ? Number(item.unitsPerPackage) : null,
        sellingPrice: normalizeNonNegative(item.sellingPrice || product.sellingPrice),
        discount: normalizeNonNegative(item.discount),
      };
    });

    const discount = normalizeNonNegative(req.body?.discount);
    const totalAmount = calculateOrderTotal(items, discount);

    const order = await (prisma as any).customerOrder.create({
      data: {
        customerId: req.user.customerId,
        userId: req.user.id,
        warehouseId,
        discount,
        totalAmount,
        note: typeof req.body?.note === 'string' ? req.body.note.trim() || null : null,
        items: { create: items },
      },
      include: includeOrderDetails,
    });

    res.status(201).json(mapOrder(order));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/approve', async (req: AuthRequest, res, next) => {
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

    // Atomically claim the order before creating the invoice: only one concurrent
    // approve request can flip status away from 'pending', so a double-click or two
    // staff approving at once can never both succeed and create two invoices.
    const claim = await (prisma as any).customerOrder.updateMany({
      where: { id: orderId, status: 'pending' },
      data: { status: 'processing' },
    });
    if (claim.count === 0) {
      return res.status(400).json({ error: 'Заказ уже обработан' });
    }

    let invoice;
    try {
      invoice = await InvoiceService.createInvoice({
        customerId: order.customerId,
        userId: req.user!.id,
        warehouseId: order.warehouseId,
        items: order.items.map((item: any) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          totalBaseUnits: Number(item.totalBaseUnits ?? item.quantity),
          packageQuantity: Number(item.packageQuantity || 0),
          extraUnitQuantity: Number(item.extraUnitQuantity || 0),
          packagingId: item.packagingId || null,
          packageName: item.packageName || null,
          baseUnitName: item.baseUnitName || null,
          unitsPerPackage: item.unitsPerPackage || null,
          sellingPrice: Number(item.sellingPrice || 0),
          discount: Number(item.discount || 0),
        })),
        discount: Number(order.discount || 0),
        paidAmount: 0,
        paymentMethod: 'cash',
      });
    } catch (invoiceError) {
      // Release the claim so the order can be retried instead of getting stuck in 'processing'.
      await (prisma as any).customerOrder.updateMany({
        where: { id: orderId, status: 'processing' },
        data: { status: 'pending' },
      });
      throw invoiceError;
    }

    const updatedOrder = await (prisma as any).customerOrder.update({
      where: { id: orderId },
      data: {
        status: 'approved',
        invoiceId: invoice.id,
        approvedByUserId: req.user!.id,
        approvedAt: new Date(),
      },
      include: includeOrderDetails,
    });

    res.json({ order: mapOrder(updatedOrder), invoice });
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

    const updatedOrder = await (prisma as any).customerOrder.update({
      where: { id: orderId },
      data: {
        status: 'rejected',
        approvedByUserId: req.user!.id,
        approvedAt: new Date(),
      },
      include: includeOrderDetails,
    });

    res.json(mapOrder(updatedOrder));
  } catch (error) {
    next(error);
  }
});

export default router;
