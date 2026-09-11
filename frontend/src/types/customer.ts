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
  total_invoiced: number;
  total_paid: number;
  balance: number;
  invoice_count?: number;
  average_invoice?: number;
  customer_segment?: 'VIP' | 'Постоянный' | 'Обычный' | 'Новый' | string;
  last_purchase_at?: string | null;
  payment_efficiency?: number;
}

export interface StatementPayment {
  id: number;
  amount: number;
  method: string;
  createdAt: string;
  staff_name: string;
}

export interface StatementReturn {
  id: number;
  totalValue: number;
  reason?: string;
  createdAt: string;
  staff_name: string;
}

export interface StatementItem {
  id: number;
  product?: { name?: string };
  quantity: number;
  totalPrice?: number;
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
  sellingPrice: number;
}

export interface StatementInvoice {
  id: number;
  createdAt: string;
  totalAmount: number;
  discount: number;
  tax?: number;
  netAmount: number;
  paidAmount: number;
  returnedAmount: number;
  status: string;
  cancelled?: boolean;
  warehouse?: { name?: string; address?: string };
  customer_name?: string;
  customer_phone?: string;
  customer?: { name?: string; phone?: string; address?: string };
  staff_name?: string;
  user?: { id?: number; username?: string; name?: string };
  items?: StatementItem[];
  invoiceBalance: number;
  paymentEvents: StatementPayment[];
  returnEvents: StatementReturn[];
}

