import { Router } from 'express';
import prisma from '../db/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { ensureWarehouseAccess, getAccessContext } from '../utils/access.js';
import { normalizeMoney, roundMoney } from '../utils/money.js';

const router = Router();
const PAYMENT_EPSILON = 0.01;

function getInvoiceStatus(paidAmount: number, netAmount: number) {
  if (paidAmount > 0 && paidAmount >= netAmount - PAYMENT_EPSILON) {
    return 'paid';
  }

  if (paidAmount > 0) {
    return 'partial';
  }

  return 'unpaid';
}

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { customer_id, invoice_id, amount, method, note } = req.body;
    const normalizedAmount = normalizeMoney(amount, 'Amount', { allowZero: false });
    if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
      return res.status(400).json({ error: 'Amount must be a non-negative number' });
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
      const p = await tx.payment.create({
        data: {
          customerId: invoice?.customerId ?? Number(customer_id),
          invoiceId,
          userId,
          amount: normalizedAmount,
          method: method || 'cash',
        },
      });

      if (invoiceId) {
        const currentInvoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
        });

        if (currentInvoice) {
          const newPaidAmount = roundMoney(Number(currentInvoice.paidAmount) + normalizedAmount);
          const netAmount = Number(currentInvoice.netAmount);
          const status = newPaidAmount > 0 && newPaidAmount >= netAmount - PAYMENT_EPSILON ? 'paid' : 'partial';
          
          await tx.invoice.update({
            where: { id: invoiceId },
            data: {
              paidAmount: newPaidAmount,
              status,
            },
          });
        }
      }

      return p;
    });

    res.status(201).json(payment);
  } catch (error) {
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
          customer_name: invoice.customerNameSnapshot || invoice.customer.name,
          staff_name: invoice.user.username,
        },
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
