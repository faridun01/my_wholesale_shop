import { Router } from 'express';
import prisma from '../db/prisma.js';
import { StockService } from '../services/stock.service.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

const router = Router();

const normalizeBracketSuffix = (value: string | null | undefined) =>
  String(value || '')
    .replace(/\s*\[[^\]]*\]\s*$/u, '')
    .replace(/plasticковых/giu, 'пластиковых')
    .replace(/Ñ‘/giu, 'Ðµ')
    .replace(/\s+/g, ' ')
    .trim();

router.get('/', async (req, res, next) => {
  try {
    const { warehouseId } = req.query;
    const products = await prisma.product.findMany({
      where: {
        active: true,
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
      },
      include: { 
        category: true, 
        warehouse: true,
        batches: warehouseId ? {
          where: { warehouseId: Number(warehouseId) }
        } : false
      },
    });

    if (warehouseId) {
      const productsWithWarehouseStock = products.map((p: any) => {
        const warehouseStock = p.batches.reduce((sum: number, b: any) => sum + b.remainingQuantity, 0);
        return { ...p, stock: warehouseStock };
      });
      return res.json(productsWithWarehouseStock);
    }

    res.json(products);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { initialStock, warehouseId, costPrice, ...rest } = req.body;
    const userId = req.user?.id || 1;
    const wId = warehouseId ? Number(warehouseId) : null;
    const normalizedName = normalizeBracketSuffix(rest.name);

    // Check for unique constraints
    const existingProduct = await prisma.product.findFirst({
      where: {
        name: normalizedName,
        warehouseId: wId,
        active: true
      }
    });

    if (existingProduct) {
      return res.status(400).json({
        error: `Товар с названием "${rest.name}" уже существует на этом складе`
      });
    }

    let resolvedPhotoUrl = rest.photoUrl || null;
    if (!resolvedPhotoUrl && normalizedName) {
      const productWithSameNamePhoto = await prisma.product.findFirst({
        where: {
          name: normalizedName,
          active: true,
          photoUrl: { not: null }
        },
        orderBy: { updatedAt: 'desc' }
      });
      resolvedPhotoUrl = productWithSameNamePhoto?.photoUrl || null;
    }

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
    if (initialStock > 0 && warehouseId) {
      await StockService.addStock(
        product.id,
        Number(warehouseId),
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
    const productId = Number(req.params.id);
    const userId = req.user?.id || 1;
    const oldProduct = await prisma.product.findUnique({ where: { id: productId } });
    
    if (!oldProduct) {
      return res.status(404).json({ error: 'Ð¢Ð¾Ð²Ð°Ñ€ Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½' });
    }

    // Check for unique constraints if name or warehouseId changed
    const newName = normalizeBracketSuffix(req.body.name || oldProduct.name);
    const newWarehouseId = req.body.warehouseId !== undefined ? Number(req.body.warehouseId) : oldProduct.warehouseId;

    if (newName !== oldProduct.name || newWarehouseId !== oldProduct.warehouseId) {
      const existingProduct = await prisma.product.findFirst({
        where: {
          name: newName,
          warehouseId: newWarehouseId,
          id: { not: productId },
          active: true
        }
      });

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
      await prisma.product.updateMany({
        where: {
          id: { not: productId },
          name: newName,
          active: true
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
        await prisma.priceHistory.create({
          data: {
            productId,
            costPrice: newCost,
            sellingPrice: newSelling
          }
        });

        await prisma.inventoryTransaction.create({
          data: {
            productId,
            warehouseId: oldProduct.warehouseId || newWarehouseId,
            userId,
            qtyChange: 0,
            type: 'adjustment',
            reason: `Ð˜Ð·Ð¼ÐµÐ½ÐµÐ½Ð¸Ðµ Ñ†ÐµÐ½Ñ‹: ${oldProduct.sellingPrice} -> ${newSelling}`,
            costAtTime: newCost,
            sellingAtTime: newSelling,
          }
        });
      }
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
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

    const remainingStock = product.batches.reduce((sum, batch) => sum + Number(batch.remainingQuantity || 0), 0);
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
    const productId = Number(req.params.id);
    const userId = req.user!.id;
    const { warehouseId, quantity, costPrice, reason } = req.body;

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
    const productId = Number(req.params.id);
    const userId = req.user!.id;
    const { fromWarehouseId, toWarehouseId, quantity } = req.body;

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
    const userId = req.user!.id;
    const { product_id, warehouse_id, quantity_change, type, reason, cost_at_time } = req.body;

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

router.get('/:id/price-history', async (req, res, next) => {
  try {
    const history = await prisma.priceHistory.findMany({
      where: { productId: Number(req.params.id) },
      orderBy: { createdAt: 'desc' }
    });
    res.json(history);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const productId = Number(req.params.id);

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
          .flatMap((transaction) => {
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

    const formatHistoryReason = (reason: string | null | undefined) =>
      String(reason || '').replace(/Warehouse\s+#(\d+)/gi, (_match: string, idText: string): string => {
        const warehouseName = warehousesById.get(Number(idText));
        return warehouseName || `Склад #${idText}`;
      });

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
      reason: `Ð¦ÐµÐ½Ð° Ð¿Ñ€Ð¾Ð´Ð°Ð¶Ð¸: ${p.sellingPrice}, ÑÐµÐ±ÐµÑÑ‚Ð¾Ð¸Ð¼Ð¾ÑÑ‚ÑŒ: ${p.costPrice}`,
    }));

    const history = [...transactionHistory, ...priceEvents].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json(history);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/batches', async (req, res, next) => {
  try {
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

