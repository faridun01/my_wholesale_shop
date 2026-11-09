import { decimal } from './financial';
import { formatCount, roundMoney } from './format';
import { formatProductName } from './productName';
import type { EditProductOption, ReturnInvoiceItem } from '../components/sales/salesTypes';

export const SALES_PAYMENT_EPSILON = 0;

export const normalizeProductSearchValue = (value: unknown) => formatProductName(value).toLowerCase();

export const normalizeDisplayBaseUnit = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'шт';
  if (['пачка', 'пачки', 'пачек', 'шт', 'штук', 'штука', 'штуки', 'pcs', 'piece', 'pieces'].includes(normalized)) {
    return 'шт';
  }
  return normalized;
};

export const normalizePackagings = (product: any) =>
  Array.isArray(product?.packagings)
    ? product.packagings
        .map((entry: any) => ({
          id: Number(entry.id),
          packageName: String(entry.packageName || '').trim(),
          baseUnitName: normalizeDisplayBaseUnit(entry.baseUnitName || product?.baseUnitName || product?.unit || 'шт'),
          unitsPerPackage: Number(entry.unitsPerPackage || 0),
          isDefault: Boolean(entry.isDefault),
        }))
        .filter((entry: any) => entry.id > 0 && entry.packageName && entry.unitsPerPackage > 0)
    : [];

export const getDefaultPackaging = (
  packagings: Array<{ id: number; isDefault?: boolean; unitsPerPackage?: number; packageName?: string; baseUnitName?: string }>,
) =>
  packagings.find((entry) => entry.isDefault) || packagings[0] || null;

export const getProductStockParts = (product: EditProductOption) => {
  const totalStock = Math.max(0, Number(product?.stock || 0));
  const baseUnitName = normalizeDisplayBaseUnit(product?.baseUnitName || product?.unit || 'шт');
  const packagings = normalizePackagings(product);
  const packaging = getDefaultPackaging(packagings);

  if (!packaging || Number(packaging.unitsPerPackage || 0) <= 0) {
    return {
      primary: `${formatCount(totalStock)} ${baseUnitName}`,
      secondary: '',
    };
  }

  const unitsPerPackage = Number(packaging.unitsPerPackage || 0);
  const packageName = String(packaging.packageName || '').trim().toLowerCase() || 'уп';
  const packageCount = Math.floor(totalStock / unitsPerPackage);
  const extraUnits = totalStock - packageCount * unitsPerPackage;
  const primary =
    packageCount > 0
      ? `${formatCount(packageCount)} ${packageName}${extraUnits > 0 ? ` +${formatCount(extraUnits)} ${baseUnitName}` : ''}`
      : `${formatCount(totalStock)} ${baseUnitName}`;
  const secondary = packageCount > 0
    ? `${formatCount(packageCount)}x${formatCount(unitsPerPackage)}=${formatCount(packageCount * unitsPerPackage)} ${baseUnitName}`
    : '';

  return { primary, secondary };
};

export function getInvoiceSubtotal(invoice: any) {
  return roundMoney(
    Array.isArray(invoice?.items)
      ? invoice.items.reduce((sum: number, item: any) => roundMoney(decimal(sum).plus(decimal(item.totalPrice || 0)).toNumber()), 0)
      : Number(invoice?.totalAmount || 0),
  );
}

export function getInvoiceDiscountAmount(invoice: any) {
  if (invoice?.originalInvoice && Array.isArray(invoice.items)) return roundMoney(invoice.items.reduce((sum: number, item: any) => decimal(sum).plus(decimal(item.allocatedOrderDiscount || 0)).toNumber(), 0));
  const subtotal = getInvoiceSubtotal(invoice);
  const discount = Number(invoice?.discount || 0);
  return roundMoney(decimal(subtotal).times(decimal(discount).div(decimal(100))).toNumber());
}

export function getInvoiceNetAmount(invoice: any) {
  const storedNet = Number(invoice?.netAmount);
  if (Number.isFinite(storedNet) && storedNet >= 0) {
    return storedNet;
  }

  const subtotal = getInvoiceSubtotal(invoice);
  const discountAmount = getInvoiceDiscountAmount(invoice);
  const returnedAmount = Number(invoice?.returnedAmount || 0);
  const calculatedNet = roundMoney(decimal(subtotal).minus(decimal(discountAmount)).minus(decimal(returnedAmount)).toNumber());

  return roundMoney(Math.max(0, calculatedNet));
}

export function getEffectiveStatus(invoice: any, epsilon = SALES_PAYMENT_EPSILON) {
  if (invoice?.cancelled) {
    return 'cancelled';
  }

  const paidAmount = Math.max(0, Number(invoice?.balancePaidAmount ?? invoice?.paidAmount ?? 0));
  const netAmount = getInvoiceNetAmount(invoice);

  if (paidAmount >= netAmount) {
    return 'paid';
  }

  if (paidAmount > 0) {
    return 'partial';
  }

  return 'unpaid';
}

export function getInvoiceBalance(invoice: any) {
  return roundMoney(Math.max(0, decimal(getInvoiceNetAmount(invoice)).minus(decimal(Math.max(0, Number(invoice?.balancePaidAmount ?? invoice?.paidAmount ?? 0)))).toNumber()));
}

export const getInvoiceChangeAmount = (invoice: any, epsilon = SALES_PAYMENT_EPSILON) => {
  if (Number(invoice?.returnedAmount || 0) > 0) return 0;
  const change = roundMoney(decimal(Math.max(0, Number(invoice?.balancePaidAmount ?? invoice?.paidAmount ?? 0))).minus(decimal(getInvoiceNetAmount(invoice))).toNumber());
  if (change <= epsilon) {
    return 0;
  }

  return change;
};

// Goods returned after payment can leave more money received than the invoice is
// now worth. The excess is what the seller owes the buyer; payments stay as recorded.
export const getInvoiceAmountToReturn = (invoice: any, epsilon = SALES_PAYMENT_EPSILON) => {
  if (Number(invoice?.returnedAmount || 0) <= 0) return 0;
  const excess = roundMoney(decimal(Math.max(0, Number(invoice?.balancePaidAmount ?? invoice?.paidAmount ?? 0))).minus(decimal(getInvoiceNetAmount(invoice))).toNumber());
  return excess > epsilon ? excess : 0;
};

export const getInvoiceAppliedPaidAmount = (invoice: any) =>
  Math.min(Math.max(0, Number(invoice?.balancePaidAmount ?? invoice?.paidAmount ?? 0)), getInvoiceNetAmount(invoice));

const getInvoiceGrossPaidAmount = (invoice: any) => {
  const storedGross = Number(invoice?.grossPaidAmount);
  if (Number.isFinite(storedGross) && storedGross >= 0) return roundMoney(storedGross);
  if (Array.isArray(invoice?.payments)) {
    return roundMoney(invoice.payments.reduce((sum: number, payment: any) => decimal(sum).plus(decimal(Math.max(0, Number(payment?.amount || 0)))).toNumber(), 0));
  }
  return getInvoiceAppliedPaidAmount(invoice);
};

// "Внесено" as shown to people: never more than the invoice's current total.
export const getInvoiceShownPaidAmount = (invoice: any) =>
  Math.min(getInvoiceGrossPaidAmount(invoice), getInvoiceNetAmount(invoice));

export const getInvoiceMoneyRefundedAmount = (invoice: any) => {
  const storedRefunded = Number(invoice?.moneyRefundedAmount);
  if (Number.isFinite(storedRefunded) && storedRefunded >= 0) return roundMoney(storedRefunded);
  if (Array.isArray(invoice?.payments)) {
    return roundMoney(invoice.payments.reduce((sum: number, payment: any) => {
      const amount = Number(payment?.amount || 0);
      const returnAdjustment = payment?.returnId != null || String(payment?.method || '').toLowerCase() === 'refund';
      return decimal(sum).plus(decimal(amount < 0 && !payment?.reversalOfId && !returnAdjustment ? Math.abs(amount) : 0)).toNumber();
    }, 0));
  }
  return 0;
};

export const getInvoiceReturnPaymentAdjustments = (invoice: any) => {
  const stored = Number(invoice?.returnPaymentAdjustments);
  if (Number.isFinite(stored) && stored >= 0) return roundMoney(stored);
  if (!Array.isArray(invoice?.payments)) return 0;
  return roundMoney(invoice.payments.reduce((sum: number, payment: any) => {
    const amount = Number(payment?.amount || 0);
    const isReturnAdjustment = payment?.returnId != null || String(payment?.method || '').toLowerCase() === 'refund';
    return decimal(sum).plus(decimal(amount < 0 && !payment?.reversalOfId && isReturnAdjustment ? Math.abs(amount) : 0)).toNumber();
  }, 0));
};

// Goods returns do not create transferable credit. Kept as a compatibility helper.
export const getInvoiceCustomerCredit = (_invoice: any) => 0;

export const normalizeDisplayPackageName = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || 'уп';
};

export const getReturnItemPackaging = (item: any) => {
  const unitsPerPackage = Math.max(0, Number(item?.unitsPerPackageSnapshot ?? item?.unitsPerPackage ?? 0));
  const packageName = String(item?.packageNameSnapshot || item?.packageName || '').trim();

  if (!packageName || unitsPerPackage <= 0) {
    return null;
  }

  return {
    packageName,
    unitsPerPackage,
    baseUnitName: normalizeDisplayBaseUnit(item?.unit || item?.baseUnitNameSnapshot || item?.baseUnitName || 'шт'),
  };
};

export const getReturnItemRemainingUnits = (item: any) =>
  Math.max(0, Number(item?.quantity ?? item?.totalBaseUnits ?? 0) - Number(item?.returnedQty || 0));

export const createReturnInvoiceItems = (items: any[], epsilon = SALES_PAYMENT_EPSILON): ReturnInvoiceItem[] =>
  (Array.isArray(items) ? items : [])
    .filter((item: any) => getReturnItemRemainingUnits(item) > epsilon)
    .map((item: any) => ({
      ...item,
      returnQty: '',
      returnMode: getReturnItemPackaging(item) ? 'package' : 'unit',
    }));

export const hasReturnableItems = (invoice: any, epsilon = SALES_PAYMENT_EPSILON) =>
  Array.isArray(invoice?.items) && invoice.items.some((item: any) => getReturnItemRemainingUnits(item) > epsilon);

export const getInvoiceReturnedAmount = (invoice: any, epsilon = SALES_PAYMENT_EPSILON) => {
  const storedReturned = Math.max(0, Number(invoice?.returnedAmount || 0));
  if (storedReturned > epsilon) {
    return storedReturned;
  }

  if (Array.isArray(invoice?.returns)) {
    return invoice.returns.reduce((sum: number, item: any) => decimal(sum).plus(Math.max(0, Number(item?.totalValue || 0))).toNumber(), 0);
  }

  return 0;
};

export const getInvoiceReturnedItems = (invoice: any, epsilon = SALES_PAYMENT_EPSILON) =>
  Array.isArray(invoice?.items)
    ? invoice.items.filter((item: any) => Number(item?.returnedQty || 0) > epsilon)
    : [];

export const hasInvoiceReturns = (invoice: any, epsilon = SALES_PAYMENT_EPSILON) =>
  getInvoiceReturnedAmount(invoice, epsilon) > epsilon ||
  (Array.isArray(invoice?.returns) && invoice.returns.length > 0) ||
  getInvoiceReturnedItems(invoice, epsilon).length > 0;

export const getInvoiceItemReturnedQty = (item: any) => Math.max(0, Number(item?.returnedQty || 0));

export const getReturnItemDisplayName = (item: any) =>
  formatProductName(item?.product_name || item?.productNameSnapshot || item?.product?.name || 'Товар без названия');

export const getInvoiceItemQuantityParts = (item: any) => {
  const packageQuantity = Math.max(0, Number(item?.packageQuantity || 0));
  const extraUnitQuantity = Math.max(0, Number(item?.extraUnitQuantity || 0));
  const unitsPerPackage = Math.max(0, Number(item?.unitsPerPackageSnapshot ?? item?.unitsPerPackage ?? 0));
  const packageName = normalizeDisplayPackageName(item?.packageNameSnapshot || item?.packageName);
  const baseUnitName = normalizeDisplayBaseUnit(item?.unit || item?.baseUnitNameSnapshot || item?.baseUnitName || 'шт');

  if (packageQuantity > 0 && unitsPerPackage > 0) {
    const packagedUnits = packageQuantity * unitsPerPackage;
    let secondary = `${formatCount(packageQuantity)}x${formatCount(unitsPerPackage)}=${formatCount(packagedUnits)} ${baseUnitName}`;
    if (extraUnitQuantity > 0) {
      secondary += ` +${formatCount(extraUnitQuantity)} ${baseUnitName}`;
    }
    return {
      primary: `${formatCount(packageQuantity)} ${packageName}`,
      secondary,
    };
  }

  const totalBaseUnits = Math.max(0, Number(item?.totalBaseUnits ?? item?.quantity ?? 0));
  return {
    primary: `${formatCount(totalBaseUnits)} ${baseUnitName}`,
    secondary: '',
  };
};

export const isInvoicePaidInFull = (invoice: any, epsilon = SALES_PAYMENT_EPSILON) =>
  getEffectiveStatus(invoice, epsilon) === 'paid';

export const isPaymentActionDisabled = (invoice: any, epsilon = SALES_PAYMENT_EPSILON) =>
  Boolean(invoice?.cancelled) ||
  isInvoicePaidInFull(invoice, epsilon) ||
  getInvoiceBalance(invoice) <= epsilon;

export const isReturnActionDisabled = (invoice: any, epsilon = SALES_PAYMENT_EPSILON) =>
  Boolean(invoice?.cancelled) || !hasReturnableItems(invoice, epsilon);
