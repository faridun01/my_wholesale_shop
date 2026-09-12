import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import {
  Banknote,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  Filter,
  MoreVertical,
  Pencil,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  Share2,
  Trash2,
  X,
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
  warehouses?: any[];
  selectedWarehouseId?: string;
  setSelectedWarehouseId?: React.Dispatch<React.SetStateAction<string>>;
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
  handleDeleteInvoice: (target: any) => void;
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
              'flex h-8 w-8 items-center justify-center rounded-xl border transition-all duration-150 active:scale-90',
              paymentDisabled
                ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                : 'border-emerald-200/90 bg-emerald-50/80 text-emerald-700 shadow-2xs hover:border-emerald-600 hover:bg-emerald-600 hover:text-white hover:shadow-xs'
            )}
            title="Принять оплату"
          >
            <Banknote size={15} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void openReturnInvoiceModal(inv);
            }}
            disabled={returnDisabled}
            className={clsx(
              'flex h-8 w-8 items-center justify-center rounded-xl border transition-all duration-150 active:scale-90',
              returnDisabled
                ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                : 'border-amber-200/90 bg-amber-50/80 text-amber-700 shadow-2xs hover:border-amber-500 hover:bg-amber-500 hover:text-white hover:shadow-xs'
            )}
            title="Оформить возврат"
          >
            <RotateCcw size={15} />
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
              'flex h-8 w-8 items-center justify-center rounded-xl border transition-all duration-150 active:scale-90',
              canEdit
                ? 'border-indigo-100 bg-indigo-50/70 text-indigo-700 shadow-2xs hover:border-indigo-600 hover:bg-indigo-600 hover:text-white hover:shadow-xs'
                : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
            )}
            title={canEdit ? 'Изменить накладную' : getEditBlockedReason(inv)}
          >
            <Pencil size={15} />
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
          'flex h-8 w-8 items-center justify-center rounded-xl border transition-all duration-150 active:scale-90 shadow-2xs',
          isOpen
            ? 'border-slate-900 bg-slate-900 text-white shadow-xs ring-2 ring-slate-900/10'
            : 'border-slate-200/90 bg-white text-slate-500 hover:border-slate-900 hover:bg-slate-900 hover:text-white'
        )}
        title="Ещё действия"
      >
        <MoreVertical size={15} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-56 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-2xl backdrop-blur-md text-left animate-in fade-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              fetchInvoiceDetails(inv.id);
            }}
            className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 border border-sky-100 transition-colors group-hover:bg-sky-500 group-hover:text-white">
              <Eye size={14} />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-semibold text-slate-800 group-hover:text-slate-900">Детали</span>
              <span className="text-[10px] font-normal text-slate-400">Просмотр накладной</span>
            </div>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              handleQuickPrintInvoice(inv.id);
            }}
            className="hidden md:flex group w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 border border-slate-200/80 transition-colors group-hover:bg-slate-800 group-hover:text-white">
              <Printer size={14} />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-semibold text-slate-800 group-hover:text-slate-900">Печать</span>
              <span className="text-[10px] font-normal text-slate-400">Быстрая печать чека</span>
            </div>
          </button>

          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              setIsOpen(false);
              const { shareInvoicePdf } = await import('../../utils/print/salesInvoicePdf');
              await shareInvoicePdf(inv);
            }}
            className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600 border border-teal-100 transition-colors group-hover:bg-teal-500 group-hover:text-white">
              <Share2 size={14} />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-semibold text-slate-800 group-hover:text-slate-900">Поделиться PDF</span>
              <span className="text-[10px] font-normal text-slate-400">Скачать или отправить</span>
            </div>
          </button>

          {isAdmin && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  handleDeleteInvoice(inv);
                }}
                className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100/70 text-rose-600 border border-rose-200/80 transition-colors group-hover:bg-rose-500 group-hover:text-white">
                  <Trash2 size={14} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-rose-600">Удалить</span>
                  <span className="text-[10px] font-normal text-rose-400">Безвозвратное удаление</span>
                </div>
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
  warehouses,
  selectedWarehouseId,
  setSelectedWarehouseId,
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
  const [expandedMobileInvoiceId, setExpandedMobileInvoiceId] = useState<number | null>(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  useEffect(() => {
    setExpandedMobileInvoiceId(null);
  }, [currentPage, search, statusFilter, staffFilter, dateFrom, dateTo, selectedWarehouseId]);

  const isWarehouseFilterActive = Boolean(
    isAdmin &&
    warehouses &&
    warehouses.length > 1 &&
    selectedWarehouseId
  );

  const advancedFiltersCount =
    (staffFilter && staffFilter !== 'all' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (isWarehouseFilterActive ? 1 : 0);

  const hasAnyActiveFilter =
    statusFilter !== 'all' ||
    (Boolean(staffFilter) && staffFilter !== 'all') ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    Boolean(search?.trim()) ||
    isWarehouseFilterActive;

  const formatDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTodayStr = () => formatDateStr(new Date());

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatDateStr(d);
  };

  const getDaysAgoStr = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return formatDateStr(d);
  };

  const getFirstDayOfMonthStr = () => {
    const d = new Date();
    d.setDate(1);
    return formatDateStr(d);
  };

  const todayStr = getTodayStr();
  const yesterdayStr = getYesterdayStr();
  const weekAgoStr = getDaysAgoStr(6);
  const firstDayOfMonthStr = getFirstDayOfMonthStr();

  const isTodayPresetActive = dateFrom === todayStr && dateTo === todayStr;
  const isYesterdayPresetActive = dateFrom === yesterdayStr && dateTo === yesterdayStr;
  const isWeekPresetActive = dateFrom === weekAgoStr && dateTo === todayStr;
  const isMonthPresetActive = dateFrom === firstDayOfMonthStr && dateTo === todayStr;

  const handleDatePreset = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
    if (preset === 'today') {
      if (isTodayPresetActive) {
        setDateFrom('');
        setDateTo('');
      } else {
        setDateFrom(todayStr);
        setDateTo(todayStr);
      }
    } else if (preset === 'yesterday') {
      if (isYesterdayPresetActive) {
        setDateFrom('');
        setDateTo('');
      } else {
        setDateFrom(yesterdayStr);
        setDateTo(yesterdayStr);
      }
    } else if (preset === 'week') {
      if (isWeekPresetActive) {
        setDateFrom('');
        setDateTo('');
      } else {
        setDateFrom(weekAgoStr);
        setDateTo(todayStr);
      }
    } else if (preset === 'month') {
      if (isMonthPresetActive) {
        setDateFrom('');
        setDateTo('');
      } else {
        setDateFrom(firstDayOfMonthStr);
        setDateTo(todayStr);
      }
    }
  };

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
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs md:min-h-190">
      {/* Top Header - Desktop only */}
      <div className="hidden md:flex flex-col gap-3 border-b border-slate-100 pb-3.5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight text-slate-900">Накладные</h2>
            <span className="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 font-mono">
              {formatCount(invoicesCount)}
            </span>
          </div>

          {/* Status Tabs on Desktop */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100/80 p-1 border border-slate-200/60">
            {[
              { key: 'all', label: 'Все' },
              { key: 'paid', label: 'Оплачено', activeClass: 'bg-emerald-600 text-white shadow-xs' },
              { key: 'partial', label: 'Частично', activeClass: 'bg-amber-500 text-white shadow-xs' },
              { key: 'unpaid', label: 'Не оплачено', activeClass: 'bg-rose-600 text-white shadow-xs' },
            ].map((status) => {
              const isSelected = statusFilter === status.key;
              return (
                <button
                  key={status.key}
                  type="button"
                  onClick={() => setStatusFilter(status.key as any)}
                  className={clsx(
                    'rounded-lg px-2.5 py-1 text-xs font-bold transition-all',
                    isSelected
                      ? status.activeClass || 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  )}
                >
                  {status.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop Search Bar */}
        <div className="relative hidden flex-1 max-w-xs md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="Поиск по номеру или клиенту..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-8 text-xs text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Compact Filters & Search (md:hidden) */}
      <div className="space-y-2.5 md:hidden">
        {/* Row 1: Search + Filter Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder={invoicesCount > 0 ? `Поиск (${formatCount(invoicesCount)})...` : 'Поиск по накладным...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-[#f4f5fb] py-2 pl-9 pr-8 text-xs text-slate-800 outline-none transition-colors focus:border-slate-300 focus:bg-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Очистить поиск"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
            className={clsx(
              'flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all',
              isMobileFiltersOpen || advancedFiltersCount > 0
                ? 'border-accent-500 bg-accent-50 text-accent-700 shadow-xs'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            )}
          >
            <Filter size={14} className={advancedFiltersCount > 0 ? 'text-accent-600' : 'text-slate-500'} />
            <span>Фильтры</span>
            {advancedFiltersCount > 0 && (
              <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-accent-600 text-[10px] font-bold text-white">
                {advancedFiltersCount}
              </span>
            )}
            <ChevronDown size={13} className={clsx('transition-transform duration-200', isMobileFiltersOpen && 'rotate-180')} />
          </button>
        </div>

        {/* Row 2: Status Pills (Horizontal Scroll) */}
        <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-0.5">
          {[
            { key: 'all', label: 'Все' },
            { key: 'paid', label: 'Оплачено', activeClass: 'bg-emerald-600 text-white shadow-xs' },
            { key: 'partial', label: 'Частично', activeClass: 'bg-amber-500 text-white shadow-xs' },
            { key: 'unpaid', label: 'Не оплачено', activeClass: 'bg-rose-600 text-white shadow-xs' },
          ].map((status) => {
            const isSelected = statusFilter === status.key;
            return (
              <button
                key={status.key}
                type="button"
                onClick={() => setStatusFilter(status.key as any)}
                className={clsx(
                  'shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                  isSelected
                    ? status.activeClass || 'bg-slate-900 text-white shadow-xs'
                    : 'border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50'
                )}
              >
                {status.label}
              </button>
            );
          })}

          {hasAnyActiveFilter && (
            <button
              type="button"
              onClick={clearInvoiceFilters}
              className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50/70 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100 transition-colors"
              title="Сбросить все"
            >
              <RotateCcw size={12} />
              <span>Сброс</span>
            </button>
          )}
        </div>

        {/* Row 3: Collapsible Advanced Filters */}
        {isMobileFiltersOpen && (
          <div className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-[#f4f5fb]/70 p-3 shadow-xs animate-in fade-in-50 duration-150">
            {isAdmin && warehouses && warehouses.length > 1 && setSelectedWarehouseId && (
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Склад</label>
                <select
                  value={selectedWarehouseId || ''}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-slate-300"
                >
                  <option value="">Все склады</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Сотрудник</label>
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-slate-300"
              >
                <option value="all">Все сотрудники</option>
                {staffOptions.map((staffName) => (
                  <option key={staffName} value={staffName}>
                    {staffName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-emerald-600" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Период дат</span>
                </div>
                {(dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 transition-colors"
                  >
                    <X size={12} />
                    <span>Сбросить даты</span>
                  </button>
                )}
              </div>

              {/* Quick Preset Buttons for 1-Tap Filter */}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { key: 'today', label: 'Сегодня', active: isTodayPresetActive },
                  { key: 'yesterday', label: 'Вчера', active: isYesterdayPresetActive },
                  { key: 'week', label: '7 дней', active: isWeekPresetActive },
                  { key: 'month', label: 'Месяц', active: isMonthPresetActive },
                ].map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => handleDatePreset(preset.key as any)}
                    className={clsx(
                      'rounded-xl py-1.5 text-center text-xs font-bold transition-all active:scale-95 shadow-2xs',
                      preset.active
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'border border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Manual Date Inputs */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div className={clsx(
                  'relative flex items-center rounded-xl border px-2.5 py-1.5 transition-all shadow-2xs',
                  dateFrom
                    ? 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                )}>
                  <span className="text-[10px] font-black uppercase text-slate-400 mr-1.5 shrink-0">От</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
                  />
                  {dateFrom && (
                    <button
                      type="button"
                      onClick={() => setDateFrom('')}
                      className="ml-1 shrink-0 p-0.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
                      title="Очистить дату «От»"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className={clsx(
                  'relative flex items-center rounded-xl border px-2.5 py-1.5 transition-all shadow-2xs',
                  dateTo
                    ? 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                )}>
                  <span className="text-[10px] font-black uppercase text-slate-400 mr-1.5 shrink-0">До</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
                  />
                  {dateTo && (
                    <button
                      type="button"
                      onClick={() => setDateTo('')}
                      className="ml-1 shrink-0 p-0.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
                      title="Очистить дату «До»"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {hasAnyActiveFilter && (
              <button
                type="button"
                onClick={clearInvoiceFilters}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        )}
      </div>

      {/* Desktop Filters (md: and up) */}
      <div className={clsx(
        'mt-3 hidden items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-2.5 md:grid',
        isAdmin && warehouses && warehouses.length > 1 ? 'md:grid-cols-5' : 'md:grid-cols-4'
      )}>
        {isAdmin && warehouses && warehouses.length > 1 && setSelectedWarehouseId && (
          <select
            value={selectedWarehouseId || ''}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
          >
            <option value="">Все склады</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={staffFilter}
          onChange={(e) => setStaffFilter(e.target.value)}
          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 shadow-2xs"
        >
          <option value="all">Все сотрудники</option>
          {staffOptions.map((staffName) => (
            <option key={staffName} value={staffName}>
              {staffName}
            </option>
          ))}
        </select>

        <div className={clsx(
          "flex h-9 items-center gap-2 rounded-xl border bg-white px-3 shadow-2xs transition-colors",
          dateFrom ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-slate-200"
        )}>
          <span className="text-[10px] font-bold uppercase text-slate-400">От</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full bg-transparent text-xs font-semibold text-slate-700 outline-none"
          />
          {dateFrom && (
            <button
              type="button"
              onClick={() => setDateFrom('')}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
              title="Очистить"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className={clsx(
          "flex h-9 items-center gap-2 rounded-xl border bg-white px-3 shadow-2xs transition-colors",
          dateTo ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-slate-200"
        )}>
          <span className="text-[10px] font-bold uppercase text-slate-400">До</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full bg-transparent text-xs font-semibold text-slate-700 outline-none"
          />
          {dateTo && (
            <button
              type="button"
              onClick={() => setDateTo('')}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
              title="Очистить"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={clearInvoiceFilters}
          disabled={!hasAnyActiveFilter}
          className={clsx(
            'flex h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-all shadow-2xs active:scale-95',
            hasAnyActiveFilter
              ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:border-rose-300'
              : 'cursor-not-allowed border-slate-200 bg-slate-50/60 text-slate-300'
          )}
        >
          <RotateCcw size={13} />
          <span>Сбросить</span>
        </button>
      </div>

      <div className="flex-1 space-y-2.5 pt-3 md:hidden">
        {paginatedInvoices.map((inv) => {
          const paymentDisabled = isPaymentActionDisabled(inv);
          const returnDisabled = isReturnActionDisabled(inv);
          const returnedAmount = getInvoiceReturnedAmount(inv);
          const returnedItemsCount = getInvoiceReturnedItems(inv).length;
          const hasReturns = hasInvoiceReturns(inv);

          return (
            <div
              key={`mobile-invoice-${inv.id}`}
              onClick={() => fetchInvoiceDetails(inv.id)}
              className="group rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">№{inv.id}</span>
                    <span className="font-mono text-[11px] text-slate-400">{new Date(inv.createdAt).toLocaleDateString('ru-RU')}</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 opacity-80 group-hover:opacity-100">
                      <Eye size={10} />
                      Накладная
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] font-semibold text-slate-900 leading-snug">{inv.customer_name}</p>
                  {inv.warehouse?.name && (
                    <p className="mt-0.5 text-[10px] text-slate-400">Склад: {inv.warehouse.name}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {getStatusBadge(getEffectiveStatus(inv), inv.cancelled)}
                  {hasReturns && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700 border border-amber-200">
                      <RotateCcw size={10} />
                      Возврат
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2 text-center">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Сумма</p>
                  <p className="mt-0.5 font-mono text-xs font-bold tabular-nums text-slate-900">{formatMoney(getInvoiceNetAmount(inv))}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Оплачено</p>
                  <p className="mt-0.5 font-mono text-xs font-bold tabular-nums text-emerald-600">{formatMoney(getInvoiceAppliedPaidAmount(inv))}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Остаток</p>
                  <p className="mt-0.5 font-mono text-xs font-bold tabular-nums text-rose-600">{formatMoney(getInvoiceBalance(inv))}</p>
                </div>
              </div>

              {hasReturns && (
                <div className="mt-2.5 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Возврат оформлен</p>
                      <p className="mt-0.5 text-xs text-amber-700">
                        {returnedItemsCount > 0 ? `Позиций: ${formatCount(returnedItemsCount)}` : 'Подробности в накладной'}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-bold text-rose-600">-{formatMoney(returnedAmount)}</p>
                  </div>
                </div>
              )}

              <div className={clsx('mt-3 grid gap-1.5', isAdmin ? 'grid-cols-3' : 'grid-cols-1')}>
                {isAdmin && (
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
                      'flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-2 text-xs font-bold transition-all active:scale-[0.97]',
                      paymentDisabled
                        ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                        : 'border-emerald-200/90 bg-emerald-50/90 text-emerald-700 shadow-2xs active:bg-emerald-600 active:text-white'
                    )}
                  >
                    <Banknote size={15} />
                    <span className="truncate">Оплата</span>
                  </button>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (returnDisabled) return;
                      void openReturnInvoiceModal(inv);
                    }}
                    disabled={returnDisabled}
                    className={clsx(
                      'flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-2 text-xs font-bold transition-all active:scale-[0.97]',
                      returnDisabled
                        ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                        : 'border-amber-200/90 bg-amber-50/90 text-amber-700 shadow-2xs active:bg-amber-500 active:text-white'
                    )}
                  >
                    <RotateCcw size={15} />
                    <span className="truncate">Возврат</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedMobileInvoiceId(
                      expandedMobileInvoiceId === inv.id ? null : inv.id
                    );
                  }}
                  className={clsx(
                    'flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-2 text-xs font-bold transition-all active:scale-[0.97]',
                    expandedMobileInvoiceId === inv.id
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200/90 bg-slate-100/80 text-slate-700 shadow-2xs hover:bg-slate-200/70'
                  )}
                >
                  <span className="truncate">Ещё</span>
                  <ChevronDown
                    size={14}
                    className={clsx('transition-transform duration-200', expandedMobileInvoiceId === inv.id && 'rotate-180')}
                  />
                </button>
              </div>

              {expandedMobileInvoiceId === inv.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2.5 space-y-1.5 overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50/60 p-2 shadow-inner animate-in fade-in duration-150"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedMobileInvoiceId(null);
                      fetchInvoiceDetails(inv.id);
                    }}
                    className="group flex w-full items-center justify-between rounded-xl border border-slate-200/80 bg-white p-2.5 text-left transition-all active:scale-[0.98] hover:border-slate-300 shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 shadow-2xs border border-sky-100">
                        <Eye size={15} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Детали накладной</p>
                        <p className="text-[10px] text-slate-400">Полный состав и статус</p>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!canEditInvoice(inv)) return;
                        setExpandedMobileInvoiceId(null);
                        openEditInvoiceModal(inv);
                      }}
                      disabled={!canEditInvoice(inv)}
                      title={getEditBlockedReason(inv)}
                      className={clsx(
                        'group flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition-all active:scale-[0.98] shadow-2xs',
                        canEditInvoice(inv)
                          ? 'border-slate-200/80 bg-white hover:border-slate-300'
                          : 'cursor-not-allowed border-slate-100 bg-slate-50/60 opacity-50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-2xs border',
                          canEditInvoice(inv)
                            ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                            : 'bg-slate-100 text-slate-400 border-slate-200'
                        )}>
                          <Pencil size={15} />
                        </div>
                        <div>
                          <p className={clsx('text-xs font-bold', canEditInvoice(inv) ? 'text-slate-800' : 'text-slate-400')}>
                            Изменить накладную
                          </p>
                          <p className="text-[10px] text-slate-400">Редактировать позиции</p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      setExpandedMobileInvoiceId(null);
                      const { shareInvoicePdf } = await import('../../utils/print/salesInvoicePdf');
                      await shareInvoicePdf(inv);
                    }}
                    className="group flex w-full items-center justify-between rounded-xl border border-slate-200/80 bg-white p-2.5 text-left transition-all active:scale-[0.98] hover:border-slate-300 shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 shadow-2xs border border-teal-100">
                        <Share2 size={15} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Поделиться (PDF)</p>
                        <p className="text-[10px] text-slate-400">Отправить накладную клиенту</p>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedMobileInvoiceId(null);
                        handleDeleteInvoice(inv);
                      }}
                      className="group flex w-full items-center justify-between rounded-xl border border-rose-200/80 bg-rose-50/70 p-2.5 text-left transition-all active:scale-[0.98] hover:bg-rose-100/80 shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 shadow-2xs border border-rose-200">
                          <Trash2 size={15} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-rose-700">Удалить накладную</p>
                          <p className="text-[10px] text-rose-500/80">Безвозвратное удаление</p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-rose-300 group-hover:text-rose-500 transition-colors" />
                    </button>
                  )}
                </div>
              )}
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
            <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">{renderSortLabel('Накладная', 'id')}</th>
              <th className="px-4 py-3">{renderSortLabel('Клиент', 'customer_name')}</th>
              <th className="px-4 py-3 text-right pr-4">{renderSortLabel('Сумма', 'netAmount')}</th>
              <th className="px-4 py-3 text-right pr-4">{renderSortLabel('Оплачено', 'paidAmount')}</th>
              <th className="px-4 py-3 text-right pr-4">{renderSortLabel('Остаток', 'balance')}</th>
              <th className="px-4 py-3 text-center">{renderSortLabel('Статус', 'status')}</th>
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
                  className="group cursor-pointer transition-colors hover:bg-slate-50/90"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">№{inv.id}</span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {new Date(inv.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-bold text-slate-700 text-[11px]">
                        {(inv.customer_name || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-xs truncate max-w-[200px]">{inv.customer_name}</p>
                        {inv.warehouse?.name && (
                          <p className="text-[10px] text-slate-400 truncate">{inv.warehouse.name}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right pr-4">
                    <span className="font-mono text-xs font-bold tabular-nums text-slate-900">{formatMoney(getInvoiceNetAmount(inv))}</span>
                    {hasReturns && (
                      <div className="mt-0.5 font-mono text-[10px] font-medium tabular-nums text-rose-600">
                        возврат: -{formatMoney(returnedAmount)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right pr-4 font-mono text-xs font-bold tabular-nums text-emerald-600">
                    {formatMoney(getInvoiceAppliedPaidAmount(inv))}
                  </td>
                  <td className="px-4 py-3 text-right pr-4 font-mono text-xs font-bold tabular-nums">
                    <span className={getInvoiceBalance(inv) > 0.005 ? 'text-rose-600' : 'text-slate-400'}>
                      {formatMoney(getInvoiceBalance(inv))}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(getEffectiveStatus(inv), inv.cancelled)}
                  </td>
                  <td className="px-3 py-3 text-center align-middle whitespace-nowrap">
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
