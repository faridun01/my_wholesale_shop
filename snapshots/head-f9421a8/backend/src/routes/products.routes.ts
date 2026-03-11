import { Router } from 'express';
import prisma from '../db/prisma.js';
import { StockService } from '../services/stock.service.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { warehouseId } = req.query;
    const products = await prisma.product.findMany({
      where: { active: true },
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

    // Check for unique constraints
    const existingProduct = await prisma.product.findFirst({
      where: {
        OR: [
          { name: rest.name, warehouseId: wId },
          rest.sku ? { sku: rest.sku, warehouseId: wId } : undefined
        ].filter(Boolean) as any,
        active: true
      }
    });

    if (existingProduct) {
      return res.status(400).json({ 
        error: existingProduct.sku === rest.sku 
          ? `Товар с артикулом ${rest.sku} уже существует на этом складе` 
          : `Товар с названием "${rest.name}" уже существует на этом складе` 
      });
    }

    // Create product with 0 stock first
    const product = await prisma.product.create({
      data: {
        ...rest,
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

router.put('/:id', async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    const oldProduct = await prisma.product.findUnique({ where: { id: productId } });
    
    if (!oldProduct) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    // Check for unique constraints if name, sku or warehouseId changed
    const newName = req.body.name || oldProduct.name;
    const newSku = req.body.sku !== undefined ? req.body.sku : oldProduct.sku;
    const newWarehouseId = req.body.warehouseId !== undefined ? Number(req.body.warehouseId) : oldProduct.warehouseId;

    if (newName !== oldProduct.name || newSku !== oldProduct.sku || newWarehouseId !== oldProduct.warehouseId) {
      const existingProduct = await prisma.product.findFirst({
        where: {
          OR: [
            { name: newName, warehouseId: newWarehouseId },
            newSku ? { sku: newSku, warehouseId: newWarehouseId } : undefined
          ].filter(Boolean) as any,
          id: { not: productId },
          active: true
        }
      });

      if (existingProduct) {
        return res.status(400).json({ 
          error: existingProduct.sku === newSku 
            ? `Товар с артикулом ${newSku} уже существует на этом складе` 
            : `Товар с названием "${newName}" уже существует на этом складе` 
        });
      }
    }
    
    const product = await prisma.product.update({
      where: { id: productId },
      data: req.body
    });

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
      }
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.product.update({
      where: { id: Number(req.params.id) },
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
    const transactions = await prisma.inventoryTransaction.findMany({
      where: { productId: Number(req.params.id) },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(transactions.map(t => ({
      ...t,
      username: t.user.username
    })));
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
