import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronRight, Loader2, Receipt } from 'lucide-react';
import { getStaffInvoices, type StaffInvoiceStatus } from '../../api/staff.api';
import { formatMoney } from '../../utils/format';
import { getEffectiveStatus, getInvoiceAppliedPaidAmount, getInvoiceBalance, getInvoiceNetAmount } from '../../utils/salesViewUtils';
import { EmptyState } from '../UI';
import { STAFF_STATUS_META, type StaffStatusFilter } from './StaffStatsPanel';
import type { StaffPeriod } from './staffPeriod';

const PAGE_SIZE = 20;

type StaffInvoicesListProps = {
  userId: number;
  period: StaffPeriod;
  statusFilter: StaffStatusFilter;
  /** Bumped by the parent after a payment so the list reloads. */
  refreshKey: number;
  onOpenInvoice: (invoiceId: number) => void;
};

export function StaffInvoiceStatusBadge({ invoice }: { invoice: any }) {
  const status = getEffectiveStatus(invoice);
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">
        Отменена
      </span>
    );
  }

  // A fully returned invoice has nothing left to pay — not a debt.
  if (getInvoiceNetAmount(invoice) <= 0 && Number(invoice?.returnedAmount || 0) > 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">
        Возврат
      </span>
    );
  }

  const meta = STAFF_STATUS_META[status as StaffInvoiceStatus];
  const Icon = meta.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold', meta.chip)}>
      <Icon size={11} />
      {meta.label}
    </span>
  );
}

const formatInvoiceDate = (value: string) =>
  new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function StaffInvoicesList({ userId, period, statusFilter, refreshKey, onOpenInvoice }: StaffInvoicesListProps) {
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  const requestIdRef = useRef(0);

  const loadPage = useCallback(
    async (nextPage: number) => {
      const requestId = ++requestIdRef.current;
      if (nextPage === 1) setIsLoading(true);
      else setIsLoadingMore(true);
      setHasError(false);

      try {
        const result = await getStaffInvoices({
          userId,
          start: period.start,
          end: period.end,
          status: statusFilter === 'all' ? undefined : statusFilter,
          page: nextPage,
          limit: PAGE_SIZE,
        });
        // Ignore responses from a filter the user already moved away from.
        if (requestId !== requestIdRef.current) return;
        setItems((current) => (nextPage === 1 ? result.items : [...current, ...result.items]));
        setHasMore(result.hasMore);
        setPage(nextPage);
      } catch {
        if (requestId === requestIdRef.current) setHasError(true);
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [userId, period.start, period.end, statusFilter],
  );

  useEffect(() => {
    void loadPage(1);
  }, [loadPage, refreshKey]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-xs font-semibold text-slate-400">
        <Loader2 size={16} className="animate-spin" />
        Загрузка накладных...
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 px-3.5 py-3 text-xs font-semibold text-rose-700">
        <span>Не удалось загрузить накладные</span>
        <button type="button" onClick={() => void loadPage(1)} className="rounded-lg bg-white px-2.5 py-1 font-bold shadow-2xs">
          Повторить
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Receipt size={20} />}
        title="Накладных нет"
        description={statusFilter === 'all' ? 'За выбранный период сотрудник ничего не оформил.' : 'Нет накладных с таким статусом за этот период.'}
      />
    );
  }

  return (
    <div className="space-y-2">
      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {items.map((invoice) => {
          const balance = Math.max(0, getInvoiceBalance(invoice));
          return (
            <button
              key={invoice.id}
              type="button"
              onClick={() => onOpenInvoice(Number(invoice.id))}
              className="w-full rounded-2xl border border-slate-200/80 bg-white p-3 text-left shadow-2xs transition-all active:scale-[0.99] active:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">№{invoice.id}</p>
                  <p className="truncate text-xs font-medium text-slate-500">{invoice.customer_name}</p>
                </div>
                <StaffInvoiceStatusBadge invoice={invoice} />
              </div>
              <div className="mt-2 flex items-end justify-between gap-2 border-t border-slate-100 pt-2">
                <div className="text-[11px] text-slate-400">
                  <p>{formatInvoiceDate(invoice.createdAt)}</p>
                  {balance > 0 && <p className="font-semibold text-rose-600">Долг {formatMoney(balance)}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-sm font-black text-slate-900 tabular-nums">{formatMoney(getInvoiceNetAmount(invoice))}</span>
                  <ChevronRight size={15} className="text-slate-300" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs md:block">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2.5">№</th>
              <th className="px-3 py-2.5">Дата</th>
              <th className="px-3 py-2.5">Клиент</th>
              <th className="px-3 py-2.5 text-right">Сумма</th>
              <th className="px-3 py-2.5 text-right">Оплачено</th>
              <th className="px-3 py-2.5 text-right">Долг</th>
              <th className="px-3 py-2.5 text-right">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {items.map((invoice) => {
              const balance = Math.max(0, getInvoiceBalance(invoice));
              return (
                <tr
                  key={invoice.id}
                  onClick={() => onOpenInvoice(Number(invoice.id))}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <td className="px-3 py-2.5 font-bold text-slate-900">{invoice.id}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-slate-500">{formatInvoiceDate(invoice.createdAt)}</td>
                  <td className="max-w-[180px] truncate px-3 py-2.5 font-medium">{invoice.customer_name}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-slate-900">{formatMoney(getInvoiceNetAmount(invoice))}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-700">{formatMoney(getInvoiceAppliedPaidAmount(invoice))}</td>
                  <td className={clsx('px-3 py-2.5 text-right font-mono tabular-nums', balance > 0 ? 'font-bold text-rose-600' : 'text-slate-300')}>
                    {balance > 0 ? formatMoney(balance) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <StaffInvoiceStatusBadge invoice={invoice} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => void loadPage(page + 1)}
          disabled={isLoadingMore}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60"
        >
          {isLoadingMore && <Loader2 size={14} className="animate-spin" />}
          {isLoadingMore ? 'Загрузка...' : 'Показать ещё'}
        </button>
      )}
    </div>
  );
}
