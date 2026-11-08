import { formatCount, roundMoney } from '../../utils/format';
import type { StatementInvoice, StatementItem } from '../../types/customer';

export const CUSTOMER_PAYMENT_EPSILON = 0;

export const getInvoiceSubtotal = (invoice: StatementInvoice) => {
  if (invoice.originalInvoice && Array.isArray(invoice.items)) return roundMoney(invoice.items.reduce((sum, item) => sum + Number(item.totalPrice ?? 0), 0));
  const storedTotal = Math.max(0, Number(invoice?.totalAmount || 0));
  if (invoice?.totalAmount != null && Number.isFinite(Number(invoice.totalAmount))) {
    return storedTotal;
  }

  const itemsSubtotal = Array.isArray(invoice?.items)
    ? invoice.items.reduce((sum, item) => {
        const storedLineTotal = Number(item?.totalPrice || 0);
        if (item?.totalPrice != null && Number.isFinite(Number(item.totalPrice))) {
          return roundMoney(sum + storedLineTotal);
        }

        return roundMoney(sum + roundMoney(Number(item.quantity || 0) * Number(item.sellingPrice || 0)));
      }, 0)
    : 0;

  return roundMoney(itemsSubtotal);
};

export const getInvoiceDiscountAmount = (invoice: StatementInvoice) => {
  if (invoice.originalInvoice && Array.isArray(invoice.items)) return roundMoney(invoice.items.reduce((sum, item) => sum + Number(item.allocatedOrderDiscount ?? 0), 0));
  const subtotal = getInvoiceSubtotal(invoice);
  const discount = Number(invoice?.discount || 0);
  return roundMoney(subtotal * (discount / 100));
};

export const getInvoiceNetAmount = (invoice: StatementInvoice) => {
  const storedNet = Math.max(0, Number(invoice?.netAmount || 0));
  if (invoice?.netAmount != null && Number.isFinite(Number(invoice.netAmount))) {
    return storedNet;
  }

  const subtotal = getInvoiceSubtotal(invoice);
  const discountAmount = getInvoiceDiscountAmount(invoice);
  const returnedAmount = Number(invoice?.returnedAmount || 0);
  const calculatedNet = roundMoney(subtotal - discountAmount - returnedAmount);

  return roundMoney(Math.max(0, calculatedNet));
};

export const getInvoiceChangeAmount = (invoice: StatementInvoice) => {
  const change = roundMoney(Math.max(0, Number(invoice?.paidAmount || 0)) - getInvoiceNetAmount(invoice));
  return change > CUSTOMER_PAYMENT_EPSILON ? change : 0;
};

export const getInvoiceAppliedPaidAmount = (invoice: StatementInvoice) =>
  Math.max(0, Math.max(0, Number(invoice?.paidAmount || 0)) - getInvoiceChangeAmount(invoice));

const normalizeDisplayBaseUnit = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'шт';
  if (['штук', 'штука', 'штуки', 'шт', 'pcs', 'piece', 'pieces'].includes(normalized)) {
    return 'шт';
  }
  return normalized;
};

const normalizeDisplayPackageName = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || 'уп';
};

export const getInvoiceItemQuantityParts = (item: StatementItem) => {
  const packageQuantity = Math.max(0, Number(item?.packageQuantity || 0));
  const extraUnitQuantity = Math.max(0, Number(item?.extraUnitQuantity || 0));
  const unitsPerPackage = Math.max(0, Number(item?.unitsPerPackageSnapshot ?? item?.unitsPerPackage ?? 0));
  const packageName = normalizeDisplayPackageName(item?.packageNameSnapshot || item?.packageName);
  const baseUnitName = normalizeDisplayBaseUnit(item?.baseUnitNameSnapshot || item?.baseUnitName || 'шт');

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
