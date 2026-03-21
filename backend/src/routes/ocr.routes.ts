import { Router } from 'express';
import { OCRService } from '../services/ocr.service.js';
import fs from 'fs';
import { createRateLimit } from '../middlewares/rate-limit.middleware.js';
import { securityConfig } from '../config/security.js';
import { imageUpload, ocrUpload } from '../utils/upload.js';
import prisma from '../db/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { getAccessContext } from '../utils/access.js';
import { StockService } from '../services/stock.service.js';
import {
  buildProductNameKey,
  calculateEffectiveCostPrice,
  normalizeBaseUnitName,
  normalizePackageName,
  normalizeProductName,
  parsePackagingFromRawName,
} from '../utils/product-packaging.js';

const router = Router();

const uploadRateLimit = createRateLimit({
  windowMs: securityConfig.rateLimit.uploadWindowMs,
  maxAttempts: securityConfig.rateLimit.uploadMaxAttempts,
  blockMs: securityConfig.rateLimit.uploadBlockMs,
  message: 'Too many file upload attempts. Please try again later.',
});

router.post('/parse-invoice', uploadRateLimit, ocrUpload.single('invoice'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const items = await OCRService.parseInvoice(req.file.path, req.file.mimetype);

    res.json(items);
  } catch (error: any) {
    if (Number(error?.status) === 503) {
      return res.status(503).json({ error: error.message });
    }
    return res.status(500).json({ error: error?.message || 'OCR parse failed' });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

router.post('/invoice', uploadRateLimit, ocrUpload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const items = await OCRService.parseInvoice(req.file.path, req.file.mimetype);

    res.json({ items });
  } catch (error: any) {
    if (Number(error?.status) === 503) {
      return res.status(503).json({ error: error.message });
    }
    return res.status(500).json({ error: error?.message || 'OCR parse failed' });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

router.post('/import-purchase-document', uploadRateLimit, ocrUpload.single('invoice'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const access = await getAccessContext(req);
    const requestedWarehouseId = Number(req.body?.warehouseId);
    const warehouseId = access.isAdmin ? requestedWarehouseId : access.warehouseId;
    if (!warehouseId) {
      return res.status(400).json({ error: 'Warehouse ID is required' });
    }

    const parsedItems = await OCRService.parseInvoice(req.file.path, req.file.mimetype);
    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({ error: 'No product lines found in the document' });
    }

    const fallbackCategoryName = String(req.body?.fallbackCategoryName || 'Без категории').trim();
    let category = await prisma.category.findFirst({
      where: { name: fallbackCategoryName },
      select: { id: true, name: true },
    });
    if (!category) {
      category = await prisma.category.create({
        data: { name: fallbackCategoryName },
        select: { id: true, name: true },
      });
    }

    const supplierId = Number(req.body?.supplierId);
    const supplier = Number.isFinite(supplierId) && supplierId > 0
      ? await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } })
      : null;

    const rawText = parsedItems
      .map((item: any) => String(item.rawName || item.name || '').trim())
      .filter(Boolean)
      .join('\n');
    const defaultExpensePercent = Number(req.body?.expensePercent || 0);

    const purchaseDocument = await prisma.purchaseDocument.create({
      data: {
        supplierId: supplier?.id || null,
        warehouseId,
        sourceType: req.file.mimetype === 'application/pdf' ? 'pdf' : 'image',
        documentNumber: req.body?.documentNumber ? String(req.body.documentNumber).trim() : null,
        documentDate: req.body?.documentDate ? new Date(req.body.documentDate) : null,
        fileUrl: null,
        rawText: rawText || null,
        status: 'imported',
        importedAt: new Date(),
      },
    });

    const results: any[] = [];

    for (const item of parsedItems) {
      const rawName = String(item.rawName || item.name || '').trim();
      if (!rawName) {
        continue;
      }

      const normalized = normalizeProductName(rawName);
      const parsedPackaging = parsePackagingFromRawName(rawName);
      const packageName = normalizePackageName(item.packageName || parsedPackaging?.packageName);
      const baseUnitName = normalizeBaseUnitName(item.baseUnitName || parsedPackaging?.baseUnitName || item.unit || 'шт');
      const unitsPerPackage = Number(item.unitsPerPackage || parsedPackaging?.unitsPerPackage || 0);
      const packageQuantity = Number(item.packageCount || 0);
      const totalBaseUnits = Number(item.quantity || (packageQuantity > 0 && unitsPerPackage > 0 ? packageQuantity * unitsPerPackage : 0));
      const extraUnitQuantity = Math.max(0, totalBaseUnits - (packageQuantity > 0 && unitsPerPackage > 0 ? packageQuantity * unitsPerPackage : 0));
      const linePrice = Number(item.price || 0);
      const costPricePerBaseUnit =
        unitsPerPackage > 0 && packageQuantity > 0
          ? linePrice / unitsPerPackage
          : linePrice;
      const effectiveCostPricePerBaseUnit = calculateEffectiveCostPrice(costPricePerBaseUnit, defaultExpensePercent);

      let product = await prisma.product.findFirst({
        where: {
          warehouseId,
          active: true,
          nameKey: buildProductNameKey(normalized.name),
        },
      });

      if (!product) {
        product = await prisma.product.create({
          data: {
            categoryId: category.id,
            name: normalized.name,
            rawName: normalized.rawName,
            brand: item.brand ? String(item.brand).trim() : normalized.brand,
            nameKey: buildProductNameKey(normalized.name),
            unit: baseUnitName,
            baseUnitName,
            purchaseCostPrice: costPricePerBaseUnit > 0 ? costPricePerBaseUnit : 0,
            expensePercent: defaultExpensePercent,
            costPrice: effectiveCostPricePerBaseUnit > 0 ? effectiveCostPricePerBaseUnit : 0,
            sellingPrice: 0,
            minStock: 0,
            initialStock: 0,
            totalIncoming: 0,
            stock: 0,
            warehouseId,
          },
        });
      } else {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            rawName: normalized.rawName,
            brand: product.brand || (item.brand ? String(item.brand).trim() : normalized.brand),
            nameKey: buildProductNameKey(normalized.name),
            baseUnitName,
            unit: baseUnitName,
            purchaseCostPrice: costPricePerBaseUnit > 0 ? costPricePerBaseUnit : product.purchaseCostPrice,
            expensePercent: defaultExpensePercent,
            costPrice: effectiveCostPricePerBaseUnit > 0 ? effectiveCostPricePerBaseUnit : product.costPrice,
          },
        });
      }

      if (packageName && unitsPerPackage > 0) {
        const existingPackaging = await prisma.productPackaging.findFirst({
          where: {
            productId: product.id,
            packageName,
            unitsPerPackage,
          },
        });

        if (!existingPackaging) {
          await prisma.productPackaging.create({
            data: {
              productId: product.id,
              warehouseId,
              packageName,
              baseUnitName,
              unitsPerPackage,
              packageSellingPrice: null,
              active: true,
              isDefault: true,
            },
          });

          await prisma.productPackaging.updateMany({
            where: {
              productId: product.id,
              packageName: { not: packageName },
            },
            data: { isDefault: false },
          });
        }
      }

      await prisma.purchaseDocumentItem.create({
        data: {
          purchaseDocumentId: purchaseDocument.id,
          matchedProductId: product.id,
          rawName: rawName,
          cleanName: normalized.name,
          brand: item.brand ? String(item.brand).trim() : normalized.brand,
          nameKey: buildProductNameKey(normalized.name),
          packageName: packageName || null,
          baseUnitName,
          unitsPerPackage: unitsPerPackage || null,
          packageQuantity: packageQuantity || null,
          extraUnitQuantity,
          totalBaseUnits,
          expensePercent: defaultExpensePercent,
          costPricePerBaseUnit: costPricePerBaseUnit > 0 ? costPricePerBaseUnit : null,
          effectiveCostPricePerBaseUnit: effectiveCostPricePerBaseUnit > 0 ? effectiveCostPricePerBaseUnit : null,
        },
      });

      if (totalBaseUnits > 0) {
        await StockService.addStock(
          product.id,
          warehouseId,
          totalBaseUnits,
          effectiveCostPricePerBaseUnit > 0 ? effectiveCostPricePerBaseUnit : Number(product.costPrice || 0),
          req.user!.id,
          'Purchase Document Import',
          costPricePerBaseUnit > 0 ? costPricePerBaseUnit : Number(product.purchaseCostPrice || product.costPrice || 0),
          defaultExpensePercent,
        );
      }

      results.push({
        productId: product.id,
        productName: normalized.name,
        packageName: packageName || null,
        baseUnitName,
        unitsPerPackage: unitsPerPackage || null,
        totalBaseUnits,
      });
    }

    res.status(201).json({
      purchaseDocumentId: purchaseDocument.id,
      importedCount: results.length,
      items: results,
    });
  } catch (error) {
    next(error);
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

router.post('/upload', uploadRateLimit, imageUpload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const photoUrl = `/uploads/${req.file.filename}`;
  res.json({ photoUrl });
});

export default router;
