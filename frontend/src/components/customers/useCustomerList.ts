import { decimal } from '../../utils/financial';
import { useMemo } from 'react';
import type { Customer } from '../../types/customer';

const segmentRank: Record<string, number> = {
  VIP: 4,
  Постоянный: 3,
  Обычный: 2,
  Новый: 1,
};

export const segmentTone: Record<string, string> = {
  VIP: 'bg-violet-100 text-violet-700',
  Постоянный: 'bg-sky-100 text-sky-700',
  Обычный: 'bg-emerald-100 text-emerald-700',
  Новый: 'bg-amber-100 text-amber-700',
};

type UseCustomerListParams = {
  currentPage: number;
  customers: Customer[];
  pageSize: number;
  searchTerm: string;
  segmentFilter: string;
  sortBy: string;
};

export const useCustomerList = ({
  currentPage,
  customers,
  pageSize,
  searchTerm,
  segmentFilter,
  sortBy,
}: UseCustomerListParams) => {
  const customerCategories = useMemo(
    () =>
      Array.from(
        new Set(
          customers
            .map((customer) => String(customer.customerCategory || '').trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, 'ru')),
    [customers],
  );

  const sortedCustomers = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase();
    const filteredCustomers = customers.filter((customer) =>
      (customer.name.toLowerCase().includes(normalizedSearch) ||
        customer.phone?.includes(searchTerm)) &&
      (segmentFilter === 'all' || customer.customer_segment === segmentFilter),
    );

    return [...filteredCustomers].sort((a, b) => {
      if (sortBy === 'amount') {
        return decimal(b.total_invoiced || 0).minus(decimal(a.total_invoiced || 0)).toNumber();
      }

      if (sortBy === 'invoices') {
        return Number(b.invoice_count || 0) - Number(a.invoice_count || 0);
      }

      if (sortBy === 'balance') {
        return decimal(b.balance || 0).minus(decimal(a.balance || 0)).toNumber();
      }

      if (sortBy === 'lastPurchase') {
        return new Date(b.last_purchase_at || 0).getTime() - new Date(a.last_purchase_at || 0).getTime();
      }

      const rankDiff = (segmentRank[b.customer_segment || ''] || 0) - (segmentRank[a.customer_segment || ''] || 0);
      if (rankDiff !== 0) {
        return rankDiff;
      }

      const amountDiff = decimal(b.total_invoiced || 0).minus(decimal(a.total_invoiced || 0)).toNumber();
      if (amountDiff !== 0) {
        return amountDiff;
      }

      return Number(b.invoice_count || 0) - Number(a.invoice_count || 0);
    });
  }, [customers, searchTerm, segmentFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedCustomers.length / pageSize));
  const paginatedCustomers = useMemo(
    () => sortedCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, pageSize, sortedCustomers],
  );

  return {
    customerCategories,
    paginatedCustomers,
    sortedCustomers,
    totalPages,
  };
};
