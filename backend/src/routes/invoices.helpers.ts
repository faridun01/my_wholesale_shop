import type { AccessContext } from '../utils/access.js';
import { buildCreatedAtRange } from './reports.helpers.js';

export const INVOICE_PAYMENT_STATUSES = ['paid', 'partial', 'unpaid'] as const;
export type InvoicePaymentStatus = (typeof INVOICE_PAYMENT_STATUSES)[number];

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parsePositiveInt = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const parseDateOnly = (value: unknown) =>
  typeof value === 'string' && DATE_ONLY_PATTERN.test(value) ? value : undefined;

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

  const where: Record<string, unknown> = {
    cancelled: false,
    warehouseId: warehouseId ?? undefined,
    userId: access.isAdmin ? (requestedUserId ?? undefined) : (access.userId ?? -1),
  };

  if (status) {
    where.status = status;
  }

  if (start || end) {
    where.createdAt = buildCreatedAtRange({ start, end });
  }

  return where;
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
