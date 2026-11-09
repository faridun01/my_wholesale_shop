import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
const frontend = (file: string) => import(/* @vite-ignore */ new URL(`../../../frontend/src/${file}`, import.meta.url).href);
describe('financial documents and previews', () => {
  it('generates real PDF files whose rendered total cells match the invoice', async () => {
    const font = readFileSync(new URL('../../../frontend/public/fonts/arial.ttf', import.meta.url));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(font)));
    try {
      const { generateSalesInvoicePdf } = await frontend('utils/print/salesInvoicePdf.ts');
      for (const net of [0, 850]) {
        const doc = await generateSalesInvoicePdf({ id: 1, netAmount: String(net), paidAmount: '600', grossPaidAmount: '600', returnedAmount: String(1000 - net),
          items: [{ quantity: 1, sellingPrice: String(net), totalPrice: String(net), product_name: 'Reference goods' }] });
        const rows = doc.lastAutoTable.body;
        const total = rows.at(-1).cells[1].text.join('').replace(/\s/g, '').replace(',', '.');
        expect(total).toBe(net.toFixed(2));
        expect(rows.flatMap((row: any) => row.cells[0].text).join(' ')).not.toContain('Налог');
        expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(2000);
      }
    } finally { vi.unstubAllGlobals(); }
  });
  it('renders the current invoice, original sale and individual return together', async () => {
    const React = await import(/* @vite-ignore */ new URL('../../../frontend/node_modules/react/index.js', import.meta.url).href);
    const { renderToStaticMarkup } = await import(/* @vite-ignore */ new URL('../../../frontend/node_modules/react-dom/server.node.js', import.meta.url).href);
    const { default: History } = await frontend('components/sales/InvoiceFinancialHistory.tsx');
    const { formatMoney } = await frontend('utils/format.ts');
    const original = { netAmount: '1000', totalAmount: '1000', discount: '0', items: [{ id: 1, quantity: 20, sellingPrice: '50', totalPrice: '1000', productNameSnapshot: 'Reference goods' }],
      payments: [1, 2, 3].map(id => ({ id, amount: '200', method: 'cash', createdAt: '2026-11-09T00:00:00Z' })) };
    const invoice = { netAmount: '850', paidAmount: '600', grossPaidAmount: '600', returnedAmount: '150', originalInvoice: original,
      financialSummary: { debtAmount: '250' }, returns: [{ id: 9, totalValue: '150', debtReduction: '150', refundedAmount: '0', createdAt: '2026-11-09T01:00:00Z', reason: 'Customer goods return', items: [{ id: 1, invoiceItemId: 1, quantity: 3, sellingPrice: '50', itemDiscount: '0', allocatedOrderDiscount: '0', totalValue: '150' }] }] };
    const html = renderToStaticMarkup(React.createElement(History, { invoice }));
    for (const amount of [1000, 850, 600, 250, 150]) expect(html).toContain(formatMoney(amount));
    expect(html).toContain('Customer goods return');
    expect(html).toContain('Reference goods');
    expect(html).not.toContain('Кредит покупателя');
    expect(html).not.toContain('Налог');
  });
  it('caps shown payments at the invoice total and reports the excess as owed to the buyer', async () => {
    const sales = await frontend('utils/salesViewUtils.ts');
    const customer = await frontend('components/customers/customerInvoiceCalculations.ts');
    const invoice = { netAmount: '500', paidAmount: '600', balancePaidAmount: '600', grossPaidAmount: '600', returnedAmount: '500', totalAmount: '1000', discount: '0', items: [] };
    expect(sales.getInvoiceCustomerCredit(invoice)).toBe(0);
    expect(sales.getInvoiceChangeAmount(invoice)).toBe(0);
    expect(sales.getInvoiceShownPaidAmount(invoice)).toBe(500);
    expect(sales.getInvoiceAppliedPaidAmount(invoice)).toBe(500);
    expect(sales.getInvoiceAmountToReturn(invoice)).toBe(100);
    expect(sales.getInvoiceBalance(invoice)).toBe(0);
    expect(customer.getInvoiceChangeAmount(invoice)).toBe(0);
    expect(customer.getInvoiceAppliedPaidAmount(invoice)).toBe(500);

    const stillOwing = { ...invoice, netAmount: '850', returnedAmount: '150' };
    expect(sales.getInvoiceShownPaidAmount(stillOwing)).toBe(600);
    expect(sales.getInvoiceAmountToReturn(stillOwing)).toBe(0);
    expect(sales.getInvoiceBalance(stillOwing)).toBe(250);

    const noReturn = { ...invoice, returnedAmount: '0' };
    expect(sales.getInvoiceAmountToReturn(noReturn)).toBe(0);
  });
  it('prints the capped payment and the amount to give back', async () => {
    const { prepareSalesInvoiceData, buildSalesInvoiceHtml } = await frontend('utils/print/salesInvoicePrint.ts');
    const invoice = { netAmount: 270, paidAmount: 324, grossPaidAmount: 324, balancePaidAmount: 324, returnedAmount: 270, items: [{ quantity: 2, sellingPrice: 150, totalPrice: 300 }] };
    const prepared = prepareSalesInvoiceData(invoice);
    expect(prepared).toMatchObject({ paidAmount: 270, amountToReturn: 54, balanceDue: 0, finalTotalAmount: 270 });
    expect(buildSalesInvoiceHtml(prepared)).toContain('Вернуть покупателю');
    expect(prepareSalesInvoiceData({ ...invoice, netAmount: 324 }).amountToReturn).toBe(0);
    expect(buildSalesInvoiceHtml(prepareSalesInvoiceData({ ...invoice, netAmount: 324 }))).not.toContain('Вернуть покупателю');
  });
  it('uses authoritative zero totals in customer documents', async () => {
    const calc = await frontend('components/customers/customerInvoiceCalculations.ts');
    expect(calc.getInvoiceNetAmount({ totalAmount: 0, netAmount: 0, items: [{ quantity: 1, sellingPrice: 100, totalPrice: 0 }] })).toBe(0);
  });
  it('previews only discounted merchandise value for a new return', async () => {
    const { returnPreview } = await frontend('utils/returnPreview.ts');
    const item = { originalQuantity: 3, cumulativeReturnedQty: 1, originalEligibleNetAmount: .13 };
    expect(returnPreview(item, 1)).toBe(.05);
    expect(returnPreview(item, 2)).toBe(.09);
    expect(returnPreview(item, .4)).toBe(0);
  });
  it('return receipt totals reconcile with the recorded event, not current invoice totals', async () => {
    const { returnReceiptInvoice } = await frontend('utils/print/returnReceipt.ts');
    const { prepareSalesInvoiceData } = await frontend('utils/print/salesInvoicePrint.ts');
    const receipt = returnReceiptInvoice({ id: 1, netAmount: 500 }, { id: 10, totalValue: 90, refundedAmount: 50, debtReduction: 40, items: [{ id: 1, quantity: 1, sellingPrice: 100, totalValue: 90 }] });
    const prepared = prepareSalesInvoiceData(receipt);
    expect(prepared.finalTotalAmount).toBe(90);
    expect(prepared.subtotalBeforeDiscount - prepared.totalDiscountAmount).toBe(90);
    expect(prepared.items[0].price).toBe(100);
  });
  it('keeps gross customer payments visible while calculating debt from applied payments', async () => {
    const { prepareSalesInvoiceData, buildSalesInvoiceHtml } = await frontend('utils/print/salesInvoicePrint.ts');
    const prepared = prepareSalesInvoiceData({
      netAmount: 37361.88,
      paidAmount: 33310.68,
      grossPaidAmount: 36000,
      balancePaidAmount: 36000,
      returnPaymentAdjustments: 2689.32,
      items: [{ quantity: 1, sellingPrice: 41720, totalPrice: 41720 }],
    });

    expect(prepared).toMatchObject({ paidAmount: 36000, balanceDue: 1361.88, returnPaymentAdjustments: 2689.32 });
    expect(buildSalesInvoiceHtml(prepared)).toContain('Внесено всего');
  });
  it('shows return settlement separately from cash payments on the return receipt', async () => {
    const { returnReceiptInvoice } = await frontend('utils/print/returnReceipt.ts');
    const { prepareSalesInvoiceData, buildSalesInvoiceHtml } = await frontend('utils/print/salesInvoicePrint.ts');
    const prepared = prepareSalesInvoiceData(returnReceiptInvoice({ id: 1 }, {
      id: 10, totalValue: 90, refundedAmount: 0, debtReduction: 60, creditAmount: 30,
      items: [{ id: 1, quantity: 1, sellingPrice: 90, totalValue: 90 }],
    }));
    const html = buildSalesInvoiceHtml(prepared);

    expect(prepared).toMatchObject({ isReturnDocument: true, paidAmount: 0, returnCashRefundAmount: 0, returnDebtReduction: 60, returnCreditAmount: 0 });
    expect(html).toContain('Уменьшение долга');
    expect(html).not.toContain('Кредит клиента');
    expect(html).not.toContain('Внесено всего');
  });
  it('prepares tax-free totals for invoice print and PDF documents', async () => {
    const { prepareSalesInvoiceData, buildSalesInvoiceHtml } = await frontend('utils/print/salesInvoicePrint.ts');
    const prepared = prepareSalesInvoiceData({
      netAmount: 90,
      tax: 10,
      discount: 10,
      items: [{ quantity: 1, sellingPrice: 100, totalPrice: 100 }],
    });

    expect(prepared).toMatchObject({ finalTotalAmount: 90, totalDiscountAmount: 10 });
    expect(buildSalesInvoiceHtml(prepared)).not.toContain('Налог');
  });
});
