import { decimal } from '../utils/financial.js';
import { reconcileInvoices } from '../services/financial-reconciliation.js';
import { WRITE_OFF_RESTORATION_REASON } from '../services/stock.service.js';
import { lineTotal, addMoney, allocateCents, balancePaidAmount, fromCents, toCents } from '../utils/financial.js';
import { Router } from 'express';
import prisma from '../db/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { getAccessContext, getScopedWarehouseId } from '../utils/access.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { commonReportsQuerySchema, transactionsQuerySchema } from '../schemas/reports.schemas.js';
import {
  buildCancelledInvoiceWhere,
  buildCreatedAtRange,
  buildInventoryWhere,
  buildInvoiceLineReportRows,
  getLineCost,
  getLineNetRevenue,
  getInvoiceLineRevenues,
  getRemainingQuantity,
  MONEY_EPSILON,
  toLocalDateKey,
} from './reports.helpers.js';
import { DEFAULT_CUSTOMER_NAME, getTotalOutstandingDebt } from '../utils/defaultCustomer.js';
import { countUniqueProductsByName } from './dashboard.helpers.js';
import { PUBLIC_USER_SELECT } from '../utils/publicUser.js';

const router = Router();

router.use(authenticate);

router.get('/reconciliation', authorize(['ADMIN']), validateRequest({ query: commonReportsQuerySchema }), async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const warehouseId = getScopedWarehouseId(access, req.query.warehouse_id);
    const invoices = await prisma.invoice.findMany({ where: buildCancelledInvoiceWhere({ warehouseId, start: req.query.start, end: req.query.end }), include: { payments: true, returns: true } });
    res.json({ ...reconcileInvoices(invoices), periodPolicy: 'invoice-created-date-with-all-subsequent-events' });
  } catch (error) { next(error); }
});

router.get('/analytics', authorize(['ADMIN']), validateRequest({ query: commonReportsQuerySchema }), async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const isAdmin = access.isAdmin;
    const warehouseId = getScopedWarehouseId(access, req.query.warehouse_id);
    const { start, end } = req.query;
    const whereClause = buildCancelledInvoiceWhere({ warehouseId, start, end });

    const [invoices, products, customers, warehouses, batches, writeoffTransactions] = await Promise.all([
      prisma.invoice.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' },
        select: {
          netAmount: true,
          discount: true,
          paidAmount: true,
          payments: { select: { amount: true, method: true, returnId: true, reversalOfId: true } },
          warehouseId: true,
          createdAt: true,
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              username: true,
            },
          },
          items: {
            select: {
              quantity: true,
              returnedQty: true,
            id: true,
            totalPrice: true,
            discount: true,
            allocatedOrderDiscount: true,
            eligibleNetAmount: true,
              sellingPrice: true,
              costPrice: true,
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
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
          returns: { select: { items: { select: { invoiceItemId: true } } } },
          warehouse: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.product.findMany({ where: { active: true, warehouseId: warehouseId ?? undefined }, select: { name: true } }),
      prisma.customer.count({
        where: {
          active: true,
          city: access.isAdmin ? undefined : (access.city ?? '__no_city__'),
          NOT: { name: { equals: DEFAULT_CUSTOMER_NAME, mode: 'insensitive' } },
        },
      }),
      prisma.warehouse.findMany({ where: access.isAdmin ? { active: true } : { active: true, id: access.warehouseId ?? -1, city: access.city ?? undefined } }),
      prisma.productBatch.findMany({
        where: {
          remainingQuantity: { gt: 0 },
          warehouseId: warehouseId ?? undefined
        }
      }),
      prisma.inventoryTransaction.findMany({
        where: buildInventoryWhere({
          type: 'adjustment',
          warehouseId,
          start,
          end,
          additional: { qtyChange: { lt: 0 }, sellingAtTime: { not: null } },
        }),
        select: {
          id: true,
          qtyChange: true,
          costAtTime: true,
          totalCost: true,
          reason: true,
          user: {
            select: {
              id: true,
              username: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const writeoffRestorations = writeoffTransactions.length ? await prisma.inventoryTransaction.findMany({
      where: { type: 'adjustment', qtyChange: { gt: 0 }, reason: { startsWith: WRITE_OFF_RESTORATION_REASON }, referenceId: { in: writeoffTransactions.map(transaction => transaction.id) } },
      select: { referenceId: true, qtyChange: true, totalCost: true, costAtTime: true },
    }) : [];
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalCost = 0;
    const totalSalesCount = invoices.length;
    // Outstanding debt is intentionally NOT scoped to the report's date range (debt
    // doesn't expire when the period ends) — shared with Dashboard so both agree.
    const totalDebtsPromise = getTotalOutstandingDebt(prisma, warehouseId ?? undefined);

    const monthlyData: any = {};
    const warehousePerformance: any = {};
    const productPerformance: Record<string, { id: number; name: string; quantity: number; revenue: number; profit: number }> = {};
    const staffPerformance: Record<string, { id: number; name: string; invoices: number; revenue: number; profit: number }> = {};
    const customerPerformance: Record<string, { id: number; name: string; invoices: number; revenue: number; debt: number }> = {};

    for (const inv of invoices) {
      // Keyed by year+month, not just the short month name, so a report spanning more
      // than one year (or a year boundary) doesn't silently merge e.g. Jan 2025 and
      // Jan 2026 into a single "янв" bar.
      const monthLabel = inv.createdAt.toLocaleString('ru-RU', { month: 'short' });
      const month = `${inv.createdAt.getFullYear()}-${String(inv.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[month]) {
        monthlyData[month] = { name: monthLabel, sales: 0, profit: 0 };
      }

      const netAmount = Number(inv.netAmount);
      const paidAmount = balancePaidAmount(inv.payments || [], inv.paidAmount);

      totalRevenue = addMoney(totalRevenue, netAmount);
      const invoiceDebt = Math.max(0, decimal(netAmount).minus(decimal(paidAmount)).toNumber());
      monthlyData[month].sales = addMoney(monthlyData[month].sales, netAmount);

      if (!warehousePerformance[inv.warehouseId]) {
        warehousePerformance[inv.warehouseId] = { name: inv.warehouse.name, sales: 0, profit: 0 };
      }
      warehousePerformance[inv.warehouseId].sales = addMoney(warehousePerformance[inv.warehouseId].sales, netAmount);

      const staffKey = String(inv.user?.id || 0);
      if (!staffPerformance[staffKey]) {
        staffPerformance[staffKey] = {
          id: Number(inv.user?.id || 0),
          name: inv.user?.username || 'Неизвестно',
          invoices: 0,
          revenue: 0,
          profit: 0,
        };
      }
      staffPerformance[staffKey].invoices += 1;
      staffPerformance[staffKey].revenue = addMoney(staffPerformance[staffKey].revenue, netAmount);

      const customerKey = String(inv.customer?.id || 0);
      if (!customerPerformance[customerKey]) {
        customerPerformance[customerKey] = {
          id: Number(inv.customer?.id || 0),
          name: inv.customer?.name || 'Без клиента',
          invoices: 0,
          revenue: 0,
          debt: 0,
        };
      }
      customerPerformance[customerKey].invoices += 1;
      customerPerformance[customerKey].revenue = addMoney(customerPerformance[customerKey].revenue, netAmount);
      customerPerformance[customerKey].debt = addMoney(customerPerformance[customerKey].debt, invoiceDebt);

      const lineRevenues = getInvoiceLineRevenues(inv);
      for (const [itemIndex, item] of inv.items.entries()) {
        const lineRevenue = lineRevenues[itemIndex];
        const lineCost = getLineCost(item);
        const lineProfit = decimal(lineRevenue).minus(decimal(lineCost)).toNumber();
        const quantity = getRemainingQuantity(item);
        const productKey = String(item.product?.id || 0);

        totalCost = addMoney(totalCost, lineCost);
        if (isAdmin) {
          totalProfit = addMoney(totalProfit, lineProfit);
          monthlyData[month].profit = addMoney(monthlyData[month].profit, lineProfit);
          warehousePerformance[inv.warehouseId].profit = addMoney(warehousePerformance[inv.warehouseId].profit, lineProfit);
          staffPerformance[staffKey].profit = addMoney(staffPerformance[staffKey].profit, lineProfit);
        }

        if (!productPerformance[productKey]) {
          productPerformance[productKey] = {
            id: Number(item.product?.id || 0),
            name: item.product?.name || 'Без названия',
            quantity: 0,
            revenue: 0,
            profit: 0,
          };
        }

        productPerformance[productKey].quantity += quantity;
        productPerformance[productKey].revenue = addMoney(productPerformance[productKey].revenue, lineRevenue);
        productPerformance[productKey].profit = addMoney(productPerformance[productKey].profit, lineProfit);
      }
    }

    const totalDebts = await totalDebtsPromise;

    const stockValuation = batches.reduce((sum: number, b: any) => addMoney(sum, lineTotal(b.remainingQuantity, b.costPrice)), 0);
    const writeoffByReason: Record<string, { name: string; quantity: number; value: number; operations: number }> = {};
    const writeoffByStaff: Record<string, { id: number; name: string; quantity: number; value: number; operations: number }> = {};
    const writeoffByProduct: Record<string, { id: number; name: string; quantity: number; value: number; operations: number }> = {};
    const writeoffByWarehouse: Record<string, { id: number; name: string; quantity: number; value: number; operations: number }> = {};

    for (const transaction of writeoffTransactions) {
      const restorations = writeoffRestorations.filter(row => row.referenceId === transaction.id);
      const restoredQuantity = restorations.reduce((sum, row) => sum + Number(row.qtyChange), 0);
      const quantity = Math.max(0, Math.abs(Number(transaction.qtyChange || 0)) - restoredQuantity);
      const value = addMoney(transaction.totalCost ?? lineTotal(Math.abs(Number(transaction.qtyChange)), transaction.costAtTime || 0),
        -addMoney(...restorations.map(row => row.totalCost ?? lineTotal(row.qtyChange, row.costAtTime || 0))));
      if (quantity === 0) continue;
      const normalizedReason = String(transaction.reason || '').replace(/^.*?:\s*/i, '').trim() || 'Списание';
      const cleanReason = /^write-?off$/i.test(normalizedReason)
        ? 'Списание'
        : (normalizedReason.charAt(0).toUpperCase() + normalizedReason.slice(1));
      const reasonKey = cleanReason.toLowerCase();
      const staffKey = String(transaction.user?.id || 0);
      const productKey = String(transaction.product?.id || 0);

      if (!writeoffByReason[reasonKey]) {
        writeoffByReason[reasonKey] = { name: cleanReason, quantity: 0, value: 0, operations: 0 };
      }
      writeoffByReason[reasonKey].quantity += quantity;
      writeoffByReason[reasonKey].value = decimal(writeoffByReason[reasonKey].value).plus(value).toNumber();
      writeoffByReason[reasonKey].operations += 1;

      if (!writeoffByStaff[staffKey]) {
        writeoffByStaff[staffKey] = {
          id: Number(transaction.user?.id || 0),
          name: transaction.user?.username || 'Неизвестно',
          quantity: 0,
          value: 0,
          operations: 0,
        };
      }
      writeoffByStaff[staffKey].quantity += quantity;
      writeoffByStaff[staffKey].value = decimal(writeoffByStaff[staffKey].value).plus(value).toNumber();
      writeoffByStaff[staffKey].operations += 1;

      if (!writeoffByProduct[productKey]) {
        writeoffByProduct[productKey] = {
          id: Number(transaction.product?.id || 0),
          name: transaction.product?.name || 'Без названия',
          quantity: 0,
          value: 0,
          operations: 0,
        };
      }
      writeoffByProduct[productKey].quantity += quantity;
      writeoffByProduct[productKey].value = decimal(writeoffByProduct[productKey].value).plus(value).toNumber();
      writeoffByProduct[productKey].operations += 1;

      const warehouseKey = String(transaction.warehouse?.id || 0);
      if (!writeoffByWarehouse[warehouseKey]) {
        writeoffByWarehouse[warehouseKey] = {
          id: Number(transaction.warehouse?.id || 0),
          name: transaction.warehouse?.name || 'Без склада',
          quantity: 0,
          value: 0,
          operations: 0,
        };
      }
      writeoffByWarehouse[warehouseKey].quantity += quantity;
      writeoffByWarehouse[warehouseKey].value = decimal(writeoffByWarehouse[warehouseKey].value).plus(value).toNumber();
      writeoffByWarehouse[warehouseKey].operations += 1;
    }

    res.json({
      summary: {
        totalRevenue,
        totalProfit: isAdmin ? totalProfit : null,
        totalCost: isAdmin ? totalCost : null,
        totalSalesCount,
        totalCustomers: customers,
        totalProducts: warehouseId ? products.length : countUniqueProductsByName(products),
        totalDebts,
        stockValuation: isAdmin ? stockValuation : null,
        margin: isAdmin ? (totalRevenue > 0 ? decimal(totalProfit).div(decimal(totalRevenue)).times(decimal(100)).toNumber() : 0) : null,
      },
      chartData: Object.values(monthlyData),
      warehousePerformance: Object.values(warehousePerformance),
      productPerformance: Object.values(productPerformance)
        .sort((a, b) => decimal(b.profit).minus(decimal(a.profit)).toNumber())
        .slice(0, 20),
      staffPerformance: Object.values(staffPerformance)
        .sort((a, b) => decimal(b.revenue).minus(decimal(a.revenue)).toNumber())
        .slice(0, 20),
      customerPerformance: Object.values(customerPerformance)
        .sort((a, b) => decimal(b.revenue).minus(decimal(a.revenue)).toNumber())
        .slice(0, 20),
      customerDebts: Object.values(customerPerformance)
        .filter((item) => item.debt > MONEY_EPSILON)
        .sort((a, b) => decimal(b.debt).minus(decimal(a.debt)).toNumber())
        .slice(0, 20),
      writeoffReasons: Object.values(writeoffByReason)
        .sort((a, b) => decimal(b.value).minus(a.value).toNumber())
        .slice(0, 20),
      writeoffByStaff: Object.values(writeoffByStaff)
        .sort((a, b) => decimal(b.value).minus(a.value).toNumber())
        .slice(0, 20),
      writeoffByProduct: Object.values(writeoffByProduct)
        .sort((a, b) => decimal(b.value).minus(a.value).toNumber())
        .slice(0, 20),
      writeoffByWarehouse: Object.values(writeoffByWarehouse)
        .sort((a, b) => decimal(b.value).minus(a.value).toNumber())
        .slice(0, 20),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/sales', authorize(['ADMIN']), validateRequest({ query: commonReportsQuerySchema }), async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const warehouseId = getScopedWarehouseId(access, req.query.warehouse_id);
    const { start, end } = req.query;
    const where = buildCancelledInvoiceWhere({ warehouseId, start, end });

    const invoices = await prisma.invoice.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        discount: true,
        netAmount: true,
        customer: { select: { name: true } },
        warehouse: { select: { name: true } },
        items: {
          select: {
            quantity: true,
            returnedQty: true,
            id: true,
            totalPrice: true,
            discount: true,
            allocatedOrderDiscount: true,
            eligibleNetAmount: true,
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
        returns: { select: { items: { select: { invoiceItemId: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const report = buildInvoiceLineReportRows({
      invoices,
      getRemainingQuantity,
      getLineNetRevenue,
      getLineCost,
      netSalesKey: 'total_sales',
      getInvoiceLineRevenues,
    });

    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.get('/profit', validateRequest({ query: commonReportsQuerySchema }), async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    if (!access.isAdmin) {
      return res.status(403).json({ error: 'Доступ запрещен. Только для администратора.' });
    }

    const warehouseId = getScopedWarehouseId(access, req.query.warehouse_id);
    const { start, end } = req.query;
    const where = buildCancelledInvoiceWhere({ warehouseId, start, end });

    const invoices = await prisma.invoice.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        discount: true,
        netAmount: true,
        customer: { select: { name: true } },
        warehouse: { select: { name: true } },
        items: {
          select: {
            quantity: true,
            returnedQty: true,
            id: true,
            totalPrice: true,
            discount: true,
            allocatedOrderDiscount: true,
            eligibleNetAmount: true,
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
        returns: { select: { items: { select: { invoiceItemId: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const report = buildInvoiceLineReportRows({
      invoices,
      getRemainingQuantity,
      getLineNetRevenue,
      getLineCost,
      netSalesKey: 'net_sales',
      getInvoiceLineRevenues,
    });

    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.get('/returns', authorize(['ADMIN']), validateRequest({ query: commonReportsQuerySchema }), async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const warehouseId = getScopedWarehouseId(access, req.query.warehouse_id);
    const { start, end } = req.query;
    const returns = await prisma.return.findMany({
      where: { createdAt: buildCreatedAtRange({ start, end }), invoice: { cancelled: false, warehouseId: warehouseId ?? undefined } },
      include: { user: { select: PUBLIC_USER_SELECT }, invoice: { include: { warehouse: true } }, items: { include: { invoiceItem: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const report = returns.flatMap((r: any) => {
      const base = { return_id: r.id, invoice_id: r.invoiceId, date: toLocalDateKey(r.createdAt), warehouse_name: r.invoice?.warehouse?.name || '', staff_name: r.user?.username || '', reason: r.reason };
      if (!r.items.length) return [{ ...base, product_name: 'Historical return (item details unavailable)', unit: '', quantity: null, selling_price: null, total_value: Number(r.totalValue), refunded_amount: r.refundedAmount == null ? null : Number(r.refundedAmount), debt_reduction: r.debtReduction == null ? null : Number(r.debtReduction), credit_amount: r.creditAmount == null ? null : Number(r.creditAmount), legacy: true }];
      const weights = r.items.map((i: any) => toCents(i.totalValue));
      const refundParts = r.refundedAmount == null ? null : allocateCents(toCents(r.refundedAmount), weights);
      const debtParts = r.debtReduction == null ? null : allocateCents(toCents(r.debtReduction), weights);
      const creditParts = r.creditAmount == null ? null : allocateCents(toCents(r.creditAmount), weights);
      return r.items.map((i: any, index: number) => ({ ...base, product_name: i.invoiceItem.productNameSnapshot || `Invoice item #${i.invoiceItemId}`, unit: i.invoiceItem.baseUnitNameSnapshot || '', quantity: i.quantity, selling_price: Number(i.sellingPrice), total_value: Number(i.totalValue), refunded_amount: refundParts ? fromCents(refundParts[index]) : null, debt_reduction: debtParts ? fromCents(debtParts[index]) : null, credit_amount: creditParts ? fromCents(creditParts[index]) : null, legacy: false }));
    });

    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.get('/writeoffs', authorize(['ADMIN', 'MANAGER']), validateRequest({ query: commonReportsQuerySchema }), async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const warehouseId = getScopedWarehouseId(access, req.query.warehouse_id);
    const { start, end } = req.query;
    const where = buildInventoryWhere({
      type: 'adjustment',
      warehouseId,
      start,
      end,
      additional: {
        qtyChange: { lt: 0 },
        sellingAtTime: { not: null },
      },
    });

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        product: true,
        warehouse: true,
        user: { select: PUBLIC_USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });

    const transactionIds = transactions.map((transaction: any) => Number(transaction.id)).filter((id: number) => Number.isFinite(id) && id > 0);
    const returnTransactions = transactionIds.length
      ? await prisma.inventoryTransaction.findMany({
          where: {
            type: 'adjustment',
            qtyChange: { gt: 0 },
            reason: { startsWith: WRITE_OFF_RESTORATION_REASON },
            referenceId: { in: transactionIds },
          },
          select: {
            referenceId: true,
            qtyChange: true,
            totalCost: true,
            costAtTime: true,
          },
        })
      : [];

    const report = transactions.map((t: any) => {
      const returnedQty = returnTransactions
        .filter(
          (candidate: any) =>
            Number(candidate.referenceId || 0) === Number(t.id) &&
            Number(candidate.qtyChange || 0) > 0
        )
        .reduce((sum: number, candidate: any) => sum + Number(candidate.qtyChange || 0), 0);

      const originalQty = Math.abs(Number(t.qtyChange || 0));
      const originalValue = t.totalCost == null ? lineTotal(originalQty, t.costAtTime || 0) : Number(t.totalCost);
      const returnedValue = addMoney(...returnTransactions.filter(row => row.referenceId === t.id).map(row => row.totalCost ?? lineTotal(row.qtyChange, row.costAtTime || 0)));

      return {
        transaction_id: t.id,
        date: toLocalDateKey(t.createdAt),
        warehouse_name: t.warehouse?.name || '',
        staff_name: t.user?.username || '',
        product_name: t.product?.name || '',
        unit: t.product?.unit || '',
        quantity: originalQty,
        returned_qty: returnedQty,
        cost_price: Number(t.costAtTime || 0),
        original_value: originalValue,
        returned_value: returnedValue,
        total_value: addMoney(originalValue, -returnedValue),
        cost_precision: t.totalCost == null ? 'legacy-average-only' : 'exact-fifo',

        reason: (() => {
          const raw = String(t.reason || '').replace(/^.*?:\s*/i, '').trim();
          if (!raw || /^write-?off$/i.test(raw)) return 'Списание';
          return raw.charAt(0).toUpperCase() + raw.slice(1);
        })(),
        can_return: originalQty > returnedQty,
        can_delete: returnedQty <= 0,
        status:
          returnedQty <= 0
            ? 'writeoff'
            : returnedQty < originalQty
              ? 'partial_return'
              : 'full_return',
      };
    }).filter((row) => row.status !== 'full_return');

    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.get('/transactions', validateRequest({ query: transactionsQuerySchema }), async (req: AuthRequest, res, next) => {
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
        user: { select: PUBLIC_USER_SELECT },
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
