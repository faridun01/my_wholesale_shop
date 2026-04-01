import prisma from '../db/prisma.js';
import { buildProductNameKey } from '../utils/product-packaging.js';

export class StockService {
  static async syncProductPackaging(
    sourceProduct: any,
    destinationProductId: number,
    toWarehouseId: number,
    tx: any
  ) {
    if (!Array.isArray(sourceProduct?.packagings) || sourceProduct.packagings.length === 0) {
      return;
    }

    await tx.productPackaging.createMany({
      data: sourceProduct.packagings.map((packaging: any) => ({
        productId: destinationProductId,
        warehouseId: toWarehouseId,
        packageName: packaging.packageName,
        baseUnitName: packaging.baseUnitName,
        unitsPerPackage: packaging.unitsPerPackage,
        packageSellingPrice: packaging.packageSellingPrice,
        barcode: packaging.barcode,
        active: packaging.active,
        isDefault: packaging.isDefault,
        sortOrder: packaging.sortOrder,
      })),
      skipDuplicates: true,
    });
  }

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
    let remainingToAllocate = quantity;
    let totalCost = 0;

    // Find available batches for this product in this warehouse, oldest first (FIFO)
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

    const totalAvailable = batches.reduce((sum: number, b: any) => sum + b.remainingQuantity, 0);
    if (totalAvailable < quantity) {
      throw new Error(`Недостаточно товара на складе (ID: ${productId}). Доступно: ${totalAvailable}, Требуется: ${quantity}`);
    }

    for (const batch of batches) {
      if (remainingToAllocate <= 0) break;

      const takeFromBatch = Math.min(batch.remainingQuantity, remainingToAllocate);
      totalCost += takeFromBatch * Number(batch.costPrice);

      // Update batch remaining quantity
      await client.productBatch.update({
        where: { id: batch.id },
        data: {
          remainingQuantity: { decrement: takeFromBatch },
        },
      });

      // Create allocation record
      await client.saleAllocation.create({
        data: {
          invoiceItemId,
          batchId: batch.id,
          quantity: takeFromBatch,
        },
      });

      remainingToAllocate -= takeFromBatch;
    }

    // Update product cache stock
    await this.updateProductStockCache(productId, client);

    return totalCost / quantity;
  }

  /**
   * Returns stock to batches (used for returns or invoice cancellation).
   * It returns stock to the EXACT batches it was taken from.
   */
  static async deallocateStock(
    invoiceItemId: number,
    quantityToReturn?: number,
    specificBatchId?: number,
    tx?: any,
    updateStockCache: boolean = true
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
          createdAt: 'asc'
        }
      }
    });

    let remainingToReturn = quantityToReturn ?? allocations.reduce((sum: number, a: any) => sum + a.quantity, 0);

    for (const allocation of allocations) {
      if (remainingToReturn <= 0) break;

      const amountToReturnToThisBatch = Math.min(allocation.quantity, remainingToReturn);

      // Return to batch
      await client.productBatch.update({
        where: { id: allocation.batchId },
        data: {
          remainingQuantity: { increment: amountToReturnToThisBatch },
        },
      });

      // Update or delete allocation
      if (amountToReturnToThisBatch === allocation.quantity) {
        await client.saleAllocation.delete({ where: { id: allocation.id } });
      } else {
        await client.saleAllocation.update({
          where: { id: allocation.id },
          data: { quantity: { decrement: amountToReturnToThisBatch } },
        });
      }

      remainingToReturn -= amountToReturnToThisBatch;
    }

    // Update product cache stock
    if (updateStockCache) {
      const item = await client.invoiceItem.findUnique({ where: { id: invoiceItemId } });
      if (item) {
        await this.updateProductStockCache(item.productId, client);
      }
    }
  }

  /**
   * Transfers stock from one warehouse to another.
   */
  static async transferStock(
    productId: number,
    fromWarehouseId: number,
    toWarehouseId: number,
    quantity: number,
    userId: number
  ) {
    return await prisma.$transaction(async (tx: any) => {
      let sourceProduct = await tx.product.findUnique({
        where: { id: productId },
        include: {
          packagings: {
            where: { active: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      if (!sourceProduct) {
        throw new Error('Товар не найден');
      }

      if (sourceProduct.warehouseId !== fromWarehouseId) {
        const fallbackSourceProduct = await tx.product.findFirst({
          where: {
            warehouseId: fromWarehouseId,
            active: true,
            OR: [
              { nameKey: sourceProduct.nameKey || buildProductNameKey(sourceProduct.name) },
              { name: sourceProduct.name },
            ],
          },
          include: {
            packagings: {
              where: { active: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        });

        if (!fallbackSourceProduct) {
          throw new Error('Не удалось найти товар на складе-источнике для переноса');
        }

        sourceProduct = fallbackSourceProduct;
        productId = sourceProduct.id;
      }

      let destinationProduct = await tx.product.findFirst({
        where: {
          warehouseId: toWarehouseId,
          active: true,
          OR: [
            { nameKey: sourceProduct.nameKey || buildProductNameKey(sourceProduct.name) },
            { name: sourceProduct.name },
          ],
        },
      });

      if (!destinationProduct) {
        destinationProduct = await tx.product.create({
          data: {
            categoryId: sourceProduct.categoryId,
            sku: null,
            name: sourceProduct.name,
            rawName: sourceProduct.rawName,
            brand: sourceProduct.brand,
            nameKey: sourceProduct.nameKey || buildProductNameKey(sourceProduct.name),
            unit: sourceProduct.unit,
            baseUnitName: sourceProduct.baseUnitName,
            purchaseCostPrice: sourceProduct.purchaseCostPrice,
            expensePercent: Number(sourceProduct.expensePercent || 0),
            costPrice: sourceProduct.costPrice,
            sellingPrice: sourceProduct.sellingPrice,
            minStock: sourceProduct.minStock,
            initialStock: 0,
            totalIncoming: 0,
            stock: 0,
            photoUrl: sourceProduct.photoUrl,
            active: true,
            warehouseId: toWarehouseId,
          },
        });

      }

      await this.syncProductPackaging(sourceProduct, destinationProduct.id, toWarehouseId, tx);

      if (destinationProduct.id !== sourceProduct.id) {
        await tx.productBatch.updateMany({
          where: {
            productId,
            warehouseId: toWarehouseId,
          },
          data: {
            productId: destinationProduct.id,
          },
        });

        await tx.inventoryTransaction.updateMany({
          where: {
            productId,
            warehouseId: toWarehouseId,
            type: 'transfer',
          },
          data: {
            productId: destinationProduct.id,
          },
        });
      }

      // 1. Find batches in source warehouse
      const sourceBatches = await tx.productBatch.findMany({
        where: {
          productId,
          warehouseId: fromWarehouseId,
          remainingQuantity: { gt: 0 },
        },
        orderBy: { createdAt: 'asc' },
      });

      const totalAvailable = sourceBatches.reduce((sum: number, b: any) => sum + b.remainingQuantity, 0);
      if (totalAvailable < quantity) {
        throw new Error(`Недостаточно товара для перемещения. Доступно: ${totalAvailable}, Требуется: ${quantity}`);
      }

      let remainingToTransfer = quantity;

      for (const batch of sourceBatches) {
        if (remainingToTransfer <= 0) break;

        const takeFromBatch = Math.min(batch.remainingQuantity, remainingToTransfer);

        // Decrease from source batch
        await tx.productBatch.update({
          where: { id: batch.id },
          data: { remainingQuantity: { decrement: takeFromBatch } },
        });

        // Create/Update batch in destination warehouse
        // We create a NEW batch in destination to preserve cost price info from the source batch
        await tx.productBatch.create({
          data: {
            productId: destinationProduct.id,
            warehouseId: toWarehouseId,
            quantity: takeFromBatch,
            remainingQuantity: takeFromBatch,
            purchaseCostPrice: batch.purchaseCostPrice ?? null,
            expensePercent: Number(batch.expensePercent || 0),
            costPrice: batch.costPrice,
          },
        });

        remainingToTransfer -= takeFromBatch;
      }

      // 2. Record Transactions
      // Outgoing from source
      await tx.inventoryTransaction.create({
        data: {
          productId,
          warehouseId: fromWarehouseId,
          userId,
          qtyChange: -quantity,
          type: 'transfer',
          reason: `Transfer to Warehouse #${toWarehouseId}`,
        },
      });

      // Incoming to destination
      await tx.inventoryTransaction.create({
        data: {
          productId: destinationProduct.id,
          warehouseId: toWarehouseId,
          userId,
          qtyChange: quantity,
          type: 'transfer',
          reason: `Transfer from Warehouse #${fromWarehouseId}`,
        },
      });

      // 3. Update product cache stock
      await this.updateProductStockCache(productId, tx);
      await this.updateProductStockCache(destinationProduct.id, tx);

      const destinationSnapshot = await tx.product.findUnique({
        where: { id: destinationProduct.id },
        include: {
          category: true,
          warehouse: true,
          packagings: {
            where: { active: true },
            orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { unitsPerPackage: 'asc' }],
          },
          batches: {
            where: { warehouseId: toWarehouseId },
          },
        },
      });

      return {
        success: true,
        sourceProductId: productId,
        destinationProductId: destinationProduct.id,
        destinationProduct: destinationSnapshot,
      };
    });
  }

  /**
   * Adds new stock batch (Incoming inventory).
   */
  static async addStock(
    productId: number,
    warehouseId: number,
    quantity: number,
    costPrice: number,
    userId: number,
    reason?: string,
    purchaseCostPrice?: number | null,
    expensePercent?: number | null,
  ) {
    // Create new batch
    const batch = await prisma.productBatch.create({
      data: {
        productId,
        warehouseId,
        quantity,
        remainingQuantity: quantity,
        purchaseCostPrice: purchaseCostPrice ?? null,
        expensePercent: Number(expensePercent || 0),
        costPrice,
      },
    });

    // Record transaction
    await prisma.inventoryTransaction.create({
      data: {
        productId,
        warehouseId,
        userId,
        qtyChange: quantity,
        type: 'incoming',
        reason: reason || 'Stock Arrival',
        referenceId: batch.id,
        costAtTime: costPrice,
      },
    });

    // Update product cache
    await prisma.product.update({
      where: { id: productId },
      data: { 
        stock: { increment: quantity },
        totalIncoming: { increment: quantity }
      },
    });

    return batch;
  }

  static async reverseIncomingTransaction(transactionId: number, userId: number) {
    return prisma.$transaction(async (tx: any) => {
      const transaction = await tx.inventoryTransaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        throw new Error('Приход не найден');
      }

      if (transaction.type !== 'incoming' || Number(transaction.qtyChange || 0) <= 0) {
        throw new Error('Отменить можно только приход товара');
      }

      const quantity = Number(transaction.qtyChange || 0);

      let batch = transaction.referenceId
        ? await tx.productBatch.findUnique({
            where: { id: Number(transaction.referenceId) },
          })
        : null;

      if (!batch) {
        batch = await tx.productBatch.findFirst({
          where: {
            productId: transaction.productId,
            warehouseId: transaction.warehouseId,
            quantity,
            remainingQuantity: { gte: quantity },
          },
          orderBy: { createdAt: 'desc' },
        });
      }

      if (!batch) {
        throw new Error('Не удалось найти связанную партию для отмены прихода');
      }

      if (Number(batch.remainingQuantity || 0) < quantity) {
        throw new Error('Нельзя отменить приход: часть этого количества уже была продана или перенесена');
      }

      if (Number(batch.quantity || 0) !== quantity) {
        throw new Error('Нельзя безопасно отменить этот приход автоматически');
      }

      await tx.productBatch.delete({
        where: { id: batch.id },
      });

      await tx.inventoryTransaction.create({
        data: {
          productId: transaction.productId,
          warehouseId: transaction.warehouseId,
          userId,
          qtyChange: -quantity,
          type: 'adjustment',
          reason: `Отмена прихода #${transaction.id}`,
          referenceId: transaction.id,
          costAtTime: transaction.costAtTime,
          sellingAtTime: transaction.sellingAtTime,
        },
      });

      await this.updateProductStockCache(transaction.productId, tx);

      return { success: true };
    });
  }

  static async writeOffStock(
    productId: number,
    warehouseId: number,
    quantity: number,
    userId: number,
    reason: string
  ) {
    return prisma.$transaction(async (tx: any) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          warehouseId: true,
          sellingPrice: true,
        },
      });

      if (!product) {
        throw new Error('Товар не найден');
      }

      if (Number(product.warehouseId) !== Number(warehouseId)) {
        throw new Error('Списание можно выполнить только со склада этого товара');
      }

      const normalizedQuantity = Number(quantity || 0);
      if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
        throw new Error('Количество для списания должно быть больше нуля');
      }

      const batches = await tx.productBatch.findMany({
        where: {
          productId,
          warehouseId,
          remainingQuantity: { gt: 0 },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      const totalAvailable = batches.reduce((sum: number, batch: any) => sum + Number(batch.remainingQuantity || 0), 0);
      if (totalAvailable < normalizedQuantity) {
        throw new Error(`Недостаточно остатка для списания. Доступно: ${totalAvailable}, требуется: ${normalizedQuantity}`);
      }

      let remainingToWriteOff = normalizedQuantity;
      let totalCost = 0;

      for (const batch of batches) {
        if (remainingToWriteOff <= 0) {
          break;
        }

        const takeFromBatch = Math.min(Number(batch.remainingQuantity || 0), remainingToWriteOff);
        totalCost += takeFromBatch * Number(batch.costPrice || 0);

        await tx.productBatch.update({
          where: { id: batch.id },
          data: {
            remainingQuantity: { decrement: takeFromBatch },
          },
        });

        remainingToWriteOff -= takeFromBatch;
      }

      await tx.inventoryTransaction.create({
        data: {
          productId,
          warehouseId,
          userId,
          qtyChange: -normalizedQuantity,
          type: 'adjustment',
          reason: `Списание: ${String(reason || '').trim() || 'служебное списание'}`,
          costAtTime: normalizedQuantity > 0 ? totalCost / normalizedQuantity : 0,
          sellingAtTime: Number(product.sellingPrice || 0),
        },
      });

      await this.updateProductStockCache(productId, tx);

      return { success: true };
    });
  }

  static async zeroBatchRemaining(batchId: number, userId: number) {
    return prisma.$transaction(async (tx: any) => {
      const batch = await tx.productBatch.findUnique({
        where: { id: batchId },
        include: {
          saleAllocations: {
            select: { id: true },
          },
        },
      });

      if (!batch) {
        throw new Error('Партия не найдена');
      }

      const remainingQuantity = Number(batch.remainingQuantity || 0);
      if (remainingQuantity <= 0) {
        throw new Error('У этой партии уже нет остатка');
      }

      if ((batch.saleAllocations?.length || 0) === 0 && Number(batch.quantity || 0) === remainingQuantity) {
        await tx.inventoryTransaction.deleteMany({
          where: {
            productId: batch.productId,
            warehouseId: batch.warehouseId,
            type: 'incoming',
            referenceId: batch.id,
          },
        });

        await tx.productBatch.delete({
          where: { id: batchId },
        });
      } else {
        await tx.productBatch.update({
          where: { id: batchId },
          data: {
            remainingQuantity: 0,
          },
        });
      }

      await tx.inventoryTransaction.create({
        data: {
          productId: batch.productId,
          warehouseId: batch.warehouseId,
          userId,
          qtyChange: -remainingQuantity,
          type: 'adjustment',
          reason: `Обнуление остатка партии #${batchId}`,
          referenceId: batchId,
          costAtTime: batch.costPrice,
        },
      });

      await this.updateProductStockCache(batch.productId, tx);

      return { success: true };
    });
  }

  static async deleteBatch(batchId: number) {
    return prisma.$transaction(async (tx: any) => {
      const batch = await tx.productBatch.findUnique({
        where: { id: batchId },
        include: {
          saleAllocations: {
            select: { id: true },
          },
        },
      });

      if (!batch) {
        throw new Error('Партия не найдена');
      }

      const initialQuantity = Number(batch.quantity || 0);
      const remainingQuantity = Number(batch.remainingQuantity || 0);

      if (batch.saleAllocations.length > 0 || remainingQuantity !== initialQuantity) {
        throw new Error('Эта партия уже участвовала в списании. Её нельзя удалить, можно только обнулить остаток.');
      }

      await tx.inventoryTransaction.deleteMany({
        where: {
          productId: batch.productId,
          warehouseId: batch.warehouseId,
          type: 'incoming',
          referenceId: batch.id,
        },
      });

      await tx.productBatch.delete({
        where: { id: batchId },
      });

      await this.updateProductStockCache(batch.productId, tx);

      return { success: true };
    });
  }

  /**
   * Updates the cached stock value in the Product model.
   */
  static async updateProductStockCache(productId: number, tx?: any) {
    const client = tx || prisma;
    const batches = await client.productBatch.findMany({
      where: { productId },
      select: { quantity: true, remainingQuantity: true },
    });

    const totalStock = batches.reduce((sum: number, b: any) => sum + b.remainingQuantity, 0);
    const totalIncoming = batches.reduce((sum: number, b: any) => sum + Number(b.quantity || 0), 0);

    await client.product.update({
      where: { id: productId },
      data: {
        stock: totalStock,
        totalIncoming,
      },
    });
  }
}
