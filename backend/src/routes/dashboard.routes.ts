import { Router } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../db/prisma.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { getAccessContext, getScopedWarehouseId } from '../utils/access.js';
import {
  buildDashboardWhere,
  buildDashboardWindows,
  computeInventoryValue,
  countUniqueProductsByName,
  filterAndSortLowStock,
  safePercentChange,
} from './dashboard.helpers.js';

const router = Router();

const getInvoiceNetAmount = async (where: any) => {
  const result = await prisma.invoice.aggregate({
    where,
    _sum: { netAmount: true },
  });

  return Number(result._sum.netAmount || 0);
};

const getDashboardProfit = async (warehouseId: number | null) => {
  const rows = await prisma.$queryRaw<Array<{ totalProfit: unknown }>>(
    warehouseId
      ? Prisma.sql`
          SELECT COALESCE(SUM((ii.selling_price - ii.cost_price) * (ii.quantity - ii.returned_qty)), 0) AS "totalProfit"
          FROM invoice_items ii
          INNER JOIN invoices i ON i.id = ii.invoice_id
          WHERE i.cancelled = false AND i.warehouse_id = ${warehouseId}
        `
      : Prisma.sql`
          SELECT COALESCE(SUM((ii.selling_price - ii.cost_price) * (ii.quantity - ii.returned_qty)), 0) AS "totalProfit"
          FROM invoice_items ii
          INNER JOIN invoices i ON i.id = ii.invoice_id
          WHERE i.cancelled = false
        `
  );

  return Number(rows[0]?.totalProfit || 0);
};

router.get('/summary', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    if (!access.isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const windows = buildDashboardWindows(new Date());

    // Get user from request (assuming auth middleware is present)
    // For now, we'll get all stats, but in a real app, we'd filter by role.
    const isAdmin = access.isAdmin;
    const selectedWarehouseId = getScopedWarehouseId(access, req.query.warehouseId);
    const { invoiceWhere, productWhere, lowStockProductWhere, customerWhere, warehouseWhere } = buildDashboardWhere({
      isAdmin,
      selectedWarehouseId,
      accessWarehouseId: access.warehouseId,
      accessCity: access.city,
    });

    const [
      salesToday,
      totalProductsRaw,
      inventoryBatches,
      totalCustomers,
      totalWarehouses,
      totalOrders,
      lowStockRaw,
      recentSales,
      invoiceTotals,
      overviewSales,
      topProductSalesRaw,
      totalProfitAggregate,
      reminders,
      currentMonthInvoiceStats,
      previousMonthInvoiceStats,
      currentMonthCustomers,
      previousMonthCustomers,
      currentMonthProductsRaw,
      previousMonthProductsRaw,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: { ...invoiceWhere, createdAt: { gte: windows.todayStart, lt: windows.tomorrowStart } },
        _sum: { netAmount: true },
      }),
      prisma.product.findMany({
        where: productWhere,
        select: { id: true, name: true, createdAt: true },
      }),
      prisma.productBatch.findMany({
        where: {
          warehouseId: selectedWarehouseId ?? (isAdmin ? undefined : (access.warehouseId ?? -1)),
          remainingQuantity: { gt: 0 },
        },
        select: {
          remainingQuantity: true,
          costPrice: true,
        },
      }),
      prisma.customer.count({ where: customerWhere }),
      prisma.warehouse.count({ where: warehouseWhere }),
      prisma.invoice.count({ where: invoiceWhere }),
      prisma.product.findMany({
        where: lowStockProductWhere,
        select: {
          id: true,
          name: true,
          stock: true,
          unit: true,
          baseUnitName: true,
          packagings: {
            where: { active: true },
            select: {
              id: true,
              packageName: true,
              baseUnitName: true,
              unitsPerPackage: true,
              isDefault: true,
            },
          },
          warehouseId: true,
          warehouse: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
        },
      }),
      prisma.invoice.findMany({
        where: invoiceWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          createdAt: true,
          netAmount: true,
          status: true,
          customer: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.invoice.aggregate({
        where: invoiceWhere,
        _sum: {
          netAmount: true,
          paidAmount: true,
        },
      }),
      prisma.invoice.findMany({
        where: {
          ...invoiceWhere,
          createdAt: { gte: windows.yearStart, lt: windows.nextYearStart },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          createdAt: true,
          netAmount: true,
        },
      }),
      prisma.invoiceItem.groupBy({
        by: ['productId'],
        where: {
          invoice: invoiceWhere,
        },
        _sum: {
          quantity: true,
        },
        orderBy: {
          _sum: {
            quantity: 'desc',
          },
        },
        take: 5,
      }),
      getDashboardProfit(selectedWarehouseId),
      prisma.reminder.findMany({
        where: { userId: req.user!.id, isCompleted: false },
        orderBy: { dueDate: 'asc' },
        take: 5
      }),
      prisma.invoice.aggregate({
        where: {
          ...invoiceWhere,
          createdAt: { gte: windows.monthStart, lt: windows.nextMonthStart },
        },
        _sum: { netAmount: true },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: {
          ...invoiceWhere,
          createdAt: { gte: windows.prevMonthStart, lt: windows.monthStart },
        },
        _sum: { netAmount: true },
        _count: true,
      }),
      prisma.customer.count({
        where: {
          ...customerWhere,
          createdAt: { gte: windows.monthStart, lt: windows.nextMonthStart },
        },
      }),
      prisma.customer.count({
        where: {
          ...customerWhere,
          createdAt: { gte: windows.prevMonthStart, lt: windows.monthStart },
        },
      }),
      prisma.product.findMany({
        where: {
          ...productWhere,
          createdAt: { gte: windows.monthStart, lt: windows.nextMonthStart },
        },
        select: { name: true },
      }),
      prisma.product.findMany({
        where: {
          ...productWhere,
          createdAt: { gte: windows.prevMonthStart, lt: windows.monthStart },
        },
        select: { name: true },
      }),
    ]);

    const totalProducts = selectedWarehouseId
      ? totalProductsRaw.length
      : countUniqueProductsByName(totalProductsRaw as Array<{ name: string }>);

    const inventoryValue = computeInventoryValue(inventoryBatches);

    const currentMonthProducts = selectedWarehouseId
      ? currentMonthProductsRaw.length
      : countUniqueProductsByName(currentMonthProductsRaw as Array<{ name: string }>);

    const previousMonthProducts = selectedWarehouseId
      ? previousMonthProductsRaw.length
      : countUniqueProductsByName(previousMonthProductsRaw as Array<{ name: string }>);

    const lowStock = filterAndSortLowStock(lowStockRaw as any[]);

    const totalRevenue = Number(invoiceTotals._sum.netAmount || 0);
    const totalPaid = Number(invoiceTotals._sum.paidAmount || 0);

    const allInvoicesForDebts = await prisma.invoice.findMany({
      where: invoiceWhere,
      select: {
        netAmount: true,
        paidAmount: true,
      },
    });

    const totalDebts = allInvoicesForDebts.reduce((sum, inv) => {
      const debt = Math.max(0, Number(inv.netAmount || 0) - Number(inv.paidAmount || 0));
      return sum + debt;
    }, 0);

    const totalProfit = Number(totalProfitAggregate || 0);
    const productSales = new Map(
      topProductSalesRaw.map((item: any) => [Number(item.productId), Number(item._sum.quantity || 0)])
    );
    const topProductIds = topProductSalesRaw.map((item: any) => Number(item.productId));

    const topProductsRaw = await prisma.product.findMany({
      where: { id: { in: topProductIds }, warehouseId: isAdmin ? undefined : (access.warehouseId ?? -1) },
      select: {
        id: true,
        name: true,
        stock: true,
        unit: true,
        category: {
          select: {
            name: true,
          },
        },
      }
    });

    const topProducts = topProductsRaw.map((p: any) => ({
      ...p,
      totalSold: productSales.get(p.id) || 0
    })).sort((a: any, b: any) => b.totalSold - a.totalSold);

    const currentRevenue = Number(currentMonthInvoiceStats._sum.netAmount || 0);
    const previousRevenue = Number(previousMonthInvoiceStats._sum.netAmount || 0);
    const revenueChange = safePercentChange(currentRevenue, previousRevenue);
    const ordersChange = safePercentChange(currentMonthInvoiceStats._count, previousMonthInvoiceStats._count);
    const customersChange = safePercentChange(currentMonthCustomers, previousMonthCustomers);
    const productsChange = safePercentChange(currentMonthProducts, previousMonthProducts);
    const [
      weekCurrentRevenue,
      weekPreviousRevenue,
      monthCurrentRevenue,
      monthPreviousRevenue,
      quarterCurrentRevenue,
      quarterPreviousRevenue,
      yearCurrentRevenue,
      yearPreviousRevenue,
      todayCurrentRevenue,
      todayPreviousRevenue,
    ] = await Promise.all([
      getInvoiceNetAmount({ ...invoiceWhere, createdAt: { gte: windows.weekStart, lt: windows.tomorrowStart } }),
      getInvoiceNetAmount({ ...invoiceWhere, createdAt: { gte: windows.prevWeekStart, lt: windows.weekStart } }),
      getInvoiceNetAmount({ ...invoiceWhere, createdAt: { gte: windows.monthStart, lt: windows.nextMonthStart } }),
      getInvoiceNetAmount({ ...invoiceWhere, createdAt: { gte: windows.prevMonthStart, lt: windows.monthStart } }),
      getInvoiceNetAmount({ ...invoiceWhere, createdAt: { gte: windows.quarterStart, lt: windows.nextQuarterStart } }),
      getInvoiceNetAmount({ ...invoiceWhere, createdAt: { gte: windows.prevQuarterStart, lt: windows.quarterStart } }),
      getInvoiceNetAmount({ ...invoiceWhere, createdAt: { gte: windows.yearStart, lt: windows.nextYearStart } }),
      getInvoiceNetAmount({ ...invoiceWhere, createdAt: { gte: windows.prevYearStart, lt: windows.yearStart } }),
      getInvoiceNetAmount({ ...invoiceWhere, createdAt: { gte: windows.todayStart, lt: windows.tomorrowStart } }),
      getInvoiceNetAmount({ ...invoiceWhere, createdAt: { gte: windows.yesterdayStart, lt: windows.todayStart } }),
    ]);

    res.json({
      todaySales: Number(salesToday._sum.netAmount || 0),
      totalProducts,
      totalCustomers,
      totalWarehouses,
      totalOrders,
      selectedWarehouseId,
      totalRevenue,
      inventoryValue,
      totalProfit: isAdmin ? totalProfit : null,
      totalDebts,
      lowStock,
      recentSales,
      overviewSales: overviewSales.map((invoice: any) => ({
        id: invoice.id,
        createdAt: invoice.createdAt,
        netAmount: invoice.netAmount,
      })),
      topProducts,
      reminders: reminders || [],
      metricChanges: {
        revenue: revenueChange,
        orders: ordersChange,
        customers: customersChange,
        products: productsChange,
      },
      overviewChanges: {
        week: safePercentChange(weekCurrentRevenue, weekPreviousRevenue),
        month: safePercentChange(monthCurrentRevenue, monthPreviousRevenue),
        quarter: safePercentChange(quarterCurrentRevenue, quarterPreviousRevenue),
        year: safePercentChange(yearCurrentRevenue, yearPreviousRevenue),
        today: safePercentChange(todayCurrentRevenue, todayPreviousRevenue),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
