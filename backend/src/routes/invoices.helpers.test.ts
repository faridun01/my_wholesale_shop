import { describe, it, expect } from 'vitest';
import { buildInvoiceListWhere, sanitizeInvoiceCreatePayload } from './invoices.helpers.js';

const seller = { isAdmin: false, userId: 7, warehouseId: 1, city: null };
const admin = { isAdmin: true, userId: 1, warehouseId: null, city: null };

describe('buildInvoiceListWhere', () => {
  it('pins a seller to their own invoices even when another userId is requested', () => {
    const where = buildInvoiceListWhere(seller, 1, { userId: '99' });

    expect(where.userId).toBe(7);
    expect(where.cancelled).toBe(false);
  });

  it('lets an admin filter by staff member, status and period', () => {
    const where: any = buildInvoiceListWhere(admin, null, {
      userId: '5',
      status: 'partial',
      start: '2026-10-01',
      end: '2026-10-31',
    });

    expect(where.userId).toBe(5);
    expect(where.status).toBe('partial');
    expect(where.createdAt.gte).toEqual(new Date(2026, 9, 1));
    expect(where.createdAt.lte).toEqual(new Date(2026, 9, 31, 23, 59, 59, 999));
  });

  it('ignores unknown statuses and malformed ids/dates', () => {
    const where = buildInvoiceListWhere(admin, null, { userId: 'abc', status: 'cancelled', start: 'yesterday' });

    expect(where.userId).toBeUndefined();
    expect(where).not.toHaveProperty('status');
    expect(where).not.toHaveProperty('createdAt');
  });
});

describe('sanitizeInvoiceCreatePayload', () => {
  it('forces a non-admin invoice to be created unpaid', () => {
    const payload = sanitizeInvoiceCreatePayload({ items: [], paidAmount: 500, paymentMethod: 'card' }, false);

    expect(payload.paidAmount).toBe(0);
    expect(payload.paymentMethod).toBe('cash');
  });

  it('keeps the admin payment untouched', () => {
    const body = { items: [], paidAmount: 500, paymentMethod: 'card' };

    expect(sanitizeInvoiceCreatePayload(body, true)).toBe(body);
  });
});
