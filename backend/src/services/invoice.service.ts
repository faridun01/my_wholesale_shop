import prisma from '../db/prisma.js';
import { addMoney, assertNoTax, balancePaidAmount, cumulativeValue, discountedUnit, discountAmount, fromCents, goodsReturnPaymentAdjustments, invoiceLines, isGoodsReturnPaymentAdjustment, lineTotal, percent, quantity as wholeQuantity, refundSplit, saleTotals, toCents } from '../utils/financial.js';
import { operationKey, requestHash, assertReplay } from '../utils/financial-operation.js';
import { StockService } from './stock.service.js';
import { formatQuantityForInvoice, normalizeBaseUnitName } from '../utils/product-packaging.js';
import { normalizeMoney, roundMoney, ceilMoney, getInvoiceStatus } from '../utils/money.js';
import { PUBLIC_USER_SELECT } from '../utils/publicUser.js';

const PAYMENT_EPSILON = 0.01;
const TRANSACTION_OPTIONS = {
  maxWait: 10000,
  timeout: 120000,
};

const buildCustomerAddressSnapshot = (customer: any) =>
  [customer?.country, customer?.region, customer?.city, customer?.address]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ') || null;

function normalizeNonNegativeNumber(value: number, fieldName: string) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new Error(`${fieldName} must be a non-negative number`);
  }

  return normalized;
}

const calculateDiscountedUnitPrice = discountedUnit;
const calculateLineTotal = lineTotal;
const calculateInvoiceDiscountAmount = discountAmount;
function calculateHistoricalInvoiceNetAmount(totalAmount: number, discountPercent = 0, tax = 0, returnedAmount = 0) {
  return Math.max(0, addMoney(totalAmount, -discountAmount(totalAmount, discountPercent), tax, -returnedAmount));
}

function buildRequestedQuantityByProduct(
  items: Array<{ productId: number; quantity: number; totalBaseUnits?: number }>,
) {
  const requested = new Map<number, number>();

  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = wholeQuantity(item.totalBaseUnits ?? item.quantity);
    requested.set(productId, Math.round((requested.get(productId) || 0) + quantity));
  }

  return requested;
}

function validatePackagedSaleAvailability(product: any, item: any, availableQty: number) {
  const packageQuantity = normalizeNonNegativeNumber(item.packageQuantity || 0, 'Package quantity');
  const packagingId = Number(item.packagingId || 0);

  if (!packagingId || packageQuantity <= 0) {
    return;
  }

  const packaging = Array.isArray(product?.packagings)
    ? product.packagings.find((entry: any) => Number(entry.id) === packagingId)
    : null;
  const unitsPerPackage = Math.max(0, Number(item.unitsPerPackage || packaging?.unitsPerPackage || 0));

  if (!packaging || unitsPerPackage <= 0) {
    throw new Error(`Упаковка для "${product.name}" не найдена`);
  }

  if (availableQty < unitsPerPackage) {
    const unit = normalizeBaseUnitName(item.baseUnitName || packaging.baseUnitName || product.baseUnitName || product.unit || 'шт');
    throw new Error(
      `Нельзя продать "${product.name}" коробкой. В коробке ${unitsPerPackage} ${unit}, доступно только ${availableQty} ${unit}`,
    );
  }
}

function buildCurrentInvoiceItemSnapshot(item: any) {
  const originalTotalBaseUnits = Math.max(0, Number(item?.totalBaseUnits ?? item?.quantity ?? 0));
  const returnedQty = Math.max(0, Number(item?.returnedQty || 0));
  const remainingBaseUnits = roundMoney(Math.max(0, originalTotalBaseUnits - returnedQty));

  if (remainingBaseUnits <= PAYMENT_EPSILON) {
    return null;
  }

  const unitsPerPackage = Math.max(0, Number(item?.unitsPerPackageSnapshot ?? 0));
  const hasPackaging = Number(item?.packageQuantity || 0) > 0 && unitsPerPackage > 0;
  const packageQuantity = hasPackaging ? Math.floor(remainingBaseUnits / unitsPerPackage) : null;
  const packagedUnits = hasPackaging ? packageQuantity! * unitsPerPackage : 0;
  const extraUnitQuantity = hasPackaging ? roundMoney(remainingBaseUnits - packagedUnits) : roundMoney(remainingBaseUnits);

  return {
    ...item,
    quantity: remainingBaseUnits,
    totalBaseUnits: remainingBaseUnits,
    packageQuantity,
    extraUnitQuantity,
    returnedQty: 0,
    originalQuantity: originalTotalBaseUnits,
    cumulativeReturnedQty: returnedQty,
    totalPrice: addMoney(item.remainingNetAmount, item.allocatedOrderDiscount ?? 0, -cumulativeValue(item.allocatedOrderDiscount ?? 0, returnedQty, originalTotalBaseUnits)),
    netLineTotal: item.remainingNetAmount,
    allocatedTax: item.remainingTax,
    originalEligibleNetAmount: item.eligibleNetAmount,
    originalAllocatedTax: item.allocatedTax,
    allocatedOrderDiscount: addMoney(item.allocatedOrderDiscount ?? 0, -cumulativeValue(item.allocatedOrderDiscount ?? 0, returnedQty, originalTotalBaseUnits)),
  };
}

export class InvoiceService {
  /**
   * Creates a new invoice and allocates stock.
   */
  static async createInvoice(data: {
    customerId: number;
    userId: number;
    warehouseId: number;
    items: {
      productId: number;
      quantity: number;
      sellingPrice: number;
      totalBaseUnits?: number;
      packageQuantity?: number;
      extraUnitQuantity?: number;
      packagingId?: number | null;
      packageName?: string | null;
      baseUnitName?: string | null;
      unitsPerPackage?: number | null;
      productName?: string | null;
      rawName?: string | null;
      brand?: string | null;
      discount?: number;
    }[];
    discount?: number;
    tax?: unknown;
    paidAmount?: number;
    paymentMethod?: string;
    paymentDueDate?: string;
    idempotencyKey?: string;
  }, transactionClient?: any) {
    const { customerId, userId, warehouseId, items, discount = 0, paidAmount = 0, paymentMethod = 'cash', paymentDueDate } = data;
    const normalizedDiscount = percent(discount);
    assertNoTax(data.tax);
    const normalizedPaidAmount = normalizeMoney(normalizeNonNegativeNumber(paidAmount, 'Paid amount'), 'Paid amount');

    if (normalizedDiscount > 100) {
      throw new Error('Discount cannot exceed 100%');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Invoice must contain at least one item');
    }

    const key = data.idempotencyKey ? operationKey(data.idempotencyKey) : null;
    const hash = requestHash(data);
    // An order approval can supply its enclosing transaction so the sale and
    // order link commit or roll back together.
    const runTransaction: any = transactionClient ? (callback: any) => callback(transactionClient) : prisma.$transaction.bind(prisma);
    return await runTransaction(async (tx: any) => {
      if (key) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
        const existing = await tx.invoice.findUnique({ where: { idempotencyKey: key } });
        if (existing) { assertReplay(existing, hash); return existing; }
      }
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      const companyProfile = await tx.companyProfile.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' } });
      const productIds = [...new Set(items.map((item) => Number(item.productId)))];
      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          warehouseId,
          active: true,
        },
        include: {
          packagings: {
            where: { active: true },
          },
        },
      }) as any[];

      if (!customer) {
        throw new Error('Customer not found');
      }

      const productsById = new Map<number, any>(products.map((product: any) => [product.id, product]));

      if (products.length !== productIds.length) {
        throw new Error('Один или несколько товаров не принадлежат выбранному складу');
      }

      const requestedByProduct = buildRequestedQuantityByProduct(items);
      for (const [productId, requestedQty] of requestedByProduct.entries()) {
        const product = productsById.get(productId);
        if (!product) {
          continue;
        }

        const availableQty = Math.max(0, Number(product.stock || 0));
        if (requestedQty > availableQty) {
          const unit = normalizeBaseUnitName(product.baseUnitName || product.unit || 'шт');
          throw new Error(
            `Нельзя продать больше остатка для "${product.name}". Доступно: ${availableQty} ${unit}, запрошено: ${requestedQty} ${unit}`,
          );
        }
      }

      for (const item of items) {
        const product = productsById.get(Number(item.productId));
        if (product) {
          validatePackagedSaleAvailability(product, item, Math.max(0, Number(product.stock || 0)));
        }
      }

      // 1. Calculate totals
      let totalAmount = 0;
      for (const item of items) {
        const quantity = wholeQuantity(item.totalBaseUnits ?? item.quantity);
        const sellingPrice = normalizeMoney(normalizeNonNegativeNumber(item.sellingPrice, 'Item price'), 'Item price');
        const itemDiscount = normalizeNonNegativeNumber(item.discount || 0, 'Item discount');
        if (quantity <= 0) {
          throw new Error('Item quantity must be greater than zero');
        }
        if (itemDiscount > 100) {
          throw new Error('Скидка на товар не может превышать 100%');
        }

        totalAmount = roundMoney(totalAmount + calculateLineTotal(quantity, sellingPrice, itemDiscount));
      }

      totalAmount = roundMoney(totalAmount);
      const calculation = saleTotals(items, normalizedDiscount);
      const netAmount = calculation.net;

      if (toCents(normalizedPaidAmount) > toCents(netAmount)) {
        throw new Error('Сумма оплаты не может превышать сумму накладной');
      }

      const status = getInvoiceStatus(normalizedPaidAmount, Number(netAmount));

      // 2. Create Invoice
      const invoice = await tx.invoice.create({
        data: {
          customerId,
          userId,
          warehouseId,
          totalAmount,
          originalNetAmount: netAmount,
          originalPaidAmount: normalizedPaidAmount,
          calculationVersion: 1,
          discount: normalizedDiscount,
          tax: 0,
          netAmount,
          paidAmount: normalizedPaidAmount,
          status,
          paymentDueDate: paymentDueDate ? new Date(paymentDueDate) : null,
          idempotencyKey: key,
          requestHash: hash,
          companyNameSnapshot: companyProfile?.name || null,
          companyCountrySnapshot: companyProfile?.country || null,
          companyRegionSnapshot: companyProfile?.region || null,
          companyCitySnapshot: companyProfile?.city || null,
          companyAddressSnapshot: companyProfile?.addressLine || null,
          customerNameSnapshot: customer.name,
          customerPhoneSnapshot: customer.phone || null,
          customerAddressSnapshot: buildCustomerAddressSnapshot(customer),
        },
      });

      // 3. Create Items and Allocate Stock
      for (const [itemIndex, item] of items.entries()) {
        const quantity = wholeQuantity(item.totalBaseUnits ?? item.quantity);
        const sellingPrice = normalizeMoney(normalizeNonNegativeNumber(item.sellingPrice, 'Item price'), 'Item price');
        const product = productsById.get(item.productId);

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        if (Number(product.warehouseId) !== Number(warehouseId)) {
          throw new Error(`Товар ${product.name} не принадлежит выбранному складу`);
        }

        const packaging = item.packagingId
          ? product.packagings.find((entry: any) => entry.id === Number(item.packagingId))
          : product.packagings.find((entry: any) => entry.isDefault) || product.packagings[0] || null;

        const packageQuantity =
          item.packageQuantity !== undefined && item.packageQuantity !== null
            ? wholeQuantity(item.packageQuantity, true)
            : null;
        const extraUnitQuantity =
          item.extraUnitQuantity !== undefined && item.extraUnitQuantity !== null
            ? wholeQuantity(item.extraUnitQuantity, true)
            : 0;
        const baseUnitName = normalizeBaseUnitName(item.baseUnitName || packaging?.baseUnitName || product.baseUnitName || product.unit);

        // Create item first with placeholder costPrice
        const invoiceItem = await tx.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            productId: item.productId,
            quantity,
            totalBaseUnits: quantity,
            packageQuantity,
            extraUnitQuantity,
            packagingId: packaging?.id || null,
            packageNameSnapshot: item.packageName || packaging?.packageName || null,
            baseUnitNameSnapshot: baseUnitName,
            unitsPerPackageSnapshot: item.unitsPerPackage || packaging?.unitsPerPackage || null,
            productNameSnapshot: item.productName || product.name,
            rawNameSnapshot: item.rawName || product.rawName || null,
            brandSnapshot: item.brand || product.brand || null,
            sellingPrice,
            discount: normalizeNonNegativeNumber(item.discount || 0, 'Item discount'),
            totalPrice: calculation.lines[itemIndex].total,
            allocatedOrderDiscount: calculation.lines[itemIndex].orderDiscount,
            eligibleNetAmount: calculation.lines[itemIndex].eligibleNet,
            allocatedTax: calculation.lines[itemIndex].allocatedTax,
          },
        });

        // FIFO Allocation and get average cost
        const avgCost = await StockService.allocateStock(item.productId, warehouseId, quantity, invoiceItem.id, tx);
        
        // Update item with actual cost
        await tx.invoiceItem.update({
          where: { id: invoiceItem.id },
          data: { costPrice: avgCost }
        });

        // Record Inventory Transaction
        await tx.inventoryTransaction.create({
          data: {
            productId: item.productId,
            warehouseId,
            userId,
            qtyChange: -quantity,
            type: 'outgoing',
            reason: `Invoice #${invoice.id}`,
            referenceId: invoice.id,
            costAtTime: avgCost,
            sellingAtTime: sellingPrice
          }
        });
      }

      // 4. Record Payment if any
      if (normalizedPaidAmount > 0) {
        await tx.payment.create({
          data: {
            customerId,
            invoiceId: invoice.id,
            userId,
            amount: roundMoney(normalizedPaidAmount),
            method: paymentMethod,
          },
        });
      }

      return invoice;
    }, {
      maxWait: 10000,
      timeout: 120000,
    });
  }

  static async reassignCustomer(invoiceId: number, customerId: number, userId?: number) {
    return await prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true, payments: true, returns: true },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
        },
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      const snapshot = JSON.parse(JSON.stringify(invoice));
      await tx.invoiceRevision.create({ data: { invoiceId, userId: userId ?? invoice.userId, snapshot } });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          customerId,
          originalSnapshot: invoice.originalSnapshot ?? snapshot,
          customerNameSnapshot: customer.name,
          customerPhoneSnapshot: customer.phone || null,
          customerAddressSnapshot: buildCustomerAddressSnapshot(customer),
        },
      });

      await tx.payment.updateMany({
        where: { invoiceId },
        data: { customerId },
      });

      await tx.return.updateMany({
        where: { invoiceId },
        data: { customerId },
      });

      return tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          customer: true,
          user: { select: PUBLIC_USER_SELECT },
          warehouse: true,
          items: true,
        },
      });
    }, {
      maxWait: 10000,
      timeout: 120000,
    });
  }

  static async updateInvoice(invoiceId: number, data: {
    customerId: number;
    userId: number;
    isAdmin?: boolean;
    items: {
      productId: number;
      quantity: number;
      totalBaseUnits?: number;
      sellingPrice: number;
      packageQuantity?: number | null;
      extraUnitQuantity?: number | null;
      packagingId?: number | null;
      packageName?: string | null;
      baseUnitName?: string | null;
      unitsPerPackage?: number | null;
      productName?: string | null;
      rawName?: string | null;
      brand?: string | null;
      discount?: number;
    }[];
    discount?: number;
  }) {
    const { customerId, userId, items, isAdmin = false } = data;

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Invoice must contain at least one item');
    }

    await prisma.$transaction(async (tx: any) => {
      // Lock the invoice row first so a concurrent payment/return/cancel against
      // the same invoice can't interleave with this edit's stale reads.
      const locked = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE
      `;
      if (!locked[0]) {
        throw new Error('Invoice not found');
      }

      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          items: true,
          payments: true,
          returns: true,
        },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (toCents(invoice.tax) !== 0) {
        throw new Error('Накладная с историческим налогом требует ручной сверки перед редактированием');
      }

      if (invoice.cancelled && !isAdmin) {
        throw new Error('Cancelled invoice cannot be edited');
      }

      // Not admin-exempt: editing items after a return already happened has no safe
      // reconciliation path here (updateInvoice unconditionally wipes Return rows and
      // resets returnedAmount below) — even an admin must reverse/delete the returns
      // through their own flow first, never lose that audit trail as an edit side effect.
      if (
        (Array.isArray(invoice.returns) && invoice.returns.length > 0) ||
        Number(invoice.returnedAmount || 0) > PAYMENT_EPSILON
      ) {
        throw new Error('Нельзя менять товары в накладной после возврата. Сначала отмените возврат.');
      }

      // Not admin-exempt: paidAmount is never touched by the edit below, so shrinking
      // the invoice here would leave paidAmount > netAmount with no correction —
      // an admin must delete/adjust the existing payment(s) first.
      if (
        Number(invoice.paidAmount || 0) > 0 ||
        toCents(addMoney(...(invoice.payments || []).map((p: any) => p.amount))) !== toCents(invoice.paidAmount)
      ) {
        throw new Error('Нельзя менять товары в накладной после оплаты. Сначала удалите оплату.');
      }

      let customer: any = null;
      if (customerId) {
        customer = await tx.customer.findUnique({ where: { id: customerId } });
        if (!customer) {
          throw new Error('Customer not found');
        }
      } else {
        customer = { name: 'Anonymous', phone: null, city: null, addressLine: null };
      }

      const productIds = [...new Set(items.map((item) => Number(item.productId)))];
      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          warehouseId: invoice.warehouseId,
          active: true,
        },
        include: {
          packagings: {
            where: { active: true },
          },
        },
      }) as any[];

      const productsById = new Map<number, any>(products.map((product: any) => [product.id, product]));

      if (products.length !== productIds.length) {
        throw new Error('Один или несколько товаров не принадлежат выбранному складу');
      }

      const requestedByProduct = buildRequestedQuantityByProduct(items);
      const originalByProduct = new Map<number, number>();
      for (const existingItem of invoice.items) {
        const productId = Number(existingItem.productId);
        const current = originalByProduct.get(productId) || 0;
        originalByProduct.set(productId, roundMoney(current + Number(existingItem.totalBaseUnits ?? existingItem.quantity ?? 0)));
      }

      for (const [productId, requestedQty] of requestedByProduct.entries()) {
        const product = productsById.get(productId);
        if (!product) {
          continue;
        }

        const availableNow = Math.max(0, Number(product.stock || 0));
        const originalQty = Math.max(0, Number(originalByProduct.get(productId) || 0));
        const availableForEdit = roundMoney(availableNow + originalQty);

        if (requestedQty > availableForEdit) {
          const unit = normalizeBaseUnitName(product.baseUnitName || product.unit || 'шт');
          throw new Error(
            `Нельзя продать больше остатка для "${product.name}". Доступно: ${availableForEdit} ${unit}, запрошено: ${requestedQty} ${unit}`,
          );
        }
      }

      for (const item of items) {
        const product = productsById.get(Number(item.productId));
        if (!product) {
          continue;
        }

        const availableNow = Math.max(0, Number(product.stock || 0));
        const originalQty = Math.max(0, Number(originalByProduct.get(Number(item.productId)) || 0));
        validatePackagedSaleAvailability(product, item, roundMoney(availableNow + originalQty));
      }

      let totalAmount = 0;
      for (const item of items) {
        const quantity = wholeQuantity(item.totalBaseUnits ?? item.quantity);
        const sellingPrice = normalizeMoney(normalizeNonNegativeNumber(item.sellingPrice, 'Item price'), 'Item price');
        const itemDiscount = normalizeNonNegativeNumber(item.discount || 0, 'Item discount');

        if (quantity <= 0) {
          throw new Error('Item quantity must be greater than zero');
        }
        if (itemDiscount > 100) {
          throw new Error('Скидка на товар не может превышать 100%');
        }

        totalAmount = roundMoney(totalAmount + calculateLineTotal(quantity, sellingPrice, itemDiscount));
      }

      totalAmount = roundMoney(totalAmount);
      const normalizedDiscount = percent(data.discount !== undefined ? data.discount : invoice.discount || 0);
      const calculation = saleTotals(items, normalizedDiscount);
      const netAmount = calculation.net;
      const previousSnapshot = JSON.parse(JSON.stringify(invoice));
      await tx.invoiceRevision.create({ data: { invoiceId, userId, snapshot: previousSnapshot } });
      if (!invoice.originalSnapshot) await tx.invoice.update({ where: { id: invoiceId }, data: { originalSnapshot: previousSnapshot } });
      const affectedProductIds = new Set<number>();

      for (const existingItem of invoice.items) {
        affectedProductIds.add(Number(existingItem.productId));
        await StockService.deallocateStock(existingItem.id, undefined, undefined, tx, false);
      }

      await tx.return.deleteMany({
        where: { invoiceId },
      });

      await tx.inventoryTransaction.deleteMany({
        where: {
          referenceId: invoiceId,
          type: { in: ['outgoing', 'return'] }
        },
      });



      await tx.invoiceItem.deleteMany({
        where: { invoiceId },
      });

      for (const [itemIndex, item] of items.entries()) {
        const quantity = wholeQuantity(item.totalBaseUnits ?? item.quantity);
        const sellingPrice = normalizeMoney(normalizeNonNegativeNumber(item.sellingPrice, 'Item price'), 'Item price');
        const product = productsById.get(Number(item.productId));

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const packaging = item.packagingId
          ? product.packagings.find((entry: any) => entry.id === Number(item.packagingId))
          : product.packagings.find((entry: any) => entry.isDefault) || product.packagings[0] || null;

        const packageQuantity =
          item.packageQuantity !== undefined && item.packageQuantity !== null
            ? wholeQuantity(item.packageQuantity, true)
            : null;
        const extraUnitQuantity =
          item.extraUnitQuantity !== undefined && item.extraUnitQuantity !== null
            ? wholeQuantity(item.extraUnitQuantity, true)
            : 0;
        const baseUnitName = normalizeBaseUnitName(item.baseUnitName || packaging?.baseUnitName || product.baseUnitName || product.unit);

        const invoiceItem = await tx.invoiceItem.create({
          data: {
            invoiceId,
            productId: Number(item.productId),
            quantity,
            totalBaseUnits: quantity,
            packageQuantity,
            extraUnitQuantity,
            packagingId: packaging?.id || null,
            packageNameSnapshot: item.packageName || packaging?.packageName || null,
            baseUnitNameSnapshot: baseUnitName,
            unitsPerPackageSnapshot: item.unitsPerPackage || packaging?.unitsPerPackage || null,
            productNameSnapshot: item.productName || product.name,
            rawNameSnapshot: item.rawName || product.rawName || null,
            brandSnapshot: item.brand || product.brand || null,
            sellingPrice,
            discount: normalizeNonNegativeNumber(item.discount || 0, 'Item discount'),
            totalPrice: calculation.lines[itemIndex].total,
            allocatedOrderDiscount: calculation.lines[itemIndex].orderDiscount,
            eligibleNetAmount: calculation.lines[itemIndex].eligibleNet,
            allocatedTax: calculation.lines[itemIndex].allocatedTax,
          },
        });

        const avgCost = await StockService.allocateStock(Number(item.productId), Number(invoice.warehouseId), quantity, invoiceItem.id, tx);
        await tx.invoiceItem.update({
          where: { id: invoiceItem.id },
          data: { costPrice: avgCost },
        });

        await tx.inventoryTransaction.create({
          data: {
            productId: Number(item.productId),
            warehouseId: Number(invoice.warehouseId),
            userId,
            qtyChange: -quantity,
            type: 'outgoing',
            reason: `Updated Invoice #${invoiceId}`,
            referenceId: invoiceId,
            costAtTime: avgCost,
            sellingAtTime: sellingPrice
          }
        });


        affectedProductIds.add(Number(item.productId));
      }

      for (const productId of affectedProductIds) {
        await StockService.updateProductStockCache(productId, tx);
      }

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          customerId,
          customerNameSnapshot: customer.name,
          customerPhoneSnapshot: customer.phone || null,
          customerAddressSnapshot: buildCustomerAddressSnapshot(customer),
          totalAmount,
          originalNetAmount: invoice.originalNetAmount ?? calculateHistoricalInvoiceNetAmount(Number(invoice.totalAmount), Number(invoice.discount), Number(invoice.tax)),
          calculationVersion: 1,
          discount: normalizedDiscount,
          netAmount,
          returnedAmount: 0,
          cancelled: isAdmin ? false : invoice.cancelled,
          status: getInvoiceStatus(Number(invoice.paidAmount || 0), Number(netAmount)),
        },
      });
    }, {
      maxWait: 10000,
      timeout: 120000,
    });

    return this.getInvoiceDetails(invoiceId);
  }

  /**
   * Cancels an invoice and returns stock.
   */
  static async cancelInvoice(invoiceId: number, userId: number, options?: { force?: boolean }) {
    const force = Boolean(options?.force);

    return await prisma.$transaction(async (tx: any) => {
      // Lock the invoice row first so a double-submitted cancel can't race a
      // concurrent payment/return against the same invoice.
      const locked = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE
      `;
      if (!locked[0]) {
        throw new Error('Invoice not found or already cancelled');
      }

      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          items: true,
          payments: {
            select: { id: true, amount: true },
          },
          returns: {
            select: { id: true },
          },
        },
      });

      if (!invoice || invoice.cancelled) {
        throw new Error('Invoice not found or already cancelled');
      }

      if (Number(invoice.paidAmount || 0) !== 0 || toCents(addMoney(...(invoice.payments || []).map((p: any) => p.amount))) !== 0) {
        throw new Error('Нельзя удалить накладную, по которой уже есть оплата');
      }

      if ((invoice.returns?.length || 0) > 0 || Number(invoice.returnedAmount || 0) > 0) {
        throw new Error('Нельзя удалить накладную, по которой уже есть возврат');
      }

      // 1. Return stock for each item
      for (const item of invoice.items) {
        await StockService.deallocateStock(item.id, undefined, undefined, tx, false);
        await StockService.updateProductStockCache(item.productId, tx);
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
              type: 'adjustment',
              reason: `Invoice #${invoiceId} Cancelled`,
              referenceId: invoiceId,
            },
          });
        }

      return { success: true };
    }, TRANSACTION_OPTIONS);
  }

  /**
   * Fetches full invoice details.
   */
  static async getInvoiceDetails(invoiceId: number) {
    const companyProfile = await prisma.companyProfile.findFirst({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        user: { select: PUBLIC_USER_SELECT },
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
          include: { user: { select: PUBLIC_USER_SELECT } }
        },
        returns: {
          include: { user: { select: PUBLIC_USER_SELECT }, items: { include: { invoiceItem: true } }, payments: true }
        }
      }
    });

    if (!invoice) throw new Error('Invoice not found');

    const invoiceItems: any[] = Array.isArray(invoice.items) ? invoice.items : [];
    const invoicePayments: any[] = Array.isArray(invoice.payments) ? invoice.payments : [];
    const invoiceReturns: any[] = Array.isArray((invoice as any).returns) ? (invoice as any).returns : [];

    const financialLines = invoiceLines(invoice);
    const normalizedItems = financialLines
      .map((item) => buildCurrentInvoiceItemSnapshot(item))
      .filter(Boolean)
      .map((item: any) => ({
      ...item,
      product_name: item.productNameSnapshot || item.product.name,
      unit: item.baseUnitNameSnapshot || item.product.baseUnitName || item.product.unit,
      quantityLabel: formatQuantityForInvoice({
        packageQuantity: item.packageQuantity,
        extraUnitQuantity: item.extraUnitQuantity,
        packageName: item.packageNameSnapshot,
        baseUnitName: item.baseUnitNameSnapshot || item.product.baseUnitName || item.product.unit,
        totalBaseUnits: item.totalBaseUnits ?? item.quantity,
      }),
    }));

    const normalizedPayments = invoicePayments.map((payment) => ({
      ...payment,
      method: payment.method,
      staff_name: payment.user?.username || '—'
    }));

    const normalizedReturns = invoiceReturns.map((itemReturn) => ({
      ...itemReturn,
      staff_name: itemReturn.user?.username || '—'
    }));
    const grossPaidAmount = addMoney(...normalizedPayments.filter((payment: any) => Number(payment.amount) > 0).map((payment: any) => payment.amount));
    const moneyRefundedAmount = -addMoney(...normalizedPayments.filter((payment: any) => Number(payment.amount) < 0 && !payment.reversalOfId && !isGoodsReturnPaymentAdjustment(payment)).map((payment: any) => payment.amount));

    return {
      ...invoice,
      tax: addMoney(...financialLines.map((l: any) => l.remainingTax)),
      saleBasisAmount: calculateHistoricalInvoiceNetAmount(Number(invoice.totalAmount), Number(invoice.discount), Number(invoice.tax)),
      customer_name: invoice.customerNameSnapshot || invoice.customer?.name || 'Клиент',
      customer_phone: invoice.customerPhoneSnapshot || invoice.customer?.phone || null,
      customer_address: invoice.customerAddressSnapshot || (invoice.customer ? buildCustomerAddressSnapshot(invoice.customer) : null),
      company_name: companyProfile?.name || invoice.companyNameSnapshot,
      company_country: companyProfile?.country || invoice.companyCountrySnapshot,
      company_region: companyProfile?.region || invoice.companyRegionSnapshot,
      company_city: companyProfile?.city || invoice.companyCitySnapshot,
      company_address: companyProfile?.addressLine || invoice.companyAddressSnapshot,
      company_phone: companyProfile?.phone || null,
      company_note: companyProfile?.note || null,
      staff_name: invoice.user?.username || '—',
      grossPaidAmount,
      moneyRefundedAmount,
      returnPaymentAdjustments: goodsReturnPaymentAdjustments(normalizedPayments),
      items: normalizedItems,
      originalInvoice: invoice.originalSnapshot ? { ...(invoice.originalSnapshot as any), paidAmount: (invoice.originalSnapshot as any).originalPaidAmount ?? null } : { ...invoice, netAmount: invoice.originalNetAmount ?? calculateHistoricalInvoiceNetAmount(Number(invoice.totalAmount), Number(invoice.discount), Number(invoice.tax)), paidAmount: invoice.originalPaidAmount ?? null, items: financialLines, payments: normalizedPayments.filter((p: any) => Number(p.amount) > 0) },
      balancePaidAmount: balancePaidAmount(normalizedPayments, invoice.paidAmount),
      financialSummary: { originalNetAmount: invoice.originalNetAmount ?? calculateHistoricalInvoiceNetAmount(Number(invoice.totalAmount), Number(invoice.discount), Number(invoice.tax)), currentNetAmount: invoice.netAmount, returnedAmount: invoice.returnedAmount, tax: addMoney(...financialLines.map((l: any) => l.remainingTax)), debtAmount: Math.max(0, addMoney(invoice.netAmount, -balancePaidAmount(normalizedPayments, invoice.paidAmount))), customerCredit: addMoney(...normalizedReturns.map((itemReturn: any) => itemReturn.creditAmount || 0)) },
      payments: normalizedPayments,
      returns: normalizedReturns
    };
  }

  /**
   * Handles partial returns.
   */
  static async returnItems(invoiceId: number, data: { items: { invoiceItemId: number; quantity: number }[]; reason: string; userId: number; idempotencyKey?: string; refundMethod?: string }) {
    const key = operationKey(data.idempotencyKey);
    if (!Array.isArray(data.items) || data.items.length === 0) throw new Error('Return must contain items');
    const ids = new Set<number>();
    for (const item of data.items) {
      wholeQuantity(item.quantity);
      if (!Number.isSafeInteger(Number(item.invoiceItemId)) || ids.has(Number(item.invoiceItemId))) throw new Error('Duplicate or invalid return item');
      ids.add(Number(item.invoiceItemId));
    }
    const hash = requestHash({ invoiceId, ...data, items: [...data.items].sort((a, b) => a.invoiceItemId - b.invoiceItemId) });
    return prisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
      const existing = await tx.return.findUnique({ where: { idempotencyKey: key } });
      const response = (r: any) => ({ success: true, returnId: r.id, refundAmount: Number(r.totalValue), cashRefundAmount: Number(r.refundedAmount), refundedAmount: Number(r.refundedAmount), debtReduction: Number(r.debtReduction), creditAmount: Number(r.creditAmount || 0), refundMethod: r.refundMethod });
      if (existing) { assertReplay(existing, hash); return response(existing); }
      const locked = await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${invoiceId} FOR UPDATE`;
      if (!locked[0]) throw new Error('Invoice not found');
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          items: { orderBy: { id: 'asc' } },
          payments: true,
          returns: { include: { items: { select: { invoiceItemId: true, taxAmount: true } } } },
        },
      });
      if (!invoice || invoice.cancelled) throw new Error('Invoice not found or cancelled');
      const lines = invoiceLines(invoice);
      if (toCents(invoice.tax) !== 0 && (invoice.returns || []).some((r: any) => !Array.isArray(r.items) || r.items.length === 0)) {
        throw new Error('Исторические возвраты без состава требуют ручной сверки перед новым возвратом');
      }
      // Never repair legacy amounts implicitly. Ambiguous old returns need an
      // explicit reconciliation, rather than inventing per-item historical data.
      const accountedReturns = addMoney(...lines.map((l: any) => addMoney(l.returnedNetAmount, l.returnedTax)));
      if (toCents(accountedReturns) !== toCents(invoice.returnedAmount)) throw new Error('Historical return amounts require reconciliation before another return');
      const remainingValue = addMoney(...lines.map((l: any) => addMoney(l.remainingNetAmount, l.remainingTax)));
      if (toCents(remainingValue) !== toCents(invoice.netAmount)) throw new Error('Invoice totals require reconciliation before another return');
      const details = data.items.map(requested => {
        const item = lines.find((l: any) => Number(l.id) === Number(requested.invoiceItemId));
        if (!item || requested.quantity > item.remainingQuantity) throw new Error('Return quantity exceeds available quantity');
        const nextQty = Number(item.returnedQty || 0) + requested.quantity;
        const value = addMoney(cumulativeValue(item.eligibleNetAmount, nextQty, item.quantity), -item.returnedNetAmount);
        const allocatedDiscount = addMoney(cumulativeValue(item.allocatedOrderDiscount, nextQty, item.quantity), -cumulativeValue(item.allocatedOrderDiscount, item.returnedQty || 0, item.quantity));
        return { item, quantity: requested.quantity, value, taxValue: 0, allocatedDiscount };
      });
      const totalValue = addMoney(...details.map(d => d.value));
      const paymentHistory = invoice.payments || [];
      if (toCents(addMoney(...paymentHistory.map((p: any) => p.amount))) !== toCents(invoice.paidAmount)) throw new Error('Payment history requires reconciliation');
      const appliedPaid = balancePaidAmount(paymentHistory, invoice.paidAmount);
      const split = refundSplit(invoice.netAmount, appliedPaid, totalValue);
      const returned = await tx.return.create({ data: {
        invoiceId, customerId: invoice.customerId, userId: data.userId, reason: data.reason || null,
        totalValue, refundedAmount: split.refundedAmount, debtReduction: split.debtReduction, creditAmount: split.creditAmount, refundMethod: null, idempotencyKey: key, requestHash: hash,
        items: { create: details.map(d => ({ invoiceItemId: d.item.id, quantity: d.quantity, sellingPrice: d.item.sellingPrice, itemDiscount: d.item.discount || 0, allocatedOrderDiscount: d.allocatedDiscount, totalValue: d.value, taxAmount: d.taxValue })) },
      } });
      for (const d of details) {
        await StockService.deallocateStock(d.item.id, d.quantity, undefined, tx, false);
        await tx.invoiceItem.update({ where: { id: d.item.id }, data: { returnedQty: { increment: d.quantity } } });
        await tx.inventoryTransaction.create({ data: { productId: d.item.productId, warehouseId: invoice.warehouseId, userId: data.userId, qtyChange: d.quantity, type: 'return', referenceId: invoiceId, reason: `Return #${returned.id}: ${data.reason || ''}`, costAtTime: d.item.costPrice || 0, sellingAtTime: d.item.sellingPrice } });
      }
      for (const productId of new Set(details.map(d => Number(d.item.productId)))) await StockService.updateProductStockCache(productId, tx);
      await tx.invoice.update({ where: { id: invoiceId }, data: { returnedAmount: addMoney(invoice.returnedAmount, totalValue), netAmount: split.netAmount, status: getInvoiceStatus(split.paidAmount, split.netAmount) } });
      return response(returned);
    }, TRANSACTION_OPTIONS);
  }
}
