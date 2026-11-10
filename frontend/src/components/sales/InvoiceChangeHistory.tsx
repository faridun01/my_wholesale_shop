import { useState } from 'react';
import { getInvoiceHistory } from '../../api/invoices.api';
import { formatCount, formatMoney } from '../../utils/format';
import { methods } from './InvoiceFinancialHistory';

const titles: Record<string, string> = {
  created: 'Накладная создана',
  edited: 'Накладная изменена',
  corrected: 'Исправление при сверке',
  payment: 'Оплата',
  payment_reversed: 'Оплата отменена',
  money_returned: 'Деньги выданы покупателю',
  return_adjustment: 'Корректировка оплаты из-за возврата',
  returned: 'Возврат товара',
  cancelled: 'Накладная отменена',
};
const dotColors: Record<string, string> = {
  created: 'bg-sky-500',
  edited: 'bg-violet-500',
  corrected: 'bg-slate-400',
  payment: 'bg-emerald-500',
  payment_reversed: 'bg-rose-500',
  money_returned: 'bg-rose-500',
  return_adjustment: 'bg-amber-500',
  returned: 'bg-amber-500',
  cancelled: 'bg-rose-600',
};

const lineText = (line: any) =>
  `${formatCount(line.quantity)} × ${formatMoney(line.price)}${Number(line.discount) > 0 ? ` (скидка ${line.discount}%)` : ''} = ${formatMoney(line.total)}`;

function Changes({ changes }: { changes: any }) {
  return <div className="mt-1 space-y-0.5 text-slate-600">
    {changes.customer && <p>Покупатель: {changes.customer.before} → {changes.customer.after}</p>}
    {changes.discount && <p>Скидка накладной: {changes.discount.before}% → {changes.discount.after}%</p>}
    {changes.amount && <p>Итого: {formatMoney(changes.amount.before)} → <span className="font-semibold">{formatMoney(changes.amount.after)}</span></p>}
    {changes.items.map((item: any) => <p key={item.name}>
      {item.name}: {item.before && item.after ? `${lineText(item.before)} → ${lineText(item.after)}` : item.after ? `добавлен, ${lineText(item.after)}` : `убран, было ${lineText(item.before)}`}
    </p>)}
  </div>;
}

function EventBody({ event }: { event: any }) {
  const method = event.method ? methods[event.method] || event.method : null;
  switch (event.type) {
    case 'created':
      return <div className="mt-1 text-slate-600">
        <p>Итого: {formatMoney(event.amount)}</p>
        {event.items.map((item: any) => <p key={item.name}>{item.name}: {lineText(item)}</p>)}
      </div>;
    case 'edited':
    case 'corrected':
      return <>
        {event.note && <p className="mt-1 text-slate-600">{event.note}</p>}
        <Changes changes={event.changes} />
      </>;
    case 'returned':
      return <div className="mt-1 text-slate-600">
        <p>На сумму {formatMoney(event.amount)}{event.reason ? ` · Причина: ${event.reason}` : ''}</p>
        {event.items.length
          ? event.items.map((item: any) => <p key={item.name}>{item.name}: {formatCount(item.quantity)} на {formatMoney(item.total)}</p>)
          : <p className="text-amber-800">Старая запись: состав возврата не сохранён.</p>}
      </div>;
    case 'cancelled':
      return <div className="mt-1 text-slate-600">
        {event.quantityRestored > 0 && <p>На склад возвращено: {formatCount(event.quantityRestored)}</p>}
        {!event.exactDate && <p className="text-amber-800">Старая запись: показана дата последнего изменения накладной.</p>}
      </div>;
    default:
      return <p className="mt-1 text-slate-600">
        {formatMoney(event.amount)}{method ? ` · ${method}` : ''}{event.reversed ? ' · позже отменена' : ''}
      </p>;
  }
}

export default function InvoiceChangeHistory({ invoiceId }: { invoiceId: number }) {
  const [history, setHistory] = useState<any>(null);
  const [failed, setFailed] = useState(false);

  // Loaded on every opening, so operations made while the window is open are included.
  const load = async () => {
    setFailed(false);
    try { setHistory(await getInvoiceHistory(invoiceId)); } catch { setFailed(true); }
  };

  return <details className="rounded-2xl border border-slate-200 bg-white p-4" onToggle={(event) => { if (event.currentTarget.open) void load(); }}>
    <summary className="cursor-pointer text-sm font-bold">История изменений</summary>
    {failed && <p className="mt-3 text-xs text-rose-600">Не удалось загрузить историю</p>}
    {!failed && !history && <p className="mt-3 text-xs text-slate-500">Загрузка…</p>}
    {history && <>
      {history.earlierEditsNotKept && <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800">Накладная создана до 9 ноября 2026: её более ранние правки не сохранялись. Платежи и возвраты показаны полностью.</p>}
      <ol className="mt-3 space-y-3 border-l border-slate-200 pl-4 text-xs">
        {history.events.map((event: any, index: number) => <li key={index} className="relative">
          <span className={`absolute -left-5.25 top-1 h-2.5 w-2.5 rounded-full ${dotColors[event.type] || 'bg-slate-400'}`} aria-hidden="true" />
          <p className="font-semibold text-slate-900">{titles[event.type] || event.type}</p>
          <p className="text-[11px] text-slate-500">{new Date(event.at).toLocaleString('ru-RU')} · {event.user || (event.type === 'corrected' ? 'Система' : '—')}</p>
          <EventBody event={event} />
        </li>)}
      </ol>
    </>}
  </details>;
}
