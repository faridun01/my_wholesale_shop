import { decimal } from '../utils/financial.js';
import { addMoney, allocateCents, fromCents, invoiceLines, lineTotal, toCents } from '../utils/financial.js';
export const MONEY_EPSILON = 0.0001;

type DateRangeInput = {
  start?: unknown;
  end?: unknown;
};

type InvoiceRow = {
  id: number;
  createdAt: Date;
  discount?: number | string | { toString(): string } | null;
  customer?: { name?: string | null } | null;
  warehouse?: { name?: string | null } | null;
  items: any[];
};

type BuildRowsOptions = {
  invoices: InvoiceRow[];
  getRemainingQuantity: (item: any) => number;
  getLineNetRevenue: (invoice: any, item: any) => number;
  getInvoiceLineRevenues?: (invoice: any) => number[];
  getLineCost: (item: any) => number;
  netSalesKey: 'total_sales' | 'net_sales';
};

const parseReportDate = (value: unknown, endOfDay = false) => {
  if (!value) return undefined;

  const raw = String(value);
  // A bare "YYYY-MM-DD" (what the date-range picker sends) is parsed by `new Date()`
  // as UTC midnight, while endOfDay's setHours(23,59,59,999) below mutates in the
  // server's LOCAL timezone — on any non-UTC server that mismatch shifts the range
  // boundaries by the UTC offset, silently excluding early transactions on the first
  // day. Build date-only strings as local dates instead, matching how
  // dashboard.helpers.ts's buildDashboardWindows constructs its boundaries.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(raw);

  if (Number.isNaN(date.getTime())) return undefined;

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
};

export const buildCreatedAtRange = ({ start, end }: DateRangeInput) => ({
  gte: parseReportDate(start),
  lte: parseReportDate(end, true),
});

// Calendar day in the server's time zone, the same one parseReportDate builds report
// periods in, so a row is never labelled with a day outside its own period.
export const toLocalDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const buildCancelledInvoiceWhere = (options: {
  warehouseId: number | null;
  start?: unknown;
  end?: unknown;
}) => {
  const where: any = {
    cancelled: false,
    createdAt: buildCreatedAtRange(options),
  };

  if (options.warehouseId) {
    where.warehouseId = options.warehouseId;
  }

  return where;
};

export const buildInventoryWhere = (options: {
  type: string;
  warehouseId: number | null;
  start?: unknown;
  end?: unknown;
  additional?: Record<string, unknown>;
}) => {
  const where: any = {
    type: options.type,
    createdAt: buildCreatedAtRange(options),
    ...(options.additional || {}),
  };

  if (options.warehouseId) {
    where.warehouseId = options.warehouseId;
  }

  return where;
};

// Shared line-level revenue/cost methodology, used by both the sales/profit
// reports and the invoice list's per-invoice profit figure, so the two never
// drift onto different definitions of "profit" for the same invoice again.
export function getRemainingQuantity(item: any) {
  return Math.max(0, Number(item?.quantity || 0) - Number(item?.returnedQty || 0));
}

export function getLineNetRevenue(invoice: any, item: any) {
  const items = invoice.items || [];
  const index = items.indexOf(item);
  if (index < 0 || getRemainingQuantity(item) <= 0 || toCents(invoice.netAmount ?? 0) <= 0) return 0;
  return getInvoiceLineRevenues(invoice)[index];
}

// Request-local calculation: allocate once per invoice, never cache mutable
// invoice data across requests or financial operations.
export function getInvoiceLineRevenues(invoice: any): number[] {
  const items: any[] = invoice.items || [];
  if (toCents(invoice.netAmount ?? 0) <= 0 || !items.some(item => getRemainingQuantity(item) > 0)) return items.map(() => 0);
  const lines = invoiceLines(invoice);
  const weights = lines.map(l => toCents(l.remainingNetAmount));
  if (weights.every(w => w === 0)) return items.map(() => 0);
  // Stored current invoice total is authoritative for legacy records too. Expose
  // reconciliation anomalies separately; never manufacture undiscounted revenue.
  return allocateCents(toCents(invoice.netAmount), weights).map((value, index) =>
    getRemainingQuantity(items[index]) > 0 ? fromCents(value) : 0);
}

export function getLineCost(item: any) {
  const remainingQty = getRemainingQuantity(item);
  if (remainingQty <= 0) return 0;

  // StockService.deallocateStock already shrinks/deletes SaleAllocation rows by the
  // returned quantity on every return, so summing the *current* allocations already
  // yields the cost of just the remaining (post-return) quantity — re-scaling it by
  // remainingQty/originalQty here would apply the return ratio a second time and
  // understate cost (overstate profit) for any partially-returned line.
  const allocatedCost = Array.isArray(item.saleAllocations)
    ? item.saleAllocations.reduce((sum: number, alloc: any) => addMoney(sum, lineTotal(alloc.quantity || 0, alloc.batch?.costPrice || 0)), 0)
    : 0;

  if (Array.isArray(item.saleAllocations) && item.saleAllocations.length > 0) {
    return allocatedCost;
  }

  const averageCost = Number(item.costPrice || 0);
  return lineTotal(remainingQty, averageCost);
}

export const buildInvoiceLineReportRows = ({
  invoices,
  getRemainingQuantity,
  getLineNetRevenue,
  getInvoiceLineRevenues,
  getLineCost,
  netSalesKey,
}: BuildRowsOptions) =>
  invoices.flatMap((inv) => {
    const revenues = getInvoiceLineRevenues?.(inv);
    return inv.items
      .map((item: any, index: number) => {
        const quantity = getRemainingQuantity(item);
        if (quantity <= 0) return null;

        const revenue = revenues ? revenues[index] : getLineNetRevenue(inv, item);
        const cost = getLineCost(item);

        return {
          invoice_id: inv.id,
          date: toLocalDateKey(inv.createdAt),
          warehouse_name: inv.warehouse?.name || '',
          customer_name: inv.customer?.name || '',
          product_name: item.product.name,
          unit: item.product.unit || '',
          quantity,
          selling_price: Number(item.sellingPrice),
          gross_sales: lineTotal(quantity, item.sellingPrice),
          discount_percent: Number(inv.discount || 0),
          [netSalesKey]: revenue,
          cost_price: quantity > 0 ? decimal(cost).div(decimal(quantity)).toNumber() : 0,
          profit: addMoney(revenue, -cost),
        };
      })
      .filter(Boolean);
  });
