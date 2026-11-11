import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import { getDebtors, type DebtorSort } from '../../api/cash.api';
import { formatMoney } from '../../utils/format';
import { Skeleton } from '../UI';
import AcceptPaymentModal from './AcceptPaymentModal';
import { Avatar, plural } from './cashUi';

// Keeps the regular customer list within reach on a phone; search always covers everyone.
const INITIAL_ROWS = 10;

/** Taking a client's payment: only the client, their debt and the invoices that can be paid. */
export default function StaffCollectPanel() {
  const [search, setSearch] = useState('');
  const [debtors, setDebtors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<DebtorSort>('name');
  const requestId = useRef(0);
  const visible = showAll || search.trim() ? debtors : debtors.slice(0, INITIAL_ROWS);

  const load = useCallback(async (query: string, order: DebtorSort) => {
    const id = ++requestId.current;
    setIsLoading(true);
    setFailed(false);
    try {
      const result = await getDebtors(query, order);
      if (id === requestId.current) setDebtors(Array.isArray(result) ? result : []);
    } catch {
      if (id === requestId.current) setFailed(true);
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(search.trim(), sort), 300);
    return () => window.clearTimeout(timer);
  }, [search, sort, load]);

  return (
    <section aria-label="Приём оплаты" className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="relative block min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Имя, телефон или № накладной"
            aria-label="Поиск клиента для оплаты"
            // 16px on a phone: iOS zooms the page into any smaller input on focus.
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-base font-medium text-slate-800 outline-none placeholder:text-xs placeholder:font-normal placeholder:text-slate-400 focus:border-slate-400 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Очистить поиск" className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700">
              <X size={15} />
            </button>
          )}
        </label>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as DebtorSort)}
          aria-label="Сортировка должников"
          className="h-11 w-[36%] max-w-44 shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 sm:w-auto"
        >
          <option value="name">По имени</option>
          <option value="debt">Больший долг</option>
          <option value="oldest">Давние долги</option>
        </select>
      </div>

      {!failed && !isLoading && debtors.length > 0 && (
        <p className="px-1 text-[11px] text-slate-500">
          {debtors.length} {plural(debtors.length, ['клиент', 'клиента', 'клиентов'])} с долгом · нажмите на клиента, чтобы принять оплату
        </p>
      )}

      {failed && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-center">
          <p className="text-xs font-semibold text-rose-700">Не удалось загрузить список</p>
          <button type="button" onClick={() => void load(search.trim(), sort)} className="mt-2 h-9 rounded-lg bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs">Повторить</button>
        </div>
      )}
      {!failed && isLoading && debtors.length === 0 && (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      )}
      {!failed && !isLoading && debtors.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500">{search ? 'Никого не нашли' : 'Долгов по накладным нет'}</p>
      )}

      {visible.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          {visible.map((customer) => (
            <li key={customer.id}>
              {/* The whole row takes the payment: a big, plain target on a phone. */}
              <button
                type="button"
                onClick={() => setSelected(customer)}
                aria-label={`Принять оплату: ${customer.name}, долг ${formatMoney(customer.debt)}`}
                className="flex min-h-16 w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50 active:bg-slate-100"
              >
                <Avatar name={customer.name} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-snug text-slate-900">{customer.name}</span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {customer.invoices.length} {plural(customer.invoices.length, ['накладная', 'накладные', 'накладных'])}{customer.phone ? ` · ${customer.phone}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm font-black tabular-nums text-rose-600">{formatMoney(customer.debt)}</span>
                  <span className="block text-[10px] font-semibold text-emerald-700">Принять</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {visible.length < debtors.length && (
        <button type="button" onClick={() => setShowAll(true)} className="h-10 w-full rounded-xl text-xs font-semibold text-slate-600 hover:bg-white">
          Показать всех ({debtors.length})
        </button>
      )}

      {selected && (
        <AcceptPaymentModal
          customer={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            void load(search.trim(), sort);
          }}
        />
      )}
    </section>
  );
}
