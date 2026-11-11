import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { ErrorState, Skeleton } from '../components/UI';
import { confirmHandover, getCashStaff, getHandovers, returnCashHandover } from '../api/cash.api';
import { useCashEvents } from '../api/cashEvents';
import { addMoney, toCents } from '../utils/financial';
import { formatMoney } from '../utils/format';
import {
  Avatar, CashHero, FilterChips, HandoverStatus, ListToolbar, SectionTitle,
  byAmountDesc, byDateDesc, errorText, formatDateTime, matches, paymentsCount, plural,
} from '../components/cash/cashUi';

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

/** A month, and one of its days or (day: null) the whole month. */
type Period = { month: string; day: number | null };

const pad = (n: number) => String(n).padStart(2, '0');
// Calendar days in the browser's zone, the same days the server cuts the period by.
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const monthParts = (month: string) => month.split('-').map(Number) as [number, number];
const daysInMonth = (month: string) => { const [y, m] = monthParts(month); return new Date(y, m, 0).getDate(); };
const shiftMonth = (month: string, delta: number) => { const [y, m] = monthParts(month); return monthKey(new Date(y, m - 1 + delta, 1)); };
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const monthName = (month: string) => {
  const [y, m] = monthParts(month);
  return new Date(y, m - 1, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(/\s*г\.$/, '');
};
const todayPeriod = (): Period => ({ month: monthKey(new Date()), day: new Date().getDate() });
const isTodayPeriod = (period: Period) => period.month === monthKey(new Date()) && period.day === new Date().getDate();
const monthRange = (month: string) => ({ from: `${month}-01`, to: `${month}-${pad(daysInMonth(month))}` });
/** "сегодня" / "за 9 ноября" / "за ноябрь 2026"; capitalised to start a sentence. */
const periodLabel = (period: Period, capitalised = false) => {
  const [y, m] = monthParts(period.month);
  const text = period.day === null
    ? `за ${monthName(period.month)}`
    : isTodayPeriod(period) ? 'сегодня' : `за ${new Date(y, m - 1, period.day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
  return capitalised ? capitalise(text) : text;
};
// The day a handover counts for: when it was confirmed, or when it was returned.
const handoverDay = (handover: any) => dayKey(new Date(handover.status === 'confirmed' ? handover.confirmedAt : handover.returnedAt));

/**
 * Month switcher with a strip of its days: a day with receipts is marked, the chosen day
 * scrolls into view. Future days are not offered.
 */
function PeriodPicker({ period, onChange, dayTotals }: { period: Period; onChange: (period: Period) => void; dayTotals: Map<number, number> }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const isCurrentMonth = period.month === monthKey(now);
  const [y, m] = monthParts(period.month);
  const lastDay = isCurrentMonth ? now.getDate() : daysInMonth(period.month);
  const days = Array.from({ length: lastDay }, (_, i) => i + 1);

  useEffect(() => {
    const chosen = stripRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (chosen && stripRef.current) stripRef.current.scrollLeft = chosen.offsetLeft - stripRef.current.clientWidth / 2 + chosen.clientWidth / 2;
  }, [period.month, period.day]);

  const chip = (active: boolean) => clsx(
    'flex h-14 shrink-0 flex-col items-center justify-center rounded-xl text-center transition-colors',
    active ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  );
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-2xs">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onChange({ month: shiftMonth(period.month, -1), day: null })} aria-label="Предыдущий месяц" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-bold text-slate-900" aria-live="polite">{capitalise(monthName(period.month))}</p>
        <button type="button" onClick={() => onChange({ month: shiftMonth(period.month, 1), day: null })} disabled={isCurrentMonth} aria-label="Следующий месяц" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 disabled:opacity-30">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        {!isTodayPeriod(period) && (
          <button type="button" onClick={() => onChange(todayPeriod())} className="ml-1 h-9 shrink-0 rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200">
            Сегодня
          </button>
        )}
      </div>
      <div ref={stripRef} className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="День">
        {/* Pinned to the left edge: the strip scrolls to the chosen day, this stays in reach. */}
        <div className="sticky left-0 z-10 shrink-0 bg-white pr-1.5 shadow-[6px_0_8px_-6px_rgba(15,23,42,0.18)]">
          <button type="button" aria-pressed={period.day === null} onClick={() => onChange({ month: period.month, day: null })} className={clsx(chip(period.day === null), 'w-16 px-1 text-[11px] font-semibold leading-tight')}>
            Весь<br />месяц
          </button>
        </div>
        {days.map((day) => {
          const date = new Date(y, m - 1, day);
          const total = dayTotals.get(day) || 0;
          const active = period.day === day;
          return (
            <button
              key={day}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ month: period.month, day })}
              aria-label={`${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}${total ? `, принято ${formatMoney(total / 100)}` : ''}`}
              title={total ? `Принято ${formatMoney(total / 100)}` : undefined}
              className={clsx(chip(active), 'w-11')}
            >
              <span className={clsx('text-[10px] uppercase', active ? 'text-slate-300' : date.getDay() === 0 ? 'text-rose-600' : 'text-slate-500')}>
                {date.toLocaleDateString('ru-RU', { weekday: 'short' })}
              </span>
              <span className="text-sm font-bold leading-tight">{day}</span>
              <span aria-hidden="true" className={clsx('mt-0.5 h-1.5 w-1.5 rounded-full', total ? (active ? 'bg-emerald-300' : 'bg-emerald-500') : 'bg-transparent')} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

const handoverMatches = (handover: any, query: string) =>
  matches(query, handover.user.username, handover.returnReason, ...handover.items.flatMap((item: any) => [item.customer, item.invoiceId, `№${item.invoiceId}`]));

/** Asks why the money goes back to the staff member, then returns it. */
function ReturnForm({ handover, onDone, onCancel }: { handover: any; onDone: () => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // Payments cancelled after the handover were refunded from the main cash and do not go back.
  const backAmount = addMoney(...handover.items.filter((item: any) => !item.cancelled).map((item: any) => item.amount));
  const refunded = toCents(backAmount) !== toCents(handover.amount);
  const submit = async () => {
    setIsSaving(true);
    try {
      await returnCashHandover(handover.id, reason.trim());
      toast.success(`Касса ${formatMoney(backAmount)} возвращена ${handover.user.username}`);
      onDone();
    } catch (error) {
      toast.error(errorText(error, 'Не удалось вернуть кассу'));
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <label htmlFor={`return-reason-${handover.id}`} className="block text-xs font-semibold text-slate-700">
        Причина {handover.status === 'confirmed' ? 'отмены приёма' : 'возврата'} (сотрудник её увидит)
      </label>
      <input
        id={`return-reason-${handover.id}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={300}
        autoFocus
        placeholder="Например: не хватает 100 сомони"
        className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base outline-none focus:border-slate-400 sm:text-sm"
      />
      {refunded && (
        <p className="mt-2 text-[11px] text-amber-800">
          Отдайте сотруднику {formatMoney(backAmount)}: часть оплат на {formatMoney(addMoney(handover.amount, -backAmount))} уже отменена, эти деньги выданы клиентам из кассы.
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="h-11 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-100">Не возвращать</button>
        <button type="button" onClick={() => void submit()} disabled={isSaving || !reason.trim()} className="h-11 rounded-lg bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">
          Вернуть сотруднику
        </button>
      </div>
    </div>
  );
}

function ClientsList({ items, open }: { items: any[]; open?: boolean }) {
  const list = (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.paymentId} className="flex items-baseline justify-between gap-3 text-xs">
          <span className="min-w-0 truncate text-slate-700">
            {item.customer || 'Клиент'}
            <span className="text-slate-500">{item.invoiceId ? ` · накл. №${item.invoiceId}` : ''}{item.cancelled ? ' · оплата отменена' : ''}</span>
          </span>
          <span className={clsx('shrink-0 font-mono font-bold tabular-nums', item.cancelled ? 'text-slate-400 line-through' : 'text-slate-900')}>{formatMoney(item.amount)}</span>
        </li>
      ))}
    </ul>
  );
  if (open) return <div className="mt-3 rounded-xl bg-slate-50 p-3">{list}</div>;
  return (
    <details className="group mt-3 rounded-xl bg-slate-50 text-xs">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between px-3 font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
        От каких клиентов ({items.length})
        <ChevronDown size={14} className="text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="px-3 pb-3">{list}</div>
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
  const [openHistoryId, setOpenHistoryId] = useState<number | null>(null);
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingSort, setPendingSort] = useState('old');
  const [historyTab, setHistoryTab] = useState<'confirmed' | 'returned'>('confirmed');
  const [historySearch, setHistorySearch] = useState('');
  const [historySort, setHistorySort] = useState('new');
  const [historyStaff, setHistoryStaff] = useState('');
  // Today's receipts open by default; any month can be looked up afterwards.
  const [period, setPeriod] = useState<Period>(todayPeriod);
  const [confirmedToday, setConfirmedToday] = useState<any[]>([]);

  // The whole month is loaded at once: picking a day is instant and the day strip shows
  // which days had receipts. Only a change of month reloads.
  const latestRequest = useRef(0);
  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    try {
      const range = monthRange(period.month);
      const today = dayKey(new Date());
      const isCurrentMonth = period.month === monthKey(new Date());
      // Waiting handovers are loaded on their own so none is ever cut off by the history period.
      const [waiting, confirmed, returned, balances, todayList] = await Promise.all([
        getHandovers('pending'),
        getHandovers('confirmed', range),
        getHandovers('returned', range),
        getCashStaff(),
        isCurrentMonth ? null : getHandovers('confirmed', { from: today, to: today }),
      ]);
      // Live notices can start several loads at once; an older answer must not overwrite a newer one.
      if (request !== latestRequest.current) return;
      setFailed(false);
      setPending(waiting);
      setHistory([...confirmed, ...returned]);
      setConfirmedToday(todayList ?? confirmed.filter((h: any) => handoverDay(h) === today));
      setStaff(balances);
    } catch {
      if (request === latestRequest.current) setFailed(true);
    }
  }, [period.month]);

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
  // The month's handovers narrowed to the chosen day, if one is chosen.
  const inPeriod = useMemo(() => {
    if (period.day === null) return history;
    const [y, m] = monthParts(period.month);
    const day = dayKey(new Date(y, m - 1, period.day));
    return history.filter((h) => handoverDay(h) === day);
  }, [history, period]);
  // Cents received on each day of the month, for the marks in the day strip.
  const dayTotals = useMemo(() => {
    const totals = new Map<number, number>();
    for (const h of history) {
      if (h.status !== 'confirmed') continue;
      const day = new Date(h.confirmedAt).getDate();
      totals.set(day, (totals.get(day) || 0) + toCents(h.amount));
    }
    return totals;
  }, [history]);
  const historyStaffNames = useMemo(() => [...new Set(inPeriod.map((h) => h.user.username))].sort((a, b) => a.localeCompare(b, 'ru')), [inPeriod]);
  const visibleHistory = useMemo(() => {
    const dateKey = historyTab === 'confirmed' ? 'confirmedAt' : 'returnedAt';
    return sortHandovers(
      inPeriod.filter((h) => h.status === historyTab && (!historyStaff || h.user.username === historyStaff) && handoverMatches(h, historySearch)),
      historySort,
      dateKey,
    ).slice(0, 100);
  }, [inPeriod, historyTab, historyStaff, historySearch, historySort]);
  const withCash = [...staff].filter((row) => toCents(row.onHand) > 0).sort((a, b) => toCents(b.onHand) - toCents(a.onHand));
  const pendingTotal = addMoney(...(pending || []).map((h) => h.amount));
  const onHandTotal = addMoney(...withCash.map((row) => row.onHand));
  const todayTotal = addMoney(...confirmedToday.map((h) => h.amount));
  const periodConfirmed = inPeriod.filter((h) => h.status === 'confirmed');
  const periodTotal = addMoney(...periodConfirmed.map((h) => h.amount));

  // Shown only while someone actually holds cash.
  const staffOnHand = withCash.length > 0 && (
    <section className="space-y-2" aria-label="На руках у сотрудников">
      <SectionTitle title="На руках у сотрудников" count={withCash.length} />
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        {withCash.map((row) => (
          <li key={row.id} className="flex min-h-14 items-center gap-3 px-3.5 py-2.5">
            <Avatar name={row.username} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{row.username}</p>
              <p className="text-[11px] text-slate-500">ещё не передал{toCents(row.pendingAmount) > 0 ? ` · ждёт ${formatMoney(row.pendingAmount)}` : ''}</p>
            </div>
            <span className="shrink-0 font-mono text-sm font-black tabular-nums text-amber-700">{formatMoney(row.onHand)}</span>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="app-page-shell min-h-full font-sans">
      <div className="min-h-screen space-y-4 lg:rounded-[28px] lg:bg-[#f4f5fb] lg:p-5">
        {/* The menu already names the page; the title stays for screen readers only. */}
        <h1 className="sr-only">Контроль кассы</h1>

        {failed && !pending ? (
          <ErrorState action={<button type="button" onClick={() => void load()} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Повторить</button>} />
        ) : !pending ? (
          <div className="space-y-3">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
        ) : (
          <div className={clsx('grid gap-4 lg:items-start', staffOnHand && 'lg:grid-cols-[minmax(0,1fr)_340px]')}>
            <div className="min-w-0 space-y-4">
              {/* What needs the administrator now; when nothing waits, what came in today. */}
              {pending.length > 0 ? (
                <CashHero
                  label="Ждут подтверждения"
                  value={pendingTotal}
                  hint={`${pending.length} ${plural(pending.length, ['передача', 'передачи', 'передач'])} от сотрудников`}
                  stats={[
                    { label: 'У сотрудников', value: formatMoney(onHandTotal) },
                    { label: 'Принято сегодня', value: formatMoney(todayTotal) },
                  ]}
                />
              ) : (
                <CashHero
                  label="Принято сегодня"
                  value={todayTotal}
                  hint={confirmedToday.length ? `${confirmedToday.length} ${plural(confirmedToday.length, ['передача', 'передачи', 'передач'])} подтверждено` : 'Сегодня приёмов ещё не было'}
                  stats={[{ label: 'У сотрудников на руках', value: formatMoney(onHandTotal) }]}
                />
              )}

              {pending.length > 0 && (
              <section className="space-y-2">
                <SectionTitle title="Ждут подтверждения" count={pending.length} />
                {pending.length > 1 && (
                  <ListToolbar search={pendingSearch} onSearch={setPendingSearch} placeholder="Сотрудник, клиент или №" sort={pendingSort} onSort={setPendingSort} options={PENDING_SORTS} />
                )}
                {visiblePending.length === 0 && <p className="px-1 text-xs text-slate-500">Ничего не найдено</p>}
                {visiblePending.map((handover) => (
                  <article key={handover.id} className="rounded-2xl border border-amber-200 bg-white p-3.5 shadow-2xs" aria-label={`Передача ${handover.user.username}`}>
                    <div className="flex items-center gap-3">
                      <Avatar name={handover.user.username} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">{handover.user.username}</p>
                        <p className="text-[11px] text-slate-500">{formatDateTime(handover.createdAt)} · {paymentsCount(handover.items.length)}</p>
                      </div>
                      <span className="shrink-0 font-mono text-lg font-black tabular-nums text-slate-900">{formatMoney(handover.amount)}</span>
                    </div>
                    <ClientsList items={handover.items} />
                    {returningId === handover.id ? (
                      <ReturnForm handover={handover} onDone={afterReturn} onCancel={() => setReturningId(null)} />
                    ) : (
                      <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                        <button
                          type="button"
                          onClick={() => setReturningId(handover.id)}
                          className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <RotateCcw size={14} aria-hidden="true" /> Вернуть
                        </button>
                        <button
                          type="button"
                          onClick={() => void confirm(handover)}
                          disabled={confirmingId === handover.id}
                          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle2 size={16} aria-hidden="true" />
                          {confirmingId === handover.id ? 'Сохраняем...' : 'Подтвердить приём'}
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </section>
              )}

              {staffOnHand && <div className="lg:hidden">{staffOnHand}</div>}

              <section className="space-y-2" aria-label="Приём денег">
                  <SectionTitle title="Приём денег" />
                  <PeriodPicker period={period} onChange={setPeriod} dayTotals={dayTotals} />
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Принято {periodLabel(period)}</p>
                      <p className="text-[11px] text-slate-600">
                        {periodConfirmed.length ? `${periodConfirmed.length} ${plural(periodConfirmed.length, ['передача', 'передачи', 'передач'])}` : 'Приёмов не было'}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-lg font-black tabular-nums text-emerald-800">{formatMoney(periodTotal)}</span>
                  </div>
                  {/* An empty period says so in the summary above; filters for nothing would be noise. */}
                  {inPeriod.length > 0 && (<>
                  <FilterChips<'confirmed' | 'returned'>
                    value={historyTab}
                    onChange={setHistoryTab}
                    options={[
                      { value: 'confirmed', label: 'Подтверждённые', count: periodConfirmed.length },
                      { value: 'returned', label: 'Возвращённые', count: inPeriod.length - periodConfirmed.length },
                    ]}
                  />
                  <ListToolbar search={historySearch} onSearch={setHistorySearch} placeholder="Сотрудник, клиент, №" sort={historySort} onSort={setHistorySort} options={HISTORY_SORTS}>
                    {historyStaffNames.length > 1 && (
                      <select value={historyStaff} onChange={(event) => setHistoryStaff(event.target.value)} aria-label="Сотрудник" className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 sm:flex-none">
                        <option value="">Все сотрудники</option>
                        {historyStaffNames.map((name) => <option key={name} value={name}>{name}</option>)}
                      </select>
                    )}
                  </ListToolbar>
                  {visibleHistory.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500">
                      {historySearch || historyStaff ? 'Ничего не найдено' : historyTab === 'confirmed' ? `${periodLabel(period, true)} приёмов не было` : `${periodLabel(period, true)} возвратов не было`}
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
                      {visibleHistory.map((handover) => {
                        const isOpen = openHistoryId === handover.id;
                        return (
                          <li key={handover.id}>
                            {/* The whole row opens the details; actions live inside, out of the way of scrolling. */}
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              onClick={() => { setOpenHistoryId(isOpen ? null : handover.id); setReturningId(null); }}
                              className="flex min-h-15 w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50"
                            >
                              <Avatar name={handover.user.username} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-slate-900">{handover.user.username}</span>
                                <span className="block truncate text-[11px] text-slate-500">
                                  {handover.status === 'confirmed'
                                    ? `${formatDateTime(handover.confirmedAt)} · ${paymentsCount(handover.items.length)}`
                                    : `${formatDateTime(handover.returnedAt)} · ${handover.returnReason}`}
                                </span>
                              </span>
                              <span className={clsx('shrink-0 font-mono text-sm font-black tabular-nums', handover.status === 'confirmed' ? 'text-emerald-700' : 'text-slate-400 line-through')}>{formatMoney(handover.amount)}</span>
                              <ChevronDown size={16} className={clsx('shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
                            </button>
                            {isOpen && (
                              <div className="px-3.5 pb-3.5">
                                <HandoverStatus status={handover.status} />
                                <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[11px]">
                                  <dt className="text-slate-500">Передал</dt>
                                  <dd className="text-slate-800">{formatDateTime(handover.createdAt)}</dd>
                                  {handover.status === 'confirmed' ? (
                                    <>
                                      <dt className="text-slate-500">Подтвердил</dt>
                                      <dd className="text-slate-800">{handover.confirmedBy?.username || 'администратор'}, {formatDateTime(handover.confirmedAt)}</dd>
                                    </>
                                  ) : (
                                    <>
                                      <dt className="text-slate-500">Вернул</dt>
                                      <dd className="text-slate-800">{handover.returnedBy?.username || '—'}, {formatDateTime(handover.returnedAt)}</dd>
                                      <dt className="text-slate-500">Причина</dt>
                                      <dd className="text-slate-800">{handover.returnReason}</dd>
                                    </>
                                  )}
                                </dl>
                                <ClientsList items={handover.items} open />
                                {handover.status === 'confirmed' && (returningId === handover.id ? (
                                  <ReturnForm handover={handover} onDone={afterReturn} onCancel={() => setReturningId(null)} />
                                ) : (
                                  <button type="button" onClick={() => setReturningId(handover.id)} className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
                                    <RotateCcw size={14} aria-hidden="true" /> Отменить приём
                                  </button>
                                ))}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  </>)}
              </section>
            </div>

            {staffOnHand && <aside className="hidden lg:block lg:sticky lg:top-4">{staffOnHand}</aside>}
          </div>
        )}
      </div>
    </div>
  );
}
