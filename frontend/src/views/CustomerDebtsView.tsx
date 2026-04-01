import React, { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Badge, Card } from '../components/UI';
import PaginationControls from '../components/common/PaginationControls';
import { getCustomers } from '../api/customers.api';
import { formatCount, formatMoney } from '../utils/format';
import { getCurrentUser, isAdminUser } from '../utils/userAccess';
import {
  buildCustomerDebtSummary,
  customerPaymentStatusMeta,
  getCustomerDebtTotal,
  getCustomerPaidTotal,
  getCustomerPaymentStatus,
  getCustomerPurchasedTotal,
  hasCustomerPurchases,
  type CustomerPaymentStatus,
  type DebtCustomer,
} from '../utils/customerDebt';
import { Printer, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { printCustomerDebts } from '../utils/print/customerDebtsPrint';

const pageSize = 10;

type DebtFilter = 'all' | 'paid' | 'unpaid';

const filterTabs: Array<{ key: DebtFilter; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'paid', label: 'Оплачено' },
  { key: 'unpaid', label: 'Не оплачено' },
];

const sortOptions = [
  { value: 'debt', label: 'Сначала должники' },
  { value: 'paid', label: 'По сумме оплат' },
  { value: 'purchased', label: 'По сумме покупок' },
  { value: 'lastPurchase', label: 'По последней покупке' },
  { value: 'name', label: 'По имени' },
] as const;

type SortMode = (typeof sortOptions)[number]['value'];

const sectionTabClassName = ({ isActive }: { isActive: boolean }) =>
  [
    'inline-flex items-center rounded-2xl px-4 py-2 text-sm font-medium transition-all',
    isActive ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100',
  ].join(' ');

export default function CustomerDebtsView() {
  const user = useMemo(() => getCurrentUser(), []);
  const isAdmin = isAdminUser(user);
  const [customers, setCustomers] = useState<DebtCustomer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DebtFilter>('all');
  const [sortBy, setSortBy] = useState<SortMode>('debt');
  const [currentPage, setCurrentPage] = useState(1);

  const formatMoneyByRole = (value: unknown) => {
    if (!isAdmin) {
      return 'Скрыто';
    }

    return formatMoney(value);
  };

  const fetchCustomers = async () => {
    try {
      const data = await getCustomers({ force: true });
      setCustomers(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Ошибка при загрузке клиентов');
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    const handleWindowFocus = () => {
      fetchCustomers();
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, []);

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

      const status = getCustomerPaymentStatus(customer);
      if (statusFilter === 'paid') {
        return status === 'paid';
      }

      return status === 'partial' || status === 'unpaid';
    });
  }, [customersWithPurchases, isAdmin, searchTerm, statusFilter]);

  const filterCounts = useMemo(
    () => ({
      all: customersWithPurchases.length,
      paid: customersWithPurchases.filter((customer) => getCustomerPaymentStatus(customer) === 'paid').length,
      unpaid: customersWithPurchases.filter((customer) => {
        const status = getCustomerPaymentStatus(customer);
        return status === 'partial' || status === 'unpaid';
      }).length,
    }),
    [customersWithPurchases],
  );

  const sortedCustomers = useMemo(() => {
    return [...filteredCustomers].sort((a, b) => {
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

      const debtDiff = getCustomerDebtTotal(b) - getCustomerDebtTotal(a);
      if (debtDiff !== 0) {
        return debtDiff;
      }

      return getCustomerPurchasedTotal(b) - getCustomerPurchasedTotal(a);
    });
  }, [filteredCustomers, sortBy]);

  const summary = useMemo(() => buildCustomerDebtSummary(filteredCustomers), [filteredCustomers]);
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

  const handlePrint = async () => {
    const selectedFilter = filterTabs.find((tab) => tab.key === statusFilter)?.label || 'Все';
    const result = printCustomerDebts({
      customers: filteredCustomers,
      filterLabel: isAdmin ? selectedFilter : 'Все',
      hideFinancials: !isAdmin,
    });

    if (!result.ok) {
      toast.error('Не удалось подготовить печать списка');
    }
  };

  return (
    <div className="app-page-shell">
      <div className="w-full space-y-6">
        <div className="app-surface app-surface-header">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-4xl font-medium tracking-tight text-slate-900">Долги и оплаты</h1>
                <p className="mt-1 text-slate-500">Финансовая аналитика по клиентам строится на основе уже оформленных накладных.</p>
                {!isAdmin && (
                  <p className="mt-2 text-sm text-amber-600">Финансовые суммы и статусы оплаты скрыты для вашей роли.</p>
                )}
              </div>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
              >
                <Printer size={18} />
                <span>Печать списка</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 rounded-[24px] bg-slate-100 p-2">
              <NavLink to="/customers" end className={sectionTabClassName}>
                База клиентов
              </NavLink>
              <NavLink to="/customers/debts" className={sectionTabClassName}>
                Долги и оплаты
              </NavLink>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-[28px] border border-white shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Общий долг</p>
            <p className="mt-3 text-2xl font-medium text-rose-600">{formatMoneyByRole(summary.totalDebt)}</p>
          </Card>
          <Card className="rounded-[28px] border border-white shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Общая сумма оплат</p>
            <p className="mt-3 text-2xl font-medium text-emerald-600">{formatMoneyByRole(summary.totalPaid)}</p>
          </Card>
          <Card className="rounded-[28px] border border-white shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Оплачено</p>
            <p className="mt-3 text-2xl font-medium text-slate-900">{isAdmin ? formatCount(summary.fullyPaidCount) : 'Скрыто'}</p>
          </Card>
          <Card className="rounded-[28px] border border-white shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Не оплачено</p>
            <p className="mt-3 text-2xl font-medium text-slate-900">{isAdmin ? formatCount(summary.debtorsCount) : 'Скрыто'}</p>
          </Card>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              {(isAdmin ? filterTabs : filterTabs.slice(0, 1)).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={
                    statusFilter === tab.key
                      ? 'inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white'
                      : 'inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50'
                  }
                >
                  <span>{tab.label}</span>
                  <span
                    className={
                      statusFilter === tab.key
                        ? 'rounded-full bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold text-white'
                        : 'rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500'
                    }
                  >
                    {formatCount(filterCounts[tab.key])}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Поиск по имени или телефону..."
                  className="w-full rounded-2xl border border-slate-200 bg-[#f7f8fc] py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition-all focus:border-slate-400 focus:bg-white"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortMode)}
                className="w-full rounded-2xl border border-slate-200 bg-[#f7f8fc] px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-slate-400 focus:bg-white lg:max-w-64"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr className="text-left text-[9px] uppercase tracking-[0.12em] text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Клиент</th>
                  <th className="px-4 py-2.5 font-medium">Категория</th>
                  <th className="px-4 py-2.5 font-medium">Телефон</th>
                  <th className="px-4 py-2.5 font-medium">Накладных</th>
                  <th className="px-4 py-2.5 font-medium">Купил всего</th>
                  <th className="px-4 py-2.5 font-medium">Оплатил всего</th>
                  <th className="px-4 py-2.5 font-medium">Долг</th>
                  <th className="px-4 py-2.5 font-medium">Последняя покупка</th>
                  <th className="px-4 py-2.5 font-medium">Статус оплаты</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-xs text-slate-500">
                      По текущим фильтрам клиентов не найдено.
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((customer) => {
                    const status = getCustomerPaymentStatus(customer);
                    const statusMeta = customerPaymentStatusMeta[status];

                    return (
                      <tr key={customer.id} className="text-xs text-slate-700">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{customer.name}</div>
                        </td>
                        <td className="px-4 py-3">{customer.customerCategory || 'Без категории'}</td>
                        <td className="px-4 py-3">{customer.phone || 'Нет телефона'}</td>
                        <td className="px-4 py-3">{formatCount(customer.invoice_count || 0)}</td>
                        <td className="px-4 py-3">{formatMoneyByRole(getCustomerPurchasedTotal(customer))}</td>
                        <td className="px-4 py-3">{formatMoneyByRole(getCustomerPaidTotal(customer))}</td>
                        <td className="px-4 py-3">
                          <span className={isAdmin && getCustomerDebtTotal(customer) > 0 ? 'font-medium text-rose-600' : ''}>
                            {formatMoneyByRole(getCustomerDebtTotal(customer))}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {customer.last_purchase_at ? new Date(customer.last_purchase_at).toLocaleDateString('ru-RU') : 'Нет покупок'}
                        </td>
                        <td className="px-4 py-3">
                          {isAdmin ? <Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge> : <span className="text-slate-400">Скрыто</span>}
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
