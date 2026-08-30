import React, { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock, Printer, Search, Store } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Badge, Card } from '../components/UI';
import PaginationControls from '../components/common/PaginationControls';
import { getCustomerHistory, getCustomers } from '../api/customers.api';
import { getWarehouses } from '../api/warehouses.api';
import { formatCount, formatMoney, roundMoney } from '../utils/format';
import { filterWarehousesForUser, getCurrentUser, getUserWarehouseId, isAdminUser } from '../utils/userAccess';
import {
  customerMatchesPaymentFilter,
  customerPaymentStatusMeta,
  getCustomerDebtTotal,
  getCustomerInvoicesByStatus,
  getCustomerPaidTotalByFilter,
  getCustomerPaidTotal,
  getCustomerPaymentStatus,
  getCustomerPurchasedTotalByFilter,
  getCustomerPurchasedTotal,
  hasCustomerPurchases,
  type DebtCustomer,
} from '../utils/customerDebt';
import { printCustomerReconciliationBatch } from '../utils/print/customerInvoicePrint';

const pageSize = 10;
const PAYMENT_EPSILON = 0.01;

type DebtFilter = 'all' | 'paid' | 'partial' | 'unpaid';

type StatementInvoice = {
  id: number;
  createdAt: string;
  totalAmount: number;
  discount: number;
  tax?: number;
  netAmount: number;
  paidAmount: number;
  returnedAmount: number;
  status?: string;
  invoiceBalance: number;
  warehouse?: { id?: number; name?: string };
  items?: any[];
  paymentEvents?: any[];
  returnEvents?: any[];
};

const getDebtFilterLabel = (filter: Exclude<DebtFilter, 'all'>) => {
  if (filter === 'paid') {
    return 'Оплачено';
  }

  if (filter === 'partial') {
    return 'Частично оплачено';
  }

  return 'Не оплачено';
};

const filterTabs: Array<{ key: DebtFilter; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'paid', label: 'Оплачено' },
  { key: 'partial', label: 'Частично оплачено' },
  { key: 'unpaid', label: 'Не оплачено' },
];

const sortOptions = [
  { value: 'priority', label: 'Приоритет печати' },
  { value: 'debt', label: 'Сначала должники' },
  { value: 'paid', label: 'По сумме оплат' },
  { value: 'purchased', label: 'По сумме покупок' },
  { value: 'lastPurchase', label: 'По последней покупке' },
  { value: 'name', label: 'По имени' },
] as const;

type SortMode = (typeof sortOptions)[number]['value'];

const sectionTabClassName = ({ isActive }: { isActive: boolean }) =>
  [
    'inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold transition-all',
    isActive ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ');

export default function CustomerDebtsView() {
  const user = useMemo(() => getCurrentUser(), []);
  const isAdmin = isAdminUser(user);
  const defaultWarehouseId = getUserWarehouseId(user);
  const [customers, setCustomers] = useState<DebtCustomer[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    const saved = localStorage.getItem('dashboard_selected_warehouse_id');
    if (saved !== null) {
      return saved;
    }
    if (!isAdmin && defaultWarehouseId) {
      return String(defaultWarehouseId);
    }
    return '';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DebtFilter>('all');
  const [sortBy, setSortBy] = useState<SortMode>('debt');
  const [currentPage, setCurrentPage] = useState(1);
  const [isExportingInvoices, setIsExportingInvoices] = useState(false);
  const [customerHistories, setCustomerHistories] = useState<Record<number, StatementInvoice[]>>({});

  const handleWarehouseSelect = (id: string) => {
    setSelectedWarehouseId(id);
    localStorage.setItem('dashboard_selected_warehouse_id', id);
  };

  const formatMoneyByRole = (value: unknown) => {
    if (!isAdmin) {
      return 'Скрыто';
    }

    return formatMoney(value);
  };

  useEffect(() => {
    getWarehouses()
      .then((data) => {
        const items = Array.isArray(data) ? data : [];
        const filtered = filterWarehousesForUser(items, user);
        setWarehouses(filtered);
        if (filtered.length === 1) {
          const singleId = String(filtered[0].id);
          setSelectedWarehouseId(singleId);
          localStorage.setItem('dashboard_selected_warehouse_id', singleId);
        }
      })
      .catch(console.error);
  }, [isAdmin, user]);

  const fetchCustomers = async () => {
    try {
      const data = await getCustomers({ force: true, warehouseId: selectedWarehouseId });
      setCustomers(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Ошибка при загрузке клиентов');
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [selectedWarehouseId]);

  useEffect(() => {
    const handleWindowFocus = () => {
      fetchCustomers();
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [selectedWarehouseId]);

  const customersWithPurchases = useMemo(
    () => customers.filter((customer) => hasCustomerPurchases(customer)),
    [customers],
  );

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return customersWithPurchases.filter((customer) => {
      const matchesSearch =
        !normalizedSearch ||
        String(customer.name || '').toLowerCase().includes(normalizedSearch) ||
        String(customer.phone || '').includes(normalizedSearch);

      if (!matchesSearch) {
        return false;
      }

      if (statusFilter === 'all' || !isAdmin) {
        return true;
      }

      return customerMatchesPaymentFilter(customer, statusFilter);
    });
  }, [customersWithPurchases, isAdmin, searchTerm, statusFilter]);

  const filterCounts = useMemo(
    () => ({
      all: customersWithPurchases.length,
      paid: customersWithPurchases.filter((customer) => customerMatchesPaymentFilter(customer, 'paid')).length,
      partial: customersWithPurchases.filter((customer) => customerMatchesPaymentFilter(customer, 'partial')).length,
      unpaid: customersWithPurchases.filter((customer) => customerMatchesPaymentFilter(customer, 'unpaid')).length,
    }),
    [customersWithPurchases],
  );

  const sortedCustomers = useMemo(() => {
    return [...filteredCustomers].sort((a, b) => {
      if (statusFilter !== 'all') {
        const matchingInvoiceDiff = getCustomerInvoicesByStatus(b, statusFilter) - getCustomerInvoicesByStatus(a, statusFilter);
        if (matchingInvoiceDiff !== 0) {
          return matchingInvoiceDiff;
        }
      }

      if (sortBy === 'name') {
        return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
      }

      if (sortBy === 'paid') {
        return getCustomerPaidTotal(b) - getCustomerPaidTotal(a);
      }

      if (sortBy === 'purchased') {
        return getCustomerPurchasedTotal(b) - getCustomerPurchasedTotal(a);
      }

      if (sortBy === 'lastPurchase') {
        return new Date(b.last_purchase_at || 0).getTime() - new Date(a.last_purchase_at || 0).getTime();
      }

      if (sortBy === 'priority') {
        const debtDiff = getCustomerDebtTotal(b) - getCustomerDebtTotal(a);
        if (debtDiff !== 0) {
          return debtDiff;
        }

        const lastPurchaseDiff = new Date(b.last_purchase_at || 0).getTime() - new Date(a.last_purchase_at || 0).getTime();
        if (lastPurchaseDiff !== 0) {
          return lastPurchaseDiff;
        }

        return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
      }

      const debtDiff = getCustomerDebtTotal(b) - getCustomerDebtTotal(a);
      if (debtDiff !== 0) {
        return debtDiff;
      }

      return getCustomerPurchasedTotal(b) - getCustomerPurchasedTotal(a);
    });
  }, [filteredCustomers, sortBy, statusFilter]);

  const summary = useMemo(() => {
    if (statusFilter === 'all') {
      return filteredCustomers.reduce(
        (acc, customer) => {
          acc.totalDebt += getCustomerDebtTotal(customer);
          acc.totalPaid += getCustomerPaidTotal(customer);

          if (customerMatchesPaymentFilter(customer, 'paid')) {
            acc.fullyPaidCount += 1;
          }

          if (customerMatchesPaymentFilter(customer, 'partial')) {
            acc.partialCount += 1;
          }

          if (customerMatchesPaymentFilter(customer, 'unpaid')) {
            acc.unpaidCount += 1;
          }

          return acc;
        },
        {
          totalDebt: 0,
          totalPaid: 0,
          fullyPaidCount: 0,
          partialCount: 0,
          unpaidCount: 0,
        },
      );
    }

    return filteredCustomers.reduce(
      (acc, customer) => {
        const purchasedTotal = getCustomerPurchasedTotalByFilter(customer, statusFilter);
        const paidTotal = getCustomerPaidTotalByFilter(customer, statusFilter);
        const debtTotal = Math.max(0, purchasedTotal - paidTotal);

        acc.totalDebt += debtTotal;
        acc.totalPaid += paidTotal;

        if (statusFilter === 'paid') {
          acc.fullyPaidCount += 1;
        } else if (statusFilter === 'partial') {
          acc.partialCount += 1;
        } else {
          acc.unpaidCount += 1;
        }

        return acc;
      },
      {
        totalDebt: 0,
        totalPaid: 0,
        fullyPaidCount: 0,
        partialCount: 0,
        unpaidCount: 0,
      },
    );
  }, [filteredCustomers, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(sortedCustomers.length / pageSize));
  const paginatedCustomers = useMemo(
    () => sortedCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, sortedCustomers],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!isAdmin || paginatedCustomers.length === 0) {
      return;
    }

    let isCancelled = false;

    const fetchVisibleHistories = async () => {
      const results = await Promise.allSettled(
        paginatedCustomers.map(async (customer) => ({
          customerId: customer.id,
          invoices: (await getCustomerHistory(customer.id)) as StatementInvoice[],
        })),
      );

      if (isCancelled) {
        return;
      }

      setCustomerHistories((prev) => {
        const next = { ...prev };
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            next[result.value.customerId] = Array.isArray(result.value.invoices) ? result.value.invoices : [];
          }
        });
        return next;
      });
    };

    fetchVisibleHistories();

    return () => {
      isCancelled = true;
    };
  }, [isAdmin, paginatedCustomers]);

  const getInvoiceSubtotal = (invoice: StatementInvoice) => {
    const storedTotal = Math.max(0, Number(invoice?.totalAmount || 0));
    if (storedTotal > PAYMENT_EPSILON) {
      return storedTotal;
    }

    const itemsSubtotal = Array.isArray(invoice?.items)
      ? invoice.items.reduce((sum: number, item: any) => {
          const storedLineTotal = Number(item?.totalPrice || 0);
          if (storedLineTotal > PAYMENT_EPSILON) {
            return roundMoney(sum + storedLineTotal);
          }

          const quantity = Number(item?.quantity || 0);
          const price = Number(item?.sellingPrice || 0);
          return roundMoney(sum + roundMoney(quantity * price));
        }, 0)
      : 0;

    return roundMoney(itemsSubtotal);
  };

  const getInvoiceDiscountAmount = (invoice: StatementInvoice) => {
    const subtotal = getInvoiceSubtotal(invoice);
    const discount = Number(invoice?.discount || 0);
    return roundMoney(subtotal * (discount / 100));
  };

  const getInvoiceNetAmount = (invoice: StatementInvoice) => {
    const storedNet = Math.max(0, Number(invoice?.netAmount || 0));
    if (storedNet > PAYMENT_EPSILON) {
      return storedNet;
    }

    const subtotal = getInvoiceSubtotal(invoice);
    const discountAmount = getInvoiceDiscountAmount(invoice);
    const taxAmount = Math.max(0, Number(invoice?.tax || 0));
    const returnedAmount = Number(invoice?.returnedAmount || 0);
    const calculatedNet = roundMoney(subtotal - discountAmount + taxAmount - returnedAmount);

    return roundMoney(Math.max(0, calculatedNet));
  };

  const getInvoicePaidAmount = (invoice: StatementInvoice) => Math.max(0, Number(invoice?.paidAmount || 0));

  const getInvoiceChangeAmount = (invoice: StatementInvoice) => {
    const change = roundMoney(getInvoicePaidAmount(invoice) - getInvoiceNetAmount(invoice));
    return change > PAYMENT_EPSILON ? change : 0;
  };

  const getInvoiceAppliedPaidAmount = (invoice: StatementInvoice) =>
    Math.max(0, getInvoicePaidAmount(invoice) - getInvoiceChangeAmount(invoice));

  const getInvoicesDebtTotal = (invoices: StatementInvoice[]) =>
    invoices.reduce((sum, invoice) => {
      const storedBalance = Math.max(0, Number(invoice?.invoiceBalance || 0));
      if (storedBalance > PAYMENT_EPSILON) {
        return sum + storedBalance;
      }

      const computedBalance = getInvoiceNetAmount(invoice) - getInvoiceAppliedPaidAmount(invoice);
      return sum + (computedBalance > PAYMENT_EPSILON ? computedBalance : 0);
    }, 0);

  const getInvoicesNetTotal = (invoices: StatementInvoice[]) =>
    invoices.reduce((sum, invoice) => sum + getInvoiceNetAmount(invoice), 0);

  const getInvoicesPaidTotal = (invoices: StatementInvoice[]) =>
    invoices.reduce((sum, invoice) => sum + getInvoiceAppliedPaidAmount(invoice), 0);

  const getVisibleInvoicesForCustomer = (customer: DebtCustomer) => {
    const historyInvoices = customerHistories[customer.id];
    if (!Array.isArray(historyInvoices)) {
      return null;
    }

    return historyInvoices.filter((invoice) => statusFilter === 'all' || getStatementInvoiceStatus(invoice) === statusFilter);
  };

  const getStatementInvoiceStatus = (invoice: StatementInvoice): Exclude<DebtFilter, 'all'> => {
    if (String(invoice?.status || '').toLowerCase() === 'paid') {
      return 'paid';
    }

    const paidAmount = Math.max(0, Number(invoice?.paidAmount || 0));
    const balance = Math.max(0, Number(invoice?.invoiceBalance || 0));

    if (balance <= PAYMENT_EPSILON) {
      return 'paid';
    }

    if (paidAmount > PAYMENT_EPSILON) {
      return 'partial';
    }

    return 'unpaid';
  };

  const getBatchCustomerStatusLabel = (invoices: StatementInvoice[]) => {
    const uniqueStatuses = Array.from(new Set(invoices.map((invoice) => getStatementInvoiceStatus(invoice))));

    if (uniqueStatuses.length === 1) {
      return getDebtFilterLabel(uniqueStatuses[0]);
    }

    return 'Смешанные статусы';
  };

  const handlePrint = async () => {
    if (sortedCustomers.length === 0) {
      toast.error('Нет клиентов для выгрузки');
      return;
    }

    setIsExportingInvoices(true);
    try {
      const selectedFilter = filterTabs.find((tab) => tab.key === statusFilter)?.label || 'Все';
      const selectedSort = sortOptions.find((option) => option.value === sortBy)?.label || 'Сортировка';
      const histories = await Promise.allSettled(
        sortedCustomers.map(async (customer) => ({
          customerId: customer.id,
          invoices: (await getCustomerHistory(customer.id)) as StatementInvoice[],
        })),
      );
      const historyByCustomerId = histories.reduce<Record<number, StatementInvoice[]>>((acc, result) => {
        if (result.status === 'fulfilled') {
          acc[result.value.customerId] = Array.isArray(result.value.invoices) ? result.value.invoices : [];
        }
        return acc;
      }, {});
      const printableCustomers = sortedCustomers
        .map((customer) => {
          const invoices = (historyByCustomerId[customer.id] || []).filter(
            (invoice) => statusFilter === 'all' || getStatementInvoiceStatus(invoice) === statusFilter,
          );
          const customerStatus = getCustomerPaymentStatus(customer);
          const purchasedTotal =
            invoices.length > 0
              ? getInvoicesNetTotal(invoices)
              : statusFilter === 'all'
                ? getCustomerPurchasedTotal(customer)
                : getCustomerPurchasedTotalByFilter(customer, statusFilter);
          const paidTotal =
            invoices.length > 0
              ? getInvoicesPaidTotal(invoices)
              : statusFilter === 'all'
                ? getCustomerPaidTotal(customer)
                : getCustomerPaidTotalByFilter(customer, statusFilter);
          const debtTotal =
            invoices.length > 0
              ? getInvoicesDebtTotal(invoices)
              : statusFilter === 'all'
                ? getCustomerDebtTotal(customer)
                : Math.max(0, purchasedTotal - paidTotal);

          return {
            id: customer.id,
            name: customer.name || 'Без имени',
            phone: customer.phone || undefined,
            purchasedTotal,
            paidTotal,
            debtTotal,
            statusLabel:
              statusFilter === 'all'
                ? customerPaymentStatusMeta[customerStatus].label
                : getDebtFilterLabel(statusFilter),
            invoices,
          };
        })
        .filter((customer) => customer.invoices.length > 0 || customer.purchasedTotal > PAYMENT_EPSILON || customer.debtTotal > PAYMENT_EPSILON);

      if (printableCustomers.length === 0) {
        toast.error(`По фильтру "${selectedFilter}" список пуст`);
        return;
      }

      const result = printCustomerReconciliationBatch({
        customers: printableCustomers,
        filterLabel: selectedFilter,
        sortLabel: selectedSort,
      });

      if (!result.ok) {
        toast.error('Не удалось подготовить акт сверки');
        return;
      }
    } catch {
      toast.error('Не удалось подготовить акт сверки');
    } finally {
      setIsExportingInvoices(false);
    }
  };

  return (
    <div className="app-page-shell min-h-full font-sans">
      <div className="space-y-5 rounded-[28px] bg-[#f4f5fb] p-5 min-h-screen">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Долги и оплаты</h1>
            <p className="mt-0.5 text-xs text-slate-500">Финансовая аналитика по клиентам на основе оформленных накладных.</p>
            {!isAdmin && (
              <p className="mt-1 text-xs text-amber-600 font-medium">Финансовые суммы и статусы оплаты скрыты для вашей роли.</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {warehouses.length > 1 && (
              <div className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs">
                <Store size={15} className="text-slate-400" />
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => handleWarehouseSelect(e.target.value)}
                  className="bg-transparent outline-none cursor-pointer"
                >
                  {isAdmin && <option value="">Все склады</option>}
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={handlePrint}
              disabled={isExportingInvoices || filteredCustomers.length === 0}
              className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <Printer size={15} />
              <span>{isExportingInvoices ? 'Подготовка...' : 'Печать акта сверки'}</span>
            </button>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-1 rounded-full border border-slate-200/70 bg-white p-1.5 w-fit shadow-xs">
          <NavLink to="/customers" end className={sectionTabClassName}>
            База клиентов
          </NavLink>
          <NavLink to="/customers/debts" className={sectionTabClassName}>
            Долги и оплаты
          </NavLink>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-xs">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Общий долг</p>
            <p className="mt-2 text-xl font-bold tracking-tight text-rose-600">{formatMoneyByRole(summary.totalDebt)}</p>
          </div>
          <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-xs">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Общая сумма оплат</p>
            <p className="mt-2 text-xl font-bold tracking-tight text-emerald-600">{formatMoneyByRole(summary.totalPaid)}</p>
          </div>
          <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-xs">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Оплачено клиентов</p>
            <p className="mt-2 text-xl font-bold tracking-tight text-slate-900">{isAdmin ? formatCount(summary.fullyPaidCount) : 'Скрыто'}</p>
          </div>
          <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-xs">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Частичная оплата</p>
            <p className="mt-2 text-xl font-bold tracking-tight text-slate-900">{isAdmin ? formatCount(summary.partialCount) : 'Скрыто'}</p>
          </div>
          <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-xs">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Не оплачено</p>
            <p className="mt-2 text-xl font-bold tracking-tight text-slate-900">{isAdmin ? formatCount(summary.unpaidCount) : 'Скрыто'}</p>
          </div>
        </div>

        {/* Desktop Table & Filter Controls Container */}
        <div className="rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {(isAdmin ? filterTabs : filterTabs.slice(0, 1)).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                    statusFilter === tab.key
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'border border-slate-200/70 bg-[#f4f5fb] text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      statusFilter === tab.key
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200/60 text-slate-600'
                    }`}
                  >
                    {formatCount(filterCounts[tab.key])}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Поиск клиента..."
                  className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] py-2.5 pl-10 pr-4 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortMode)}
                className="rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3.5 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-1 md:hidden">
            {paginatedCustomers.length === 0 ? (
              <p className="py-10 text-center text-xs font-medium text-slate-400">
                По текущим фильтрам клиентов не найдено.
              </p>
            ) : (
              paginatedCustomers.map((customer) => {
                const aggregateStatus = getCustomerPaymentStatus(customer);
                const displayStatus = statusFilter === 'all' ? aggregateStatus : statusFilter;
                const statusMeta = customerPaymentStatusMeta[displayStatus];
                const warehouseNames =
                  Array.isArray(customer.warehouse_names) && customer.warehouse_names.length > 0
                    ? customer.warehouse_names.join(', ')
                    : '---';
                const visibleHistoryInvoices = getVisibleInvoicesForCustomer(customer);
                const visibleInvoiceCount =
                  visibleHistoryInvoices !== null
                    ? visibleHistoryInvoices.length
                    : statusFilter === 'all'
                      ? Number(customer.invoice_count || 0)
                      : getCustomerInvoicesByStatus(customer, statusFilter);
                const visiblePurchasedTotal =
                  visibleHistoryInvoices !== null
                    ? getInvoicesNetTotal(visibleHistoryInvoices)
                    : getCustomerPurchasedTotalByFilter(customer, statusFilter);
                const visiblePaidTotal =
                  visibleHistoryInvoices !== null
                    ? getInvoicesPaidTotal(visibleHistoryInvoices)
                    : getCustomerPaidTotalByFilter(customer, statusFilter);
                const visibleDebtTotal =
                  visibleHistoryInvoices !== null
                    ? getInvoicesDebtTotal(visibleHistoryInvoices)
                    : statusFilter === 'paid'
                      ? 0
                      : getCustomerDebtTotal(customer);

                return (
                  <div key={`mobile-debt-${customer.id}`} className="rounded-2xl border border-slate-100 bg-[#f4f5fb]/60 p-4 shadow-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{customer.name}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">{warehouseNames}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{customer.phone || '—'}</p>
                      </div>
                      {isAdmin ? (
                        <span
                          title={statusMeta.label}
                          className={clsx(
                            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border shadow-xs',
                            displayStatus === 'paid'
                              ? 'border-emerald-200/80 bg-emerald-50 text-emerald-600'
                              : displayStatus === 'partial'
                                ? 'border-amber-200/80 bg-amber-50 text-amber-600'
                                : 'border-rose-200/80 bg-rose-50 text-rose-500'
                          )}
                        >
                          {displayStatus === 'paid' ? (
                            <CheckCircle2 size={15} />
                          ) : displayStatus === 'partial' ? (
                            <Clock size={15} />
                          ) : (
                            <AlertCircle size={15} />
                          )}
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs text-slate-400">Скрыто</span>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-slate-200/60 bg-white px-3 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Накладных</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatCount(visibleInvoiceCount)}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200/60 bg-white px-3 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Купил всего</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatMoneyByRole(visiblePurchasedTotal)}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200/60 bg-white px-3 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Оплатил всего</p>
                        <p className="mt-0.5 text-sm font-semibold text-emerald-600">{formatMoneyByRole(visiblePaidTotal)}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200/60 bg-white px-3 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Долг</p>
                        <p className={clsx('mt-0.5 text-sm font-semibold', isAdmin && visibleDebtTotal > 0 ? 'text-rose-600' : 'text-slate-900')}>
                          {formatMoneyByRole(visibleDebtTotal)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-[11px] text-slate-400">
                      Последняя покупка:{' '}
                      {customer.last_purchase_at ? new Date(customer.last_purchase_at).toLocaleDateString('ru-RU') : 'Нет покупок'}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-[#f4f5fb] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="rounded-l-2xl py-3 px-4">Клиент</th>
                  <th className="py-3 px-4">Склад</th>
                  <th className="py-3 px-4">Телефон</th>
                  <th className="py-3 px-4">Накладных</th>
                  <th className="py-3 px-4">Купил всего</th>
                  <th className="py-3 px-4">Оплатил всего</th>
                  <th className="py-3 px-4">Долг</th>
                  <th className="py-3 px-4">Последняя покупка</th>
                  <th className="rounded-r-2xl py-3 px-4">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-xs font-medium text-slate-400">
                      По текущим фильтрам клиентов не найдено.
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((customer) => {
                    const aggregateStatus = getCustomerPaymentStatus(customer);
                    const displayStatus = statusFilter === 'all' ? aggregateStatus : statusFilter;
                    const statusMeta = customerPaymentStatusMeta[displayStatus];
                    const warehouseNames =
                      Array.isArray(customer.warehouse_names) && customer.warehouse_names.length > 0
                        ? customer.warehouse_names.join(', ')
                        : '---';
                    const visibleHistoryInvoices = getVisibleInvoicesForCustomer(customer);
                    const visibleInvoiceCount =
                      visibleHistoryInvoices !== null
                        ? visibleHistoryInvoices.length
                        : statusFilter === 'all'
                          ? Number(customer.invoice_count || 0)
                          : getCustomerInvoicesByStatus(customer, statusFilter);
                    const visiblePurchasedTotal =
                      visibleHistoryInvoices !== null
                        ? getInvoicesNetTotal(visibleHistoryInvoices)
                        : getCustomerPurchasedTotalByFilter(customer, statusFilter);
                    const visiblePaidTotal =
                      visibleHistoryInvoices !== null
                        ? getInvoicesPaidTotal(visibleHistoryInvoices)
                        : getCustomerPaidTotalByFilter(customer, statusFilter);
                    const visibleDebtTotal =
                      visibleHistoryInvoices !== null
                        ? getInvoicesDebtTotal(visibleHistoryInvoices)
                        : statusFilter === 'paid'
                          ? 0
                          : getCustomerDebtTotal(customer);

                    return (
                      <tr key={customer.id} className="transition-colors hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-semibold text-slate-900">{customer.name}</td>
                        <td className="py-3 px-4 text-slate-500">{warehouseNames}</td>
                        <td className="py-3 px-4 text-slate-500">{customer.phone || '—'}</td>
                        <td className="py-3 px-4 font-medium text-slate-900">{formatCount(visibleInvoiceCount)}</td>
                        <td className="py-3 px-4 font-medium text-slate-900">{formatMoneyByRole(visiblePurchasedTotal)}</td>
                        <td className="py-3 px-4 font-semibold text-emerald-600">{formatMoneyByRole(visiblePaidTotal)}</td>
                        <td className="py-3 px-4 font-semibold">
                          <span className={isAdmin && visibleDebtTotal > 0 ? 'text-rose-600' : 'text-slate-900'}>
                            {formatMoneyByRole(visibleDebtTotal)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {customer.last_purchase_at ? new Date(customer.last_purchase_at).toLocaleDateString('ru-RU') : 'Нет покупок'}
                        </td>
                        <td className="py-3 px-4">
                          {isAdmin ? (
                            <span
                              title={statusMeta.label}
                              className={clsx(
                                'inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-xs',
                                displayStatus === 'paid'
                                  ? 'border-emerald-200/80 bg-emerald-50 text-emerald-600'
                                  : displayStatus === 'partial'
                                    ? 'border-amber-200/80 bg-amber-50 text-amber-600'
                                    : 'border-rose-200/80 bg-rose-50 text-rose-500'
                              )}
                            >
                              {displayStatus === 'paid' ? (
                                <CheckCircle2 size={15} />
                              ) : displayStatus === 'partial' ? (
                                <Clock size={15} />
                              ) : (
                                <AlertCircle size={15} />
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400">Скрыто</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={sortedCustomers.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </div>
  );
}
