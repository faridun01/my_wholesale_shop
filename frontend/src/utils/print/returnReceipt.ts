import { addMoney } from '../financial';
export function returnReceiptInvoice(invoice: any, returned: any) {
  const items = returned.items || [];
  return { ...invoice, id: `${invoice.id} / возврат ${returned.id}`, createdAt: returned.createdAt,
    items: items.map((line: any) => ({ ...line.invoiceItem, id: line.id, quantity: line.quantity, totalBaseUnits: line.quantity,
      packageQuantity: 0, extraUnitQuantity: line.quantity, sellingPrice: line.sellingPrice,
      totalPrice: addMoney(line.totalValue, -Number(line.taxAmount || 0)) })),
    netAmount: Number(returned.totalValue), totalAmount: addMoney(...items.map((i: any) => addMoney(i.totalValue, -Number(i.taxAmount || 0)))),
    tax: addMoney(...items.map((i: any) => i.taxAmount || 0)), discount: 0, returnedAmount: 0,
    paidAmount: Number(returned.refundedAmount || 0), originalInvoice: undefined,
    documentTitle: `Возврат №${returned.id}`, debtReduction: returned.debtReduction,
  };
}
