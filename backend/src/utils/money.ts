import { Prisma } from '@prisma/client';
import { fromCents, MAX_STORED_CENTS, toCents } from './financial.js';
export const roundMoney = (value: unknown, digits = 2) => {
  if (digits === 2) return fromCents(toCents(value ?? 0));
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return new Prisma.Decimal(numeric).toDecimalPlaces(digits, Prisma.Decimal.ROUND_HALF_UP).toNumber();
};

export const ceilMoney = (value: unknown, digits = 2) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return new Prisma.Decimal(numeric).toDecimalPlaces(digits, Prisma.Decimal.ROUND_CEIL).toNumber();
};

export const normalizeMoney = (value: unknown, fieldName: string, options?: { allowZero?: boolean }) => {
  const normalized = roundMoney(value);
  const allowZero = options?.allowZero ?? true;

  if (!Number.isFinite(normalized) || normalized < 0 || toCents(normalized) > MAX_STORED_CENTS || (!allowZero && normalized === 0)) {
    throw Object.assign(new Error(`${fieldName} must be a valid monetary amount`), { status: 400 });
  }

  return normalized;
};

const PAYMENT_EPSILON = 0.01;

export const getInvoiceStatus = (paidAmount: number, netAmount: number) => {
  if (toCents(paidAmount) >= toCents(netAmount)) {
    return 'paid';
  }

  if (paidAmount > 0) {
    return 'partial';
  }

  return 'unpaid';
};
