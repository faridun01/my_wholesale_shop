import prisma from '../db/prisma.js';
import { buildProductNameKey } from '../utils/product-packaging.js';

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
      const sourceProduct = await tx.product.findUnique({
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

        if (Array.isArray(sourceProduct.packagings) && sourceProduct.packagings.length > 0) {
          await tx.productPackaging.createMany({
            data: sourceProduct.packagings.map((packaging: any) => ({
              productId: destinationProduct.id,
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

      return { success: true, destinationProductId: destinationProduct.id };
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

  /**
   * Updates the cached stock value in the Product model.
   */
  static async updateProductStockCache(productId: number, tx?: any) {
    const client = tx || prisma;
    const batches = await client.productBatch.findMany({
      where: { productId },
      select: { remainingQuantity: true },
    });

    const totalStock = batches.reduce((sum: number, b: any) => sum + b.remainingQuantity, 0);

    await client.product.update({
      where: { id: productId },
      data: { stock: totalStock },
    });
  }
}
