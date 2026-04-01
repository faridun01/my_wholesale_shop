import { Router } from 'express';
import prisma from '../db/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { getAccessContext, getScopedWarehouseId } from '../utils/access.js';

const router = Router();
const MONEY_EPSILON = 0.0001;

function getRemainingQuantity(item: any) {
  return Math.max(0, Number(item?.quantity || 0) - Number(item?.returnedQty || 0));
}

function getInvoiceSubtotal(items: any[]) {
  return items.reduce((sum, item) => sum + Number(item.sellingPrice || 0) * Number(item.quantity || 0), 0);
}

function getRemainingSubtotal(items: any[]) {
  return items.reduce((sum, item) => sum + Number(item.sellingPrice || 0) * getRemainingQuantity(item), 0);
}

function getLineNetRevenue(invoice: any, item: any) {
  const remainingQty = getRemainingQuantity(item);
  if (remainingQty <= 0) return 0;

  const remainingSubtotal = getRemainingSubtotal(invoice.items || []);
  const lineRemainingSubtotal = Number(item.sellingPrice || 0) * remainingQty;
  const invoiceNetAmount = Number(invoice.netAmount || 0);

  if (remainingSubtotal <= MONEY_EPSILON) {
    return lineRemainingSubtotal;
  }

  if (invoiceNetAmount <= MONEY_EPSILON) {
    return lineRemainingSubtotal;
  }

  return (lineRemainingSubtotal / remainingSubtotal) * invoiceNetAmount;
}

function getLineCost(item: any) {
  const originalQty = Number(item?.quantity || 0);
  const remainingQty = getRemainingQuantity(item);
  if (remainingQty <= 0) return 0;

  const allocatedCost = Array.isArray(item.saleAllocations)
    ? item.saleAllocations.reduce((sum: number, alloc: any) => sum + Number(alloc.batch?.costPrice || 0) * Number(alloc.quantity || 0), 0)
    : 0;

  if (allocatedCost > MONEY_EPSILON) {
    if (originalQty > MONEY_EPSILON && remainingQty < originalQty) {
      return allocatedCost * (remainingQty / originalQty);
    }
    return allocatedCost;
  }

  const averageCost = Number(item.costPrice || 0);
  return averageCost * remainingQty;
}

router.use(authenticate);

router.get('/analytics', authorize(['ADMIN']), async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const isAdmin = access.isAdmin;
    const warehouseId = getScopedWarehouseId(access, req.query.warehouse_id);

    const whereClause: any = { cancelled: false };
    if (warehouseId) whereClause.warehouseId = warehouseId;

    const [invoices, products, customers, warehouses, batches] = await Promise.all([
      prisma.invoice.findMany({
        where: whereClause,
        select: {
          netAmount: true,
          paidAmount: true,
          warehouseId: true,
          createdAt: true,
          items: {
            select: {
              sellingPrice: true,
              saleAllocations: {
                select: {
                  quantity: true,
                  batch: {
                    select: {
                      costPrice: true,
                    },
                  },
                },
              },
            },
          },
          warehouse: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.product.findMany({ where: { active: true, warehouseId: warehouseId ?? undefined } }),
      prisma.customer.findMany({ where: { active: true, city: access.isAdmin ? undefined : (access.city ?? '__no_city__') } }),
      prisma.warehouse.findMany({ where: access.isAdmin ? { active: true } : { active: true, id: access.warehouseId ?? -1, city: access.city ?? undefined } }),
      prisma.productBatch.findMany({
        where: {
          remainingQuantity: { gt: 0 },
          warehouseId: warehouseId ?? undefined
        }
      }),
    ]);

    let totalRevenue = 0;
    let totalProfit = 0;
    let totalCost = 0;
    const totalSalesCount = invoices.length;
    let totalDebts = 0;

    const monthlyData: any = {};
    const warehousePerformance: any = {};

    for (const inv of invoices) {
      const month = inv.createdAt.toLocaleString('ru-RU', { month: 'short' });
      if (!monthlyData[month]) {
        monthlyData[month] = { name: month, sales: 0, profit: 0 };
      }

      const netAmount = Number(inv.netAmount);
      const paidAmount = Number(inv.paidAmount);

      totalRevenue += netAmount;
      totalDebts += Math.max(0, netAmount - paidAmount);
      monthlyData[month].sales += netAmount;

      if (!warehousePerformance[inv.warehouseId]) {
        warehousePerformance[inv.warehouseId] = { name: inv.warehouse.name, sales: 0, profit: 0 };
      }
      warehousePerformance[inv.warehouseId].sales += netAmount;

      for (const item of inv.items) {
        const lineRevenue = getLineNetRevenue(inv, item);
        const lineCost = getLineCost(item);
        const lineProfit = lineRevenue - lineCost;

        totalCost += lineCost;
        if (isAdmin) {
          totalProfit += lineProfit;
          monthlyData[month].profit += lineProfit;
          warehousePerformance[inv.warehouseId].profit += lineProfit;
        }
      }
    }

    const stockValuation = batches.reduce((sum: number, b: any) => sum + (Number(b.costPrice) * b.remainingQuantity), 0);

    res.json({
      summary: {
        totalRevenue,
        totalProfit: isAdmin ? totalProfit : null,
        totalCost: isAdmin ? totalCost : null,
        totalSalesCount,
        totalCustomers: customers.length,
        totalProducts: products.length,
        totalDebts,
        stockValuation: isAdmin ? stockValuation : null,
        margin: isAdmin ? (totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0) : null,
      },
      chartData: Object.values(monthlyData),
      warehousePerformance: Object.values(warehousePerformance),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/sales', authorize(['ADMIN']), async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const warehouseId = getScopedWarehouseId(access, req.query.warehouse_id);
    const { start, end } = req.query;
    const where: any = {
      cancelled: false,
      createdAt: {
        gte: start ? new Date(start as string) : undefined,
        lte: end ? new Date(end as string) : undefined,
      },
    };
    if (warehouseId) where.warehouseId = warehouseId;

    const invoices = await prisma.invoice.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        customer: { select: { name: true } },
        warehouse: { select: { name: true } },
        items: {
          select: {
            quantity: true,
            returnedQty: true,
            sellingPrice: true,
            costPrice: true,
            product: { select: { name: true, unit: true } },
            saleAllocations: {
              select: {
                quantity: true,
                batch: { select: { costPrice: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const report = invoices.flatMap((inv: any) =>
      inv.items
        .map((item: any) => {
          const quantity = getRemainingQuantity(item);
          if (quantity <= 0) return null;

          const revenue = getLineNetRevenue(inv, item);
          const cost = getLineCost(item);

          return {
            invoice_id: inv.id,
            date: inv.createdAt.toISOString().split('T')[0],
            warehouse_name: inv.warehouse?.name || '',
            customer_name: inv.customer?.name || '',
            product_name: item.product.name,
            unit: item.product.unit || '',
            quantity,
            selling_price: Number(item.sellingPrice),
            gross_sales: Number(item.sellingPrice) * quantity,
            discount_percent: Number(inv.discount || 0),
            total_sales: revenue,
            cost_price: quantity > 0 ? cost / quantity : 0,
            profit: revenue - cost,
          };
        })
        .filter(Boolean)
    );

    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.get('/profit', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    if (!access.isAdmin) {
      return res.status(403).json({ error: '?????? ????????. ?????? ??? ???????????????.' });
    }

    const warehouseId = getScopedWarehouseId(access, req.query.warehouse_id);
    const { start, end } = req.query;
    const where: any = {
      cancelled: false,
      createdAt: {
        gte: start ? new Date(start as string) : undefined,
        lte: end ? new Date(end as string) : undefined,
      },
    };
    if (warehouseId) where.warehouseId = warehouseId;

    const invoices = await prisma.invoice.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        discount: true,
        customer: { select: { name: true } },
        warehouse: { select: { name: true } },
        items: {
          select: {
            quantity: true,
            returnedQty: true,
            sellingPrice: true,
            costPrice: true,
            product: { select: { name: true, unit: true } },
            saleAllocations: {
              select: {
                quantity: true,
                batch: { select: { costPrice: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const report = invoices.flatMap((inv: any) =>
      inv.items
        .map((item: any) => {
          const quantity = getRemainingQuantity(item);
          if (quantity <= 0) return null;

          const revenue = getLineNetRevenue(inv, item);
          const cost = getLineCost(item);

          return {
            invoice_id: inv.id,
            date: inv.createdAt.toISOString().split('T')[0],
            warehouse_name: inv.warehouse?.name || '',
            customer_name: inv.customer?.name || '',
            product_name: item.product.name,
            unit: item.product.unit || '',
            quantity,
            selling_price: Number(item.sellingPrice),
            gross_sales: Number(item.sellingPrice) * quantity,
            discount_percent: Number(inv.discount || 0),
            net_sales: revenue,
            cost_price: quantity > 0 ? cost / quantity : 0,
            profit: revenue - cost,
          };
        })
        .filter(Boolean)
    );

    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.get('/returns', authorize(['ADMIN']), async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const warehouseId = getScopedWarehouseId(access, req.query.warehouse_id);
    const { start, end } = req.query;
    const where: any = {
      type: 'return',
      createdAt: {
        gte: start ? new Date(start as string) : undefined,
        lte: end ? new Date(end as string) : undefined,
      },
    };
    if (warehouseId) where.warehouseId = warehouseId;

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        product: true,
        warehouse: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const report = transactions
      .map((t: any) => ({
        return_id: t.referenceId || t.id,
        date: t.createdAt.toISOString().split('T')[0],
        warehouse_name: t.warehouse?.name || '',
        staff_name: t.user?.username || '',
        product_name: t.product.name,
        unit: t.product.unit || '',
        quantity: Math.abs(t.qtyChange),
        selling_price: Number(t.sellingAtTime || 0),
        total_value: Math.abs(t.qtyChange) * Number(t.sellingAtTime || 0),
        reason: t.reason,
      }))
      .filter((row) => !/^Invoice #\d+ Cancelled$/i.test(String(row.reason || '').trim()));

    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.get('/writeoffs', authorize(['ADMIN', 'MANAGER']), async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const warehouseId = getScopedWarehouseId(access, req.query.warehouse_id);
    const { start, end } = req.query;
    const where: any = {
      type: 'adjustment',
      qtyChange: { lt: 0 },
      sellingAtTime: { not: null },
      createdAt: {
        gte: start ? new Date(start as string) : undefined,
        lte: end ? new Date(end as string) : undefined,
      },
    };
    if (warehouseId) where.warehouseId = warehouseId;

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        product: true,
        warehouse: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const report = transactions.map((t: any) => ({
      date: t.createdAt.toISOString().split('T')[0],
      warehouse_name: t.warehouse?.name || '',
      staff_name: t.user?.username || '',
      product_name: t.product?.name || '',
      unit: t.product?.unit || '',
      quantity: Math.abs(Number(t.qtyChange || 0)),
      cost_price: Number(t.costAtTime || 0),
      total_value: Math.abs(Number(t.qtyChange || 0)) * Number(t.costAtTime || 0),
      reason: String(t.reason || '').replace(/^.*?:\s*/i, '').trim() || 'Write-off',
    }));

    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.get('/transactions', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    if (!access.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { productId, type, limit = 50 } = req.query;
    const warehouseId = getScopedWarehouseId(access, req.query.warehouseId);
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        productId: productId ? Number(productId) : undefined,
        warehouseId: warehouseId ?? undefined,
        type: type as string || undefined,
      },
      include: {
        product: true,
        warehouse: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });
    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

export default router;
