import { clsx } from 'clsx';
import type React from 'react';
import { Search, X } from 'lucide-react';
import { toCents } from '../../utils/financial';
import { formatMoney } from '../../utils/format';

export const formatDateTime = (value: unknown) =>
  new Date(value as string).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const errorText = (error: any, fallback: string) => error?.response?.data?.error || fallback;

export function MoneyTile({ label, value, hint, tone = 'default' }: { label: string; value: unknown; hint?: string; tone?: 'default' | 'good' | 'warn' }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs">
      <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={clsx('mt-1 truncate font-mono text-base font-black tabular-nums sm:text-lg', tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-900')}>
        {formatMoney(value)}
      </p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

const STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: 'Ожидает подтверждения', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
  confirmed: { label: 'Подтверждено', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  returned: { label: 'Возвращено', tone: 'border-slate-200 bg-slate-100 text-slate-600' },
};

export function HandoverStatus({ status }: { status: string }) {
  const meta = STATUS[status] || { label: status, tone: 'border-slate-200 bg-slate-50 text-slate-600' };
  return <span className={clsx('inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold', meta.tone)}>{meta.label}</span>;
}

/** Where a received payment's money is now. */
export const paymentState = (op: any): 'on_hand' | 'pending' | 'confirmed' | 'cancelled' | 'other' =>
  op.handoverId ? (op.handoverStatus === 'confirmed' ? 'confirmed' : 'pending') : op.cancelled ? 'cancelled' : op.available ? 'on_hand' : 'other';

const STATE_TEXT: Record<string, { text: string; tone: string }> = {
  on_hand: { text: 'У вас на руках', tone: 'text-slate-600' },
  pending: { text: 'Передано, ждёт подтверждения', tone: 'text-amber-700' },
  confirmed: { text: 'Сдано администратору', tone: 'text-emerald-700' },
  cancelled: { text: 'Оплата отменена', tone: 'text-slate-400' },
};

export function PaymentRow({ op, selectable, selected, onToggle }: { op: any; selectable?: boolean; selected?: boolean; onToggle?: () => void }) {
  const state = STATE_TEXT[paymentState(op)];
  const body = (
    <>
      {selectable && <input type="checkbox" checked={Boolean(selected)} onChange={onToggle} className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300" aria-label={`Передать оплату ${op.customer || ''}`} />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-slate-900">{op.customer || 'Клиент'}</p>
        <p className="text-[11px] text-slate-500">{formatDateTime(op.at)}{op.invoiceId ? ` · накл. №${op.invoiceId}` : ''}</p>
        {state && <p className={clsx('text-[11px] font-semibold', state.tone)}>{state.text}</p>}
      </div>
      <span className={clsx('shrink-0 font-mono text-sm font-black tabular-nums', op.cancelled && !op.handoverId ? 'text-slate-400 line-through' : 'text-slate-900')}>{formatMoney(op.amount)}</span>
    </>
  );
  return selectable ? (
    <li><label className="flex cursor-pointer items-start gap-3 px-3.5 py-2.5 hover:bg-slate-50">{body}</label></li>
  ) : (
    <li className="flex items-start gap-3 px-3.5 py-2.5">{body}</li>
  );
}

export type SortOption = { value: string; label: string };

/** Search box with a sort selector, laid out for a phone and a desktop alike. */
export function ListToolbar({ search, onSearch, placeholder, sort, onSort, options, children }: {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  sort: string;
  onSort: (value: string) => void;
  options: SortOption[];
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="relative block min-w-0 flex-1">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-8 text-xs font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-slate-400"
        />
        {search && (
          <button type="button" onClick={() => onSearch('')} aria-label="Очистить поиск" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700">
            <X size={14} />
          </button>
        )}
      </label>
      <div className="flex min-w-0 items-center gap-2">
        {children}
        <select
          value={sort}
          onChange={(event) => onSort(event.target.value)}
          aria-label="Сортировка"
          className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 sm:flex-none"
        >
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
    </div>
  );
}

export function FilterChips<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: Array<{ value: T; label: string; count?: number }> }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={clsx(
            'shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
            value === option.value ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
          )}
        >
          {option.label}{typeof option.count === 'number' ? ` · ${option.count}` : ''}
        </button>
      ))}
    </div>
  );
}

// Shared comparators: newest first by default, money compared in kopecks.
export const byDateDesc = (a: any, b: any, key = 'at') => new Date(b[key]).getTime() - new Date(a[key]).getTime();
export const byAmountDesc = (a: any, b: any) => toCents(b.amount) - toCents(a.amount);
export const matches = (query: string, ...values: unknown[]) => {
  const q = query.trim().toLowerCase();
  return !q || values.some((value) => String(value ?? '').toLowerCase().includes(q));
};
