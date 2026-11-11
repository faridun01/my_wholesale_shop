import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3, RotateCcw, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { ErrorState, PageHeader, Skeleton } from '../components/UI';
import { getMyCash, returnCashHandover, sendCashHandover } from '../api/cash.api';
import { useCashEvents } from '../api/cashEvents';
import { addMoney, toCents } from '../utils/financial';
import { formatMoney } from '../utils/format';
import {
  CashHero, EmptyNote, FilterChips, HandoverStatus, ListToolbar, PaymentRow, SectionTitle, StickyActionBar,
  byAmountDesc, byDateDesc, errorText, formatDateTime, matches, paymentState, paymentsCount,
} from '../components/cash/cashUi';

type StateFilter = 'all' | 'on_hand' | 'pending' | 'confirmed' | 'cancelled';
type HistoryTab = 'payments' | 'handovers';

const SORTS = [
  { value: 'new', label: 'Сначала новые' },
  { value: 'old', label: 'Сначала старые' },
  { value: 'amount_desc', label: 'Сумма: больше' },
  { value: 'amount_asc', label: 'Сумма: меньше' },
  { value: 'customer', label: 'Клиент: А–Я' },
];

// The send list shows this many rows before "show all", so the page never scrolls inside itself.
const ON_HAND_PREVIEW = 6;
const HISTORY_PAGE = 20;

const sortOperations = (list: any[], sort: string) => [...list].sort((a, b) => {
  switch (sort) {
    case 'old': return -byDateDesc(a, b);
    case 'amount_desc': return byAmountDesc(a, b) || byDateDesc(a, b);
    case 'amount_asc': return -byAmountDesc(a, b) || byDateDesc(a, b);
    case 'customer': return String(a.customer || '').localeCompare(String(b.customer || ''), 'ru') || byDateDesc(a, b);
    default: return byDateDesc(a, b);
  }
});

export default function MyCashView() {
  const [data, setData] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  // Everything on hand is offered for sending, except what the seller unticked.
  const [unticked, setUnticked] = useState<Set<number>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const [busyHandoverId, setBusyHandoverId] = useState<number | null>(null);
  const [showAllOnHand, setShowAllOnHand] = useState(false);
  const [historyTab, setHistoryTab] = useState<HistoryTab>('payments');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('new');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE);
  const latestRequest = useRef(0);

  // A new filter, search or order starts from the top of the list again.
  useEffect(() => setHistoryLimit(HISTORY_PAGE), [stateFilter, search, sort]);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    try {
      const result = await getMyCash();
      // Live notices can start several loads at once; an older answer must not overwrite a newer one.
      if (request !== latestRequest.current) return;
      setFailed(false);
      setData(result);
      const onHandIds = new Set<number>(result.operations.filter((op: any) => op.available).map((op: any) => op.paymentId));
      setUnticked((previous) => new Set([...previous].filter((id) => onHandIds.has(id))));
    } catch {
      if (request === latestRequest.current) setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [load]);

  // The administrator's confirmation or return shows up here at once.
  useCashEvents(() => void load());

  const onHand = useMemo(() => sortOperations((data?.operations || []).filter((op: any) => op.available), 'new'), [data]);
  const selected = useMemo(() => new Set<number>(onHand.map((op: any) => op.paymentId).filter((id: number) => !unticked.has(id))), [onHand, unticked]);
  const selectedAmount = addMoney(...onHand.filter((op: any) => selected.has(op.paymentId)).map((op: any) => op.amount));
  const allSelected = onHand.length > 0 && unticked.size === 0;
  const shownOnHand = showAllOnHand ? onHand : onHand.slice(0, ON_HAND_PREVIEW);
  const pendingHandovers = useMemo(() => (data?.handovers || []).filter((h: any) => h.status === 'pending'), [data]);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: 0, on_hand: 0, pending: 0, confirmed: 0, cancelled: 0 };
    for (const op of data?.operations || []) {
      result.all += 1;
      result[paymentState(op)] = (result[paymentState(op)] || 0) + 1;
    }
    return result;
  }, [data]);

  const visibleOperations = useMemo(() => sortOperations(
    (data?.operations || []).filter((op: any) => (stateFilter === 'all' || paymentState(op) === stateFilter) && matches(search, op.customer, op.invoiceId, `№${op.invoiceId}`)),
    sort,
  ), [data, stateFilter, search, sort]);

  const toggle = (paymentId: number) => setUnticked((previous) => {
    const next = new Set(previous);
    if (next.has(paymentId)) next.delete(paymentId);
    else next.add(paymentId);
    return next;
  });

  const send = async () => {
    const ids = onHand.filter((op: any) => selected.has(op.paymentId)).map((op: any) => op.paymentId);
    if (!ids.length) return;
    setIsSending(true);
    try {
      await sendCashHandover(ids);
      toast.success(`Передано на подтверждение: ${formatMoney(selectedAmount)}`);
    } catch (error) {
      toast.error(errorText(error, 'Не удалось передать кассу'));
    } finally {
      setIsSending(false);
      await load();
    }
  };

  const takeBack = async (handover: any) => {
    if (!window.confirm(`Отозвать передачу ${formatMoney(handover.amount)}? Деньги снова будут числиться у вас на руках, и вы сможете передать их заново.`)) return;
    setBusyHandoverId(handover.id);
    try {
      await returnCashHandover(handover.id);
      toast.success('Передача отозвана, деньги снова у вас');
    } catch (error) {
      toast.error(errorText(error, 'Не удалось отозвать передачу'));
    } finally {
      setBusyHandoverId(null);
      await load();
    }
  };

  if (failed && !data) return <div className="app-page-shell"><ErrorState action={<button type="button" onClick={() => void load()} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Повторить</button>} /></div>;

  return (
    <div className="app-page-shell min-h-full font-sans">
      <div className="mx-auto min-h-screen max-w-3xl space-y-4 lg:rounded-[28px] lg:bg-[#f4f5fb] lg:p-5">
        <PageHeader title="Моя касса" description="Деньги, принятые от клиентов, и их сдача администратору" />

        {!data ? (
          <div className="space-y-3">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        ) : (
          <>
            <CashHero
              label="На руках"
              value={data.summary.onHand}
              hint={toCents(data.summary.onHand) > 0 ? 'Ещё не передано администратору' : 'Все принятые деньги переданы'}
              stats={[
                { label: 'Ждёт', value: formatMoney(data.summary.pendingAmount) },
                { label: 'Сдано', value: formatMoney(data.summary.confirmed) },
                { label: 'Сегодня', value: formatMoney(data.summary.today) },
              ]}
            />

            {/* What is waiting for the administrator comes first: the seller may need to take it back. */}
            {pendingHandovers.map((handover: any) => (
              <section key={handover.id} className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5" aria-label="Передача ждёт подтверждения">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"><Clock3 size={18} aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">Ждёт подтверждения администратора</p>
                    <p className="text-[11px] text-slate-600">{formatDateTime(handover.createdAt)} · {paymentsCount(handover.items.length)}</p>
                  </div>
                  <span className="shrink-0 font-mono text-base font-black tabular-nums text-slate-900">{formatMoney(handover.amount)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void takeBack(handover)}
                  disabled={busyHandoverId === handover.id}
                  className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-white text-xs font-semibold text-slate-700 hover:bg-amber-50 disabled:opacity-50"
                >
                  <RotateCcw size={14} aria-hidden="true" /> Отозвать, чтобы изменить
                </button>
              </section>
            ))}

            <section className="space-y-2" aria-label="Передать кассу">
              <SectionTitle
                title="Передать администратору"
                count={onHand.length || undefined}
                action={onHand.length > 0 && (
                  <button type="button" onClick={() => setUnticked(allSelected ? new Set(onHand.map((op: any) => op.paymentId)) : new Set())} className="h-8 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-white hover:text-slate-900">
                    {allSelected ? 'Снять все' : 'Выбрать все'}
                  </button>
                )}
              />
              {onHand.length === 0 ? (
                <EmptyNote icon={<CheckCircle2 size={18} />} title="Все деньги переданы" text="Новые оплаты появятся здесь, как только вы их примете." />
              ) : (
                <>
                  <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
                    {shownOnHand.map((op: any) => <PaymentRow key={op.paymentId} op={op} selectable showState={false} selected={selected.has(op.paymentId)} onToggle={() => toggle(op.paymentId)} />)}
                  </ul>
                  {onHand.length > shownOnHand.length && (
                    <button type="button" onClick={() => setShowAllOnHand(true)} className="h-10 w-full rounded-xl text-xs font-semibold text-slate-600 hover:bg-white">
                      Показать все ({onHand.length})
                    </button>
                  )}
                  <StickyActionBar>
                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={isSending || selected.size === 0}
                      className="flex h-13 w-full items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-sm font-bold">
                        <Send size={16} aria-hidden="true" />
                        <span className="truncate">{isSending ? 'Отправка...' : <>Передать кассу<span className="sr-only"> на подтверждение</span></>}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-mono text-sm font-black tabular-nums">{formatMoney(selectedAmount)}</span>
                        <span className="block text-[10px] font-medium text-slate-300">{selected.size} из {onHand.length}</span>
                      </span>
                    </button>
                  </StickyActionBar>
                </>
              )}
            </section>

            <section className="space-y-2">
              <SectionTitle title="История" />
              <FilterChips<HistoryTab>
                value={historyTab}
                onChange={setHistoryTab}
                options={[
                  { value: 'payments', label: 'Оплаты', count: counts.all },
                  { value: 'handovers', label: 'Передачи', count: data.handovers.length },
                ]}
              />

              {historyTab === 'payments' ? (
                <>
                  <ListToolbar search={search} onSearch={setSearch} placeholder="Клиент или № накладной" sort={sort} onSort={setSort} options={SORTS} />
                  <FilterChips<StateFilter>
                    value={stateFilter}
                    onChange={setStateFilter}
                    options={[
                      { value: 'all', label: 'Все', count: counts.all },
                      { value: 'on_hand', label: 'На руках', count: counts.on_hand },
                      { value: 'pending', label: 'Ждут', count: counts.pending },
                      { value: 'confirmed', label: 'Сдано', count: counts.confirmed },
                      { value: 'cancelled', label: 'Отменены', count: counts.cancelled },
                    ]}
                  />
                  {visibleOperations.length ? (
                    <>
                      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
                        {visibleOperations.slice(0, historyLimit).map((op: any) => <PaymentRow key={op.paymentId} op={op} />)}
                      </ul>
                      {visibleOperations.length > historyLimit && (
                        <button type="button" onClick={() => setHistoryLimit((limit) => limit + HISTORY_PAGE)} className="h-10 w-full rounded-xl text-xs font-semibold text-slate-600 hover:bg-white">
                          Показать ещё ({visibleOperations.length - historyLimit})
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500">
                      {data.operations.length ? 'Ничего не найдено' : 'За последние 30 дней оплат нет'}
                    </p>
                  )}
                  <p className="px-1 text-[11px] text-slate-500">Показаны оплаты за 30 дней и все деньги, которые ещё у вас на руках.</p>
                </>
              ) : data.handovers.length ? (
                <ul aria-label="Передачи кассы" className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
                  {data.handovers.map((handover: any) => (
                    <li key={handover.id} className="px-3.5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{formatDateTime(handover.createdAt)}</p>
                          <p className="text-[11px] text-slate-500">
                            {paymentsCount(handover.items.length)}
                            {handover.status === 'confirmed' && ` · подтвердил ${handover.confirmedBy?.username || 'администратор'}, ${formatDateTime(handover.confirmedAt)}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className={`font-mono text-sm font-black tabular-nums ${handover.status === 'returned' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{formatMoney(handover.amount)}</span>
                          <HandoverStatus status={handover.status} />
                        </div>
                      </div>
                      {handover.status === 'returned' && (
                        <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
                          Возвращено{handover.returnedBy?.username ? ` (${handover.returnedBy.username})` : ''}, {formatDateTime(handover.returnedAt)}: {handover.returnReason}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500">Передач пока не было</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
