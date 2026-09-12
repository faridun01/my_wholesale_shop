export const MONEY_EPSILON = 0.0001;

type DateRangeInput = {
  start?: unknown;
  end?: unknown;
};

type InvoiceRow = {
  id: number;
  createdAt: Date;
  discount?: number | null;
  customer?: { name?: string | null } | null;
  warehouse?: { name?: string | null } | null;
  items: any[];
};

type BuildRowsOptions = {
  invoices: InvoiceRow[];
  getRemainingQuantity: (item: any) => number;
  getLineNetRevenue: (invoice: any, item: any) => number;
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

function getRemainingSubtotal(items: any[]) {
  return items.reduce((sum, item) => sum + Number(item.sellingPrice || 0) * getRemainingQuantity(item), 0);
}

export function getLineNetRevenue(invoice: any, item: any) {
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

export function getLineCost(item: any) {
  const remainingQty = getRemainingQuantity(item);
  if (remainingQty <= 0) return 0;

  // StockService.deallocateStock already shrinks/deletes SaleAllocation rows by the
  // returned quantity on every return, so summing the *current* allocations already
  // yields the cost of just the remaining (post-return) quantity — re-scaling it by
  // remainingQty/originalQty here would apply the return ratio a second time and
  // understate cost (overstate profit) for any partially-returned line.
  const allocatedCost = Array.isArray(item.saleAllocations)
    ? item.saleAllocations.reduce((sum: number, alloc: any) => sum + Number(alloc.batch?.costPrice || 0) * Number(alloc.quantity || 0), 0)
    : 0;

  if (allocatedCost > MONEY_EPSILON) {
    return allocatedCost;
  }

  const averageCost = Number(item.costPrice || 0);
  return averageCost * remainingQty;
}

export const buildInvoiceLineReportRows = ({
  invoices,
  getRemainingQuantity,
  getLineNetRevenue,
  getLineCost,
  netSalesKey,
}: BuildRowsOptions) =>
  invoices.flatMap((inv) =>
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
          [netSalesKey]: revenue,
          cost_price: quantity > 0 ? cost / quantity : 0,
          profit: revenue - cost,
        };
      })
      .filter(Boolean)
  );
