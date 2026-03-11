import { Router } from 'express';
import prisma from '../db/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { customer_id, invoice_id, amount, method, note } = req.body;
    const userId = req.user!.id;

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          customerId: Number(customer_id),
          invoiceId: invoice_id ? Number(invoice_id) : null,
          userId,
          amount: Number(amount),
          method: method || 'cash',
        },
      });

      if (invoice_id) {
        const invoice = await tx.invoice.findUnique({
          where: { id: Number(invoice_id) },
        });

        if (invoice) {
          const newPaidAmount = Number(invoice.paidAmount) + Number(amount);
          const status = newPaidAmount >= Number(invoice.netAmount) ? 'paid' : 'partial';
          
          await tx.invoice.update({
            where: { id: Number(invoice_id) },
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

export default router;
