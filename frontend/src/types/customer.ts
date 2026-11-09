import type { MoneyValue } from '../utils/financial';
export interface Customer {
  id: number;
  customerType?: 'individual' | 'company';
  name: string;
  customerCategory?: string;
  companyName?: string;
  contactName?: string;
  phone: string;
  country?: string;
  region?: string;
  city?: string;
  address: string;
  notes: string;
  total_invoiced: MoneyValue;
  total_paid: MoneyValue;
  balance: MoneyValue;
  invoice_count?: number;
  average_invoice?: MoneyValue;
  customer_segment?: 'VIP' | 'Постоянный' | 'Обычный' | 'Новый' | string;
  last_purchase_at?: string | null;
  payment_efficiency?: number;
}

export interface StatementPayment {
  id: number;
  amount: MoneyValue;
  method: string;
  createdAt: string;
  staff_name: string;
}

export interface StatementReturn {
  id: number;
  totalValue: MoneyValue;
  reason?: string;
  createdAt: string;
  staff_name: string;
}

export interface StatementItem {
  allocatedOrderDiscount?: MoneyValue;
  id: number;
  product?: { name?: string };
  quantity: number;
  totalPrice?: MoneyValue;
  totalBaseUnits?: number;
  packageQuantity?: number;
  extraUnitQuantity?: number;
  unitsPerPackageSnapshot?: number;
  unitsPerPackage?: number;
  packageNameSnapshot?: string;
  baseUnitNameSnapshot?: string;
  packageName?: string;
  baseUnitName?: string;
  returnedQty?: number;
  sellingPrice: MoneyValue;
}

export interface StatementInvoice {
  originalInvoice?: any;
  financialSummary?: any;
  payments?: any[];
  returns?: any[];
  id: number;
  createdAt: string;
  totalAmount: MoneyValue;
  discount: MoneyValue;
  netAmount: MoneyValue;
  paidAmount: MoneyValue;
  returnedAmount: MoneyValue;
  status: string;
  cancelled?: boolean;
  warehouse?: { name?: string; address?: string };
  customer_name?: string;
  customer_phone?: string;
  customer?: { name?: string; phone?: string; address?: string };
  staff_name?: string;
  user?: { id?: number; username?: string; name?: string };
  items?: StatementItem[];
  invoiceBalance: MoneyValue;
  paymentEvents: StatementPayment[];
  returnEvents: StatementReturn[];
}
