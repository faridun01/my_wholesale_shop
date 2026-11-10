import { clsx } from 'clsx';
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

export function HandoverStatus({ status }: { status: string }) {
  return status === 'confirmed' ? (
    <span className="inline-flex shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Подтверждено</span>
  ) : (
    <span className="inline-flex shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Ожидает подтверждения</span>
  );
}

/** One received payment: who paid, when, for which invoice, and where its cash is now. */
export function PaymentRow({ op }: { op: any }) {
  const state = op.handoverId
    ? { text: op.handoverStatus === 'confirmed' ? 'Сдано администратору' : 'Передано, ждёт подтверждения', tone: op.handoverStatus === 'confirmed' ? 'text-emerald-700' : 'text-amber-700' }
    : op.cancelled
      ? { text: 'Оплата отменена', tone: 'text-slate-400' }
      : op.available
        ? { text: 'У вас на руках', tone: 'text-slate-600' }
        : null;
  return (
    <li className="flex items-start justify-between gap-3 px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-slate-900">{op.customer || 'Клиент'}</p>
        <p className="text-[11px] text-slate-500">{formatDateTime(op.at)}{op.invoiceId ? ` · накл. №${op.invoiceId}` : ''}</p>
        {state && <p className={clsx('text-[11px] font-semibold', state.tone)}>{state.text}</p>}
      </div>
      <span className={clsx('shrink-0 font-mono text-sm font-black tabular-nums', op.cancelled && !op.handoverId ? 'text-slate-400 line-through' : 'text-slate-900')}>{formatMoney(op.amount)}</span>
    </li>
  );
}
