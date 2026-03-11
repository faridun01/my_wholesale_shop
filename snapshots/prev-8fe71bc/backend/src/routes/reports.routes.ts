import { Router } from 'express';
import prisma from '../db/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

// Apply authentication to all routes in this router
router.use(authenticate);

router.get('/analytics', authorize(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const user = (req as any).user;
    const role = user?.role?.toUpperCase();
    const isAdmin = role === 'ADMIN' || role === 'MANAGER';
    const { warehouse_id } = req.query;

    const whereClause: any = { cancelled: false };
    if (warehouse_id) whereClause.warehouseId = Number(warehouse_id);

    const [invoices, products, customers, warehouses, batches] = await Promise.all([
      prisma.invoice.findMany({
        where: whereClause,
        include: {
          items: {
            include: {
              saleAllocations: {
                include: { batch: true }
              }
            }
          },
          warehouse: true
        }
      }),
      prisma.product.findMany({ where: { active: true } }),
      prisma.customer.findMany({ where: { active: true } }),
      prisma.warehouse.findMany({ where: { active: true } }),
      prisma.productBatch.findMany({ 
        where: { 
          remainingQuantity: { gt: 0 },
          warehouseId: warehouse_id ? Number(warehouse_id) : undefined
        } 
      }),
    ]);

    let totalRevenue = 0;
    let totalProfit = 0;
    let totalCost = 0;
    let totalSalesCount = invoices.length;
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
      totalDebts += (netAmount - paidAmount);
      monthlyData[month].sales += netAmount;

      if (!warehousePerformance[inv.warehouseId]) {
        warehousePerformance[inv.warehouseId] = { name: inv.warehouse.name, sales: 0, profit: 0 };
      }
      warehousePerformance[inv.warehouseId].sales += netAmount;

      for (const item of inv.items) {
        for (const alloc of item.saleAllocations) {
          const cost = Number(alloc.batch.costPrice) * alloc.quantity;
          const profit = (Number(item.sellingPrice) - Number(alloc.batch.costPrice)) * alloc.quantity;
          
          totalCost += cost;
          if (isAdmin) {
            totalProfit += profit;
            monthlyData[month].profit += profit;
            warehousePerformance[inv.warehouseId].profit += profit;
          }
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

router.get('/sales', authorize(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const { start, end, warehouse_id } = req.query;
    const where: any = {
      cancelled: false,
      createdAt: {
        gte: start ? new Date(start as string) : undefined,
        lte: end ? new Date(end as string) : undefined,
      },
    };
    if (warehouse_id) where.warehouseId = Number(warehouse_id);

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const report = invoices.flatMap(inv => 
      inv.items.map(item => ({
        date: inv.createdAt.toISOString().split('T')[0],
        product_name: item.product.name,
        quantity: item.quantity,
        selling_price: Number(item.sellingPrice),
        total_sales: Number(item.sellingPrice) * item.quantity,
      }))
    );

    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.get('/profit', async (req, res, next) => {
  try {
    const user = (req as any).user;
    const role = user?.role?.toUpperCase();
    const isAdmin = role === 'ADMIN' || role === 'MANAGER';
    if (!isAdmin) {
      return res.status(403).json({ error: 'Доступ запрещен. Только для администраторов.' });
    }

    const { start, end, warehouse_id } = req.query;
    const where: any = {
      cancelled: false,
      createdAt: {
        gte: start ? new Date(start as string) : undefined,
        lte: end ? new Date(end as string) : undefined,
      },
    };
    if (warehouse_id) where.warehouseId = Number(warehouse_id);

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
            saleAllocations: { include: { batch: true } }
          }
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const report = invoices.flatMap(inv => 
      inv.items.map(item => {
        const cost = item.saleAllocations.reduce((sum, alloc) => sum + (Number(alloc.batch.costPrice) * alloc.quantity), 0);
        const revenue = Number(item.sellingPrice) * item.quantity;
        return {
          date: inv.createdAt.toISOString().split('T')[0],
          product_name: item.product.name,
          quantity: item.quantity,
          selling_price: Number(item.sellingPrice),
          cost_price: cost / item.quantity,
          profit: revenue - cost,
        };
      })
    );

    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.get('/returns', authorize(['ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const { start, end, warehouse_id } = req.query;
    const where: any = {
      type: 'return',
      createdAt: {
        gte: start ? new Date(start as string) : undefined,
        lte: end ? new Date(end as string) : undefined,
      },
    };
    if (warehouse_id) where.warehouseId = Number(warehouse_id);

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: { product: true },
      orderBy: { createdAt: 'asc' },
    });

    const report = transactions.map(t => ({
      date: t.createdAt.toISOString().split('T')[0],
      product_name: t.product.name,
      quantity: Math.abs(t.qtyChange),
      selling_price: 0, // Returns might not have selling price directly in transaction
      reason: t.reason,
    }));

    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.get('/transactions', async (req, res, next) => {
  try {
    const { productId, warehouseId, type, limit = 50 } = req.query;
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        productId: productId ? Number(productId) : undefined,
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
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
