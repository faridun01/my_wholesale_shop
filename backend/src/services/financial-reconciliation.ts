import { addMoney, balancePaidAmount, discountAmount, isGoodsReturnPaymentAdjustment, toCents } from '../utils/financial.js';
export function reconcileInvoices(invoices: any[]) {
  const sum = (values: unknown[]) => addMoney(...values);
  const payments = invoices.flatMap(i => i.payments || []);
  const returns = invoices.flatMap(i => i.returns || []);
  const returnAdjustments = payments.filter(isGoodsReturnPaymentAdjustment);
  const unknownReturns = returns.filter(r => r.refundedAmount == null || r.debtReduction == null).length;
  return {
    salesBeforeReturns: sum(invoices.map(i => addMoney(i.totalAmount, -discountAmount(i.totalAmount, i.discount)))),
    currentNet: sum(invoices.map(i => i.netAmount)),
    returnedValue: sum(invoices.map(i => i.returnedAmount)),
    grossCollections: sum(payments.filter(p => Number(p.amount) > 0).map(p => p.amount)),
    paymentReversals: -sum(payments.filter(p => p.reversalOfId).map(p => p.amount)),
    returnPaymentAdjustments: -sum(returnAdjustments.map(p => p.amount)),
    moneyRefunded: -sum(payments.filter(p => Number(p.amount) < 0 && !p.reversalOfId && !isGoodsReturnPaymentAdjustment(p)).map(p => p.amount)),
    netCollections: sum(payments.filter(p => !isGoodsReturnPaymentAdjustment(p)).map(p => p.amount)),
    outstandingDebt: sum(invoices.map(i => Math.max(0, addMoney(i.netAmount, -balancePaidAmount(i.payments || [], i.paidAmount))))),
    debtReduction: unknownReturns ? null : sum(returns.map(r => r.debtReduction)),
    unknownHistoricalReturns: unknownReturns,
    reconciliationExceptions: invoices.filter(i => (i.payments || []).some(isGoodsReturnPaymentAdjustment) || toCents(addMoney(i.netAmount, i.returnedAmount)) !== toCents(addMoney(i.totalAmount, -discountAmount(i.totalAmount, i.discount))) || toCents(i.paidAmount) !== toCents(sum((i.payments || []).map((p: any) => p.amount)))).length,
  };
}
