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
import { getTotalOutstandingDebt } from '../utils/defaultCustomer.js';

const router = Router();

// Profit = SUM(invoice.net_amount) - SUM(actual COGS). Net amount already reflects
// invoice discount/tax, and COGS prefers real batch-allocation cost (falling back to
// the item's average cost) — this matches the methodology reports.routes.ts uses
// (getLineNetRevenue/getLineCost), so Dashboard and Reports no longer diverge on
// discounted/taxed invoices.
const getDashboardProfit = async (warehouseId: number | null) => {
  const rows = await prisma.$queryRaw<Array<{ totalProfit: unknown }>>(
    warehouseId
      ? Prisma.sql`
          SELECT COALESCE(SUM(i.net_amount) - SUM(COALESCE(cost_agg.total_cost, 0)), 0) AS "totalProfit"
          FROM invoices i
          LEFT JOIN (
            SELECT ii.invoice_id,
              SUM(
                CASE WHEN COALESCE(alloc.total_alloc_cost, 0) > 0
                  THEN alloc.total_alloc_cost
                  ELSE ii.cost_price * (ii.quantity - ii.returned_qty)
                END
              ) AS total_cost
            FROM invoice_items ii
            LEFT JOIN (
              SELECT sa.invoice_item_id, SUM(pb.cost_price * sa.quantity) AS total_alloc_cost
              FROM sale_allocations sa
              INNER JOIN product_batches pb ON pb.id = sa.batch_id
              GROUP BY sa.invoice_item_id
            ) alloc ON alloc.invoice_item_id = ii.id
            GROUP BY ii.invoice_id
          ) cost_agg ON cost_agg.invoice_id = i.id
          WHERE i.cancelled = false AND i.warehouse_id = ${warehouseId}
        `
      : Prisma.sql`
          SELECT COALESCE(SUM(i.net_amount) - SUM(COALESCE(cost_agg.total_cost, 0)), 0) AS "totalProfit"
          FROM invoices i
          LEFT JOIN (
            SELECT ii.invoice_id,
              SUM(
                CASE WHEN COALESCE(alloc.total_alloc_cost, 0) > 0
                  THEN alloc.total_alloc_cost
                  ELSE ii.cost_price * (ii.quantity - ii.returned_qty)
                END
              ) AS total_cost
            FROM invoice_items ii
            LEFT JOIN (
              SELECT sa.invoice_item_id, SUM(pb.cost_price * sa.quantity) AS total_alloc_cost
              FROM sale_allocations sa
              INNER JOIN product_batches pb ON pb.id = sa.batch_id
              GROUP BY sa.invoice_item_id
            ) alloc ON alloc.invoice_item_id = ii.id
            GROUP BY ii.invoice_id
          ) cost_agg ON cost_agg.invoice_id = i.id
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
    const { invoiceWhere, debtInvoiceWhere, productWhere, lowStockProductWhere, customerWhere, warehouseWhere } = buildDashboardWhere({
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
      totalDebtsAggregate,
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
      getTotalOutstandingDebt(prisma, debtInvoiceWhere.warehouseId),
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

    const totalDebts = Number(totalDebtsAggregate || 0);

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
    const invoiceWarehouseFilter = typeof invoiceWhere.warehouseId === 'number'
      ? Prisma.sql`AND warehouse_id = ${invoiceWhere.warehouseId}`
      : Prisma.empty;
    const [revenueWindows] = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT
        COALESCE(SUM(net_amount) FILTER (WHERE created_at >= ${windows.weekStart} AND created_at < ${windows.tomorrowStart}), 0) AS "weekCurrentRevenue",
        COALESCE(SUM(net_amount) FILTER (WHERE created_at >= ${windows.prevWeekStart} AND created_at < ${windows.weekStart}), 0) AS "weekPreviousRevenue",
        COALESCE(SUM(net_amount) FILTER (WHERE created_at >= ${windows.monthStart} AND created_at < ${windows.nextMonthStart}), 0) AS "monthCurrentRevenue",
        COALESCE(SUM(net_amount) FILTER (WHERE created_at >= ${windows.prevMonthStart} AND created_at < ${windows.monthStart}), 0) AS "monthPreviousRevenue",
        COALESCE(SUM(net_amount) FILTER (WHERE created_at >= ${windows.quarterStart} AND created_at < ${windows.nextQuarterStart}), 0) AS "quarterCurrentRevenue",
        COALESCE(SUM(net_amount) FILTER (WHERE created_at >= ${windows.prevQuarterStart} AND created_at < ${windows.quarterStart}), 0) AS "quarterPreviousRevenue",
        COALESCE(SUM(net_amount) FILTER (WHERE created_at >= ${windows.yearStart} AND created_at < ${windows.nextYearStart}), 0) AS "yearCurrentRevenue",
        COALESCE(SUM(net_amount) FILTER (WHERE created_at >= ${windows.prevYearStart} AND created_at < ${windows.yearStart}), 0) AS "yearPreviousRevenue",
        COALESCE(SUM(net_amount) FILTER (WHERE created_at >= ${windows.todayStart} AND created_at < ${windows.tomorrowStart}), 0) AS "todayCurrentRevenue",
        COALESCE(SUM(net_amount) FILTER (WHERE created_at >= ${windows.yesterdayStart} AND created_at < ${windows.todayStart}), 0) AS "todayPreviousRevenue"
      FROM invoices
      WHERE cancelled = false
        AND created_at >= ${windows.prevYearStart}
        AND created_at < ${windows.nextYearStart}
        ${invoiceWarehouseFilter}
    `);

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
        week: safePercentChange(Number(revenueWindows.weekCurrentRevenue || 0), Number(revenueWindows.weekPreviousRevenue || 0)),
        month: safePercentChange(Number(revenueWindows.monthCurrentRevenue || 0), Number(revenueWindows.monthPreviousRevenue || 0)),
        quarter: safePercentChange(Number(revenueWindows.quarterCurrentRevenue || 0), Number(revenueWindows.quarterPreviousRevenue || 0)),
        year: safePercentChange(Number(revenueWindows.yearCurrentRevenue || 0), Number(revenueWindows.yearPreviousRevenue || 0)),
        today: safePercentChange(Number(revenueWindows.todayCurrentRevenue || 0), Number(revenueWindows.todayPreviousRevenue || 0)),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
