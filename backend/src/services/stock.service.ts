import prisma from '../db/prisma.js';

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toNumber(value: any, fallback = 0): number {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Rounds a quantity to standard precision (2 decimal places)
 */
function roundQty(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}



export class StockService {
  /**
   * Allocates stock from batches using FIFO logic.
   */
  static async allocateStock(
    productId: number,
    warehouseId: number,
    quantity: number,
    invoiceItemId: number,
    tx?: any
  ) {
    const client = tx || prisma;
    const requiredQty = roundQty(toNumber(quantity, 0));

    if (requiredQty <= 0) {
      throw new Error('Количество для списания должно быть больше 0');
    }

    let remainingToAllocate = requiredQty;
    let totalCost = 0;

    const batches = await client.productBatch.findMany({
      where: {
        productId,
        warehouseId,
        remainingQuantity: { gt: 0 },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const totalAvailable = batches.reduce(
      (sum: number, b: any) => sum + Number(b.remainingQuantity || 0),
      0
    );

    if (totalAvailable < requiredQty) {
      throw new Error(
        `Недостаточно товара на складе (ID: ${productId}). Доступно: ${totalAvailable}, Требуется: ${requiredQty}`
      );
    }

    for (const batch of batches) {
      if (remainingToAllocate <= 0) break;

      const batchRemaining = roundQty(toNumber(batch.remainingQuantity, 0));
      const takeFromBatch = Math.min(batchRemaining, remainingToAllocate);
      totalCost += takeFromBatch * Number(batch.costPrice || 0);

      await client.productBatch.update({
        where: { id: batch.id },
        data: {
          remainingQuantity: { decrement: takeFromBatch },
        },
      });

      await client.saleAllocation.create({
        data: {
          invoiceItemId,
          batchId: batch.id,
          quantity: takeFromBatch,
        },
      });

      remainingToAllocate -= takeFromBatch;
    }

    await this.updateProductStockCache(productId, client);

    return round2(totalCost / requiredQty);
  }

  /**
   * Returns stock to batches.
   */
  static async deallocateStock(
    invoiceItemId: number,
    quantityToReturn?: number,
    specificBatchId?: number,
    tx?: any,
    shouldUpdateCache = true
  ) {
    const client = tx || prisma;
    const whereClause: any = { invoiceItemId };

    if (specificBatchId) {
      whereClause.batchId = specificBatchId;
    }

    const allocations = await client.saleAllocation.findMany({
      where: whereClause,
      include: { batch: true },
      orderBy: {
        batch: {
          createdAt: 'asc',
        },
      },
    });

    let remainingToReturn =
      quantityToReturn != null
        ? roundQty(toNumber(quantityToReturn, 0))
        : allocations.reduce((sum: number, a: any) => sum + Number(a.quantity || 0), 0);

    for (const allocation of allocations) {
      if (remainingToReturn <= 0) break;

      const allocQty = roundQty(toNumber(allocation.quantity, 0));
      const amountToReturnToThisBatch = Math.min(allocQty, remainingToReturn);

      await client.productBatch.update({
        where: { id: allocation.batchId },
        data: {
          remainingQuantity: { increment: amountToReturnToThisBatch },
        },
      });

      if (amountToReturnToThisBatch === allocQty) {
        await client.saleAllocation.delete({ where: { id: allocation.id } });
      } else {
        await client.saleAllocation.update({
          where: { id: allocation.id },
          data: { quantity: { decrement: amountToReturnToThisBatch } },
        });
      }

      remainingToReturn -= amountToReturnToThisBatch;
    }

    if (shouldUpdateCache) {
      const item = await client.invoiceItem.findUnique({ where: { id: invoiceItemId } });
      if (item) {
        await this.updateProductStockCache(item.productId, client);
      }
    }
  }

  /**
   * Transfers stock between warehouses.
   */
  static async transferStock(
    productId: number,
    fromWarehouseId: number,
    toWarehouseId: number,
    quantity: number,
    userId: number
  ) {
    const transferQty = roundQty(toNumber(quantity, 0));

    if (transferQty <= 0) {
      throw new Error('Количество для переноса должно быть больше 0');
    }

    return await prisma.$transaction(async (tx: any) => {
      const sourceBatches = await tx.productBatch.findMany({
        where: {
          productId,
          warehouseId: fromWarehouseId,
          remainingQuantity: { gt: 0 },
        },
        orderBy: { createdAt: 'asc' },
      });

      const totalAvailable = sourceBatches.reduce(
        (sum: number, b: any) => sum + Number(b.remainingQuantity || 0),
        0
      );

      if (totalAvailable < transferQty) {
        throw new Error(
          `Недостаточно товара для перемещения. Доступно: ${totalAvailable}, Требуется: ${transferQty}`
        );
      }

      let remainingToTransfer = transferQty;

      for (const batch of sourceBatches) {
        if (remainingToTransfer <= 0) break;

        const batchRemaining = roundQty(toNumber(batch.remainingQuantity, 0));
        const takeFromBatch = Math.min(batchRemaining, remainingToTransfer);

        await tx.productBatch.update({
          where: { id: batch.id },
          data: { remainingQuantity: { decrement: takeFromBatch } },
        });

        await tx.productBatch.create({
          data: {
            productId,
            warehouseId: toWarehouseId,
            quantity: takeFromBatch,
            remainingQuantity: takeFromBatch,
            costPrice: round2(toNumber(batch.costPrice, 0)),
          },
        });

        remainingToTransfer -= takeFromBatch;
      }

      await tx.inventoryTransaction.create({
        data: {
          productId,
          warehouseId: fromWarehouseId,
          userId,
          qtyChange: -transferQty,
          type: 'transfer',
          reason: `Transfer to Warehouse #${toWarehouseId}`,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          productId,
          warehouseId: toWarehouseId,
          userId,
          qtyChange: transferQty,
          type: 'transfer',
          reason: `Transfer from Warehouse #${fromWarehouseId}`,
        },
      });

      await this.updateProductStockCache(productId, tx);

      return { success: true };
    });
  }

  /**
   * Adds incoming stock.
   * quantity must already be in pieces (шт)
   * costPrice must already be in TJS per 1 piece
   */
  static async addStock(
    productId: number,
    warehouseId: number,
    quantity: number,
    costPrice: number,
    userId: number,
    reason?: string
  ) {
    const normalizedQty = roundQty(toNumber(quantity, 0));
    const normalizedCost = round2(toNumber(costPrice, 0));
    const normalizedReason = String(reason || 'Stock Arrival').trim();

    if (normalizedQty <= 0) {
      throw new Error('Количество должно быть больше 0');
    }

    if (normalizedCost < 0) {
      throw new Error('Цена закупки не может быть отрицательной');
    }

    return await prisma.$transaction(async (tx: any) => {
      const batch = await tx.productBatch.create({
        data: {
          productId,
          warehouseId,
          quantity: normalizedQty,
          remainingQuantity: normalizedQty,
          costPrice: normalizedCost,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          productId,
          warehouseId,
          userId,
          qtyChange: normalizedQty,
          type: 'incoming',
          reason: normalizedReason,
          costAtTime: normalizedCost,
        },
      });

      await tx.product.update({
        where: { id: productId },
        data: {
          stock: { increment: normalizedQty },
          totalIncoming: { increment: normalizedQty },
          costPrice: normalizedCost,
          unit: 'шт',
        },
      });

      return batch;
    });
  }

  /**
   * Rebuild product stock from batches.
   */
  static async updateProductStockCache(productId: number, tx?: any) {
    const client = tx || prisma;

    const batches = await client.productBatch.findMany({
      where: { productId },
      select: { remainingQuantity: true },
    });

    const totalStock = batches.reduce(
      (sum: number, b: any) => sum + Number(b.remainingQuantity || 0),
      0
    );

    await client.product.update({
      where: { id: productId },
      data: {
        stock: totalStock,
        unit: 'шт',
      },
    });
  }
}