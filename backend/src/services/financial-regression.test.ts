import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../db/prisma.js', () => ({ default: { $transaction: vi.fn(), payment: {}, expense: {} } }));
vi.mock('../middlewares/auth.middleware.js', () => ({ authenticate: (_req: any, _res: any, next: any) => next(), authorize: () => (_req: any, _res: any, next: any) => next() }));
vi.mock('./stock.service.js', () => ({ StockService: { allocateStock: vi.fn(async () => 0), deallocateStock: vi.fn(async () => {}), updateProductStockCache: vi.fn(async () => {}) } }));
import prisma from '../db/prisma.js';
import { InvoiceService } from './invoice.service.js';
import { StockService } from './stock.service.js';
import { getLineCost, getLineNetRevenue } from '../routes/reports.helpers.js';
import { buildStaffMetrics } from './staff-stats.service.js';
import paymentRouter from '../routes/payments.routes.js';
import expenseRouter from '../routes/expenses.routes.js';
import reportRouter from '../routes/reports.routes.js';
import invoiceRouter from '../routes/invoices.routes.js';
import productRouter from '../routes/products.routes.js';

let invoice: any, payments: any[], returns: any[], tx: any;
function reset(quantity = 3, price = .05, discount = 10, paid = 0) {
  const subtotal = Math.round(quantity * price * 100) / 100;
  invoice = { id: 1, userId: 1, customerId: 1, warehouseId: 1, discount, totalAmount: subtotal,
    netAmount: subtotal - Math.round(subtotal * discount) / 100, paidAmount: paid, returnedAmount: 0,
    items: [{ id: 1, productId: 1, quantity, totalBaseUnits: quantity, sellingPrice: price, discount: 0,
      totalPrice: subtotal, returnedQty: 0, product: { name: 'A' } }], payments: [], returns: [] };
  payments = paid ? [{ id: 1, amount: paid, method: 'card' }] : []; returns = [];
}
const ret = (quantity: number, key: string = crypto.randomUUID()) => InvoiceService.returnItems(1, {
  items: [{ invoiceItemId: 1, quantity }], reason: 'regression', userId: 1, idempotencyKey: key, refundMethod: 'card',
} as any);
const handler = (router: any, path: string, method: string) => router.stack.find((l: any) => l.route?.path === path && l.route.methods[method]).route.stack[0].handle;
async function invoke(fn: any, body: any = {}, params: any = {}) {
  let result: any; const res: any = { status: () => res, json: (v: any) => { result = v; } };
  await fn({ body, params, user: { id: 1, role: 'ADMIN' } }, res, (error: any) => { throw error; }); return result;
}
async function invokeResponse(fn: any, body: any = {}, params: any = {}) {
  let status = 200, result: any;
  const res: any = { status: (value: number) => { status = value; return res; }, json: (value: any) => { result = value; } };
  await fn({ body, params, user: { id: 1, role: 'ADMIN' } }, res, (error: any) => { throw error; });
  return { status, body: result };
}
beforeEach(() => {
  vi.clearAllMocks(); reset();
  tx = { $queryRaw: vi.fn(async () => [structuredClone(invoice)]),
    customer: { findUnique: async () => ({ id: 1, name: 'Customer' }) }, companyProfile: { findFirst: async () => null },
    product: { findMany: async () => [{ id: 1, warehouseId: 1, stock: 100, packagings: [], name: 'A' }] },
    invoice: { findUnique: async () => structuredClone({ ...invoice, payments, returns }), create: async ({ data }: any) => Object.assign(invoice, data), update: vi.fn(async ({ data }: any) => Object.assign(invoice, data)) },
    invoiceItem: { create: async ({ data }: any) => { const item = { id: 1, ...data, returnedQty: 0 }; invoice.items = [item]; return item; }, update: async ({ data }: any) => { if (data.returnedQty) invoice.items[0].returnedQty += data.returnedQty.increment; }, deleteMany: async () => {} },
    return: { findUnique: async ({ where }: any) => returns.find(r => r.idempotencyKey === where.idempotencyKey), create: async ({ data }: any) => { const r = { id: returns.length + 1, ...data, items: data.items?.create || [] }; returns.push(r); return r; }, deleteMany: async () => {} },
    invoiceRevision: { create: async () => ({}) },
    inventoryTransaction: { create: async () => {}, deleteMany: async () => {} },
    payment: { findUnique: async ({ where }: any) => payments.find(p => p.idempotencyKey === where.idempotencyKey), findMany: async () => payments,
      create: vi.fn(async ({ data }: any) => { const p = { id: payments.length + 1, ...data }; payments.push(p); return p; }), delete: vi.fn(async () => {}) },
  };
  (prisma.$transaction as any).mockImplementation(async (fn: any) => fn(tx));
});
describe('audit regressions: transactions', () => {
  it('full and sequential discounted returns never exceed original net', async () => {
    const original = invoice.netAmount; await ret(1); await ret(1); await ret(1);
    expect(invoice.returnedAmount).toBeCloseTo(original, 2); expect(invoice.netAmount).toBe(0);
  });
  it('rejects duplicate invoice item IDs before any stock write', async () => {
    await expect(InvoiceService.returnItems(1, { userId: 1, reason: '', idempotencyKey: 'duplicate', items: [{ invoiceItemId: 1, quantity: 3 }, { invoiceItemId: 1, quantity: 3 }] } as any)).rejects.toThrow();
    expect(StockService.deallocateStock).not.toHaveBeenCalled();
  });
  it('rejects fractional sale quantities', async () => {
    await expect(InvoiceService.createInvoice({ customerId: 1, userId: 1, warehouseId: 1, items: [{ productId: 1, quantity: 1.5, sellingPrice: 100 }] })).rejects.toThrow();
  });
  it('rejects nonzero tax through invoice creation, editing, and service calls', async () => {
    const body = { tax: 5 };
    expect(await invokeResponse(handler(invoiceRouter, '/', 'post'), body)).toMatchObject({ status: 400, body: { error: 'Tax is not supported' } });
    expect(await invokeResponse(handler(invoiceRouter, '/:id', 'put'), body, { id: '1' })).toMatchObject({ status: 400, body: { error: 'Tax is not supported' } });
    await expect(invoke(handler(paymentRouter, '/', 'post'), body)).rejects.toThrow(/tax/i);
    await expect(invoke(handler(expenseRouter, '/', 'post'), body)).rejects.toThrow(/tax/i);
    expect(await invokeResponse(handler(productRouter, '/:id/restock', 'post'), body, { id: '1' })).toMatchObject({ status: 400, body: { error: 'Tax is not supported' } });
    await expect(InvoiceService.createInvoice({ customerId: 1, userId: 1, warehouseId: 1, items: [{ productId: 1, quantity: 1, sellingPrice: 100 }], tax: 5 })).rejects.toThrow(/tax/i);
    expect(await invokeResponse(handler(invoiceRouter, '/', 'post'), { items: [{ taxAmount: 5 }] })).toMatchObject({ status: 400, body: { error: 'Tax is not supported' } });
  });
  it('ignores legacy tax fields when calculating new returns', async () => {
    reset(1, 100, 0, 100);
    invoice.tax = 10;
    invoice.items[0].allocatedTax = 10;
    invoice.items[0].eligibleNetAmount = 100;
    payments = [{ id: 1, amount: 100, method: 'card' }];
    await ret(1);
    expect(invoice.returnedAmount).toBe(100);
    expect(invoice.netAmount).toBe(0);
    expect(invoice.paidAmount).toBe(100);
    expect(returns[0].items[0].totalValue).toBe(100);
    expect(returns[0].items[0]).not.toHaveProperty('taxAmount');
    expect(returns[0].creditAmount).toBe(0);
    expect(payments).toEqual([{ id: 1, amount: 100, method: 'card' }]);
  });
  it('rejects fractional returns', async () => { await expect(ret(.4)).rejects.toThrow(); });
  it('does not record a one-cent goods return as a cash refund', async () => {
    reset(1, .01, 0, .01);
    await ret(1);
    expect(payments).toHaveLength(1);
    expect(returns[0]).toMatchObject({ totalValue: .01, refundedAmount: 0, debtReduction: 0, creditAmount: 0 });
  });
  it('reduces the invoice and debt without reducing the original payment', async () => {
    reset(5, 20, 0, 70);
    payments = [{ id: 1, amount: 70, method: 'cash' }];

    const result = await ret(1);

    expect(result).toMatchObject({ refundAmount: 20, cashRefundAmount: 0, debtReduction: 20, creditAmount: 0 });
    expect(invoice.netAmount).toBe(80);
    expect(invoice.paidAmount).toBe(70);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ id: 1, amount: 70 });
    expect(payments.reduce((sum, payment) => sum + payment.amount, 0)).toBe(70);
  });
  it('preserves payments without creating credit when returns exceed debt', async () => {
    reset(2, 50, 0, 90);
    payments = [{ id: 1, amount: 90, method: 'card' }];

    const result = await ret(1);

    expect(result).toMatchObject({ refundAmount: 50, cashRefundAmount: 0, debtReduction: 10, creditAmount: 0 });
    expect(invoice.netAmount).toBe(50);
    expect(invoice.paidAmount).toBe(90);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ id: 1, amount: 90 });
    expect(payments.reduce((sum, payment) => sum + payment.amount, 0)).toBe(invoice.paidAmount);
  });
  it('retries return operations without applying them twice', async () => {
    reset(3, 100, 0); const first = await ret(1, 'same-key'); const second = await ret(1, 'same-key');
    expect(invoice.items[0].returnedQty).toBe(1); expect(second).toEqual(first); expect(returns).toHaveLength(1);
  });
  it('rejects editing a discount above 100%', async () => {
    reset(1, 100, 0); const details = vi.spyOn(InvoiceService, 'getInvoiceDetails').mockResolvedValue(invoice);
    try { await expect(InvoiceService.updateInvoice(1, { customerId: 1, userId: 1, discount: 150, items: [{ productId: 1, quantity: 1, sellingPrice: 100 }] })).rejects.toThrow(/discount/i); } finally { details.mockRestore(); }
  });
  it('does not write or calculate legacy tax fields when editing', async () => {
    reset(1, 100, 0); invoice.tax = 10;
    const details = vi.spyOn(InvoiceService, 'getInvoiceDetails').mockResolvedValue(invoice);
    try {
      await InvoiceService.updateInvoice(1, { customerId: 1, userId: 1, items: [{ productId: 1, quantity: 1, sellingPrice: 100 }] });
    } finally {
      details.mockRestore();
    }
    expect(invoice.netAmount).toBe(100);
    expect(invoice.tax).toBe(10);
    expect(tx.invoice.update.mock.calls[0]?.[0]?.data).not.toHaveProperty('tax');
  });
  it('does not delete original payments after a refund', async () => {
    reset(1, 50, 0, 50); payments = [{ id: 1, amount: 100 }, { id: 2, amount: -50 }];
    (prisma.payment as any).findUnique = async () => ({ ...payments[0], invoiceId: 1, invoice });
    await expect(invoke(handler(paymentRouter, '/:id', 'delete'), {}, { id: '1' })).rejects.toThrow();
    expect(tx.payment.delete).not.toHaveBeenCalled();
  });
  it('preserves expense payment history and records the refund', async () => {
    const expense: any = { id: 1, amount: 100, paidAmount: 100 }; const history: any[] = [{ id: 1, amount: 100, method: 'transfer' }];
    (prisma.expense as any).findUnique = async () => expense;
    tx.$queryRaw = async () => [expense]; tx.expensePayment = { findMany: async () => history,
      create: async ({ data }: any) => { history.push({ id: 2, ...data }); }, update: async ({ data }: any) => Object.assign(history[0], data), delete: async () => history.pop() };
    tx.expenseRefund = { findUnique: async () => null, create: async () => ({}) };
    tx.expense = { findUnique: async () => expense, update: async ({ data }: any) => ({ ...Object.assign(expense, data), payments: history }) };
    const out = await invoke(handler(expenseRouter, '/:id/refunds', 'post'), { amount: 40, method: 'transfer', idempotency_key: 'expense-refund' }, { id: '1' });
    expect(Number(history[0].amount)).toBe(100); expect(history).toHaveLength(2); expect(out.refundedAmount).toBe(40);
  });
});
describe('audit regressions: reports and documents', () => {
  it('parses localized money input and rejects invalid values', async () => {
    const { parseMoneyInput } = await import(/* @vite-ignore */ new URL('../../../frontend/src/utils/format.ts', import.meta.url).href);
    expect(parseMoneyInput('1250,50')).toBe(1250.5);
    expect(parseMoneyInput('1 250,50')).toBe(1250.5);
    expect(parseMoneyInput('1.250,50')).toBe(1250.5);
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput('12,3,4')).toBeNull();
  });
  it('preserves genuinely zero cost in remaining FIFO allocations', () => {
    expect(getLineCost({ quantity: 2, returnedQty: 1, costPrice: 5, saleAllocations: [{ quantity: 1, batch: { costPrice: 0 } }] })).toBe(0);
  });
  it('customer reconciliation uses original sales and signed payment events', async () => {
    const module = await import(/* @vite-ignore */ new URL('../../../frontend/src/utils/print/customerInvoicePrint.ts', import.meta.url).href);
    const entries = module.getInvoiceStatementEntries({ id: 1, originalNetAmount: 200, netAmount: 100, returnedAmount: 100, paymentEvents: [{ amount: 50 }, { amount: -50 }], returnEvents: [{ totalValue: 100 }] });
    expect(entries.reduce((sum: number, e: any) => sum + e.debit - e.credit, 0)).toBe(100);
  });
  it('return reports use recorded discounted return values rather than list price', async () => {
    (prisma as any).inventoryTransaction = { findMany: async () => [{ id: 1, referenceId: 1, createdAt: new Date(), qtyChange: 1, sellingAtTime: 100, product: { name: 'A', unit: 'pcs' } }] };
    (prisma as any).return = { findMany: async () => [{ id: 10, invoiceId: 1, createdAt: new Date(), totalValue: 90, refundedAmount: 50, debtReduction: 40, items: [{ id: 1, quantity: 1, sellingPrice: 100, totalValue: 90, invoiceItem: { productNameSnapshot: 'A' } }], invoice: { warehouse: { name: 'Main' } } }] };
    const route = (reportRouter as any).stack.find((l: any) => l.route?.path === '/returns').route;
    let out: any; await route.stack.at(-1).handle({ query: {}, user: { id: 1, role: 'ADMIN' } }, { json: (value: any) => { out = value; } }, (e: any) => { throw e; });
    expect(out[0]).toMatchObject({ total_value: 90, return_id: 10, product_name: 'A', quantity: 1, refunded_amount: 50, debt_reduction: 40 });
  });
  it('reports zero revenue for zero-net invoices', () => { const item = { quantity: 1, sellingPrice: 100, totalPrice: 100 }; expect(getLineNetRevenue({ netAmount: 0, discount: 100, items: [item] }, item)).toBe(0); });
  it('attributes revenue to item-specific discounted values', () => {
    const a = { id: 1, quantity: 1, sellingPrice: 100, totalPrice: 0, discount: 100 }, b = { id: 2, quantity: 1, sellingPrice: 100, totalPrice: 100 };
    expect(getLineNetRevenue({ netAmount: 100, discount: 0, items: [a, b] }, a)).toBe(0);
  });
  it('keeps new invoice, report, and receipt totals aligned after discounts', async () => {
    const { prepareSalesInvoiceData } = await loadPrint();
    const item = { id: 1, quantity: 1, sellingPrice: 100, totalPrice: 100, allocatedOrderDiscount: 20, eligibleNetAmount: 80 };
    const sale = { totalAmount: 100, discount: 20, netAmount: 80, items: [item], returns: [] };
    expect(getLineNetRevenue(sale, item)).toBe(80);
    expect(prepareSalesInvoiceData(sale)).toMatchObject({ finalTotalAmount: 80, totalDiscountAmount: 20 });
  });
  it('staff collections preserve actual paid amounts even for legacy paid status', () => {
    const result = buildStaffMetrics([{ userId: 1, status: 'paid', _count: { _all: 1 }, _sum: { netAmount: 100, paidAmount: 99.99, returnedAmount: 0 } }]);
    expect(result.paidAmount).toBe(99.99); expect(result.debtAmount).toBe(.01);
  });
  const loadPrint = () => import(/* @vite-ignore */ new URL('../../../frontend/src/utils/print/salesInvoicePrint.ts', import.meta.url).href);
  it('prints authoritative zero totals', async () => { const { prepareSalesInvoiceData } = await loadPrint(); expect(prepareSalesInvoiceData({ netAmount: 0, discount: 100, items: [{ quantity: 1, sellingPrice: 100, totalPrice: 100 }] }).finalTotalAmount).toBe(0); });
  it('current receipts do not subtract cumulative returns a second time', async () => {
    const { prepareSalesInvoiceData } = await loadPrint(); const result = prepareSalesInvoiceData({ netAmount: 100, returnedAmount: 100, items: [{ quantity: 1, sellingPrice: 100, totalPrice: 100 }] });
    expect(result.subtotalBeforeDiscount - result.totalDiscountAmount).toBe(result.finalTotalAmount);
    expect(result.returnedAmount).toBe(0);
  });
  it('does not include legacy tax fields in printed totals', async () => {
    const { prepareSalesInvoiceData, buildSalesInvoiceHtml } = await loadPrint();
    const prepared = prepareSalesInvoiceData({ netAmount: 90, tax: 10, discount: 10, items: [{ quantity: 1, sellingPrice: 100, totalPrice: 100 }] });
    expect(prepared.totalDiscountAmount).toBe(10);
    expect(buildSalesInvoiceHtml(prepared)).not.toContain('Налог');
  });
});
