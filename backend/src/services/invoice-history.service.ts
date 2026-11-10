import prisma from '../db/prisma.js';
import { addMoney, discountAmount, isGoodsReturnPaymentAdjustment, toCents } from '../utils/financial.js';

// Earlier edits overwrote the invoice; saved versions start with the 2026-11-09 release.
const VERSIONS_KEPT_SINCE = new Date('2026-11-09T11:00:00Z');

const saleAmount = (version: any) => addMoney(version.totalAmount, -discountAmount(version.totalAmount, version.discount));

function linesOf(version: any, productNames: Map<number, string>) {
  const lines = new Map<number, any>();
  for (const item of version.items || []) {
    const line = lines.get(item.productId);
    if (line) {
      line.quantity += Number(item.quantity);
      line.total = addMoney(line.total, item.totalPrice);
    } else {
      lines.set(item.productId, {
        name: item.productNameSnapshot || productNames.get(item.productId) || `Товар #${item.productId}`,
        quantity: Number(item.quantity),
        price: addMoney(item.sellingPrice),
        discount: Number(item.discount || 0),
        total: addMoney(item.totalPrice),
      });
    }
  }
  return lines;
}

const lineChanged = (a: any, b: any) =>
  a.quantity !== b.quantity || toCents(a.price) !== toCents(b.price) || a.discount !== b.discount || toCents(a.total) !== toCents(b.total);

function changesBetween(before: any, after: any, productNames: Map<number, string>) {
  const was = linesOf(before, productNames);
  const now = linesOf(after, productNames);
  const items = [...new Set([...was.keys(), ...now.keys()])].flatMap((productId) => {
    const from = was.get(productId);
    const to = now.get(productId);
    if (from && to && !lineChanged(from, to)) return [];
    return [{ name: (to || from).name, before: from ?? null, after: to ?? null }];
  });
  const customerChanged = before.customerNameSnapshot && after.customerNameSnapshot && before.customerNameSnapshot !== after.customerNameSnapshot;
  return {
    customer: customerChanged ? { before: before.customerNameSnapshot, after: after.customerNameSnapshot } : null,
    discount: Number(before.discount || 0) !== Number(after.discount || 0) ? { before: Number(before.discount || 0), after: Number(after.discount || 0) } : null,
    amount: toCents(saleAmount(before)) !== toCents(saleAmount(after)) ? { before: saleAmount(before), after: saleAmount(after) } : null,
    items,
  };
}

function paymentEvent(payment: any, reversedIds: Set<number>) {
  const base = { at: payment.createdAt, userId: payment.userId, amount: Math.abs(addMoney(payment.amount)), method: payment.method };
  if (payment.reversalOfId) return { ...base, type: 'payment_reversed' };
  if (toCents(payment.amount) > 0) return { ...base, type: 'payment', reversed: reversedIds.has(payment.id) };
  return { ...base, type: isGoodsReturnPaymentAdjustment(payment) ? 'return_adjustment' : 'money_returned' };
}

export async function getInvoiceHistory(invoiceId: number) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      revisions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      payments: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      returns: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { items: { include: { invoiceItem: { select: { productId: true, productNameSnapshot: true } } } } },
      },
    },
  });
  if (!invoice) return null;

  const cancelRows = invoice.cancelled
    ? await prisma.inventoryTransaction.findMany({
        where: { referenceId: invoiceId, reason: `Invoice #${invoiceId} Cancelled` },
        orderBy: { id: 'asc' },
        select: { userId: true, qtyChange: true, createdAt: true },
      })
    : [];

  const versions: any[] = [...invoice.revisions.map((revision) => revision.snapshot), invoice];
  const productIds = new Set<number>();
  for (const version of versions) for (const item of version.items || []) productIds.add(item.productId);
  for (const itemReturn of invoice.returns) for (const line of itemReturn.items) productIds.add(line.invoiceItem.productId);
  const products = await prisma.product.findMany({ where: { id: { in: [...productIds] } }, select: { id: true, name: true } });
  const productNames = new Map(products.map((product) => [product.id, product.name]));

  const reversedIds = new Set(invoice.payments.flatMap((payment) => (payment.reversalOfId ? [payment.reversalOfId] : [])));
  const events: any[] = [
    { type: 'created', at: invoice.createdAt, userId: invoice.userId, amount: saleAmount(versions[0]), items: [...linesOf(versions[0], productNames).values()] },
    ...invoice.revisions.map((revision, index) => {
      const correction = (revision.snapshot as any)?.correction;
      return {
        type: correction ? 'corrected' : 'edited',
        at: revision.createdAt,
        // A reconciliation was run by the system; its row only names the invoice's seller.
        userId: correction ? null : revision.userId,
        note: correction || null,
        changes: changesBetween(versions[index], versions[index + 1], productNames),
      };
    }),
    ...invoice.payments.map((payment) => paymentEvent(payment, reversedIds)),
    ...invoice.returns.map((itemReturn) => ({
      type: 'returned',
      at: itemReturn.createdAt,
      userId: itemReturn.userId,
      amount: addMoney(itemReturn.totalValue),
      reason: itemReturn.reason,
      items: itemReturn.items.map((line) => ({
        name: line.invoiceItem.productNameSnapshot || productNames.get(line.invoiceItem.productId) || `Товар #${line.invoiceItem.productId}`,
        quantity: line.quantity,
        total: addMoney(line.totalValue),
      })),
    })),
  ];

  if (invoice.cancelled) {
    events.push({
      type: 'cancelled',
      at: cancelRows[0]?.createdAt ?? invoice.updatedAt,
      userId: cancelRows[0]?.userId ?? null,
      quantityRestored: cancelRows.reduce((sum, row) => sum + Number(row.qtyChange), 0),
      exactDate: cancelRows.length > 0,
    });
  }

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const userIds = [...new Set(events.flatMap((event) => (event.userId ? [event.userId] : [])))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } });
  const usernames = new Map(users.map((user) => [user.id, user.username]));

  return {
    earlierEditsNotKept: invoice.createdAt < VERSIONS_KEPT_SINCE,
    events: events.map(({ userId, ...event }) => ({ ...event, user: usernames.get(userId) ?? null })),
  };
}
