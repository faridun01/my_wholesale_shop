import { Router } from 'express';
import prisma from '../db/prisma.js';

const router = Router();

router.get('/summary', async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get user from request (assuming auth middleware is present)
    // For now, we'll get all stats, but in a real app, we'd filter by role.
    const user = (req as any).user;
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';

    const [
      salesToday,
      totalProducts,
      totalCustomers,
      totalWarehouses,
      lowStock,
      recentSales,
      allInvoices,
      reminders
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: { createdAt: { gte: today }, cancelled: false },
        _sum: { netAmount: true },
      }),
      prisma.product.count({ where: { active: true } }),
      prisma.customer.count({ where: { active: true } }),
      prisma.warehouse.count({ where: { active: true } }),
      prisma.product.findMany({
        where: { stock: { lte: 10 }, active: true },
        take: 5,
      }),
      prisma.invoice.findMany({
        where: { cancelled: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { customer: true },
      }),
      prisma.invoice.findMany({
        where: { cancelled: false },
        include: {
          items: true
        }
      }),
      prisma.reminder.findMany({
        where: { userId: user.id, isCompleted: false },
        orderBy: { dueDate: 'asc' },
        take: 5
      })
    ]);

    // Calculate total profit and debts
    let totalProfit = 0;
    let totalDebts = 0;
    let totalRevenue = 0;

    for (const inv of allInvoices) {
      totalRevenue += Number(inv.netAmount);
      totalDebts += (Number(inv.netAmount) - Number(inv.paidAmount));
      
      if (isAdmin) {
        for (const item of inv.items) {
          const quantitySold = Number(item.quantity) - Number(item.returnedQty);
          totalProfit += (Number(item.sellingPrice) - Number(item.costPrice)) * quantitySold;
        }
      }
    }

    // Calculate top products
    const productSales: any = {};
    for (const inv of allInvoices) {
      for (const item of inv.items) {
        productSales[item.productId] = (productSales[item.productId] || 0) + item.quantity;
      }
    }

    const topProductIds = Object.keys(productSales)
      .sort((a, b) => productSales[b] - productSales[a])
      .slice(0, 5)
      .map(Number);

    const topProductsRaw = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      include: { category: true }
    });

    const topProducts = topProductsRaw.map((p: any) => ({
      ...p,
      totalSold: productSales[p.id]
    })).sort((a: any, b: any) => b.totalSold - a.totalSold);

    res.json({
      todaySales: Number(salesToday._sum.netAmount || 0),
      totalProducts,
      totalCustomers,
      totalWarehouses,
      totalRevenue,
      totalProfit: isAdmin ? totalProfit : null,
      totalDebts,
      lowStock,
      recentSales,
      topProducts,
      reminders: reminders || []
    });
  } catch (error) {
    next(error);
  }
});

export default router;
