import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { ErrorState, LoadingState, PageHeader } from '../components/UI';
import { confirmHandover, getCashStaff, getHandovers, returnCashHandover } from '../api/cash.api';
import { useCashEvents } from '../api/cashEvents';
import { toCents } from '../utils/financial';
import { formatMoney } from '../utils/format';
import { FilterChips, ListToolbar, byAmountDesc, byDateDesc, errorText, formatDateTime, matches } from '../components/cash/cashUi';

const PENDING_SORTS = [
  { value: 'old', label: 'Сначала давние' },
  { value: 'new', label: 'Сначала новые' },
  { value: 'amount_desc', label: 'Сумма: больше' },
  { value: 'staff', label: 'Сотрудник: А–Я' },
];
const HISTORY_SORTS = [
  { value: 'new', label: 'Сначала новые' },
  { value: 'old', label: 'Сначала старые' },
  { value: 'amount_desc', label: 'Сумма: больше' },
  { value: 'amount_asc', label: 'Сумма: меньше' },
];

const sortHandovers = (list: any[], sort: string, dateKey: string) => [...list].sort((a, b) => {
  switch (sort) {
    case 'old': return -byDateDesc(a, b, dateKey);
    case 'amount_desc': return byAmountDesc(a, b) || byDateDesc(a, b, dateKey);
    case 'amount_asc': return -byAmountDesc(a, b) || byDateDesc(a, b, dateKey);
    case 'staff': return a.user.username.localeCompare(b.user.username, 'ru') || -byDateDesc(a, b, dateKey);
    default: return byDateDesc(a, b, dateKey);
  }
});

const handoverMatches = (handover: any, query: string) =>
  matches(query, handover.user.username, handover.returnReason, ...handover.items.flatMap((item: any) => [item.customer, item.invoiceId, `№${item.invoiceId}`]));

/** Asks why the money goes back to the staff member, then returns it. */
function ReturnForm({ handover, onDone, onCancel }: { handover: any; onDone: () => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const submit = async () => {
    setIsSaving(true);
    try {
      await returnCashHandover(handover.id, reason.trim());
      toast.success(`Касса ${formatMoney(handover.amount)} возвращена ${handover.user.username}`);
      onDone();
    } catch (error) {
      toast.error(errorText(error, 'Не удалось вернуть кассу'));
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
      <label htmlFor={`return-reason-${handover.id}`} className="block text-[11px] font-semibold text-slate-700">
        Причина {handover.status === 'confirmed' ? 'отмены приёма' : 'возврата'} (сотрудник её увидит)
      </label>
      <input
        id={`return-reason-${handover.id}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={300}
        autoFocus
        placeholder="Например: не хватает 100 сомони"
        className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-slate-400"
      />
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onCancel} className="h-9 flex-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-100">Не возвращать</button>
        <button type="button" onClick={() => void submit()} disabled={isSaving || !reason.trim()} className="h-9 flex-1 rounded-lg bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">
          Вернуть сотруднику
        </button>
      </div>
    </div>
  );
}

function ClientsList({ items }: { items: any[] }) {
  return (
    <details className="mt-2 text-[11px] text-slate-600">
      <summary className="cursor-pointer font-semibold">От каких клиентов ({items.length})</summary>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item.paymentId} className="flex justify-between gap-3">
            <span className="truncate">{item.customer || 'Клиент'}{item.invoiceId ? ` · накл. №${item.invoiceId}` : ''}</span>
            <span className="shrink-0 font-mono font-bold">{formatMoney(item.amount)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function CashControlView() {
  const [pending, setPending] = useState<any[] | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [failed, setFailed] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [returningId, setReturningId] = useState<number | null>(null);
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingSort, setPendingSort] = useState('old');
  const [historyTab, setHistoryTab] = useState<'confirmed' | 'returned'>('confirmed');
  const [historySearch, setHistorySearch] = useState('');
  const [historySort, setHistorySort] = useState('new');
  const [historyStaff, setHistoryStaff] = useState('');

  const latestRequest = useRef(0);
  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    try {
      // Waiting handovers are loaded on their own so none is ever cut off by the history limit.
      const [waiting, recent, balances] = await Promise.all([getHandovers('pending'), getHandovers(), getCashStaff()]);
      // Live notices can start several loads at once; an older answer must not overwrite a newer one.
      if (request !== latestRequest.current) return;
      setFailed(false);
      setPending(waiting);
      setHistory(recent.filter((h: any) => h.status !== 'pending'));
      setStaff(balances);
    } catch {
      if (request === latestRequest.current) setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener('focus', refresh);
    window.addEventListener('cash-handovers-updated', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('cash-handovers-updated', refresh);
    };
  }, [load]);

  // A handover sent by a staff member appears here at once.
  useCashEvents(() => void load());

  const confirm = async (handover: any) => {
    setConfirmingId(handover.id);
    try {
      await confirmHandover(handover.id);
      toast.success(`Приём ${formatMoney(handover.amount)} от ${handover.user.username} подтверждён`);
    } catch (error) {
      toast.error(errorText(error, 'Не удалось подтвердить'));
    } finally {
      setConfirmingId(null);
      window.dispatchEvent(new Event('cash-handovers-updated'));
    }
  };

  const afterReturn = () => {
    setReturningId(null);
    window.dispatchEvent(new Event('cash-handovers-updated'));
  };

  const visiblePending = useMemo(
    () => sortHandovers((pending || []).filter((h) => handoverMatches(h, pendingSearch)), pendingSort, 'createdAt'),
    [pending, pendingSearch, pendingSort],
  );
  const historyStaffNames = useMemo(() => [...new Set(history.map((h) => h.user.username))].sort((a, b) => a.localeCompare(b, 'ru')), [history]);
  const visibleHistory = useMemo(() => {
    const dateKey = historyTab === 'confirmed' ? 'confirmedAt' : 'returnedAt';
    return sortHandovers(
      history.filter((h) => h.status === historyTab && (!historyStaff || h.user.username === historyStaff) && handoverMatches(h, historySearch)),
      historySort,
      dateKey,
    ).slice(0, 100);
  }, [history, historyTab, historyStaff, historySearch, historySort]);
  const withCash = [...staff].filter((row) => toCents(row.onHand) > 0).sort((a, b) => toCents(b.onHand) - toCents(a.onHand));

  return (
    <div className="app-page-shell min-h-full font-sans">
      <div className="min-h-screen space-y-3.5 sm:space-y-4 lg:rounded-[28px] lg:bg-[#f4f5fb] lg:p-5">
        <PageHeader title="Контроль кассы" description="Пересчитайте деньги, которые передал сотрудник, и подтвердите приём" />

        {failed && !pending ? (
          <ErrorState action={<button type="button" onClick={() => void load()} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Повторить</button>} />
        ) : !pending ? (
          <LoadingState />
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-bold text-slate-900">Ждут подтверждения ({pending.length})</h2>
              {pending.length > 1 && (
                <ListToolbar search={pendingSearch} onSearch={setPendingSearch} placeholder="Сотрудник, клиент или № накладной" sort={pendingSort} onSort={setPendingSort} options={PENDING_SORTS} />
              )}
              {pending.length === 0 && (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500">Новых передач кассы нет. Они появятся здесь сразу после отправки.</p>
              )}
              {pending.length > 0 && visiblePending.length === 0 && <p className="px-1 text-xs text-slate-500">Ничего не найдено</p>}
              {visiblePending.map((handover) => (
                <div key={handover.id} className="rounded-2xl border border-amber-200 bg-white p-3.5 shadow-2xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{handover.user.username}</p>
                      <p className="text-[11px] text-slate-500">{formatDateTime(handover.createdAt)}</p>
                    </div>
                    <span className="shrink-0 font-mono text-lg font-black text-slate-900">{formatMoney(handover.amount)}</span>
                  </div>
                  <ClientsList items={handover.items} />
                  {returningId === handover.id ? (
                    <ReturnForm handover={handover} onDone={afterReturn} onCancel={() => setReturningId(null)} />
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setReturningId(handover.id)}
                        className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        <RotateCcw size={14} /> Вернуть
                      </button>
                      <button
                        type="button"
                        onClick={() => void confirm(handover)}
                        disabled={confirmingId === handover.id}
                        className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle2 size={16} />
                        {confirmingId === handover.id ? 'Сохраняем...' : 'Подтвердить приём'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </section>

            {withCash.length > 0 && (
              <section className="space-y-1.5">
                <h2 className="px-1 text-xs font-bold text-slate-900">Ещё не передали</h2>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
                  {withCash.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs">
                      <span className="truncate font-bold text-slate-900">{row.username}</span>
                      <span className="shrink-0 font-mono font-black text-amber-700">{formatMoney(row.onHand)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {history.length > 0 && (
              <section className="space-y-2">
                <h2 className="px-1 text-xs font-bold text-slate-900">История передач</h2>
                <FilterChips<'confirmed' | 'returned'>
                  value={historyTab}
                  onChange={setHistoryTab}
                  options={[
                    { value: 'confirmed', label: 'Подтверждённые', count: history.filter((h) => h.status === 'confirmed').length },
                    { value: 'returned', label: 'Возвращённые', count: history.filter((h) => h.status === 'returned').length },
                  ]}
                />
                <ListToolbar search={historySearch} onSearch={setHistorySearch} placeholder="Сотрудник, клиент, № накладной или причина" sort={historySort} onSort={setHistorySort} options={HISTORY_SORTS}>
                  {historyStaffNames.length > 1 && (
                    <select value={historyStaff} onChange={(event) => setHistoryStaff(event.target.value)} aria-label="Сотрудник" className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 sm:flex-none">
                      <option value="">Все сотрудники</option>
                      {historyStaffNames.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  )}
                </ListToolbar>
                {visibleHistory.length === 0 ? (
                  <p className="px-1 text-xs text-slate-500">Ничего не найдено</p>
                ) : (
                  <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
                    {visibleHistory.map((handover) => (
                      <li key={handover.id} className="px-3.5 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-slate-900">{handover.user.username}</p>
                            <p className="text-[11px] text-slate-500">
                              {handover.status === 'confirmed'
                                ? `${formatDateTime(handover.confirmedAt)} · подтвердил ${handover.confirmedBy?.username || 'администратор'}`
                                : `${formatDateTime(handover.returnedAt)} · вернул ${handover.returnedBy?.username || '—'}: ${handover.returnReason}`}
                            </p>
                          </div>
                          <span className={`shrink-0 font-mono text-sm font-black ${handover.status === 'confirmed' ? 'text-emerald-700' : 'text-slate-400 line-through'}`}>{formatMoney(handover.amount)}</span>
                        </div>
                        <ClientsList items={handover.items} />
                        {handover.status === 'confirmed' && (returningId === handover.id ? (
                          <ReturnForm handover={handover} onDone={afterReturn} onCancel={() => setReturningId(null)} />
                        ) : (
                          <button type="button" onClick={() => setReturningId(handover.id)} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                            <RotateCcw size={12} /> Отменить приём
                          </button>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
