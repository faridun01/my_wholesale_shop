import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { calculateEffectiveCostPrice } from './product-packaging.js';
import { ceilMoney, roundMoney } from './money.js';
import { decimal, financialPayload, addMoney, allocateCents, assertNoTaxPayload, cumulativeValue, discountedUnit, invoiceLines, refundByMethod, refundSplit, saleTotals, toCents } from './financial.js';
describe('exact financial arithmetic', () => {
  it('preserves decimal text over JSON without changing IDs or quantities', () => {
    expect(financialPayload({ id: 7, quantity: 3, amount: '10.075000000000000001', items: [{ sellingPrice: .1, discount: '33.333333333333333333' }] })).toEqual({
      id: 7, quantity: 3, amount: '10.075000000000000001', items: [{ sellingPrice: '0.1', discount: '33.333333333333333333' }],
    });
    expect(decimal('0.1').plus('0.2').toString()).toBe('0.3');
  });
  it('rounds purchase charges and decimal boundaries explicitly', () => {
    expect(calculateEffectiveCostPrice(.1, 10)).toBe(.11);
    expect(calculateEffectiveCostPrice(10, .75)).toBe(10.08);
    expect(ceilMoney(1.01)).toBe(1.01);
    expect(ceilMoney(1.001)).toBe(1.01);
    expect(roundMoney(10.075)).toBe(10.08);
    expect(() => calculateEffectiveCostPrice(-1, 0)).toThrow();
    expect(() => calculateEffectiveCostPrice(1, -1)).toThrow();
  });
  it('preserves three payments and reduces 1000 by a goods return of 150', () => {
    const paid = addMoney(200, 200, 200);
    expect(refundSplit(1000, paid, 150)).toEqual({ refundedAmount: 0, debtReduction: 150, creditAmount: 0, netAmount: 850, paidAmount: 600, debtAmount: 250 });
    expect(refundSplit(850, paid, 350)).toMatchObject({ netAmount: 500, paidAmount: 600, debtAmount: 0, creditAmount: 0 });
  });
  it('rejects nonzero tax before rounding, including sub-cent amounts', () => {
    for (const tax of ['0.004', '-0.001', '1e-20']) expect(() => assertNoTaxPayload({ tax })).toThrow();
    expect(() => assertNoTaxPayload({ tax: '0.000' })).not.toThrow();
  });
  it('sums cents exactly without order-dependent floating point accumulation', () => {
    expect(addMoney(...Array(10000).fill(.01))).toBe(100);
    expect(addMoney(9999999999.99, .01, -9999999999.99)).toBe(.01);
  });
  it('uses identical generated browser arithmetic', () => expect(readFileSync(new URL('./financial.ts', import.meta.url), 'utf8')).toBe(readFileSync(new URL('../../../frontend/src/utils/financial.ts', import.meta.url), 'utf8')));
  it('rounds exact money input and accepts common decimal separators', () => {
    expect(toCents('10.075')).toBe(1008); expect(toCents('-10.075')).toBe(-1008);
    expect(toCents('1 234,56')).toBe(123456); expect(toCents('1.234,56')).toBe(123456);
    expect(toCents(',5')).toBe(50); expect(() => toCents('NaN')).toThrow();
  });
  it('retains upward discounted unit rounding', () => expect(discountedUnit(.05, 10)).toBe(.05));
  it('calculates sales and discounts without a tax component', () => {
    const sale = saleTotals([{ quantity: 1, sellingPrice: 100 }], 20);
    expect(sale).toMatchObject({ subtotal: 100, discount: 20, net: 80, lines: [{ eligibleNet: 80 }] });
    expect(() => assertNoTaxPayload({ items: [{ taxAmount: 1 }] })).toThrow(/tax/i);
  });
  it('ignores legacy tax fields in return calculations', () => {
    const invoice = { tax: 10, discount: 0, items: [{ id: 1, quantity: 1, returnedQty: 1, totalPrice: 100, eligibleNetAmount: 100, allocatedTax: 10 }],
      returns: [{ items: [{ invoiceItemId: 1, taxAmount: 0 }] }] };
    expect(invoiceLines(invoice)[0]).toMatchObject({ returnedNetAmount: 100, remainingNetAmount: 0 });
    expect(invoiceLines(invoice)[0]).not.toHaveProperty('remainingTax');
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
  it('preserves payments without creating credit when returns exceed debt', () => {
    expect(refundSplit(100, 90, 20)).toEqual({ refundedAmount: 0, debtReduction: 10, creditAmount: 0, netAmount: 80, paidAmount: 90, debtAmount: 0 });
  });
  it('allows report aggregates above a single database amount while rejecting oversized invoices', () => {
    expect(addMoney(9999999999.99, .01)).toBe(10000000000);
    expect(() => saleTotals([{ quantity: 2, sellingPrice: 9999999999.99 }])).toThrow(/database monetary range/);
  });
  it('allocates proportional mixed-method refunds with no cent loss', () => {
    expect(refundByMethod([{ method: 'cash', amount: .01 }, { method: 'card', amount: .01 }, { method: 'transfer', amount: .01 }], .02)).toEqual([{ method: 'cash', amount: .01 }, { method: 'card', amount: .01 }]);
  });
});
