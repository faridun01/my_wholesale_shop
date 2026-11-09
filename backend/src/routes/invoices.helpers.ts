import { Prisma } from '@prisma/client';
import type { AccessContext } from '../utils/access.js';
import { buildCreatedAtRange } from './reports.helpers.js';

export const INVOICE_PAYMENT_STATUSES = ['paid', 'partial', 'unpaid'] as const;
export type InvoicePaymentStatus = (typeof INVOICE_PAYMENT_STATUSES)[number];

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
const MAX_SEARCH_LENGTH = 100;

const parsePositiveInt = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const parseDateOnly = (value: unknown) =>
  typeof value === 'string' && DATE_ONLY_PATTERN.test(value) ? value : undefined;

// An exact moment, for callers whose "day" is not the server's day: the sales list
// sends the browser's local day boundaries, since the server may run in UTC.
const parseInstant = (value: unknown) => {
  if (typeof value !== 'string' || !INSTANT_PATTERN.test(value)) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const parseInvoiceStatus = (value: unknown): InvoicePaymentStatus | undefined =>
  INVOICE_PAYMENT_STATUSES.includes(value as InvoicePaymentStatus) ? (value as InvoicePaymentStatus) : undefined;

/**
 * Builds the `where` for the invoice list. A non-admin is always pinned to their
 * own invoices — the `userId` query filter is honoured for admins only, so a
 * seller can never read another staff member's history by passing someone
 * else's id.
 */
export const buildInvoiceListWhere = (
  access: AccessContext,
  warehouseId: number | null,
  query: Record<string, unknown>,
) => {
  const requestedUserId = access.isAdmin ? parsePositiveInt(query.userId) : null;
  const status = parseInvoiceStatus(query.status);
  const start = parseDateOnly(query.start);
  const end = parseDateOnly(query.end);
  const from = parseInstant(query.from);
  const to = parseInstant(query.to);

  const where: Record<string, unknown> = {
    cancelled: false,
    warehouseId: warehouseId ?? undefined,
    userId: access.isAdmin ? (requestedUserId ?? undefined) : (access.userId ?? -1),
  };

  if (status) {
    where.status = status;
  }

  if (from || to) {
    where.createdAt = { gte: from, lte: to };
  } else if (start || end) {
    where.createdAt = buildCreatedAtRange({ start, end });
  }

  return where;
};

const INVOICE_LIST_SORT_KEYS = ['id', 'createdAt', 'customer_name', 'netAmount', 'paidAmount', 'balance', 'status', 'staff_name'] as const;
type InvoiceListSortKey = (typeof INVOICE_LIST_SORT_KEYS)[number];

// SQL counterparts of what the list route and the sales table derive per invoice.
// Keep in step with `customer_name` in invoices.routes.ts, balancePaidAmount /
// isGoodsReturnPaymentAdjustment in utils/financial.ts and getEffectiveStatus /
// getInvoiceBalance in frontend salesViewUtils.ts.
const CUSTOMER_NAME_SQL = Prisma.sql`COALESCE(NULLIF(i.customer_name_snapshot, ''), NULLIF(c.name, ''), 'Клиент')`;
const PAYMENT_TOTALS_JOIN_SQL = Prisma.sql`
  CROSS JOIN LATERAL (
    SELECT
      GREATEST(0, COALESCE(SUM(p.amount) FILTER (
        WHERE NOT (p.amount < 0 AND p.reversal_of_id IS NULL AND (p.return_id IS NOT NULL OR lower(p.method) = 'refund'))
      ), 0)) AS balance_paid,
      COALESCE(SUM(p.amount) FILTER (WHERE p.amount > 0), 0) AS gross_paid
    FROM payments p
    WHERE p.invoice_id = i.id
  ) totals`;
const EFFECTIVE_STATUS_SQL = Prisma.sql`CASE WHEN totals.balance_paid >= i.net_amount THEN 'paid' WHEN totals.balance_paid > 0 THEN 'partial' ELSE 'unpaid' END`;

const INVOICE_LIST_SORT_SQL: Record<InvoiceListSortKey, Prisma.Sql> = {
  id: Prisma.sql`i.id`,
  createdAt: Prisma.sql`i.created_at`,
  customer_name: Prisma.sql`lower(${CUSTOMER_NAME_SQL})`,
  netAmount: Prisma.sql`i.net_amount`,
  paidAmount: Prisma.sql`LEAST(totals.gross_paid, i.net_amount)`,
  balance: Prisma.sql`GREATEST(0, i.net_amount - totals.balance_paid)`,
  status: EFFECTIVE_STATUS_SQL,
  staff_name: Prisma.sql`lower(u.username)`,
};

const escapeLikePattern = (value: string) => value.replace(/[\\%_]/g, '\\$&');

// created_at is a naive UTC timestamp. Binding it as text keeps the comparison
// independent of the database session's TimeZone.
const toTimestampSql = (date: Date) => Prisma.sql`CAST(${date.toISOString().slice(0, -1)}::text AS timestamp)`;

/**
 * Filtering, search and sorting of the invoice list on values that exist only as
 * SQL expressions. `where` comes from buildInvoiceListWhere, which stays the single
 * place that pins a seller to their own invoices.
 */
export const buildInvoiceListSql = (where: Record<string, any>, query: Record<string, unknown>) => {
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, MAX_SEARCH_LENGTH) : '';
  const paymentStatus = parseInvoiceStatus(query.paymentStatus);
  const sortKey: InvoiceListSortKey = INVOICE_LIST_SORT_KEYS.includes(query.sort as InvoiceListSortKey)
    ? (query.sort as InvoiceListSortKey)
    : 'createdAt';
  const direction = Prisma.raw(query.order === 'asc' ? 'ASC' : 'DESC');

  const conditions = [Prisma.sql`i.cancelled = ${where.cancelled}`];
  if (where.warehouseId !== undefined) conditions.push(Prisma.sql`i.warehouse_id = ${where.warehouseId}`);
  if (where.userId !== undefined) conditions.push(Prisma.sql`i.user_id = ${where.userId}`);
  if (where.status) conditions.push(Prisma.sql`i.status = ${where.status}`);
  if (where.createdAt?.gte) conditions.push(Prisma.sql`i.created_at >= ${toTimestampSql(where.createdAt.gte)}`);
  if (where.createdAt?.lte) conditions.push(Prisma.sql`i.created_at <= ${toTimestampSql(where.createdAt.lte)}`);
  if (paymentStatus) conditions.push(Prisma.sql`${EFFECTIVE_STATUS_SQL} = ${paymentStatus}`);
  if (search) {
    const pattern = `%${escapeLikePattern(search)}%`;
    conditions.push(Prisma.sql`(i.id::text LIKE ${pattern} OR ${CUSTOMER_NAME_SQL} ILIKE ${pattern})`);
  }

  const whereSql = Prisma.join(conditions, ' AND ');
  const buildFromSql = (needsCustomer: boolean, needsUser: boolean, needsPaymentTotals: boolean) => Prisma.sql`
    FROM invoices i
    ${needsCustomer ? Prisma.sql`JOIN customers c ON c.id = i.customer_id` : Prisma.empty}
    ${needsUser ? Prisma.sql`JOIN users u ON u.id = i.user_id` : Prisma.empty}
    ${needsPaymentTotals ? PAYMENT_TOTALS_JOIN_SQL : Prisma.empty}`;

  const pageFromSql = buildFromSql(
    Boolean(search) || sortKey === 'customer_name',
    sortKey === 'staff_name',
    Boolean(paymentStatus) || sortKey === 'paidAmount' || sortKey === 'balance' || sortKey === 'status',
  );
  const countFromSql = buildFromSql(Boolean(search), false, Boolean(paymentStatus));

  return {
    pageIds: (limit: number, skip: number) => Prisma.sql`
      SELECT i.id ${pageFromSql}
      WHERE ${whereSql}
      ORDER BY ${INVOICE_LIST_SORT_SQL[sortKey]} ${direction}, i.created_at DESC, i.id DESC
      LIMIT ${limit} OFFSET ${skip}`,
    count: Prisma.sql`SELECT COUNT(*)::int AS total ${countFromSql} WHERE ${whereSql}`,
  };
};

/**
 * Only an ADMIN may record a payment. When anyone else creates an invoice the
 * paid amount is forced to zero server-side, whatever the client sent, so the
 * invoice is always created as unpaid and no Payment row is written.
 */
export const sanitizeInvoiceCreatePayload = <T extends Record<string, unknown>>(body: T, isAdmin: boolean): T => {
  if (isAdmin) {
    return body;
  }

  return {
    ...body,
    paidAmount: 0,
    paymentMethod: 'cash',
  };
};
