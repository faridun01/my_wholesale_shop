import { describe, expect, it } from 'vitest';
import { maskInvoiceFinancials } from './customerVisibility.js';

// Every key a seller must never see a value for, wherever it sits in the response.
const FORBIDDEN = /amount|price|cost|total|paid|balance|debt|refund|credit|basis|profit|status|incoming|eligible|allocated/i;

const collectValues = (value: any, path = '', out: Array<[string, unknown]> = []) => {
  if (Array.isArray(value)) value.forEach((v) => collectValues(v, `${path}[]`, out));
  else if (value && typeof value === 'object' && !(value instanceof Date)) Object.entries(value).forEach(([k, v]) => collectValues(v, path ? `${path}.${k}` : k, out));
  else out.push([path, value]);
  return out;
};

describe('customer invoices shown to a non-admin', () => {
  const invoice = {
    id: 7, customerId: 3, userId: 2, warehouseId: 1, cancelled: false, status: 'partial', createdAt: new Date('2026-11-01'),
    customerNameSnapshot: 'Клиент', totalAmount: '100', discount: '5', netAmount: '95', paidAmount: '40', returnedAmount: '0',
    originalNetAmount: '95', originalPaidAmount: '40', originalSnapshot: { netAmount: '95', items: [{ costPrice: '60' }] },
    saleBasisAmount: '95', grossPaidAmount: '40', balancePaidAmount: '40', invoiceBalance: '55', idempotencyKey: 'k', requestHash: 'h',
    warehouse: { id: 1, name: 'Склад', city: 'Душанбе', phone: '+992' },
    user: { id: 2, username: 'seller', role: 'SELLER' },
    items: [{
      id: 11, productId: 5, quantity: 10, returnedQty: 0, productNameSnapshot: 'Товар', sellingPrice: '10', totalPrice: '100',
      costPrice: '6', eligibleNetAmount: '95', allocatedOrderDiscount: '5',
      product: { id: 5, name: 'Товар', unit: 'шт', costPrice: '6', purchaseCostPrice: '5.5', sellingPrice: '10', totalIncoming: 680, stock: 40 },
    }],
    payments: [{ id: 21, amount: '40', method: 'cash', createdAt: new Date(), returnId: null }],
    returns: [{ id: 31, totalValue: '0', refundedAmount: '0', debtReduction: '0', reason: 'брак' }],
    paymentEvents: [{ id: 21, amount: '40', method: 'cash', staff_name: 'admin' }],
    returnEvents: [{ id: 31, totalValue: '10', refundedAmount: '5', debtReduction: '5', items: [{ productName: 'Товар', quantity: 1, sellingPrice: '10', totalValue: '10' }] }],
  };

  it('keeps what goods, when, where and by whom', () => {
    const masked: any = maskInvoiceFinancials(invoice);
    expect([masked.id, masked.cancelled, masked.warehouse.name, masked.user.username]).toEqual([7, false, 'Склад', 'seller']);
    expect(masked.items[0]).toMatchObject({ productNameSnapshot: 'Товар', quantity: 10, product: { name: 'Товар', unit: 'шт' } });
    expect(masked.paymentEvents[0]).toMatchObject({ id: 21, method: 'cash' });
    expect(masked.returnEvents[0].items[0]).toEqual({ productName: 'Товар', quantity: 1 });
  });

  it('gives no amount, price, cost or payment status anywhere', () => {
    const exposed = collectValues(maskInvoiceFinancials(invoice)).filter(([path, value]) => FORBIDDEN.test(path.split('.').pop()!) && value !== 0);
    expect(exposed).toEqual([]);
    expect(JSON.stringify(maskInvoiceFinancials(invoice))).not.toMatch(/"(costPrice|purchaseCostPrice|stock|totalIncoming|originalSnapshot|status|role|idempotencyKey)"/);
  });
});
