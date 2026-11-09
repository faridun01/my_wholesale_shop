import { describe, expect, it } from 'vitest';
import { ReferenceInvoice, referenceSale, type ReferenceItem } from '../testing/financial-reference.js';
import { addMoney, invoiceLines, refundSplit, saleTotals, toCents } from '../utils/financial.js';

describe('independent Decimal oracle and generated state transitions', () => {
  it('matches 4000 generated sales, allocations, payments and sequential returns', () => {
    let seed = 93017;
    const rand = (limit: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % limit; };
    for (let sample = 0; sample < 4000; sample++) {
      const items: ReferenceItem[] = Array.from({ length: 1 + rand(4) }, () => ({ quantity: 1 + rand(8), sellingPrice: (rand(100001) / 100).toFixed(2), discount: String([0, 5, 10, 33.333, 50, 99, 100][rand(7)]) }));
      const discount = String([0, .125, 10, 25, 50, 99, 100][rand(7)]);
      const expected = referenceSale(items, discount);
      const actual = saleTotals(items, discount);
      expect(toCents(actual.subtotal)).toBe(expected.subtotal.toNumber());
      expect(toCents(actual.discount)).toBe(expected.discount.toNumber());
      expect(toCents(actual.net)).toBe(expected.net.toNumber());
      actual.lines.forEach((line, index) => expect(toCents(line.orderDiscount)).toBe(expected.lines[index].discount.toNumber()));
      const model = new ReferenceInvoice(items, discount);
      const paid = model.sale.net.div(2).floor().div(100).toFixed(2);
      if (Number(paid) > 0) model.pay(paid);
      let net = actual.net;
      const originalPaid = Number(paid);
      for (let index = 0; index < items.length; index++) {
        for (let q = 1; q <= items[index].quantity; q++) {
          const event = model.returnGoods(index, 1);
          const invoice = { discount, items: items.map((item, i) => ({ ...item, totalPrice: actual.lines[i].total, eligibleNetAmount: actual.lines[i].eligibleNet, allocatedOrderDiscount: actual.lines[i].orderDiscount, returnedQty: model.returned[i] })) };
          const result = refundSplit(net, originalPaid, event.div(100).toNumber());
          net = result.netAmount;
          expect(toCents(net)).toBe(model.net.toNumber());
          expect(toCents(result.debtAmount)).toBe(model.debt.toNumber());
          expect(result.paidAmount).toBe(originalPaid);
          expect(result.refundedAmount).toBe(0);
          expect(result.creditAmount).toBe(0);
          expect(toCents(addMoney(...invoiceLines(invoice).map(line => line.remainingNetAmount)))).toBe(model.net.toNumber());
        }
      }
      expect(net).toBe(0);
      expect(model.returnedValue.eq(model.sale.net)).toBe(true);
    }
  }, 30000);
});
