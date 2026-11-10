import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, Search, Wallet } from 'lucide-react';
import { getDebtors } from '../../api/cash.api';
import { formatMoney } from '../../utils/format';
import AcceptPaymentModal from './AcceptPaymentModal';

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
  const requestId = useRef(0);
  const visible = showAll || search.trim() ? debtors : debtors.slice(0, INITIAL_ROWS);

  const load = useCallback(async (query: string) => {
    const id = ++requestId.current;
    setIsLoading(true);
    setFailed(false);
    try {
      const result = await getDebtors(query);
      if (id === requestId.current) setDebtors(Array.isArray(result) ? result : []);
    } catch {
      if (id === requestId.current) setFailed(true);
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search, load]);

  return (
    <section aria-label="Приём оплаты" className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3 shadow-2xs sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-black text-slate-900">Приём оплаты</h2>
          <p className="text-[11px] text-slate-500">Клиенты с долгом по накладным вашего склада</p>
        </div>
        <Link to="/my-cash" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
          <Wallet size={13} /> Моя касса
        </Link>
      </div>

      <label className="relative mt-3 block">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Имя, телефон или номер накладной"
          aria-label="Поиск клиента для оплаты"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-slate-400"
        />
      </label>

      <div className="mt-2 space-y-1.5">
        {failed && <p className="py-3 text-center text-xs text-rose-600">Не удалось загрузить список</p>}
        {!failed && !isLoading && debtors.length === 0 && (
          <p className="py-3 text-center text-xs text-slate-500">{search ? 'Никого не нашли' : 'Долгов по накладным нет'}</p>
        )}
        {visible.map((customer) => (
          <div key={customer.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-900">{customer.name}</p>
              <p className="text-[11px] text-slate-500">
                {customer.phone ? `${customer.phone} · ` : ''}накладных: {customer.invoices.length}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-xs font-black text-rose-600">{formatMoney(customer.debt)}</span>
              <button
                type="button"
                onClick={() => setSelected(customer)}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-bold text-white hover:bg-emerald-700"
              >
                <Banknote size={13} />
                <span>Принять оплату</span>
              </button>
            </div>
          </div>
        ))}
        {visible.length < debtors.length && (
          <button type="button" onClick={() => setShowAll(true)} className="w-full rounded-xl py-2 text-center text-[11px] font-semibold text-slate-600 hover:bg-white">
            Показать всех ({debtors.length})
          </button>
        )}
      </div>

      {selected && (
        <AcceptPaymentModal
          customer={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            void load(search.trim());
          }}
        />
      )}
    </section>
  );
}
