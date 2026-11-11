import { clsx } from 'clsx';
import type React from 'react';
import { Search, X } from 'lucide-react';
import { toCents } from '../../utils/financial';
import { formatMoney } from '../../utils/format';

export const formatDateTime = (value: unknown) =>
  new Date(value as string).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const errorText = (error: any, fallback: string) => error?.response?.data?.error || fallback;

/** Russian plural: plural(5, ['оплата', 'оплаты', 'оплат']) → 'оплат'. */
export const plural = (n: number, [one, few, many]: [string, string, string]) => {
  const tens = Math.abs(n) % 100;
  const units = tens % 10;
  if (tens > 10 && tens < 20) return many;
  if (units === 1) return one;
  if (units >= 2 && units <= 4) return few;
  return many;
};
export const paymentsCount = (n: number) => `${n} ${plural(n, ['оплата', 'оплаты', 'оплат'])}`;

/** The one figure a cash page is about, with a few supporting figures under it. */
export function CashHero({ label, value, hint, stats }: { label: string; value: unknown; hint?: React.ReactNode; stats?: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <section className="rounded-2xl bg-slate-900 p-4 text-white shadow-sm sm:p-5" aria-label={label}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">{label}</p>
      <p className="mt-1 font-mono text-[28px] font-black leading-none tabular-nums sm:text-3xl">{formatMoney(value)}</p>
      {hint && <p className="mt-1.5 text-xs text-slate-300">{hint}</p>}
      {stats && stats.length > 0 && (
        <dl className="mt-4 grid gap-px overflow-hidden rounded-xl bg-white/10" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
          {stats.map((stat) => (
            <div key={stat.label} className="min-w-0 bg-slate-900 px-2.5 py-2 first:pl-0 sm:px-3">
              <dt className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-300">{stat.label}</dt>
              <dd className="mt-0.5 truncate font-mono text-sm font-bold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export function SectionTitle({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-2 px-1">
      <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
        {title}
        {typeof count === 'number' && <span className="rounded-full bg-slate-200/70 px-1.5 py-px text-[11px] font-bold text-slate-700">{count}</span>}
      </h2>
      {action}
    </div>
  );
}

export function Avatar({ name }: { name?: string | null }) {
  return (
    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold uppercase text-slate-700">
      {String(name || '?').trim().charAt(0) || '?'}
    </span>
  );
}

/** Keeps the page's main action in reach: above the phone's bottom navigation, below the content on a desktop. */
export function StickyActionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 -mx-1 rounded-2xl bg-canvas/80 p-1 backdrop-blur-sm lg:bottom-4 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      {children}
    </div>
  );
}

export function EmptyNote({ icon, title, text }: { icon?: React.ReactNode; title: string; text?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4">
      {icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">{icon}</span>}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {text && <p className="text-xs text-slate-500">{text}</p>}
      </div>
    </div>
  );
}

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

export function PaymentRow({ op, selectable, selected, onToggle, showState = true }: { op: any; selectable?: boolean; selected?: boolean; onToggle?: () => void; showState?: boolean }) {
  const state = showState ? STATE_TEXT[paymentState(op)] : null;
  const body = (
    <>
      {selectable && <input type="checkbox" checked={Boolean(selected)} onChange={onToggle} className="h-5 w-5 shrink-0 rounded border-slate-300 accent-slate-900" aria-label={`Передать оплату ${op.customer || ''}`} />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{op.customer || 'Клиент'}</p>
        <p className="text-[11px] text-slate-500">{formatDateTime(op.at)}{op.invoiceId ? ` · накл. №${op.invoiceId}` : ''}</p>
        {state && <p className={clsx('text-[11px] font-semibold', state.tone)}>{state.text}</p>}
      </div>
      <span className={clsx('shrink-0 font-mono text-sm font-black tabular-nums', op.cancelled && !op.handoverId ? 'text-slate-400 line-through' : 'text-slate-900')}>{formatMoney(op.amount)}</span>
    </>
  );
  return selectable ? (
    <li><label className="flex min-h-14 cursor-pointer items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50">{body}</label></li>
  ) : (
    <li className="flex min-h-14 items-center gap-3 px-3.5 py-2.5">{body}</li>
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
  // One row on a phone: search takes the room, sorting stays compact. Extra filters
  // (children) move the search onto its own row there.
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className={clsx('relative block min-w-0 flex-1', children && 'basis-full sm:basis-0')}>
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          // 16px on a phone: iOS zooms the page into any smaller input on focus.
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-8 text-base font-medium text-slate-800 outline-none placeholder:text-xs placeholder:font-normal placeholder:text-slate-400 focus:border-slate-400 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
        />
        {search && (
          <button type="button" onClick={() => onSearch('')} aria-label="Очистить поиск" className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700">
            <X size={14} />
          </button>
        )}
      </label>
      <div className={clsx('flex min-w-0 items-center gap-2', children ? 'flex-1 sm:flex-none' : 'w-[38%] max-w-44 shrink-0 sm:w-auto sm:max-w-none')}>
        {children}
        <select
          value={sort}
          onChange={(event) => onSort(event.target.value)}
          aria-label="Сортировка"
          className="h-10 w-full min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 sm:w-auto sm:flex-none"
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
