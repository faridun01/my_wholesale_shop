import { useMemo } from 'react';
import {
  getEffectiveStatus,
  getInvoiceAppliedPaidAmount,
  getInvoiceBalance,
  getInvoiceNetAmount,
} from '../../utils/salesViewUtils';
import { toLocalDateKey } from '../../utils/format';

type InvoiceSortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

type UseSalesListDataOptions = {
  invoices: any[];
  search: string;
  statusFilter: 'all' | 'paid' | 'partial' | 'unpaid';
  staffFilter: string;
  dateFrom: string;
  dateTo: string;
  sortConfig: InvoiceSortConfig;
  isAdmin: boolean;
  userWarehouseId: number | null | undefined;
  currentPage: number;
  pageSize: number;
};

const useSalesListData = ({
  invoices,
  search,
  statusFilter,
  staffFilter,
  dateFrom,
  dateTo,
  sortConfig,
  isAdmin,
  userWarehouseId,
  currentPage,
  pageSize,
}: UseSalesListDataOptions) => {
  const normalizedSearch = search.trim().toLowerCase();

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((inv) => {
        if (inv?.cancelled) {
          return false;
        }

        const matchesSearch =
          !normalizedSearch ||
          String(inv.id).includes(normalizedSearch) ||
          String(inv.customer_name || '').toLowerCase().includes(normalizedSearch);

        const effectiveStatus = getEffectiveStatus(inv);
        const matchesStatus = statusFilter === 'all' || effectiveStatus === statusFilter;
        const matchesStaff = staffFilter === 'all' || String(inv.staff_name || '') === staffFilter;
        // Local calendar day — slicing the ISO string would use the UTC day and
        // put early-morning invoices on the previous date in UTC+ time zones.
        const invoiceDate = inv.createdAt ? toLocalDateKey(inv.createdAt) : '';
        const matchesDateFrom = !dateFrom || invoiceDate >= dateFrom;
        const matchesDateTo = !dateTo || invoiceDate <= dateTo;

        if (isAdmin || !userWarehouseId) {
          return matchesSearch && matchesStatus && matchesStaff && matchesDateFrom && matchesDateTo;
        }

        const invoiceWarehouseId = inv.warehouseId || inv.warehouse?.id;
        return (
          matchesSearch &&
          matchesStatus &&
          matchesStaff &&
          matchesDateFrom &&
          matchesDateTo &&
          Number(invoiceWarehouseId) === userWarehouseId
        );
      }),
    [dateFrom, dateTo, invoices, isAdmin, normalizedSearch, staffFilter, statusFilter, userWarehouseId],
  );

  const sortedInvoices = useMemo(() => {
    const direction = sortConfig.direction === 'asc' ? 1 : -1;

    return [...filteredInvoices].sort((a, b) => {
      switch (sortConfig.key) {
        case 'id':
          return (Number(a.id) - Number(b.id)) * direction;
        case 'createdAt':
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
        case 'customer_name':
          return String(a.customer_name || '').localeCompare(String(b.customer_name || '')) * direction;
        case 'netAmount':
          return (getInvoiceNetAmount(a) - getInvoiceNetAmount(b)) * direction;
        case 'paidAmount':
          return (getInvoiceAppliedPaidAmount(a) - getInvoiceAppliedPaidAmount(b)) * direction;
        case 'balance':
          return (getInvoiceBalance(a) - getInvoiceBalance(b)) * direction;
        case 'status':
          return String(getEffectiveStatus(a)).localeCompare(String(getEffectiveStatus(b))) * direction;
        case 'staff_name':
          return String(a.staff_name || '').localeCompare(String(b.staff_name || '')) * direction;
        default:
          return 0;
      }
    });
  }, [filteredInvoices, sortConfig.direction, sortConfig.key]);

  const totalPages = Math.max(1, Math.ceil(sortedInvoices.length / pageSize));
  const paginatedInvoices = useMemo(
    () => sortedInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, pageSize, sortedInvoices],
  );

  const staffOptions = useMemo(
    () => Array.from(new Set(invoices.map((invoice) => String(invoice.staff_name || '').trim()).filter(Boolean))),
    [invoices],
  );

  return {
    sortedInvoices,
    totalPages,
    paginatedInvoices,
    staffOptions,
  };
};

export default useSalesListData;
