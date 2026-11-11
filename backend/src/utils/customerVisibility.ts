// What a non-admin may see of a customer's invoices: which goods, when, where and by whom,
// never any amount, price, cost or payment status. Built from an allow-list, so a field
// added to invoices, lines or products later stays hidden until it is listed here.

const pick = (source: any, keys: string[]) =>
  Object.fromEntries(keys.filter((key) => source?.[key] !== undefined).map((key) => [key, source[key]]));

const INVOICE_KEYS = [
  'id', 'customerId', 'userId', 'warehouseId', 'cancelled', 'createdAt', 'updatedAt',
  'customerNameSnapshot', 'customerPhoneSnapshot', 'customerAddressSnapshot',
];
const LINE_KEYS = [
  'id', 'invoiceId', 'productId', 'quantity', 'totalBaseUnits', 'packageQuantity', 'extraUnitQuantity',
  'packagingId', 'packageNameSnapshot', 'baseUnitNameSnapshot', 'unitsPerPackageSnapshot',
  'productNameSnapshot', 'rawNameSnapshot', 'brandSnapshot', 'returnedQty',
];
const PRODUCT_KEYS = ['id', 'name', 'brand', 'unit', 'baseUnitName', 'photoUrl'];

const maskEvent = (event: any, keys: string[]) => ({ ...pick(event, keys), amount: 0, totalValue: 0 });

export const maskInvoiceFinancials = (invoice: any) => ({
  ...pick(invoice, INVOICE_KEYS),
  warehouse: invoice.warehouse ? pick(invoice.warehouse, ['id', 'name', 'city']) : invoice.warehouse,
  user: invoice.user ? pick(invoice.user, ['id', 'username']) : invoice.user,
  totalAmount: 0,
  discount: 0,
  netAmount: 0,
  paidAmount: 0,
  returnedAmount: 0,
  invoiceBalance: 0,
  saleBasisAmount: 0,
  grossPaidAmount: 0,
  balancePaidAmount: 0,
  items: (Array.isArray(invoice.items) ? invoice.items : []).map((item: any) => ({
    ...pick(item, LINE_KEYS),
    ...(item.product ? { product: pick(item.product, PRODUCT_KEYS) } : {}),
    sellingPrice: 0,
    totalPrice: 0,
  })),
  payments: (Array.isArray(invoice.payments) ? invoice.payments : []).map((payment: any) => maskEvent(payment, ['id', 'createdAt', 'method', 'staff_name'])),
  returns: (Array.isArray(invoice.returns) ? invoice.returns : []).map((itemReturn: any) => maskEvent(itemReturn, ['id', 'createdAt', 'reason', 'staff_name'])),
  paymentEvents: (Array.isArray(invoice.paymentEvents) ? invoice.paymentEvents : []).map((payment: any) => maskEvent(payment, ['id', 'createdAt', 'method', 'staff_name'])),
  returnEvents: (Array.isArray(invoice.returnEvents) ? invoice.returnEvents : []).map((itemReturn: any) => ({
    ...maskEvent(itemReturn, ['id', 'createdAt', 'reason', 'staff_name']),
    items: (Array.isArray(itemReturn.items) ? itemReturn.items : []).map((line: any) => pick(line, ['productName', 'quantity'])),
  })),
});
