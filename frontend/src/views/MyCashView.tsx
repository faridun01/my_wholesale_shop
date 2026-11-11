import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { ErrorState, PageHeader, Skeleton } from '../components/UI';
import { getMyCash, returnCashHandover, sendCashHandover } from '../api/cash.api';
import { useCashEvents } from '../api/cashEvents';
import { addMoney, toCents } from '../utils/financial';
import { formatMoney } from '../utils/format';
import {
  FilterChips, HandoverStatus, ListToolbar, MoneyTile, PaymentRow,
  byAmountDesc, byDateDesc, errorText, formatDateTime, matches, paymentState,
} from '../components/cash/cashUi';

type StateFilter = 'all' | 'on_hand' | 'pending' | 'confirmed' | 'cancelled';

const SORTS = [
  { value: 'new', label: 'Сначала новые' },
  { value: 'old', label: 'Сначала старые' },
  { value: 'amount_desc', label: 'Сумма: больше' },
  { value: 'amount_asc', label: 'Сумма: меньше' },
  { value: 'customer', label: 'Клиент: А–Я' },
];

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
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('new');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const latestRequest = useRef(0);

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
      <div className="min-h-screen space-y-3.5 sm:space-y-4 lg:rounded-[28px] lg:bg-[#f4f5fb] lg:p-5">
        <PageHeader title="Моя касса" description="Деньги, которые вы приняли от клиентов, и их передача администратору" />

        {!data ? (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-19.5 rounded-2xl" />)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <MoneyTile label="Принято сегодня" value={data.summary.today} />
              <MoneyTile label="На руках" value={data.summary.onHand} tone={toCents(data.summary.onHand) > 0 ? 'warn' : 'default'} hint="ещё не передано" />
              <MoneyTile label="Ждёт подтверждения" value={data.summary.pendingAmount} hint={data.summary.pendingCount ? `передач: ${data.summary.pendingCount}` : undefined} />
              <MoneyTile label="Сдано" value={data.summary.confirmed} tone="good" hint="администратору, всего" />
            </div>

            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs" aria-label="Передать кассу">
              {onHand.length === 0 ? (
                <p className="px-4 py-4 text-center text-xs text-slate-500">Все принятые деньги переданы администратору</p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-2.5">
                    <p className="text-xs font-bold text-slate-900">На руках: {onHand.length} {onHand.length === 1 ? 'оплата' : 'оплат(ы)'}</p>
                    <button type="button" onClick={() => setUnticked(allSelected ? new Set(onHand.map((op: any) => op.paymentId)) : new Set())} className="text-[11px] font-semibold text-slate-600 hover:text-slate-900">
                      {allSelected ? 'Снять все' : 'Выбрать все'}
                    </button>
                  </div>
                  <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                    {onHand.map((op: any) => <PaymentRow key={op.paymentId} op={op} selectable selected={selected.has(op.paymentId)} onToggle={() => toggle(op.paymentId)} />)}
                  </ul>
                  <div className="border-t border-slate-100 p-3">
                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={isSending || selected.size === 0}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send size={16} />
                      {isSending ? 'Отправка...' : `Передать кассу на подтверждение · ${formatMoney(selectedAmount)}`}
                    </button>
                  </div>
                </>
              )}
            </section>

            {data.handovers.length > 0 && (
              <section className="space-y-1.5">
                <h2 className="px-1 text-xs font-bold text-slate-900">Передачи кассы</h2>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
                  {data.handovers.map((handover: any) => (
                    <li key={handover.id} className="px-3.5 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900">{formatDateTime(handover.createdAt)} · оплат: {handover.items.length}</p>
                          <p className="text-[11px] text-slate-500">
                            {handover.status === 'confirmed'
                              ? `Подтвердил ${handover.confirmedBy?.username || 'администратор'}, ${formatDateTime(handover.confirmedAt)}`
                              : handover.status === 'returned'
                                ? `Возвращено ${handover.returnedBy?.username ? `(${handover.returnedBy.username})` : ''}, ${formatDateTime(handover.returnedAt)}: ${handover.returnReason}`
                                : 'Администратор ещё не подтвердил'}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className={`font-mono text-sm font-black ${handover.status === 'returned' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{formatMoney(handover.amount)}</span>
                          <HandoverStatus status={handover.status} />
                        </div>
                      </div>
                      {handover.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => void takeBack(handover)}
                          disabled={busyHandoverId === handover.id}
                          className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <RotateCcw size={12} /> Отозвать, чтобы изменить
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="space-y-2">
              <h2 className="px-1 text-xs font-bold text-slate-900">Мои оплаты</h2>
              <ListToolbar search={search} onSearch={setSearch} placeholder="Клиент или номер накладной" sort={sort} onSort={setSort} options={SORTS} />
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
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
                  {visibleOperations.map((op: any) => <PaymentRow key={op.paymentId} op={op} />)}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500">
                  {data.operations.length ? 'Ничего не найдено' : 'За последние 30 дней оплат нет'}
                </p>
              )}
              <p className="px-1 text-[11px] text-slate-400">Показаны оплаты за 30 дней и все деньги, которые ещё у вас на руках.</p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
