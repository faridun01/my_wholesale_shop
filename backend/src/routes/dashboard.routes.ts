import { Router } from 'express';
import prisma from '../db/prisma.js';

const router = Router();
const safePercentChange = (current: number, previous: number) => {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return ((current - previous) / previous) * 100;
};

const getPeriodRevenue = (invoices: Array<{ createdAt: Date; netAmount: number }>, start: Date, end: Date) =>
  invoices.reduce((sum, invoice) => {
    const createdAt = new Date(invoice.createdAt);
    if (createdAt >= start && createdAt < end) {
      return sum + Number(invoice.netAmount || 0);
    }

    return sum;
  }, 0);

router.get('/summary', async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    // Get user from request (assuming auth middleware is present)
    // For now, we'll get all stats, but in a real app, we'd filter by role.
    const user = (req as any).user;
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';

    const [
      salesToday,
      totalProducts,
      totalCustomers,
      totalWarehouses,
      totalOrders,
      lowStock,
      recentSales,
      allInvoices,
      reminders,
      currentMonthInvoices,
      previousMonthInvoices,
      currentMonthCustomers,
      previousMonthCustomers,
      currentMonthProducts,
      previousMonthProducts,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: { createdAt: { gte: today }, cancelled: false },
        _sum: { netAmount: true },
      }),
      prisma.product.count({ where: { active: true } }),
      prisma.customer.count({ where: { active: true } }),
      prisma.warehouse.count({ where: { active: true } }),
      prisma.invoice.count({ where: { cancelled: false } }),
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
      }),
      prisma.invoice.findMany({
        where: {
          cancelled: false,
          createdAt: { gte: monthStart, lt: nextMonthStart },
        },
        select: { netAmount: true },
      }),
      prisma.invoice.findMany({
        where: {
          cancelled: false,
          createdAt: { gte: prevMonthStart, lt: monthStart },
        },
        select: { netAmount: true },
      }),
      prisma.customer.count({
        where: {
          active: true,
          createdAt: { gte: monthStart, lt: nextMonthStart },
        },
      }),
      prisma.customer.count({
        where: {
          active: true,
          createdAt: { gte: prevMonthStart, lt: monthStart },
        },
      }),
      prisma.product.count({
        where: {
          active: true,
          createdAt: { gte: monthStart, lt: nextMonthStart },
        },
      }),
      prisma.product.count({
        where: {
          active: true,
          createdAt: { gte: prevMonthStart, lt: monthStart },
        },
      }),
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

    const currentRevenue = currentMonthInvoices.reduce((sum, invoice) => sum + Number(invoice.netAmount || 0), 0);
    const previousRevenue = previousMonthInvoices.reduce((sum, invoice) => sum + Number(invoice.netAmount || 0), 0);
    const revenueChange = safePercentChange(currentRevenue, previousRevenue);
    const ordersChange = safePercentChange(currentMonthInvoices.length, previousMonthInvoices.length);
    const customersChange = safePercentChange(currentMonthCustomers, previousMonthCustomers);
    const productsChange = safePercentChange(currentMonthProducts, previousMonthProducts);
    const todayStart = new Date(today);
    const tomorrowStart = new Date(today);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const yesterdayStart = new Date(today);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
    const prevQuarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 - 3, 1);
    const nextQuarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 + 3, 1);
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const nextYearStart = new Date(today.getFullYear() + 1, 0, 1);
    const prevYearStart = new Date(today.getFullYear() - 1, 0, 1);

    const periodRevenue = {
      week: {
        current: getPeriodRevenue(allInvoices, weekStart, tomorrowStart),
        previous: getPeriodRevenue(allInvoices, prevWeekStart, weekStart),
      },
      month: {
        current: getPeriodRevenue(allInvoices, monthStart, nextMonthStart),
        previous: getPeriodRevenue(allInvoices, prevMonthStart, monthStart),
      },
      quarter: {
        current: getPeriodRevenue(allInvoices, quarterStart, nextQuarterStart),
        previous: getPeriodRevenue(allInvoices, prevQuarterStart, quarterStart),
      },
      year: {
        current: getPeriodRevenue(allInvoices, yearStart, nextYearStart),
        previous: getPeriodRevenue(allInvoices, prevYearStart, yearStart),
      },
      today: {
        current: getPeriodRevenue(allInvoices, todayStart, tomorrowStart),
        previous: getPeriodRevenue(allInvoices, yesterdayStart, todayStart),
      },
    };

    res.json({
      todaySales: Number(salesToday._sum.netAmount || 0),
      totalProducts,
      totalCustomers,
      totalWarehouses,
      totalOrders,
      totalRevenue,
      totalProfit: isAdmin ? totalProfit : null,
      totalDebts,
      lowStock,
      recentSales,
      topProducts,
      reminders: reminders || [],
      metricChanges: {
        revenue: revenueChange,
        orders: ordersChange,
        customers: customersChange,
        products: productsChange,
      },
      overviewChanges: {
        week: safePercentChange(periodRevenue.week.current, periodRevenue.week.previous),
        month: safePercentChange(periodRevenue.month.current, periodRevenue.month.previous),
        quarter: safePercentChange(periodRevenue.quarter.current, periodRevenue.quarter.previous),
        year: safePercentChange(periodRevenue.year.current, periodRevenue.year.previous),
        today: safePercentChange(periodRevenue.today.current, periodRevenue.today.previous),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
