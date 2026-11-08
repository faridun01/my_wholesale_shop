import { addMoney, discountAmount, toCents } from '../utils/financial.js';
export function reconcileInvoices(invoices: any[]) {
  const sum = (values: unknown[]) => addMoney(...values);
  const payments = invoices.flatMap(i => i.payments || []);
  const returns = invoices.flatMap(i => i.returns || []);
  const unknownReturns = returns.filter(r => r.refundedAmount == null || r.debtReduction == null).length;
  return {
    salesBeforeReturns: sum(invoices.map(i => addMoney(i.totalAmount, -discountAmount(i.totalAmount, i.discount), i.tax))),
    currentNet: sum(invoices.map(i => i.netAmount)),
    returnedValue: sum(invoices.map(i => i.returnedAmount)),
    grossCollections: sum(payments.filter(p => Number(p.amount) > 0).map(p => p.amount)),
    paymentReversals: -sum(payments.filter(p => p.reversalOfId).map(p => p.amount)),
    moneyRefunded: -sum(payments.filter(p => Number(p.amount) < 0 && !p.reversalOfId).map(p => p.amount)),
    netCollections: sum(payments.map(p => p.amount)),
    outstandingDebt: sum(invoices.map(i => Math.max(0, addMoney(i.netAmount, -Number(i.paidAmount))))),
    debtReduction: unknownReturns ? null : sum(returns.map(r => r.debtReduction)),
    unknownHistoricalReturns: unknownReturns,
    reconciliationExceptions: invoices.filter(i => toCents(addMoney(i.netAmount, i.returnedAmount)) !== toCents(addMoney(i.totalAmount, -discountAmount(i.totalAmount, i.discount), i.tax)) || toCents(i.paidAmount) !== toCents(sum((i.payments || []).map((p: any) => p.amount)))).length,
  };
}
