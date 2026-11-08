import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { addMoney, allocateCents, cumulativeValue, discountedUnit, invoiceLines, refundByMethod, refundSplit, saleTotals, toCents } from './financial.js';
describe('exact financial arithmetic', () => {
  it('uses identical generated browser arithmetic', () => expect(readFileSync(new URL('./financial.ts', import.meta.url), 'utf8')).toBe(readFileSync(new URL('../../../frontend/src/utils/financial.ts', import.meta.url), 'utf8')));
  it('rounds exact money input and accepts common decimal separators', () => {
    expect(toCents('10.075')).toBe(1008); expect(toCents('-10.075')).toBe(-1008);
    expect(toCents('1 234,56')).toBe(123456); expect(toCents('1.234,56')).toBe(123456);
    expect(toCents(',5')).toBe(50); expect(() => toCents('NaN')).toThrow();
  });
  it('retains upward discounted unit rounding', () => expect(discountedUnit(.05, 10)).toBe(.05));
  it('calculates sales and discounts without tax and rejects nonzero tax input', () => {
    const sale = saleTotals([{ quantity: 1, sellingPrice: 100 }], 20);
    expect(sale).toMatchObject({ subtotal: 100, discount: 20, net: 80, lines: [{ allocatedTax: 0, eligibleNet: 80 }] });
    expect(() => saleTotals([{ quantity: 1, sellingPrice: 100 }], 0, 10)).toThrow(/tax/i);
  });
  it('uses recorded return tax only for historical returns', () => {
    const invoice = { tax: 10, discount: 0, items: [{ id: 1, quantity: 1, returnedQty: 1, totalPrice: 100, eligibleNetAmount: 100, allocatedTax: 10 }],
      returns: [{ items: [{ invoiceItemId: 1, taxAmount: 0 }] }] };
    expect(invoiceLines(invoice)[0]).toMatchObject({ returnedNetAmount: 100, returnedTax: 0, remainingTax: 10 });
    invoice.returns[0].items[0].taxAmount = 10;
    expect(invoiceLines(invoice)[0]).toMatchObject({ returnedTax: 10, remainingTax: 0 });
  });
  it('conserves discounts and refunds across generated combinations', () => {
    for (let cents = 0; cents < 100; cents++) for (const qty of [1, 2, 3, 7, 10]) for (const discount of [0, 1, 10, 33, 50, 99, 100]) {
      const sale = saleTotals([{ quantity: qty, sellingPrice: cents / 100 }, { quantity: 2, sellingPrice: .03, discount: 100 }], discount);
      expect(sale.lines.reduce((s, l) => s + toCents(l.orderDiscount), 0)).toBe(toCents(sale.discount));
      let returned = 0; for (let q = 1; q <= qty; q++) { const next = cumulativeValue(sale.lines[0].eligibleNet, q, qty); expect(next).toBeGreaterThanOrEqual(returned); returned = next; }
      expect(toCents(returned)).toBe(toCents(sale.net));
    }
  });
  it('allocates ties deterministically and preserves zero lines', () => expect(allocateCents(2, [1, 1, 1, 0])).toEqual([1, 1, 0, 0]));
  it('reduces the invoice and debt without changing recorded payments', () => {
    expect(refundSplit(200, 50, 100)).toEqual({ refundedAmount: 0, debtReduction: 100, creditAmount: 0, netAmount: 100, paidAmount: 50, debtAmount: 50 });
  });
  it('records return value above the remaining debt as customer credit', () => {
    expect(refundSplit(100, 90, 20)).toEqual({ refundedAmount: 0, debtReduction: 10, creditAmount: 10, netAmount: 80, paidAmount: 90, debtAmount: 0 });
  });
  it('allows report aggregates above a single database amount while rejecting oversized invoices', () => {
    expect(addMoney(9999999999.99, .01)).toBe(10000000000);
    expect(() => saleTotals([{ quantity: 2, sellingPrice: 9999999999.99 }])).toThrow(/database monetary range/);
  });
  it('allocates proportional mixed-method refunds with no cent loss', () => {
    expect(refundByMethod([{ method: 'cash', amount: .01 }, { method: 'card', amount: .01 }, { method: 'transfer', amount: .01 }], .02)).toEqual([{ method: 'cash', amount: .01 }, { method: 'card', amount: .01 }]);
  });
});
