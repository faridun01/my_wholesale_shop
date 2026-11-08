import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
const frontend = (file: string) => import(/* @vite-ignore */ new URL(`../../../frontend/src/${file}`, import.meta.url).href);
afterEach(() => vi.unstubAllGlobals());
describe('financial documents and previews', () => {
  it('uses authoritative zero totals in customer documents', async () => {
    const calc = await frontend('components/customers/customerInvoiceCalculations.ts');
    expect(calc.getInvoiceNetAmount({ totalAmount: 0, netAmount: 0, items: [{ quantity: 1, sellingPrice: 100, totalPrice: 0 }] })).toBe(0);
  });
  it('previews only discounted merchandise value for a new return', async () => {
    const { returnPreview } = await frontend('utils/returnPreview.ts');
    const item = { originalQuantity: 3, cumulativeReturnedQty: 1, originalEligibleNetAmount: .13, originalAllocatedTax: .02 };
    expect(returnPreview(item, 1)).toBe(.05);
    expect(returnPreview(item, 2)).toBe(.09);
    expect(returnPreview(item, .4)).toBe(0);
  });
  it('return receipt totals reconcile with the recorded event, not current invoice totals', async () => {
    const { returnReceiptInvoice } = await frontend('utils/print/returnReceipt.ts');
    const { prepareSalesInvoiceData } = await frontend('utils/print/salesInvoicePrint.ts');
    const receipt = returnReceiptInvoice({ id: 1, netAmount: 500 }, { id: 10, totalValue: 90, refundedAmount: 50, debtReduction: 40, items: [{ id: 1, quantity: 1, sellingPrice: 100, totalValue: 90, taxAmount: 10 }] });
    const prepared = prepareSalesInvoiceData(receipt);
    expect(prepared.finalTotalAmount).toBe(90); expect(prepared.taxAmount).toBe(10);
    expect(prepared.subtotalBeforeDiscount - prepared.totalDiscountAmount + prepared.taxAmount).toBe(90);
    expect(prepared.items[0].price).toBe(100);
  });
  it('generates actual PDFs whose totals tables preserve zero and tax values', async () => {
    const font = readFileSync(new URL('../../../frontend/public/fonts/arial.ttf', import.meta.url));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(font)));
    const { generateSalesInvoicePdf } = await frontend('utils/print/salesInvoicePdf.ts');
    for (const invoice of [
      { id: 1, netAmount: 0, discount: 100, items: [{ quantity: 1, sellingPrice: 100, totalPrice: 100 }] },
      { id: 2, netAmount: 90, discount: 20, tax: 10, items: [{ quantity: 1, sellingPrice: 100, totalPrice: 100 }] },
    ]) {
      const pdf = await generateSalesInvoicePdf(invoice);
      expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(2000);
      const rows = (pdf as any).lastAutoTable.body;
      expect(rows.at(-1).cells[1].text.join('')).toBe(invoice.id === 1 ? '0,00' : '90,00');
      if (invoice.id === 2) expect(rows.some((r: any) => r.cells[1]?.text.join('') === '10,00')).toBe(true);
    }
  });
});
