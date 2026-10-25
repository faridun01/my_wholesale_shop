import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { AlertCircle, CheckCircle2, Clock, Receipt, TrendingUp, Wallet } from 'lucide-react';
import type { StaffInvoiceStatus, StaffMetrics } from '../../api/staff.api';
import { formatCount, formatMoney } from '../../utils/format';
import { Skeleton } from '../UI';

export type StaffStatusFilter = 'all' | StaffInvoiceStatus;

export const STAFF_STATUS_META: Record<StaffInvoiceStatus, { label: string; dot: string; chip: string; icon: typeof CheckCircle2 }> = {
  paid: {
    label: 'Оплачено',
    dot: 'bg-emerald-500',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: CheckCircle2,
  },
  partial: {
    label: 'Частично',
    dot: 'bg-amber-500',
    chip: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: Clock,
  },
  unpaid: {
    label: 'Не оплачено',
    dot: 'bg-rose-500',
    chip: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: AlertCircle,
  },
};

export const formatPercentValue = (rate: number) => `${Math.round(Math.max(0, Math.min(1, rate)) * 100)}%`;

type StaffStatsPanelProps = {
  metrics: StaffMetrics | null;
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** Admin only — omitted for the seller's own view. */
  profit?: number;
  statusFilter?: StaffStatusFilter;
  onStatusFilterChange?: (status: StaffStatusFilter) => void;
};

function MetricTile({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone?: 'default' | 'success' | 'danger';
}) {
  return (
    <div
      className={clsx(
        'min-w-0 rounded-2xl border bg-white p-3 shadow-2xs',
        tone === 'success' && 'border-emerald-100',
        tone === 'danger' && 'border-rose-100',
        tone === 'default' && 'border-slate-200/80',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <span
          className={clsx(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
            tone === 'success' && 'bg-emerald-50 text-emerald-600',
            tone === 'danger' && 'bg-rose-50 text-rose-600',
            tone === 'default' && 'bg-slate-100 text-slate-500',
          )}
        >
          {icon}
        </span>
      </div>
      <p
        className={clsx(
          'mt-1.5 truncate font-mono text-base font-black tabular-nums sm:text-lg',
          tone === 'success' && 'text-emerald-700',
          tone === 'danger' && 'text-rose-600',
          tone === 'default' && 'text-slate-900',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">{hint}</p>}
    </div>
  );
}

export function StaffStatusChips({
  metrics,
  value,
  onChange,
}: {
  metrics: StaffMetrics;
  value: StaffStatusFilter;
  onChange: (status: StaffStatusFilter) => void;
}) {
  const options: Array<{ id: StaffStatusFilter; label: string; count: number }> = [
    { id: 'all', label: 'Все', count: metrics.invoicesCount },
    ...(Object.keys(STAFF_STATUS_META) as StaffInvoiceStatus[]).map((status) => ({
      id: status as StaffStatusFilter,
      label: STAFF_STATUS_META[status].label,
      count: metrics.byStatus[status].count,
    })),
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((option) => {
        const active = value === option.id;
        const meta = option.id === 'all' ? null : STAFF_STATUS_META[option.id];
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={clsx(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95',
              active
                ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900',
            )}
          >
            {meta && <span className={clsx('h-2 w-2 rounded-full', meta.dot)} />}
            <span>{option.label}</span>
            <span
              className={clsx(
                'rounded-full px-1.5 font-mono text-[10px] font-bold',
                active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
              )}
            >
              {formatCount(option.count)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function StaffStatsPanel({
  metrics,
  loading,
  error,
  onRetry,
  profit,
  statusFilter,
  onStatusFilterChange,
}: StaffStatsPanelProps) {
  if (loading && !metrics) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[86px] rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[58px] rounded-2xl" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 px-3.5 py-3 text-xs font-semibold text-rose-700">
        <span>Не удалось загрузить статистику</span>
        {onRetry && (
          <button type="button" onClick={onRetry} className="rounded-lg bg-white px-2.5 py-1 font-bold text-rose-700 shadow-2xs">
            Повторить
          </button>
        )}
      </div>
    );
  }

  const debtInvoices = metrics.byStatus.partial.count + metrics.byStatus.unpaid.count;
  const paidShare = metrics.soldAmount > 0 ? metrics.byStatus.paid.amount / metrics.soldAmount : 0;
  const partialPaidShare = metrics.soldAmount > 0 ? metrics.byStatus.partial.paid / metrics.soldAmount : 0;

  return (
    <div className={clsx('space-y-2 transition-opacity', loading && 'opacity-60')}>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricTile
          label="Накладных"
          value={formatCount(metrics.invoicesCount)}
          hint={metrics.invoicesCount > 0 ? `Средний чек ${formatMoney(metrics.averageCheck)}` : 'Нет продаж'}
          icon={<Receipt size={13} />}
        />
        <MetricTile
          label="Продано"
          value={formatMoney(metrics.soldAmount)}
          hint={metrics.returnedAmount > 0 ? `Возвраты −${formatMoney(metrics.returnedAmount)}` : 'TJS'}
          icon={<TrendingUp size={13} />}
        />
        <MetricTile
          label="Оплачено"
          value={formatMoney(metrics.paidAmount)}
          hint={`${formatCount(metrics.byStatus.paid.count)} накл. закрыто полностью`}
          icon={<Wallet size={13} />}
          tone="success"
        />
        <MetricTile
          label="Долг"
          value={formatMoney(metrics.debtAmount)}
          hint={debtInvoices > 0 ? `${formatCount(debtInvoices)} накл. ждут оплаты` : 'Долгов нет'}
          icon={<AlertCircle size={13} />}
          tone={metrics.debtAmount > 0 ? 'danger' : 'default'}
        />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-2xs">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-slate-600">
            Собрано <span className="font-mono font-black text-slate-900">{formatPercentValue(metrics.collectionRate)}</span>
          </span>
          {profit !== undefined && (
            <span className="font-semibold text-slate-500">
              Прибыль{' '}
              <span className={clsx('font-mono font-black', profit >= 0 ? 'text-emerald-700' : 'text-rose-600')}>
                {formatMoney(profit)}
              </span>
            </span>
          )}
        </div>
        <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-rose-100" aria-hidden>
          <div className="h-full bg-emerald-500" style={{ width: `${paidShare * 100}%` }} />
          <div className="h-full bg-amber-400" style={{ width: `${partialPaidShare * 100}%` }} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-400">
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Оплачено</span>
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Частичные оплаты</span>
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rose-300" />Долг</span>
        </div>
      </div>

      {statusFilter !== undefined && onStatusFilterChange && (
        <StaffStatusChips metrics={metrics} value={statusFilter} onChange={onStatusFilterChange} />
      )}
    </div>
  );
}
