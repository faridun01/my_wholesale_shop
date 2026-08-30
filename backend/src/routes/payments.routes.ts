import { Router } from 'express';
import prisma from '../db/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { ensureWarehouseAccess, getAccessContext } from '../utils/access.js';
import { normalizeMoney, roundMoney, getInvoiceStatus } from '../utils/money.js';

const router = Router();
const PAYMENT_EPSILON = 0.01;

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { customer_id, invoice_id, amount, method, note, idempotency_key } = req.body;
    const normalizedAmount = normalizeMoney(amount, 'Amount', { allowZero: false });
    if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
      return res.status(400).json({ error: 'Amount must be a non-negative number' });
    }

    const idempotencyKey = typeof idempotency_key === 'string' && idempotency_key.trim() ? idempotency_key.trim() : null;
    if (idempotencyKey) {
      // A retried/double-submitted request (double-click, network retry) reusing the
      // same client-generated key returns the original payment instead of creating a duplicate.
      const existingPayment = await prisma.payment.findUnique({ where: { idempotencyKey } });
      if (existingPayment) {
        return res.status(200).json(existingPayment);
      }
    }

    const userId = req.user!.id;
    const access = await getAccessContext(req);
    const invoiceId = invoice_id ? Number(invoice_id) : null;
    const invoice = invoiceId
      ? await prisma.invoice.findUnique({
          where: { id: invoiceId },
          select: { id: true, customerId: true, warehouseId: true, userId: true },
        })
      : null;

    if (!access.isAdmin) {
      if (!invoice) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (!ensureWarehouseAccess(access, invoice.warehouseId) || invoice.userId !== access.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const payment = await prisma.$transaction(async (tx: any) => {
      if (invoiceId) {
        // Lock the invoice row first so concurrent payments (double-click, retry,
        // two staff recording at once) serialize instead of racing on paidAmount.
        const locked = await tx.$queryRaw<Array<{ netAmount: any; paidAmount: any }>>`
          SELECT net_amount as "netAmount", paid_amount as "paidAmount" FROM invoices WHERE id = ${invoiceId} FOR UPDATE
        `;
        if (!locked[0]) {
          throw new Error('Invoice not found');
        }

        const projectedPaidAmount = Number(locked[0].paidAmount) + normalizedAmount;
        if (projectedPaidAmount > Number(locked[0].netAmount) + PAYMENT_EPSILON) {
          throw new Error('Сумма оплаты не может превышать сумму накладной');
        }
      }

      const p = await tx.payment.create({
        data: {
          customerId: invoice?.customerId ?? Number(customer_id),
          invoiceId,
          userId,
          amount: normalizedAmount,
          method: method || 'cash',
          idempotencyKey,
        },
      });

      if (invoiceId) {
        // Atomic increment (not read-modify-write) so a concurrently-committed
        // payment's amount can never be overwritten/lost.
        const updated = await tx.invoice.update({
          where: { id: invoiceId },
          data: { paidAmount: { increment: normalizedAmount } },
        });

        const newPaidAmount = roundMoney(Number(updated.paidAmount));
        const netAmount = Number(updated.netAmount);
        const status = newPaidAmount > 0 && newPaidAmount >= netAmount - PAYMENT_EPSILON ? 'paid' : 'partial';

        if (status !== updated.status) {
          await tx.invoice.update({
            where: { id: invoiceId },
            data: { status },
          });
        }
      }

      return p;
    });

    res.status(201).json(payment);
  } catch (error: any) {
    // Truly-concurrent duplicate submissions with the same idempotency key: the
    // pre-check above can both pass before either commits, so the unique constraint
    // is the final backstop — return the winning payment instead of a 500.
    const retryKey = typeof req.body?.idempotency_key === 'string' ? req.body.idempotency_key.trim() : '';
    if (error?.code === 'P2002' && retryKey && !res.headersSent) {
      const existingPayment = await prisma.payment.findUnique({ where: { idempotencyKey: retryKey } });
      if (existingPayment) {
        return res.status(200).json(existingPayment);
      }
    }
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const paymentId = Number(req.params.id);
    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      return res.status(400).json({ error: 'Payment ID is required' });
    }

    const access = await getAccessContext(req);
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        invoice: {
          select: {
            id: true,
            warehouseId: true,
            userId: true,
            netAmount: true,
            cancelled: true,
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (!payment.invoice) {
      return res.status(400).json({ error: 'Only invoice payments can be cancelled' });
    }

    if (!access.isAdmin) {
      if (!ensureWarehouseAccess(access, payment.invoice.warehouseId) || Number(payment.invoice.userId) !== Number(access.userId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    if (payment.invoice.cancelled) {
      return res.status(400).json({ error: 'Cannot cancel payment for a cancelled invoice' });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Lock the invoice row before recomputing paidAmount so a concurrent
      // payment insert/delete on the same invoice can't interleave with this recompute.
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${payment.invoiceId} FOR UPDATE`;

      await tx.payment.delete({
        where: { id: paymentId },
      });

      const remainingPayments = await tx.payment.findMany({
        where: { invoiceId: payment.invoiceId },
        select: { amount: true },
      });

      const paidAmount = roundMoney(
        remainingPayments.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0),
      );
      const status = getInvoiceStatus(paidAmount, Number(payment.invoice?.netAmount || 0));

      const invoice = await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          paidAmount,
          status,
        },
        include: {
          customer: true,
          user: true,
          items: true,
        },
      });

      return {
        success: true,
        invoice: {
          ...invoice,
          customer_name: invoice.customerNameSnapshot || invoice.customer?.name || 'Клиент',
          staff_name: invoice.user?.username || '—',
        },
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
