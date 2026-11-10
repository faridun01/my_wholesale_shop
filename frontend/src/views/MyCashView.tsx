import { useCallback, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { ErrorState, PageHeader, Skeleton } from '../components/UI';
import { getMyCash, sendCashHandover } from '../api/cash.api';
import { addMoney, toCents } from '../utils/financial';
import { formatMoney } from '../utils/format';
import { HandoverStatus, MoneyTile, PaymentRow, errorText, formatDateTime } from '../components/cash/cashUi';

export default function MyCashView() {
  const [data, setData] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try { setData(await getMyCash()); } catch { setFailed(true); }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onHand = (data?.operations || []).filter((op: any) => op.available);
  const onHandAmount = addMoney(...onHand.map((op: any) => op.amount));

  const send = async () => {
    setIsSending(true);
    try {
      await sendCashHandover(onHand.map((op: any) => op.paymentId));
      toast.success('Касса передана на подтверждение администратору');
    } catch (error) {
      toast.error(errorText(error, 'Не удалось передать кассу'));
    } finally {
      setIsSending(false);
      await load();
    }
  };

  if (failed) return <div className="app-page-shell"><ErrorState action={<button type="button" onClick={() => void load()} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Повторить</button>} /></div>;

  return (
    <div className="app-page-shell min-h-full font-sans">
      <div className="min-h-screen space-y-3.5 sm:space-y-4 lg:rounded-[28px] lg:bg-[#f4f5fb] lg:p-5">
        <PageHeader title="Моя касса" description="Деньги, которые вы приняли от клиентов, и их передача администратору" />

        {!data ? (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[78px] rounded-2xl" />)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <MoneyTile label="Принято сегодня" value={data.summary.today} />
              <MoneyTile label="На руках" value={data.summary.onHand} tone={toCents(data.summary.onHand) > 0 ? 'warn' : 'default'} hint="ещё не передано" />
              <MoneyTile label="Ждёт подтверждения" value={data.summary.pendingAmount} />
              <MoneyTile label="Сдано администратору" value={data.summary.confirmed} tone="good" />
            </div>

            <button
              type="button"
              onClick={() => void send()}
              disabled={isSending || onHand.length === 0}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} />
              {isSending ? 'Отправка...' : onHand.length ? `Передать кассу на подтверждение · ${formatMoney(onHandAmount)}` : 'Передавать нечего'}
            </button>

            {data.handovers.length > 0 && (
              <section className="space-y-1.5">
                <h2 className="px-1 text-xs font-bold text-slate-900">Передачи кассы</h2>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
                  {data.handovers.map((handover: any) => (
                    <li key={handover.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900">{formatDateTime(handover.createdAt)} · оплат: {handover.items.length}</p>
                        <p className="text-[11px] text-slate-500">
                          {handover.status === 'confirmed' ? `Подтвердил ${handover.confirmedBy?.username || 'администратор'}, ${formatDateTime(handover.confirmedAt)}` : 'Администратор ещё не подтвердил'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-mono text-sm font-black text-slate-900">{formatMoney(handover.amount)}</span>
                        <HandoverStatus status={handover.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="space-y-1.5">
              <h2 className="px-1 text-xs font-bold text-slate-900">Мои оплаты</h2>
              {data.operations.length ? (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
                  {data.operations.map((op: any) => <PaymentRow key={op.paymentId} op={op} />)}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500">За последние 30 дней оплат нет</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
