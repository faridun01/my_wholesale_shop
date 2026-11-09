// Independent oracle: deliberately imports no application calculation code.
import { Prisma } from '@prisma/client';
const D = Prisma.Decimal.clone({ precision: 80, rounding: Prisma.Decimal.ROUND_HALF_UP });
export type ReferenceItem = { quantity: number; sellingPrice: string; discount?: string };
const cents = (value: Prisma.Decimal.Value) => new D(value).times(100).toDecimalPlaces(0);
export function referenceSale(items: ReferenceItem[], orderDiscount: string) {
  const gross = items.map(i => cents(i.sellingPrice).times(new D(100).minus(i.discount || 0)).div(100).ceil().times(i.quantity));
  const subtotal = gross.reduce((s, n) => s.plus(n), new D(0));
  const discount = subtotal.times(orderDiscount).div(100).toDecimalPlaces(0);
  const allocated = gross.map((g, index) => ({ index,
    value: subtotal.isZero() ? new D(0) : discount.times(g).div(subtotal).floor(),
    remainder: subtotal.isZero() ? new D(0) : discount.times(g).mod(subtotal),
  }));
  let left = discount.minus(allocated.reduce((s, a) => s.plus(a.value), new D(0))).toNumber();
  for (const row of [...allocated].sort((a, b) => b.remainder.comparedTo(a.remainder) || a.index - b.index)) {
    if (left-- <= 0) break;
    row.value = row.value.plus(1);
  }
  return { subtotal, discount, net: subtotal.minus(discount), lines: gross.map((g, index) => ({
    gross: g, discount: allocated[index].value, eligible: g.minus(allocated[index].value), quantity: items[index].quantity,
  })) };
}
export class ReferenceInvoice {
  readonly sale: ReturnType<typeof referenceSale>;
  readonly returned: number[];
  paid = new D(0);
  constructor(items: ReferenceItem[], discount: string) {
    this.sale = referenceSale(items, discount); this.returned = items.map(() => 0);
  }
  get returnedValue() {
    return this.sale.lines.reduce((sum, line, i) => sum.plus(line.eligible.times(this.returned[i]).div(line.quantity).toDecimalPlaces(0)), new D(0));
  }
  get net() { return this.sale.net.minus(this.returnedValue); }
  get debt() { return D.max(0, this.net.minus(this.paid)); }
  pay(amount: string) {
    const value = cents(amount);
    if (value.lte(0) || value.gt(this.debt)) throw new Error('Reference payment exceeds debt');
    this.paid = this.paid.plus(value);
  }
  returnGoods(index: number, quantity: number) {
    if (quantity <= 0 || this.returned[index] + quantity > this.sale.lines[index].quantity) throw new Error('Reference return exceeds quantity');
    const before = this.returnedValue;
    this.returned[index] += quantity;
    return this.returnedValue.minus(before);
  }
}
