import { useEffect, useState } from 'react';
import client from '../../api/client';
import { formatMoney } from '../../utils/format';
export default function FinancialReconciliationPanel({ start, end, warehouseId }: { start: string; end: string; warehouseId: string }) {
  const [data, setData] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true; setData(null); setFailed(false);
    client.get('/reports/reconciliation', { params: { start, end, warehouse_id: warehouseId || undefined } }).then(r => { if (active) setData(r.data); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [start, end, warehouseId]);
  const fields = { salesBeforeReturns: 'Продажи до возвратов', returnedValue: 'Стоимость возвратов товаров', currentNet: 'Текущая выручка после возвратов', grossCollections: 'Всего поступило по оплатам', moneyRefunded: 'Фактически возвращено денег', paymentReversals: 'Сторно платежей', returnPaymentAdjustments: 'Старые корректировки оплат по возвратам', netCollections: 'Чистые поступления без товарных возвратов', debtReduction: 'Долг уменьшен возвратами', customerCredit: 'Кредит покупателям', outstandingDebt: 'Остаток долга' };
  return <details className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
    <summary className="cursor-pointer font-bold">Сверка продаж, оплат и возвратов</summary>
    <p className="mt-2 text-xs text-slate-500">Накладные, созданные в выбранном периоде, с учётом всех последующих оплат и возвратов. Дата признания продаж не изменена.</p>
    {failed ? <p role="alert" className="mt-3 text-rose-700">Не удалось загрузить сверку</p> : !data ? <p className="mt-3">Загрузка…</p> : <>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">{Object.entries(fields).map(([key, label]) => <div key={key} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-mono font-semibold">{data[key] == null ? 'Неизвестно для старых записей' : formatMoney(data[key])}</dd></div>)}</dl>
      {!!data.unknownHistoricalReturns && <p className="mt-3 text-xs text-amber-800">Старых возвратов без разделения денег и долга: {data.unknownHistoricalReturns}. Недостающие данные не восстанавливались.</p>}
      {!!data.reconciliationExceptions && <p role="alert" className="mt-3 text-rose-700">Требуют сверки: {data.reconciliationExceptions} накладных.</p>}
    </>}
  </details>;
}
