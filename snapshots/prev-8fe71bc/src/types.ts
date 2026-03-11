export type UserRole = 'admin' | 'staff';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  can_cancel: boolean;
  can_delete: boolean;
  warehouse_id: number;
}

export interface Warehouse {
  id: number;
  city: string;
  name_address: string;
  note: string;
  active: boolean;
}

export interface InventoryTransaction {
  id: number;
  product_id: number;
  quantity_change: number;
  type: 'purchase' | 'sale' | 'cancellation' | 'adjustment';
  reason?: string;
  user_id: number;
  username?: string;
  cost_at_time?: number;
  selling_price_at_time?: number;
  reference_id?: number;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  name: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  min_stock: number;
  initial_stock: number;
  photo_url?: string;
  active: boolean;
  archived: boolean;
  stock: number;
  total_incoming: number;
  price_visibility: 'global' | 'always_show' | 'always_hide';
  warehouse_id: number;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  active: boolean;
  archived: boolean;
  total_invoiced: number;
  total_paid: number;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  selling_price: number;
  cost_basis: number;
  unit?: string;
}

export interface Invoice {
  id: number;
  customer_id: number;
  customer_name?: string;
  total_amount: number;
  discount: number;
  tax: number;
  total_returned: number;
  returned_amount: number;
  status: 'paid' | 'partial' | 'unpaid';
  user_id: number;
  staff_name: string;
  created_at: string;
  cancelled: boolean;
  cancellation_reason?: string;
  total_paid: number;
  items?: InvoiceItem[];
}

export interface Payment {
  id: number;
  customer_id: number;
  invoice_id?: number;
  amount: number;
  method: string;
  note?: string;
  user_id: number;
  created_at: string;
}

export interface DashboardStats {
  today_sales: number;
  today_profit: number;
  today_payments: number;
  low_stock: { name: string; stock: number; min_stock: number }[];
  top_debtors: { name: string; balance: number }[];
}