import prisma from '../db/prisma.js';
import { roundMoney } from '../utils/money.js';
import { buildCreatedAtRange, getLineCost, getLineNetRevenue } from '../routes/reports.helpers.js';
import { INVOICE_PAYMENT_STATUSES, type InvoicePaymentStatus } from '../routes/invoices.helpers.js';

const PAYMENT_EPSILON = 0.01;

type DbClient = Pick<typeof prisma, 'invoice' | 'user'>;

export type StaffStatsPeriod = {
  start?: string;
  end?: string;
  warehouseId?: number | null;
};

export type StaffStatusBucket = {
  count: number;
  amount: number;
  paid: number;
  debt: number;
};

export type StaffMetrics = {
  invoicesCount: number;
  soldAmount: number;
  paidAmount: number;
  debtAmount: number;
  returnedAmount: number;
  averageCheck: number;
  collectionRate: number;
  byStatus: Record<InvoicePaymentStatus, StaffStatusBucket>;
};

export type StaffStatsGroupRow = {
  userId: number;
  status: string | null;
  _count: { _all: number };
  _sum: {
    netAmount: unknown;
    paidAmount: unknown;
    returnedAmount: unknown;
  };
};

const STAFF_USER_SELECT = {
  id: true,
  username: true,
  role: true,
  active: true,
  warehouse: { select: { id: true, name: true } },
} as const;

const emptyBucket = (): StaffStatusBucket => ({ count: 0, amount: 0, paid: 0, debt: 0 });

const resolveBucketStatus = (status: string | null, netAmount: number, paidAmount: number): InvoicePaymentStatus => {
  if (INVOICE_PAYMENT_STATUSES.includes(status as InvoicePaymentStatus)) {
    return status as InvoicePaymentStatus;
  }
  if (paidAmount > 0 && paidAmount >= netAmount - PAYMENT_EPSILON) return 'paid';
  return paidAmount > 0 ? 'partial' : 'unpaid';
};

/**
 * Folds `invoice.groupBy(['userId', 'status'])` rows into one metrics object.
 *
 * Per-invoice paidAmount never exceeds netAmount for partial/unpaid invoices, so
 * their summed difference is the exact debt. For fully paid invoices the applied
 * payment is the invoice amount itself — any historical overpayment ("сдача")
 * must not inflate the "Оплачено" figure above what was actually sold.
 */
export const buildStaffMetrics = (rows: StaffStatsGroupRow[]): StaffMetrics => {
  const byStatus: Record<InvoicePaymentStatus, StaffStatusBucket> = {
    paid: emptyBucket(),
    partial: emptyBucket(),
    unpaid: emptyBucket(),
  };
  let returnedAmount = 0;

  for (const row of rows) {
    const netAmount = Number(row._sum.netAmount || 0);
    const rawPaid = Math.max(0, Number(row._sum.paidAmount || 0));
    const status = resolveBucketStatus(row.status, netAmount, rawPaid);
    const bucket = byStatus[status];
    const appliedPaid = status === 'paid' ? netAmount : Math.min(rawPaid, netAmount);

    bucket.count += Number(row._count._all || 0);
    bucket.amount += netAmount;
    bucket.paid += appliedPaid;
    bucket.debt += status === 'paid' ? 0 : Math.max(0, netAmount - appliedPaid);
    returnedAmount += Number(row._sum.returnedAmount || 0);
  }

  for (const bucket of Object.values(byStatus)) {
    bucket.amount = roundMoney(bucket.amount);
    bucket.paid = roundMoney(bucket.paid);
    bucket.debt = roundMoney(bucket.debt);
  }

  const invoicesCount = byStatus.paid.count + byStatus.partial.count + byStatus.unpaid.count;
  const soldAmount = roundMoney(byStatus.paid.amount + byStatus.partial.amount + byStatus.unpaid.amount);
  const paidAmount = roundMoney(byStatus.paid.paid + byStatus.partial.paid + byStatus.unpaid.paid);
  const debtAmount = roundMoney(byStatus.partial.debt + byStatus.unpaid.debt);

  return {
    invoicesCount,
    soldAmount,
    paidAmount,
    debtAmount,
    returnedAmount: roundMoney(returnedAmount),
    averageCheck: invoicesCount > 0 ? roundMoney(soldAmount / invoicesCount) : 0,
    collectionRate: soldAmount > PAYMENT_EPSILON ? Math.min(1, paidAmount / soldAmount) : 0,
    byStatus,
  };
};

const buildStatsWhere = (period: StaffStatsPeriod, userId?: number) => {
  const where: Record<string, unknown> = { cancelled: false };

  if (period.start || period.end) {
    where.createdAt = buildCreatedAtRange({ start: period.start, end: period.end });
  }
  if (period.warehouseId) {
    where.warehouseId = period.warehouseId;
  }
  if (userId) {
    where.userId = userId;
  }

  return where;
};

const groupInvoicesByStatus = (client: DbClient, where: Record<string, unknown>, byUser: boolean) =>
  (client.invoice.groupBy as any)({
    by: byUser ? ['userId', 'status'] : ['status'],
    where,
    _count: { _all: true },
    _sum: { netAmount: true, paidAmount: true, returnedAmount: true },
  }) as Promise<StaffStatsGroupRow[]>;

const isCustomerRole = (role: unknown) => String(role || '').toUpperCase() === 'CUSTOMER';

export class StaffStatsService {
  /** All staff with their sales metrics for the period, best sellers first. */
  static async getStaffStatsList(period: StaffStatsPeriod, client: DbClient = prisma) {
    const rows = await groupInvoicesByStatus(client, buildStatsWhere(period), true);

    const rowsByUser = new Map<number, StaffStatsGroupRow[]>();
    for (const row of rows) {
      const list = rowsByUser.get(row.userId) || [];
      list.push(row);
      rowsByUser.set(row.userId, list);
    }

    // Every active staff account is listed (even with zero sales, so the admin
    // sees who sold nothing), plus deactivated accounts that still have invoices
    // in the period so their history never silently disappears from the totals.
    const users = await client.user.findMany({
      where: {
        OR: [{ active: true }, { id: { in: [...rowsByUser.keys()] } }],
      },
      select: STAFF_USER_SELECT,
    });

    const staff = users
      .filter((user) => rowsByUser.has(user.id) || !isCustomerRole(user.role))
      .map((user) => ({
        ...user,
        ...buildStaffMetrics(rowsByUser.get(user.id) || []),
      }))
      .sort((a, b) => b.soldAmount - a.soldAmount || a.username.localeCompare(b.username, 'ru'));

    return {
      totals: buildStaffMetrics(rows),
      staff,
    };
  }

  /** Metrics for one staff member; `null` when the user does not exist. */
  static async getStaffSummary(
    userId: number,
    period: StaffStatsPeriod,
    options: { includeProfit: boolean },
    client: DbClient = prisma,
  ) {
    const user = await client.user.findUnique({ where: { id: userId }, select: STAFF_USER_SELECT });
    if (!user) {
      return null;
    }

    const where = buildStatsWhere(period, userId);
    const rows = await groupInvoicesByStatus(client, where, false);
    const metrics = buildStaffMetrics(rows.map((row) => ({ ...row, userId })));

    let profit: number | undefined;
    if (options.includeProfit) {
      // Same revenue/cost methodology as the Reports "Прибыль" endpoint and the
      // invoice list, so a staff member's profit never disagrees across screens.
      const invoices = await client.invoice.findMany({
        where,
        select: {
          netAmount: true,
          items: {
            select: {
              quantity: true,
              returnedQty: true,
              sellingPrice: true,
              costPrice: true,
              saleAllocations: { select: { quantity: true, batch: { select: { costPrice: true } } } },
            },
          },
        },
      });

      profit = roundMoney(
        invoices.reduce(
          (sum, invoice) =>
            sum + invoice.items.reduce((lineSum, item) => lineSum + getLineNetRevenue(invoice, item) - getLineCost(item), 0),
          0,
        ),
      );
    }

    return {
      user,
      period: { start: period.start ?? null, end: period.end ?? null },
      ...metrics,
      ...(profit !== undefined ? { profit } : {}),
    };
  }
}
