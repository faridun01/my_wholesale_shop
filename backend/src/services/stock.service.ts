import { operationKey, requestHash, assertReplay } from '../utils/financial-operation.js';
import { normalizeMoney } from '../utils/money.js';
import { decimal } from '../utils/financial.js';
import prisma from '../db/prisma.js';
import { quantity as wholeStoredQuantity, toCents, addMoney, cumulativeValue, lineTotal } from '../utils/financial.js';

function round2(value: number): number {
  return decimal(value).toDecimalPlaces(2).toNumber();
}

function toNumber(value: any, fallback = 0): number {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

async function stockOperation(tx: any, value: string | undefined, payload: unknown) {
  const key = value ? operationKey(value) : null;
  const hash = requestHash(payload);
  if (!key) return { key, hash, existing: null };
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
  const existing = await tx.inventoryTransaction.findUnique({ where: { idempotencyKey: key } });
  if (existing) assertReplay(existing, hash);
  return { key, hash, existing };
}

/**
 * Rounds a quantity to integer precision (all quantities are INT)
 */
function roundQty(value: number): number {
  const numeric = Number(value || 0);
  if (!Number.isSafeInteger(numeric)) throw new Error('Quantity must be a whole number');
  return numeric;
}



export class StockService {
  static isCorrectionWriteOffReason(reason: string | null | undefined) {
    return String(reason || '').trim().toLowerCase().includes('корректиров');
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
    const requiredQty = roundQty(toNumber(quantity, 0));

    if (requiredQty <= 0) {
      throw new Error('Количество для списания должно быть больше 0');
    }

    let remainingToAllocate = requiredQty;
    let totalCost = 0;

    let batches: any[] = [];
    if (typeof client.$queryRaw === 'function') {
      // Row-locking read: must not silently fall back on error, or concurrent
      // allocations can race unlocked and oversell/undershoot stock (see stock.service.ts audit).
      batches = await client.$queryRaw`
        SELECT id, product_id as "productId", warehouse_id as "warehouseId",
               remaining_quantity as "remainingQuantity", cost_price as "costPrice"
        FROM product_batches
        WHERE product_id = ${productId} AND warehouse_id = ${warehouseId} AND remaining_quantity > 0
        ORDER BY created_at ASC
        FOR UPDATE
      `;
    } else {
      // Only reached by test mocks that don't implement $queryRaw.
      batches = await client.productBatch.findMany({
        where: { productId, warehouseId, remainingQuantity: { gt: 0 } },
        orderBy: { createdAt: 'asc' },
      });
    }

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
      totalCost = addMoney(totalCost, lineTotal(takeFromBatch, batch.costPrice || 0));

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

    return cumulativeValue(totalCost, 1, requiredQty);
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

    if (remainingToReturn > allocations.reduce((sum: number, a: any) => sum + Number(a.quantity || 0), 0)) {
      throw new Error('Stock allocations require reconciliation before this return');
    }

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
   * Transfers stock between warehouses. Products are warehouse-scoped rows (each
   * warehouse has its own Product record for the same item, see the
   * [warehouseId, nameKey] unique constraint), so a transfer must move stock into
   * the destination warehouse's OWN product row (finding or cloning it), never
   * into a new batch still tagged to the source product's id — otherwise the
   * stock becomes invisible/unsellable at the destination while
   * updateProductStockCache (which sums batches by productId only) keeps
   * counting it against the source product too.
   */
  static async transferStock(
    productId: number,
    fromWarehouseId: number,
    toWarehouseId: number,
    quantity: number,
    userId: number,
    idempotencyKey?: string
  ) {
    const transferQty = roundQty(toNumber(quantity, 0));

    if (transferQty <= 0) {
      throw new Error('Количество для переноса должно быть больше 0');
    }

    if (Number(fromWarehouseId) === Number(toWarehouseId)) {
      throw new Error('Склад назначения должен отличаться от склада списания');
    }

    return await prisma.$transaction(async (tx: any) => {
      const operation = await stockOperation(tx, idempotencyKey, { kind: 'transfer', productId, fromWarehouseId, toWarehouseId, quantity, userId });
      if (operation.existing) return { success: true, destinationProductId: operation.existing.referenceId };
      const sourceProduct = await tx.product.findUnique({ where: { id: productId } });

      if (!sourceProduct) {
        throw new Error('Товар не найден');
      }

      if (Number(sourceProduct.warehouseId) !== Number(fromWarehouseId)) {
        throw new Error('Перемещение можно выполнить только со склада этого товара');
      }

      let destProduct = await tx.product.findFirst({
        where: { warehouseId: toWarehouseId, nameKey: sourceProduct.nameKey },
      });

      if (!destProduct) {
        destProduct = await tx.product.create({
          data: {
            categoryId: sourceProduct.categoryId,
            sku: sourceProduct.sku,
            name: sourceProduct.name,
            rawName: sourceProduct.rawName,
            brand: sourceProduct.brand,
            nameKey: sourceProduct.nameKey,
            unit: sourceProduct.unit,
            baseUnitName: sourceProduct.baseUnitName,
            purchaseCostPrice: sourceProduct.purchaseCostPrice,
            expensePercent: sourceProduct.expensePercent,
            costPrice: sourceProduct.costPrice,
            sellingPrice: sourceProduct.sellingPrice,
            minStock: sourceProduct.minStock,
            photoUrl: sourceProduct.photoUrl,
            warehouseId: toWarehouseId,
            active: true,
          },
        });
      }

      // Row-locking read: must not race unlocked, or concurrent transfers/write-offs
      // of the same batches can both pass the availability check and oversell.
      const sourceBatches: any[] = await tx.$queryRaw`
        SELECT id, remaining_quantity as "remainingQuantity", cost_price as "costPrice"
        FROM product_batches
        WHERE product_id = ${productId} AND warehouse_id = ${fromWarehouseId} AND remaining_quantity > 0
        ORDER BY created_at ASC
        FOR UPDATE
      `;

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
            productId: destProduct.id,
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
          referenceId: destProduct.id,
          idempotencyKey: operation.key,
          requestHash: operation.hash,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          productId: destProduct.id,
          warehouseId: toWarehouseId,
          userId,
          qtyChange: transferQty,
          type: 'transfer',
          reason: `Transfer from Warehouse #${fromWarehouseId}`,
        },
      });

      await this.updateProductStockCache(productId, tx);
      await this.updateProductStockCache(destProduct.id, tx);

      return { success: true, destinationProductId: destProduct.id };
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
    costPrice: number | string,
    userId: number,
    reason?: string,
    purchaseCostPrice?: number | string,
    expensePercent?: number | string,
    options: { transactionClient?: any; idempotencyKey?: string; sellingPrice?: unknown } = {}
  ) {
    const normalizedQty = roundQty(toNumber(quantity, 0));
    const normalizedCost = normalizeMoney(costPrice, 'Purchase cost');
    const normalizedReason = String(reason || 'Stock Arrival').trim();
    const normalizedPurchaseCostPrice = purchaseCostPrice !== undefined ? normalizeMoney(purchaseCostPrice, 'Purchase cost') : null;
    const normalizedExpensePercent = decimal(expensePercent ?? 0).toString();

    if (normalizedQty <= 0) {
      throw new Error('Количество должно быть больше 0');
    }

    if (normalizedCost < 0) {
      throw new Error('Цена закупки не может быть отрицательной');
    }

    if (decimal(normalizedExpensePercent).lt(0)) throw new Error('Expense percentage must be non-negative');
    const key = options.idempotencyKey ? operationKey(options.idempotencyKey) : null;
    const sellingPrice = options.sellingPrice === undefined ? undefined : normalizeMoney(options.sellingPrice, 'Selling price');
    const hash = requestHash({ productId, warehouseId, quantity: normalizedQty, costPrice: normalizedCost, userId, reason: normalizedReason, purchaseCostPrice: normalizedPurchaseCostPrice, expensePercent: normalizedExpensePercent, sellingPrice });
    const runTransaction: any = options.transactionClient ? (callback: any) => callback(options.transactionClient) : prisma.$transaction.bind(prisma);
    return await runTransaction(async (tx: any) => {
      if (key) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
        const existing = await tx.inventoryTransaction.findUnique({ where: { idempotencyKey: key } });
        if (existing) {
          assertReplay(existing, hash);
          const original = await tx.productBatch.findUnique({ where: { id: existing.referenceId } });
          if (!original) throw new Error('Previously applied incoming batch has already been cancelled');
          return original;
        }
      }
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`;
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product || Number(product.warehouseId) !== Number(warehouseId)) throw new Error('Incoming product does not belong to the warehouse');
      if (sellingPrice !== undefined && (!decimal(product.costPrice).eq(normalizedCost) || !decimal(product.sellingPrice).eq(sellingPrice))) {
        await tx.priceHistory.create({ data: { productId, costPrice: normalizedCost, sellingPrice } });
      }
      const batch = await tx.productBatch.create({
        data: {
          productId,
          warehouseId,
          quantity: normalizedQty,
          remainingQuantity: normalizedQty,
          costPrice: normalizedCost,
          purchaseCostPrice: normalizedPurchaseCostPrice,
          expensePercent: normalizedExpensePercent,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          productId,
          warehouseId,
          userId,
          qtyChange: normalizedQty,
          type: 'incoming',
          idempotencyKey: key,
          requestHash: hash,
          referenceId: batch.id,
          totalCost: lineTotal(normalizedQty, normalizedCost),
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
          ...(purchaseCostPrice !== undefined ? { purchaseCostPrice: normalizedPurchaseCostPrice } : {}),
          ...(expensePercent !== undefined ? { expensePercent: normalizedExpensePercent } : {}),
          ...(sellingPrice !== undefined ? { sellingPrice } : {}),
          unit: 'шт',
        },
      });

      return batch;
    });
  }

  static async reverseIncomingTransaction(transactionId: number, userId: number) {
    return prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM inventory_transactions WHERE id = ${transactionId} FOR UPDATE`;
      const transaction = await tx.inventoryTransaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        throw new Error('Приход не найден');
      }

      if (transaction.type !== 'incoming' || Number(transaction.qtyChange || 0) <= 0) {
        throw new Error('Отменить можно только приход товара');
      }

      const quantity = roundQty(toNumber(transaction.qtyChange, 0));
      const existingReversal = await tx.inventoryTransaction.findFirst({ where: { referenceId: transaction.id, type: 'adjustment', qtyChange: { lt: 0 } } });
      if (existingReversal) throw new Error('Incoming transaction has already been reversed');
      if (!transaction.referenceId) throw new Error('Historical incoming batch link requires reconciliation');
      await tx.$queryRaw`SELECT id FROM product_batches WHERE id = ${Number(transaction.referenceId)} FOR UPDATE`;
      const batch = await tx.productBatch.findUnique({ where: { id: Number(transaction.referenceId) } });
      if (batch && (Number(batch.productId) !== Number(transaction.productId) || Number(batch.warehouseId) !== Number(transaction.warehouseId))) throw new Error('Incoming batch link requires reconciliation');

      if (!batch) {
        throw new Error('Не удалось найти связанную партию для отмены прихода');
      }

      if (roundQty(toNumber(batch.remainingQuantity, 0)) < quantity) {
        throw new Error('Нельзя отменить приход: часть этого количества уже была продана или перенесена');
      }

      if (roundQty(toNumber(batch.quantity, 0)) !== quantity) {
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
    reason: string,
    idempotencyKey?: string
  ) {
    return prisma.$transaction(async (tx: any) => {
      const operation = await stockOperation(tx, idempotencyKey, { kind: 'write-off', productId, warehouseId, quantity, userId, reason });
      if (operation.existing) return { success: true, transactionId: operation.existing.id };
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

      const normalizedQuantity = roundQty(toNumber(quantity, 0));
      if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
        throw new Error('Количество для списания должно быть больше нуля');
      }

      // Row-locking read: must not race unlocked, or a concurrent write-off/transfer
      // of the same batches can both pass the availability check and oversell.
      const batches: any[] = await tx.$queryRaw`
        SELECT id, remaining_quantity as "remainingQuantity", cost_price as "costPrice"
        FROM product_batches
        WHERE product_id = ${productId} AND warehouse_id = ${warehouseId} AND remaining_quantity > 0
        ORDER BY created_at ASC
        FOR UPDATE
      `;

      const totalAvailable = roundQty(
        batches.reduce((sum: number, batch: any) => sum + toNumber(batch.remainingQuantity, 0), 0)
      );
      if (totalAvailable < normalizedQuantity) {
        throw new Error(`Недостаточно остатка для списания. Доступно: ${totalAvailable}, требуется: ${normalizedQuantity}`);
      }

      let remainingToWriteOff = normalizedQuantity;
      let totalCost = 0;
      const costAllocations: { batchId: number; quantity: number; costPrice: string }[] = [];
      const normalizedReason = String(reason || '').trim() || 'служебное списание';

      for (const batch of batches) {
        if (remainingToWriteOff <= 0) {
          break;
        }

        const batchRemaining = roundQty(toNumber(batch.remainingQuantity, 0));
        const takeFromBatch = Math.min(batchRemaining, remainingToWriteOff);
        costAllocations.push({ batchId: Number(batch.id), quantity: takeFromBatch, costPrice: decimal(batch.costPrice).toFixed(2) });
        totalCost = decimal(totalCost).plus(decimal(takeFromBatch).times(decimal(toNumber(batch.costPrice, 0)))).toNumber();

        await tx.productBatch.update({
          where: { id: batch.id },
          data: {
            remainingQuantity: { decrement: takeFromBatch },
          },
        });

        remainingToWriteOff = roundQty(remainingToWriteOff - takeFromBatch);
      }

      const event = await tx.inventoryTransaction.create({
        data: {
          productId,
          warehouseId,
          userId,
          qtyChange: -normalizedQuantity,
          type: 'adjustment',
          idempotencyKey: operation.key,
          requestHash: operation.hash,
          totalCost,
          costAllocations,
          reason: `Списание: ${normalizedReason}`,
          costAtTime: normalizedQuantity > 0 ? round2(decimal(totalCost).div(decimal(normalizedQuantity)).toNumber()) : 0,
          sellingAtTime: Number(product.sellingPrice || 0),
        },
      });

      await this.updateProductStockCache(productId, tx);

      return { success: true, transactionId: event.id };
    });
  }

  static async reverseCorrectionWriteOff(transactionId: number, userId: number) {
    const transaction = await prisma.inventoryTransaction.findUnique({ where: { id: transactionId } });
    if (!transaction || !this.isCorrectionWriteOffReason(transaction.reason)) throw new Error('Only correction write-offs may be reversed');
    return this.returnWriteOffTransaction(transactionId, Math.abs(Number(transaction.qtyChange)), userId, 'Correction reversal');
  }

  static async returnWriteOffTransaction(transactionId: number, quantity: number, userId: number, reason?: string, idempotencyKey?: string) {
    return prisma.$transaction(async (tx: any) => {
      const operation = await stockOperation(tx, idempotencyKey, { kind: 'return-write-off', transactionId, quantity, userId, reason });
      if (operation.existing) return { success: true, transactionId: operation.existing.id };
      await tx.$queryRaw`SELECT id FROM inventory_transactions WHERE id = ${transactionId} FOR UPDATE`;
      const transaction = await tx.inventoryTransaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        throw new Error('Списание не найдено');
      }

      if (
        transaction.type !== 'adjustment' ||
        Number(transaction.qtyChange || 0) >= 0 ||
        !String(transaction.reason || '').includes('Списание')
      ) {
        throw new Error('Вернуть можно только списание товара');
      }

      const normalizedQuantity = roundQty(toNumber(quantity, 0));
      if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
        throw new Error('Количество для возврата должно быть больше нуля');
      }

      const originalQuantity = roundQty(Math.abs(toNumber(transaction.qtyChange, 0)));
      const returnedTransactions = await tx.inventoryTransaction.findMany({
        where: {
          referenceId: transaction.id,
          type: 'adjustment',
          idempotencyKey: operation.key,
          requestHash: operation.hash,
          qtyChange: { gt: 0 },
        },
        select: { qtyChange: true },
      });

      const alreadyReturned = roundQty(
        returnedTransactions.reduce((sum: number, item: any) => sum + toNumber(item.qtyChange, 0), 0)
      );
      const availableToReturn = roundQty(originalQuantity - alreadyReturned);

      if (availableToReturn <= 0) {
        throw new Error('Это списание уже полностью возвращено');
      }

      if (normalizedQuantity > availableToReturn) {
        throw new Error(`Нельзя вернуть больше доступного. Сейчас доступно: ${availableToReturn}`);
      }

      const product = await tx.product.findUnique({
        where: { id: transaction.productId },
        select: {
          id: true,
          costPrice: true,
          active: true,
        },
      });

      if (!product || !product.active) {
        throw new Error('Товар не найден');
      }

      const saved = Array.isArray(transaction.costAllocations) ? transaction.costAllocations : null;
      let costToRestore = 0;
      const restoredAllocations: { batchId: number; quantity: number; costPrice: string }[] = [];
      if (saved) {
        if (saved.reduce((sum: number, row: any) => sum + wholeStoredQuantity(row.quantity), 0) !== originalQuantity ||
            toCents(addMoney(...saved.map((row: any) => lineTotal(row.quantity, row.costPrice)))) !== toCents(transaction.totalCost)) {
          throw new Error('Write-off cost allocations require reconciliation');
        }
        let skipped = alreadyReturned;
        let needed = normalizedQuantity;
        for (const row of saved) {
          const available = wholeStoredQuantity(row.quantity);
          const skip = Math.min(skipped, available); skipped -= skip;
          const take = Math.min(available - skip, needed);
          if (!take) continue;
          const existing = await tx.productBatch.findUnique({ where: { id: Number(row.batchId) } });
          const price = decimal(row.costPrice).toFixed(2);
          if (existing && Number(existing.productId) === Number(transaction.productId) && Number(existing.warehouseId) === Number(transaction.warehouseId) && decimal(existing.costPrice).eq(price)) {
            await tx.productBatch.update({ where: { id: existing.id }, data: { remainingQuantity: { increment: take } } });
          } else {
            await tx.productBatch.create({ data: { productId: transaction.productId, warehouseId: transaction.warehouseId, quantity: take, remainingQuantity: take, costPrice: price } });
          }
          restoredAllocations.push({ batchId: Number(row.batchId), quantity: take, costPrice: price });
          costToRestore = addMoney(costToRestore, lineTotal(take, price));
          needed -= take;
          if (!needed) break;
        }
        if (needed) throw new Error('Write-off allocation quantity mismatch');
      } else {
        // No invented batch details for historical write-offs.
        const price = transaction.costAtTime ?? product.costPrice;
        await tx.productBatch.create({ data: { productId: transaction.productId, warehouseId: transaction.warehouseId, quantity: normalizedQuantity, remainingQuantity: normalizedQuantity, costPrice: price } });
        costToRestore = lineTotal(normalizedQuantity, price);
      }

      const reasonSuffix = String(reason || '').trim();
      const event = await tx.inventoryTransaction.create({
        data: {
          productId: transaction.productId,
          warehouseId: transaction.warehouseId,
          userId,
          qtyChange: normalizedQuantity,
          type: 'adjustment',
          idempotencyKey: operation.key,
          requestHash: operation.hash,
          reason: `Возврат списания #${transaction.id}${reasonSuffix ? `: ${reasonSuffix}` : ''}`,
          referenceId: transaction.id,
          totalCost: costToRestore,
          ...(saved ? { costAllocations: restoredAllocations } : {}),
          costAtTime: transaction.costAtTime,
          sellingAtTime: transaction.sellingAtTime,
        },
      });

      await this.updateProductStockCache(transaction.productId, tx);

      return { success: true, transactionId: event.id };
    });
  }

  static async deleteWriteOffTransactionPermanently(transactionId: number, userId?: number) {
    // Retain the original event; cancelling a write-off is an appended restoration.
    const transaction = await prisma.inventoryTransaction.findUnique({ where: { id: transactionId } });
    if (!transaction) throw new Error('Write-off not found');
    return this.returnWriteOffTransaction(transactionId, Math.abs(Number(transaction.qtyChange)), userId ?? transaction.userId, 'Write-off cancellation');
  }

  /**
   * Zeroes out a batch's remaining quantity (e.g. correcting a bad batch record),
   * recording an adjustment transaction for the difference.
   */
  static async zeroBatchRemaining(batchId: number, userId: number) {
    return await prisma.$transaction(async (tx: any) => {
      const batch = await tx.productBatch.findUnique({ where: { id: batchId } });

      if (!batch) {
        throw new Error('Партия не найдена');
      }

      const remaining = roundQty(toNumber(batch.remainingQuantity, 0));

      if (remaining <= 0) {
        return { success: true };
      }

      await tx.productBatch.update({
        where: { id: batchId },
        data: { remainingQuantity: 0 },
      });

      await tx.inventoryTransaction.create({
        data: {
          productId: batch.productId,
          warehouseId: batch.warehouseId,
          userId,
          qtyChange: -remaining,
          type: 'adjustment',
          reason: `Обнуление партии #${batchId}`,
          costAtTime: round2(toNumber(batch.costPrice, 0)),
        },
      });

      await this.updateProductStockCache(batch.productId, tx);

      return { success: true };
    });
  }

  /**
   * Permanently deletes a batch record. Blocked with a friendly error if any sale
   * has already allocated stock from it (the DB FK would otherwise reject the
   * delete with a raw constraint error).
   */
  static async deleteBatch(batchId: number) {
    return await prisma.$transaction(async (tx: any) => {
      const batch = await tx.productBatch.findUnique({ where: { id: batchId } });

      if (!batch) {
        throw new Error('Партия не найдена');
      }

      const allocationCount = await tx.saleAllocation.count({ where: { batchId } });
      if (allocationCount > 0) {
        throw new Error('Нельзя удалить партию: часть товара из неё уже продана');
      }

      await tx.productBatch.delete({ where: { id: batchId } });
      await this.updateProductStockCache(batch.productId, tx);

      return { success: true };
    });
  }

  /**
   * Rebuild product stock from batches.
   */
  static async updateProductStockCache(productId: number, tx?: any) {
    const client = tx || prisma;

    const totals = await client.productBatch.aggregate({
      where: { productId },
      _sum: {
        quantity: true,
        remainingQuantity: true,
      },
    });

    const totalStock = roundQty(toNumber(totals._sum.remainingQuantity, 0));
    const totalIncoming = roundQty(toNumber(totals._sum.quantity, 0));

    await client.product.update({
      where: { id: productId },
      data: {
        stock: totalStock,
        totalIncoming,
        unit: 'шт',
      },
    });
  }
}
