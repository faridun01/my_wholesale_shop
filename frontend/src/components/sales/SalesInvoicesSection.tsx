import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import {
  Banknote,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  Filter,
  MoreVertical,
  Pencil,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import PaginationControls from '../common/PaginationControls';
import { formatCount, formatMoney, toFixedNumber } from '../../utils/format';
import {
  getEffectiveStatus,
  getInvoiceAppliedPaidAmount,
  getInvoiceBalance,
  getInvoiceNetAmount,
  getInvoiceReturnedAmount,
  getInvoiceReturnedItems,
  hasInvoiceReturns,
  isPaymentActionDisabled,
  isReturnActionDisabled,
} from '../../utils/salesViewUtils';

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

type SalesInvoicesSectionProps = {
  isAdmin: boolean;
  invoicesCount: number;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  statusFilter: 'all' | 'paid' | 'partial' | 'unpaid';
  setStatusFilter: React.Dispatch<React.SetStateAction<'all' | 'paid' | 'partial' | 'unpaid'>>;
  staffFilter: string;
  setStaffFilter: React.Dispatch<React.SetStateAction<string>>;
  dateFrom: string;
  setDateFrom: React.Dispatch<React.SetStateAction<string>>;
  dateTo: string;
  setDateTo: React.Dispatch<React.SetStateAction<string>>;
  staffOptions: string[];
  clearInvoiceFilters: () => void;
  paginatedInvoices: any[];
  sortedInvoicesLength: number;
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  sortConfig: SortConfig;
  onSort: (key: string) => void;
  getStatusBadge: (status: string, cancelled: boolean) => React.ReactNode;
  setSelectedInvoice: React.Dispatch<React.SetStateAction<any>>;
  setPaymentAmount: React.Dispatch<React.SetStateAction<string>>;
  setShowPaymentModal: React.Dispatch<React.SetStateAction<boolean>>;
  openReturnInvoiceModal: (invoice: any) => Promise<void>;
  canEditInvoice: (invoice: any) => boolean;
  getEditBlockedReason: (invoice: any) => string;
  openEditInvoiceModal: (invoice: any) => void;
  fetchInvoiceDetails: (id: number) => Promise<void>;
  handleQuickPrintInvoice: (id: number) => Promise<void>;
  handleDeleteInvoice: (id: number) => Promise<void>;
};

function SalesRowActions({
  inv,
  isAdmin,
  paymentDisabled,
  returnDisabled,
  canEditInvoice,
  getEditBlockedReason,
  setSelectedInvoice,
  setPaymentAmount,
  setShowPaymentModal,
  openReturnInvoiceModal,
  openEditInvoiceModal,
  fetchInvoiceDetails,
  handleQuickPrintInvoice,
  handleDeleteInvoice,
}: {
  inv: any;
  isAdmin: boolean;
  paymentDisabled: boolean;
  returnDisabled: boolean;
  canEditInvoice: (inv: any) => boolean;
  getEditBlockedReason: (inv: any) => string;
  setSelectedInvoice: (inv: any) => void;
  setPaymentAmount: (amt: string) => void;
  setShowPaymentModal: (show: boolean) => void;
  openReturnInvoiceModal: (inv: any) => void;
  openEditInvoiceModal: (inv: any) => void;
  fetchInvoiceDetails: (id: any) => void;
  handleQuickPrintInvoice: (id: any) => void;
  handleDeleteInvoice: (id: any) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const canEdit = canEditInvoice(inv);

  return (
    <div className="relative inline-flex items-center justify-center gap-1.5" ref={dropdownRef}>
      {isAdmin && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (paymentDisabled) return;
              setSelectedInvoice(inv);
              setPaymentAmount(String(toFixedNumber(getInvoiceBalance(inv))));
              setShowPaymentModal(true);
            }}
            disabled={paymentDisabled}
            className={clsx(
              'flex h-7 w-7 items-center justify-center rounded-lg border transition-colors',
              paymentDisabled
                ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white'
            )}
            title="Принять оплату"
          >
            <Banknote size={14} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void openReturnInvoiceModal(inv);
            }}
            disabled={returnDisabled}
            className={clsx(
              'flex h-7 w-7 items-center justify-center rounded-lg border transition-colors',
              returnDisabled
                ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white'
            )}
            title="Возврат"
          >
            <RotateCcw size={14} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!canEdit) return;
              openEditInvoiceModal(inv);
            }}
            disabled={!canEdit}
            className={clsx(
              'flex h-7 w-7 items-center justify-center rounded-lg border transition-colors',
              canEdit
                ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-900 hover:text-white'
                : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
            )}
            title={canEdit ? 'Изменить продажу' : getEditBlockedReason(inv)}
          >
            <Pencil size={14} />
          </button>
        </>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={clsx(
          'flex h-7 w-7 items-center justify-center rounded-lg border transition-colors',
          isOpen
            ? 'border-slate-900 bg-slate-900 text-white'
            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        )}
        title="Ещё действия"
      >
        <MoreVertical size={14} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-44 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xl text-left">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              fetchInvoiceDetails(inv.id);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-[#f4f5fb] transition-colors"
          >
            <Eye size={14} className="text-slate-400" />
            <span>Просмотр</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              handleQuickPrintInvoice(inv.id);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-[#f4f5fb] transition-colors"
          >
            <Printer size={14} className="text-slate-400" />
            <span>Печать</span>
          </button>

          {isAdmin && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  handleDeleteInvoice(inv.id);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 size={14} className="text-rose-500" />
                <span>Удалить</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const SalesInvoicesSection = ({
  isAdmin,
  invoicesCount,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  staffFilter,
  setStaffFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  staffOptions,
  clearInvoiceFilters,
  paginatedInvoices,
  sortedInvoicesLength,
  isLoading,
  currentPage,
  totalPages,
  pageSize,
  setCurrentPage,
  sortConfig,
  onSort,
  getStatusBadge,
  setSelectedInvoice,
  setPaymentAmount,
  setShowPaymentModal,
  openReturnInvoiceModal,
  canEditInvoice,
  getEditBlockedReason,
  openEditInvoiceModal,
  fetchInvoiceDetails,
  handleQuickPrintInvoice,
  handleDeleteInvoice,
}: SalesInvoicesSectionProps) => {
  const renderSortLabel = (label: string, key: string) => (
    <button
      type="button"
      onClick={() => onSort(key)}
      className="inline-flex items-center gap-1 transition-colors hover:text-slate-600"
    >
      <span>{label}</span>
      {sortConfig.key === key ? (
        sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
      ) : (
        <Filter size={13} className="opacity-40" />
      )}
    </button>
  );

  return (
    <div className="flex flex-col overflow-hidden rounded-[28px] border border-white bg-white p-5 shadow-sm md:min-h-190">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Накладные</h2>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {formatCount(invoicesCount)}
          </span>
        </div>
        <div className="relative flex-1 max-w-xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Поиск по ID или клиенту..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full border border-slate-200 bg-[#f4f5fb] py-3 pl-11 pr-5 text-sm text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2.5 rounded-2xl border border-slate-100 bg-[#f4f5fb]/50 p-3 md:grid-cols-2 xl:grid-cols-5">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300"
        >
          <option value="all">Все статусы</option>
          <option value="paid">Оплачено</option>
          <option value="partial">Частично</option>
          <option value="unpaid">Не оплачено</option>
        </select>

        <select
          value={staffFilter}
          onChange={(e) => setStaffFilter(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300"
        >
          <option value="all">Все сотрудники</option>
          {staffOptions.map((staffName) => (
            <option key={staffName} value={staffName}>
              {staffName}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5">
          <Calendar size={16} className="text-slate-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full bg-transparent text-xs font-medium text-slate-700 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5">
          <Calendar size={16} className="text-slate-400" />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full bg-transparent text-xs font-medium text-slate-700 outline-none"
          />
        </div>

        <button
          type="button"
          onClick={clearInvoiceFilters}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-900 hover:text-white"
        >
          Сбросить фильтры
        </button>
      </div>

      <div className="flex-1 space-y-3 pt-3 md:hidden">
        {paginatedInvoices.map((inv) => {
          const paymentDisabled = isPaymentActionDisabled(inv);
          const returnDisabled = isReturnActionDisabled(inv);
          const returnedAmount = getInvoiceReturnedAmount(inv);
          const returnedItemsCount = getInvoiceReturnedItems(inv).length;
          const hasReturns = hasInvoiceReturns(inv);

          return (
            <div key={`mobile-invoice-${inv.id}`} className="rounded-2xl border border-slate-100 bg-[#f4f5fb]/60 p-4 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-900">Накладная</p>
                  <p className="mt-0.5 text-xs text-slate-400">{new Date(inv.createdAt).toLocaleDateString('ru-RU')}</p>
                  <p className="mt-2 text-sm font-medium text-slate-800">{inv.customer_name}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {getStatusBadge(getEffectiveStatus(inv), inv.cancelled)}
                  {hasReturns && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-amber-700 border border-amber-200/80">
                      <RotateCcw size={12} />
                      Возврат
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200/60 bg-white px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Сумма</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatMoney(getInvoiceNetAmount(inv))}</p>
                </div>
                <div className="rounded-xl border border-slate-200/60 bg-white px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Оплачено</p>
                  <p className="mt-0.5 text-sm font-semibold text-emerald-600">{formatMoney(getInvoiceAppliedPaidAmount(inv))}</p>
                </div>
                <div className="rounded-xl border border-slate-200/60 bg-white px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Остаток</p>
                  <p className="mt-0.5 text-sm font-semibold text-rose-600">{formatMoney(getInvoiceBalance(inv))}</p>
                </div>
                <div className="rounded-xl border border-slate-200/60 bg-white px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Склад</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-800">{inv.warehouse?.name || '---'}</p>
                </div>
              </div>

              {hasReturns && (
                <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Возврат оформлен</p>
                      <p className="mt-0.5 text-xs text-amber-700">
                        {returnedItemsCount > 0 ? `Позиций: ${formatCount(returnedItemsCount)}` : 'Подробности в деталях'}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-rose-600">-{formatMoney(returnedAmount)}</p>
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    if (paymentDisabled) return;
                    setSelectedInvoice(inv);
                    setPaymentAmount(String(toFixedNumber(getInvoiceBalance(inv))));
                    setShowPaymentModal(true);
                  }}
                  disabled={paymentDisabled}
                  className={clsx(
                    'rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
                    paymentDisabled
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                  )}
                >
                  Оплата
                </button>
                <button
                  onClick={() => {
                    void openReturnInvoiceModal(inv);
                  }}
                  disabled={returnDisabled}
                  className={clsx(
                    'rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
                    returnDisabled
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                      : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
                  )}
                >
                  Возврат
                </button>
                <button
                  onClick={() => {
                    if (!canEditInvoice(inv)) return;
                    openEditInvoiceModal(inv);
                  }}
                  disabled={!canEditInvoice(inv)}
                  title={getEditBlockedReason(inv)}
                  className={clsx(
                    'rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
                    canEditInvoice(inv)
                      ? 'border-slate-200 bg-white text-slate-800 hover:bg-slate-900 hover:text-white'
                      : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300',
                  )}
                >
                  Изменить
                </button>
                <button
                  onClick={() => fetchInvoiceDetails(inv.id)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-900 hover:text-white"
                >
                  Детали
                </button>
                <button
                  onClick={() => handleQuickPrintInvoice(inv.id)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-900 hover:text-white"
                >
                  Печать
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteInvoice(inv.id)}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-auto border-t border-slate-100 bg-white/95 md:hidden">
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={sortedInvoicesLength}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          className="border-t-0"
        />
      </div>

      <div className="hidden min-h-140 flex-1 overflow-x-auto pt-3 md:block">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-[#f4f5fb] text-xs font-medium uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">{renderSortLabel('Дата', 'createdAt')}</th>
              <th className="px-4 py-3">{renderSortLabel('Клиент', 'customer_name')}</th>
              <th className="px-4 py-3">{renderSortLabel('Сумма', 'netAmount')}</th>
              <th className="px-4 py-3">{renderSortLabel('Оплачено', 'paidAmount')}</th>
              <th className="px-4 py-3">{renderSortLabel('Остаток', 'balance')}</th>
              <th className="px-4 py-3">{renderSortLabel('Статус', 'status')}</th>
              <th className="px-3 py-3 text-center">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedInvoices.map((inv) => {
              const paymentDisabled = isPaymentActionDisabled(inv);
              const returnDisabled = isReturnActionDisabled(inv);
              const returnedAmount = getInvoiceReturnedAmount(inv);
              const hasReturns = hasInvoiceReturns(inv);

              return (
                <tr
                  key={inv.id}
                  onClick={() => fetchInvoiceDetails(inv.id)}
                  className="cursor-pointer transition-colors hover:bg-[#f4f5fb]"
                >
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(inv.createdAt).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{inv.customer_name}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-900">{formatMoney(getInvoiceNetAmount(inv))}</span>
                    {hasReturns && (
                      <div className="mt-0.5 text-[10px] font-medium text-rose-600">
                        возврат: -{formatMoney(returnedAmount)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-600">{formatMoney(getInvoiceAppliedPaidAmount(inv))}</td>
                  <td className="px-4 py-3 font-semibold text-rose-600">{formatMoney(getInvoiceBalance(inv))}</td>
                  <td className="px-4 py-3">{getStatusBadge(getEffectiveStatus(inv), inv.cancelled)}</td>
                  <td className="px-3 py-3 text-center align-middle">
                    <SalesRowActions
                      inv={inv}
                      isAdmin={isAdmin}
                      paymentDisabled={paymentDisabled}
                      returnDisabled={returnDisabled}
                      canEditInvoice={canEditInvoice}
                      getEditBlockedReason={getEditBlockedReason}
                      setSelectedInvoice={setSelectedInvoice}
                      setPaymentAmount={setPaymentAmount}
                      setShowPaymentModal={setShowPaymentModal}
                      openReturnInvoiceModal={openReturnInvoiceModal}
                      openEditInvoiceModal={openEditInvoiceModal}
                      fetchInvoiceDetails={fetchInvoiceDetails}
                      handleQuickPrintInvoice={handleQuickPrintInvoice}
                      handleDeleteInvoice={handleDeleteInvoice}
                    />
                  </td>
                </tr>
              );
            })}
            {sortedInvoicesLength === 0 && !isLoading && (
              <tr>
                <td colSpan={7} className="px-8 py-20 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#f4f5fb] text-slate-400">
                      <Receipt size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-700">Накладные не найдены</p>
                    <p className="mt-1 text-xs text-slate-400">Попробуйте сбросить фильтры</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-auto hidden border-t border-slate-100 bg-white/95 md:block">
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={sortedInvoicesLength}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          className="border-t-0"
        />
      </div>
    </div>
  );
};

export default SalesInvoicesSection;
