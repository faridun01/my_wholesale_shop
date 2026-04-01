export type CustomerPaymentStatus = 'paid' | 'partial' | 'unpaid';

export type DebtCustomer = {
  id: number;
  name: string;
  customerCategory?: string | null;
  phone?: string | null;
  total_invoiced?: number;
  total_paid?: number;
  balance?: number;
  invoice_count?: number;
  last_purchase_at?: string | null;
};

export type CustomerDebtSummary = {
  totalDebt: number;
  totalPaid: number;
  fullyPaidCount: number;
  debtorsCount: number;
};

const PAYMENT_EPSILON = 0.01;

export const customerPaymentStatusMeta: Record<CustomerPaymentStatus, { label: string; badgeVariant: 'success' | 'warning' | 'danger' }> = {
  paid: {
    label: 'Оплачено полностью',
    badgeVariant: 'success',
  },
  partial: {
    label: 'Частично оплачено',
    badgeVariant: 'warning',
  },
  unpaid: {
    label: 'Не оплачено',
    badgeVariant: 'danger',
  },
};

export function getCustomerPurchasedTotal(customer: DebtCustomer) {
  return Number(customer.total_invoiced || 0);
}

export function getCustomerPaidTotal(customer: DebtCustomer) {
  return Number(customer.total_paid || 0);
}

export function getCustomerDebtTotal(customer: DebtCustomer) {
  const debt = Number(customer.balance || 0);
  return debt > PAYMENT_EPSILON ? debt : 0;
}

export function hasCustomerPurchases(customer: DebtCustomer) {
  return getCustomerPurchasedTotal(customer) > PAYMENT_EPSILON || Number(customer.invoice_count || 0) > 0;
}

export function getCustomerPaymentStatus(customer: DebtCustomer): CustomerPaymentStatus {
  const purchased = getCustomerPurchasedTotal(customer);
  const paid = getCustomerPaidTotal(customer);
  const debt = getCustomerDebtTotal(customer);

  if (debt <= PAYMENT_EPSILON) {
    return 'paid';
  }

  if (paid > PAYMENT_EPSILON && debt > PAYMENT_EPSILON) {
    return 'partial';
  }

  if (paid <= PAYMENT_EPSILON && purchased > PAYMENT_EPSILON) {
    return 'unpaid';
  }

  return 'paid';
}

export function buildCustomerDebtSummary(customers: DebtCustomer[]): CustomerDebtSummary {
  return customers.reduce<CustomerDebtSummary>(
    (summary, customer) => {
      const status = getCustomerPaymentStatus(customer);
      const debt = getCustomerDebtTotal(customer);
      const paid = getCustomerPaidTotal(customer);

      summary.totalDebt += debt;
      summary.totalPaid += paid;

      if (status === 'paid') {
        summary.fullyPaidCount += 1;
      }

      if (debt > PAYMENT_EPSILON) {
        summary.debtorsCount += 1;
      }

      return summary;
    },
    {
      totalDebt: 0,
      totalPaid: 0,
      fullyPaidCount: 0,
      debtorsCount: 0,
    },
  );
}
