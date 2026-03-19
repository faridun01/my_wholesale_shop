import { Router } from 'express';
import prisma from '../db/prisma.js';
import { StockService } from '../services/stock.service.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { ensureWarehouseAccess, getAccessContext, getScopedWarehouseId } from '../utils/access.js';

const router = Router();

const normalizeVolumeSpacing = (value: string) =>
  value
    .replace(/(\d)\s*[.,]\s*(\d)/gu, '$1.$2')
    .replace(/(\d)\s+(\d)(?=\s*(?:гр|г|кг|л|мл)\b)/giu, '$1.$2')
    .replace(/(\d(?:\.\d+)?)\s*(гр|г|кг|л|мл|шт)\b/giu, '$1 $2');

const normalizeProductName = (value: string | null | undefined) =>
  normalizeVolumeSpacing(String(value || ''))
    .replace(/\s*\[[^\]]*\]\s*$/u, '')
    .replace(/[«"“”„‟'][^«"“”„‟']+[»"“”„‟']/gu, ' ')
    .replace(/[«»“”„‟"']/gu, '')
    .replace(/[(),]/gu, ' ')
    .replace(/plasticковых/giu, 'пластиковых')
    .replace(/[ёЁ]/gu, 'е')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeProductFamilyName = (value: string | null | undefined) =>
  normalizeProductName(value)
    .toLowerCase()
    .replace(/\bмассой\s+\d+(?:[.,]\d+)?\s*(?:гр|г|кг|л|мл|шт)\b/giu, '')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:гр|г|кг|л|мл|шт)\b/giu, '')
    .replace(/\s+/g, ' ')
    .trim();

const formatMoneyValue = (value: unknown) => Number(value || 0).toFixed(2);

const ensureAdminProductAccess = (access: Awaited<ReturnType<typeof getAccessContext>>, res: any) => {
  if (!access.isAdmin) {
    res.status(403).json({ error: 'Только администратор может выполнять это действие' });
    return false;
  }

  return true;
};

const applyFamilyPhotoFallback = <T extends { id: number; name: string | null; photoUrl?: string | null }>(items: T[]) => {
  const familyPhotoMap = new Map<string, string>();

  for (const item of items) {
    const familyKey = normalizeProductFamilyName(item.name);
    if (!familyKey || !item.photoUrl) continue;
    if (!familyPhotoMap.has(familyKey)) {
      familyPhotoMap.set(familyKey, item.photoUrl);
    }
  }

  return items.map((item) => {
    if (item.photoUrl) {
      return item;
    }

    const familyKey = normalizeProductFamilyName(item.name);
    const inheritedPhoto = familyKey ? familyPhotoMap.get(familyKey) : null;

    return inheritedPhoto ? { ...item, photoUrl: inheritedPhoto } : item;
  });
};

router.get('/', async (req, res, next) => {
  try {
    const access = await getAccessContext(req as AuthRequest);
    const warehouseId = getScopedWarehouseId(access, req.query.warehouseId);
    const products = await prisma.product.findMany({
      where: {
        active: true,
        warehouseId: warehouseId ?? undefined,
      },
      include: { 
        category: true, 
        warehouse: true,
        batches: warehouseId ? {
          where: { warehouseId: Number(warehouseId) }
        } : false
      },
    });

    const productsWithResolvedPhoto = applyFamilyPhotoFallback(products as any[]);

    if (warehouseId) {
      const productsWithWarehouseStock = productsWithResolvedPhoto.map((p: any) => {
        const warehouseStock = p.batches.reduce((sum: number, b: any) => sum + b.remainingQuantity, 0);
        return {
          ...p,
          stock: warehouseStock,
          costPrice: access.isAdmin ? p.costPrice : null,
        };
      });
      return res.json(productsWithWarehouseStock);
    }

    res.json(
      productsWithResolvedPhoto.map((product: any) => ({
        ...product,
        costPrice: access.isAdmin ? product.costPrice : null,
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    if (!ensureAdminProductAccess(access, res)) {
      return;
    }
    const { initialStock, warehouseId, costPrice, ...rest } = req.body;
    const userId = req.user?.id || 1;
    const requestedWarehouseId = warehouseId ? Number(warehouseId) : null;
    const wId = access.isAdmin ? requestedWarehouseId : access.warehouseId;

    if (!access.isAdmin && !wId) {
      return res.status(400).json({ error: 'Warehouse ID is required' });
    }
    const normalizedName = normalizeProductName(rest.name);

    // Check for unique constraints
    const existingProducts = await prisma.product.findMany({
      where: {
        warehouseId: wId,
        active: true
      },
      select: {
        id: true,
        name: true,
      }
    });
    const existingProduct = existingProducts.find((product: { id: number; name: string }) => normalizeProductName(product.name) === normalizedName);

    if (existingProduct) {
      return res.status(400).json({
        error: `Товар с названием "${rest.name}" уже существует на этом складе`
      });
    }

    const resolvedPhotoUrl = rest.photoUrl || null;

    // Create product with 0 stock first
    const product = await prisma.product.create({
      data: {
        ...rest,
        name: normalizedName,
        sku: null,
        photoUrl: resolvedPhotoUrl,
        initialStock: Number(initialStock || 0),
        totalIncoming: 0,
        stock: 0,
        warehouseId: wId,
        costPrice: Number(costPrice || 0),
      },
    });

    // Record initial price history
    await prisma.priceHistory.create({
      data: {
        productId: product.id,
        costPrice: Number(costPrice || 0),
        sellingPrice: Number(rest.sellingPrice || 0),
      }
    });

    // Then add initial stock via StockService to create batches and transactions
    if (initialStock > 0 && wId) {
      await StockService.addStock(
        product.id,
        Number(wId),
        Number(initialStock),
        Number(costPrice || 0),
        userId,
        'Initial Stock'
      );
    }

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    if (!ensureAdminProductAccess(access, res)) {
      return;
    }
    const productId = Number(req.params.id);
    const userId = req.user?.id || 1;
    const oldProduct = await prisma.product.findUnique({ where: { id: productId } });
    
    if (!oldProduct) {
      return res.status(404).json({ error: 'Ð¢Ð¾Ð²Ð°Ñ€ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½' });
    }

    if (!access.isAdmin && !ensureWarehouseAccess(access, oldProduct.warehouseId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Check for unique constraints if name or warehouseId changed
    const newName = normalizeProductName(req.body.name || oldProduct.name);
    const newWarehouseId = access.isAdmin
      ? (req.body.warehouseId !== undefined ? Number(req.body.warehouseId) : oldProduct.warehouseId)
      : access.warehouseId;

    if (newName !== oldProduct.name || newWarehouseId !== oldProduct.warehouseId) {
      const existingProducts = await prisma.product.findMany({
        where: {
          warehouseId: newWarehouseId,
          active: true
        },
        select: {
          id: true,
          name: true,
        }
      });
      const existingProduct = existingProducts.find((product: { id: number; name: string }) => (
        product.id !== productId && normalizeProductName(product.name) === newName
      ));

      if (existingProduct) {
        return res.status(400).json({
          error: `Товар с названием "${newName}" уже существует на этом складе`
        });
      }
    }
    
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        ...req.body,
        name: newName,
        sku: null
      }
    });

    if (req.body.photoUrl !== undefined) {
      const familyName = normalizeProductFamilyName(newName);
      const relatedProducts = await prisma.product.findMany({
        where: {
          active: true,
          id: { not: productId },
        },
        select: {
          id: true,
          name: true,
        }
      });

      const relatedIds = relatedProducts
        .filter((relatedProduct: { id: number; name: string }) => normalizeProductFamilyName(relatedProduct.name) === familyName)
        .map((relatedProduct: { id: number; name: string }) => relatedProduct.id);

      await prisma.product.updateMany({
        where: {
          id: { in: relatedIds },
        },
        data: {
          photoUrl: req.body.photoUrl || null
        }
      });
    }

    // If price changed, record history
    if (oldProduct && (req.body.costPrice !== undefined || req.body.sellingPrice !== undefined)) {
      const newCost = req.body.costPrice !== undefined ? Number(req.body.costPrice) : oldProduct.costPrice;
      const newSelling = req.body.sellingPrice !== undefined ? Number(req.body.sellingPrice) : oldProduct.sellingPrice;
      
      if (newCost !== oldProduct.costPrice || newSelling !== oldProduct.sellingPrice) {
        const historyWarehouseId = oldProduct.warehouseId ?? newWarehouseId ?? null;

        await prisma.priceHistory.create({
          data: {
            productId,
            costPrice: newCost,
            sellingPrice: newSelling
          }
        });

        if (historyWarehouseId) {
          await prisma.inventoryTransaction.create({
            data: {
              productId,
              warehouseId: historyWarehouseId,
              userId,
              qtyChange: 0,
              type: 'adjustment',
              reason: `Изменение цены: ${oldProduct.sellingPrice} -> ${newSelling}`,
              costAtTime: newCost,
              sellingAtTime: newSelling,
            }
          });
        }
      }
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/merge', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    if (!ensureAdminProductAccess(access, res)) {
      return;
    }

    const sourceProductId = Number(req.params.id);
    const targetProductId = Number(req.body?.targetProductId);

    if (!Number.isFinite(sourceProductId) || !Number.isFinite(targetProductId) || sourceProductId <= 0 || targetProductId <= 0) {
      return res.status(400).json({ error: 'Некорректные товары для объединения' });
    }

    if (sourceProductId === targetProductId) {
      return res.status(400).json({ error: 'Нельзя объединить товар с самим собой' });
    }

    const [sourceProduct, targetProduct] = await Promise.all([
      prisma.product.findUnique({ where: { id: sourceProductId } }),
      prisma.product.findUnique({ where: { id: targetProductId } }),
    ]);

    if (!sourceProduct || !targetProduct) {
      return res.status(404).json({ error: 'Один из товаров не найден' });
    }

    if (sourceProduct.warehouseId !== targetProduct.warehouseId) {
      return res.status(400).json({ error: 'Объединять можно только товары из одного склада' });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.productBatch.updateMany({
        where: { productId: sourceProductId },
        data: { productId: targetProductId },
      });

      await tx.invoiceItem.updateMany({
        where: { productId: sourceProductId },
        data: { productId: targetProductId },
      });

      await tx.inventoryTransaction.updateMany({
        where: { productId: sourceProductId },
        data: { productId: targetProductId },
      });

      await tx.priceHistory.updateMany({
        where: { productId: sourceProductId },
        data: { productId: targetProductId },
      });

      const targetBatches = await tx.productBatch.findMany({
        where: { productId: targetProductId },
        select: { quantity: true, remainingQuantity: true },
      });

      const nextStock = targetBatches.reduce((sum: number, batch: any) => sum + Number(batch.remainingQuantity || 0), 0);
      const nextIncoming = targetBatches.reduce((sum: number, batch: any) => sum + Number(batch.quantity || 0), 0);

      await tx.product.update({
        where: { id: targetProductId },
        data: {
          stock: nextStock,
          totalIncoming: nextIncoming,
          initialStock: Math.max(Number(targetProduct.initialStock || 0), nextIncoming),
          photoUrl: targetProduct.photoUrl || sourceProduct.photoUrl || null,
        },
      });

      await tx.product.update({
        where: { id: sourceProductId },
        data: {
          active: false,
          stock: 0,
          totalIncoming: 0,
          initialStock: 0,
          name: `${sourceProduct.name} [merged ${sourceProductId}]`,
          photoUrl: null,
          sku: null,
        },
      });
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const access = await getAccessContext(req as AuthRequest);
    if (!ensureAdminProductAccess(access, res)) {
      return;
    }
    const productId = Number(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        batches: {
          where: { remainingQuantity: { gt: 0 } },
          select: { remainingQuantity: true },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    if (!access.isAdmin && !ensureWarehouseAccess(access, product.warehouseId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const remainingStock = product.batches.reduce((sum: number, batch: any) => sum + Number(batch.remainingQuantity || 0), 0);
    if (remainingStock > 0 || Number(product.stock || 0) > 0) {
      return res.status(400).json({ error: 'Нельзя удалить товар, пока на складе есть запас' });
    }

    await prisma.product.update({
      where: { id: productId },
      data: { active: false }
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/restock', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    if (!ensureAdminProductAccess(access, res)) {
      return;
    }
    const productId = Number(req.params.id);
    const userId = req.user!.id;
    const warehouseId = access.isAdmin ? Number(req.body.warehouseId) : access.warehouseId;
    const { quantity, costPrice, reason } = req.body;

    if (!warehouseId || !ensureWarehouseAccess(access, warehouseId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const batch = await StockService.addStock(
      productId,
      warehouseId,
      quantity,
      costPrice,
      userId,
      reason
    );
    res.json(batch);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/transfer', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    if (!ensureAdminProductAccess(access, res)) {
      return;
    }
    const productId = Number(req.params.id);
    const userId = req.user!.id;
    const { quantity } = req.body;
    const fromWarehouseId = access.isAdmin ? Number(req.body.fromWarehouseId) : access.warehouseId;
    const toWarehouseId = Number(req.body.toWarehouseId);

    if (!fromWarehouseId || !ensureWarehouseAccess(access, fromWarehouseId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await StockService.transferStock(
      productId,
      fromWarehouseId,
      toWarehouseId,
      quantity,
      userId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/inventory/transaction', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    if (!ensureAdminProductAccess(access, res)) {
      return;
    }
    const userId = req.user!.id;
    const { product_id, quantity_change, type, reason, cost_at_time } = req.body;
    const warehouse_id = access.isAdmin ? Number(req.body.warehouse_id) : access.warehouseId;

    if (!warehouse_id || !ensureWarehouseAccess(access, warehouse_id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const batch = await StockService.addStock(
      Number(product_id),
      Number(warehouse_id),
      Number(quantity_change),
      Number(cost_at_time),
      userId,
      reason
    );
    res.json(batch);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/price-history', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
      select: { warehouseId: true },
    });
    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    if (!access.isAdmin && !ensureWarehouseAccess(access, product.warehouseId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const history = await prisma.priceHistory.findMany({
      where: { productId: Number(req.params.id) },
      orderBy: { createdAt: 'desc' }
    });
    res.json(history);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/history', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const productId = Number(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { warehouseId: true },
    });
    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    if (!access.isAdmin && !ensureWarehouseAccess(access, product.warehouseId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const decodeMojibake = (value: string) => {
      const source = String(value || '');
      if (!/[ÐÑ]/.test(source)) {
        return source;
      }

      try {
        return Buffer.from(source, 'latin1').toString('utf8');
      } catch {
        return source;
      }
    };

    const [transactions, priceHistory] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where: { productId },
        include: { user: true, warehouse: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.priceHistory.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const warehouseIdsFromReasons = Array.from(
      new Set(
        transactions
          .flatMap((transaction: any) => {
            const matches = String(transaction.reason || '').match(/Warehouse\s+#(\d+)/gi) || [];
            return matches
              .map((match) => Number((match.match(/(\d+)/) || [])[0]))
              .filter((id) => Number.isFinite(id));
          })
      )
    );

    const warehousesById = warehouseIdsFromReasons.length
      ? new Map(
          (
            await prisma.warehouse.findMany({
              where: { id: { in: warehouseIdsFromReasons } },
              select: { id: true, name: true },
            })
          ).map((warehouse: { id: number; name: string }) => [warehouse.id, warehouse.name] as [number, string])
        )
      : new Map<number, string>();

    const formatHistoryReason = (reason: string | null | undefined) => {
      const normalized = decodeMojibake(String(reason || ''))
        .replace(/Warehouse\s+#(\d+)/gi, (_match: string, idText: string): string => {
          const warehouseName = warehousesById.get(Number(idText));
          return String(warehouseName || `Склад #${idText}`);
        });

      if (!normalized) {
        return '';
      }

      if (/^OCR Restock$/i.test(normalized)) {
        return 'Пополнение по OCR';
      }
      if (/^Initial Stock$/i.test(normalized)) {
        return 'Начальный остаток';
      }
      if (/^Stock Arrival$/i.test(normalized)) {
        return 'Приход товара';
      }
      if (/^Transfer to (.+)$/i.test(normalized)) {
        return normalized.replace(/^Transfer to (.+)$/i, 'Перенос на $1');
      }
      if (/^Transfer from (.+)$/i.test(normalized)) {
        return normalized.replace(/^Transfer from (.+)$/i, 'Перенос со $1');
      }
      if (/^Invoice #(\d+) Cancelled$/i.test(normalized)) {
        return normalized.replace(/^Invoice #(\d+) Cancelled$/i, 'Отмена накладной #$1');
      }

      return normalized
        .replace(/^Price change:/i, 'Изменение цены:')
        .replace(/^Selling price:/i, 'Цена продажи:')
        .replace(/^Cost price:/i, 'Себестоимость:');
    };

    const transactionHistory = transactions.map((t: any) => ({
      id: `tx-${t.id}`,
      createdAt: t.createdAt,
      type: t.type,
      qtyChange: t.qtyChange,
      warehouse: t.warehouse,
      warehouseName: t.warehouse?.name || '---',
      username: t.user.username,
      reason: formatHistoryReason(t.reason),
    }));

    const priceEvents = priceHistory.map((p: any) => ({
      id: `price-${p.id}`,
      createdAt: p.createdAt,
      type: 'price_change',
      qtyChange: 0,
      warehouse: null,
      warehouseName: '---',
      username: 'system',
      reason: `Цена продажи: ${formatMoneyValue(p.sellingPrice)}, себестоимость: ${formatMoneyValue(p.costPrice)}`,
    }));

    const history = [...transactionHistory, ...priceEvents].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json(access.isAdmin ? history : history.filter((item) => item.type !== 'price_change'));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/batches', async (req: AuthRequest, res, next) => {
  try {
    const access = await getAccessContext(req);
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
      select: { warehouseId: true },
    });
    if (!product) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    if (!access.isAdmin && !ensureWarehouseAccess(access, product.warehouseId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const batches = await prisma.productBatch.findMany({
      where: { 
        productId: Number(req.params.id),
        remainingQuantity: { gt: 0 }
      },
      include: { warehouse: true },
      orderBy: { createdAt: 'asc' }
    });
    res.json(batches);
  } catch (error) {
    next(error);
  }
});

export default router;
