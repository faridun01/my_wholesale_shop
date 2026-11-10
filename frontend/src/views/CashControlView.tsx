import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ErrorState, LoadingState, PageHeader } from '../components/UI';
import { confirmHandover, getCashStaff, getHandovers } from '../api/cash.api';
import { toCents } from '../utils/financial';
import { formatMoney } from '../utils/format';
import { errorText, formatDateTime } from '../components/cash/cashUi';

export default function CashControlView() {
  const [pending, setPending] = useState<any[] | null>(null);
  const [confirmed, setConfirmed] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [failed, setFailed] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [open, done, balances] = await Promise.all([getHandovers('pending'), getHandovers('confirmed'), getCashStaff()]);
      setPending(open);
      setConfirmed(done.slice(0, 30));
      setStaff(balances);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener('cash-handovers-updated', load as EventListener);
    return () => window.removeEventListener('cash-handovers-updated', load as EventListener);
  }, [load]);

  const confirm = async (handover: any) => {
    setConfirmingId(handover.id);
    try {
      await confirmHandover(handover.id);
      toast.success(`Приём ${formatMoney(handover.amount)} от ${handover.user.username} подтверждён`);
      window.dispatchEvent(new Event('cash-handovers-updated'));
    } catch (error) {
      toast.error(errorText(error, 'Не удалось подтвердить'));
      await load();
    } finally {
      setConfirmingId(null);
    }
  };

  const withCash = staff.filter((row) => toCents(row.onHand) > 0);

  return (
    <div className="app-page-shell min-h-full font-sans">
      <div className="min-h-screen space-y-3.5 sm:space-y-4 lg:rounded-[28px] lg:bg-[#f4f5fb] lg:p-5">
        <PageHeader title="Контроль кассы" description="Пересчитайте деньги, которые передал сотрудник, и подтвердите приём" />

        {failed ? (
          <ErrorState action={<button type="button" onClick={() => void load()} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Повторить</button>} />
        ) : !pending ? (
          <LoadingState />
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-bold text-slate-900">Ждут подтверждения ({pending.length})</h2>
              {pending.length === 0 && (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500">Новых передач кассы нет</p>
              )}
              {pending.map((handover) => (
                <div key={handover.id} className="rounded-2xl border border-amber-200 bg-white p-3.5 shadow-2xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{handover.user.username}</p>
                      <p className="text-[11px] text-slate-500">{formatDateTime(handover.createdAt)} · оплат: {handover.items.length}</p>
                    </div>
                    <span className="shrink-0 font-mono text-lg font-black text-slate-900">{formatMoney(handover.amount)}</span>
                  </div>
                  <details className="mt-2 text-[11px] text-slate-600">
                    <summary className="cursor-pointer font-semibold">От каких клиентов</summary>
                    <ul className="mt-1.5 space-y-1">
                      {handover.items.map((item: any) => (
                        <li key={item.paymentId} className="flex justify-between gap-3">
                          <span className="truncate">{item.customer || 'Клиент'}{item.invoiceId ? ` · накл. №${item.invoiceId}` : ''}</span>
                          <span className="shrink-0 font-mono font-bold">{formatMoney(item.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                  <button
                    type="button"
                    onClick={() => void confirm(handover)}
                    disabled={confirmingId === handover.id}
                    className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    {confirmingId === handover.id ? 'Сохраняем...' : 'Подтвердить приём'}
                  </button>
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

            {confirmed.length > 0 && (
              <section className="space-y-1.5">
                <h2 className="px-1 text-xs font-bold text-slate-900">Подтверждённые</h2>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
                  {confirmed.map((handover) => (
                    <li key={handover.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900">{handover.user.username}</p>
                        <p className="text-[11px] text-slate-500">
                          {formatDateTime(handover.confirmedAt)} · подтвердил {handover.confirmedBy?.username || 'администратор'}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-black text-emerald-700">{formatMoney(handover.amount)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
