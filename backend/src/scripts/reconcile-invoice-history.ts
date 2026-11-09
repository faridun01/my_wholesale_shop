import 'dotenv/config';
import prisma from '../db/prisma.js';
import { addMoney, discountAmount, invoiceLines, toCents } from '../utils/financial.js';

// This diagnostic deliberately cannot rewrite history. Aggregate differences
// are evidence to review, never grounds to delete a return or stock event.
async function main() {
  if (process.argv.includes('--apply')) throw new Error('Historical reconciliation is read-only. A reviewed record-specific migration is required to change history.');
  const result = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const invoices = await tx.invoice.findMany({
      where: { OR: [{ returnedAmount: { gt: 0 } }, { returns: { some: {} } }, { items: { some: { returnedQty: { gt: 0 } } } }] },
      include: { items: { orderBy: { id: 'asc' } }, returns: { include: { items: true } }, payments: true },
      orderBy: { id: 'asc' },
    });
    return invoices.map(invoice => {
      const lines = invoiceLines(invoice);
      const originalValue = addMoney(invoice.totalAmount, -discountAmount(invoice.totalAmount, invoice.discount));
      const calculatedReturned = addMoney(...lines.map(line => line.returnedNetAmount));
      return { invoiceId: invoice.id,
        originalValue, currentValue: invoice.netAmount, recordedReturned: invoice.returnedAmount,
        calculatedReturned, aggregateMatches: toCents(originalValue) === toCents(addMoney(invoice.netAmount, invoice.returnedAmount)),
        quantityValuesMatch: toCents(calculatedReturned) === toCents(invoice.returnedAmount),
        paymentLedgerMatches: toCents(addMoney(...invoice.payments.map(payment => payment.amount))) === toCents(invoice.paidAmount),
        historicalReturnsWithoutItems: invoice.returns.filter(returned => !returned.items.length).map(returned => returned.id),
      };
    });
  });
  console.log(JSON.stringify({ readOnly: true, invoices: result }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
