import prisma from '../db/prisma.js';
import { StockService } from './stock.service.js';

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

export class InvoiceService {
  /**
   * Creates a new invoice and allocates stock.
   */
  static async createInvoice(data: {
    customerId: number;
    userId: number;
    warehouseId: number;
    items: { productId: number; quantity: number; sellingPrice: number }[];
    discount?: number;
    tax?: number;
    paidAmount?: number;
    paymentMethod?: string;
    paymentDueDate?: string;
  }) {
    const { customerId, userId, warehouseId, items, discount = 0, tax = 0, paidAmount = 0, paymentMethod = 'cash', paymentDueDate } = data;

    // Start Prisma Transaction
    return await prisma.$transaction(async (tx: any) => {
      // 1. Calculate totals
      let totalAmount = 0;
      for (const item of items) {
        totalAmount += item.quantity * item.sellingPrice;
      }

      const netAmount = totalAmount - (totalAmount * discount / 100) + tax;
      const status = getInvoiceStatus(Number(paidAmount), Number(netAmount));

      // 2. Create Invoice
      const invoice = await tx.invoice.create({
        data: {
          customerId,
          userId,
          warehouseId,
          totalAmount,
          discount,
          tax,
          netAmount,
          paidAmount,
          status,
          paymentDueDate: paymentDueDate ? new Date(paymentDueDate) : null,
        },
      });

      // 3. Create Items and Allocate Stock
      for (const item of items) {
        // Create item first with placeholder costPrice
        const invoiceItem = await tx.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            productId: item.productId,
            quantity: item.quantity,
            sellingPrice: item.sellingPrice,
            totalPrice: item.quantity * item.sellingPrice,
          },
        });

        // FIFO Allocation and get average cost
        const avgCost = await StockService.allocateStock(item.productId, warehouseId, item.quantity, invoiceItem.id, tx);
        
        // Update item with actual cost
        await tx.invoiceItem.update({
          where: { id: invoiceItem.id },
          data: { costPrice: avgCost }
        });
      }

      // 4. Record Payment if any
      if (paidAmount > 0) {
        await tx.payment.create({
          data: {
            customerId,
            invoiceId: invoice.id,
            userId,
            amount: paidAmount,
            method: paymentMethod,
          },
        });
      }

      return invoice;
    });
  }

  /**
   * Cancels an invoice and returns stock.
   */
  static async cancelInvoice(invoiceId: number, userId: number) {
    return await prisma.$transaction(async (tx: any) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true },
      });

      if (!invoice || invoice.cancelled) {
        throw new Error('Invoice not found or already cancelled');
      }

      // 1. Return stock for each item
      for (const item of invoice.items) {
        await StockService.deallocateStock(item.id, undefined, undefined, tx);
      }

      // 2. Mark invoice as cancelled
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { cancelled: true },
      });

      // 3. Record transaction
      for (const item of invoice.items) {
        await tx.inventoryTransaction.create({
          data: {
            productId: item.productId,
            warehouseId: invoice.warehouseId,
            userId,
            qtyChange: item.quantity,
            type: 'return',
            reason: `Invoice #${invoiceId} Cancelled`,
            referenceId: invoiceId,
          },
        });
      }

      return { success: true };
    });
  }

  /**
   * Fetches full invoice details.
   */
  static async getInvoiceDetails(invoiceId: number) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        user: true,
        warehouse: true,
        items: {
          include: { 
            product: true,
            saleAllocations: {
              include: { batch: true }
            }
          }
        },
        payments: {
          include: { user: true }
        }
      }
    });

    if (!invoice) throw new Error('Invoice not found');

    return {
      ...invoice,
      customer_name: invoice.customer.name,
      customer_phone: invoice.customer.phone,
      customer_address: invoice.customer.address,
      staff_name: invoice.user.username,
      items: invoice.items.map(item => ({
        ...item,
        product_name: item.product.name,
        unit: item.product.unit,
      })),
      payments: invoice.payments.map(p => ({
        ...p,
        method: p.method,
        staff_name: p.user.username
      })),
      returns: await prisma.return.findMany({
        where: { invoiceId },
        include: { user: true }
      }).then(returns => returns.map(r => ({
        ...r,
        staff_name: r.user.username
      })))
    };
  }

  /**
   * Handles partial returns.
   */
  static async returnItems(invoiceId: number, data: { items: { productId: number; quantity: number }[]; reason: string; userId: number }) {
    const { items, reason, userId } = data;

    return await prisma.$transaction(async (tx: any) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true }
      });

      if (!invoice) throw new Error('Invoice not found');
      if (invoice.status === 'paid') throw new Error('Cannot return items for a fully paid invoice');

      let totalRefundValue = 0;

      for (const returnItem of items) {
        const originalItem = invoice.items.find((i: any) => i.productId === returnItem.productId);
        if (!originalItem) continue;

        if (originalItem.returnedQty + returnItem.quantity > originalItem.quantity) {
          throw new Error(`Нельзя вернуть больше, чем было продано для товара ID ${returnItem.productId}`);
        }

        // 1. Return stock to batches (FIFO reverse) - this ensures stock goes back to the same warehouse
        await StockService.deallocateStock(originalItem.id, returnItem.quantity, undefined, tx);

        // 2. Record inventory transaction
        await tx.inventoryTransaction.create({
          data: {
            productId: returnItem.productId,
            warehouseId: invoice.warehouseId,
            userId,
            qtyChange: returnItem.quantity,
            type: 'return',
            reason: `${reason} (Накладная #${invoiceId})`,
            referenceId: invoiceId
          }
        });

        // 3. Update InvoiceItem returnedQty
        await tx.invoiceItem.update({
          where: { id: originalItem.id },
          data: { returnedQty: { increment: returnItem.quantity } }
        });

        // 4. Calculate refund value
        totalRefundValue += Number(originalItem.sellingPrice) * returnItem.quantity;
      }

      // 5. Create Return record
      await tx.return.create({
        data: {
          invoiceId,
          customerId: invoice.customerId,
          userId,
          reason,
          totalValue: totalRefundValue
        }
      });

      // 6. Update invoice returned amount and net amount
      // We subtract the return from the net amount to reduce debt
      const newReturnedAmount = Number(invoice.returnedAmount) + totalRefundValue;
      const newNetAmount = Number(invoice.netAmount) - totalRefundValue;
      
      // Update status based on new net amount
      const status = getInvoiceStatus(Number(invoice.paidAmount), Number(newNetAmount));

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { 
          returnedAmount: newReturnedAmount,
          netAmount: newNetAmount,
          status
        }
      });

      return { success: true, refundAmount: totalRefundValue };
    });
  }
}
