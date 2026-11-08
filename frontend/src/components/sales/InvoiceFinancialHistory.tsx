import { formatCount, formatMoney } from '../../utils/format';
import { addMoney } from '../../utils/financial';
import { returnReceiptInvoice } from '../../utils/print/returnReceipt';
import toast from 'react-hot-toast';

const methods: Record<string, string> = { cash: 'Наличные', card: 'Карта', transfer: 'Перевод', mixed: 'Несколько способов' };
async function document(invoice: any, pdf = false) {
  try {
    if (pdf) { const { downloadSalesInvoicePdf } = await import('../../utils/print/salesInvoicePdf'); await downloadSalesInvoicePdf(invoice); }
    else { const { printSalesInvoice } = await import('../../utils/print/salesInvoicePrint'); printSalesInvoice({ invoice }); }
  } catch { toast.error('Не удалось подготовить документ'); }
}
export default function InvoiceFinancialHistory({ invoice }: { invoice: any }) {
  const original = invoice.originalInvoice;
  const debt = invoice.financialSummary?.debtAmount ?? Math.max(0, addMoney(invoice.netAmount, -Number(invoice.paidAmount)));
  return <section className="space-y-3" aria-label="Финансовая история накладной">
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm">
      <h3 className="font-bold">Текущая накладная — оставшиеся товары</h3>
      <p className="mt-1">Итого: {formatMoney(invoice.netAmount)} · Внесено всего: {formatMoney(invoice.grossPaidAmount ?? invoice.paidAmount)} · Долг: {formatMoney(debt)}</p>
      {Number(invoice.moneyRefundedAmount || 0) > 0 && <p className="mt-1 text-xs text-slate-600">Деньгами возвращено: {formatMoney(invoice.moneyRefundedAmount)}. Эта сумма показана отдельно от внесённых оплат.</p>}
      {Number(invoice.returnPaymentAdjustments || 0) > 0 && <p className="mt-1 text-xs text-amber-800">В старой истории есть корректировка оплаты из-за возврата товара: {formatMoney(invoice.returnPaymentAdjustments)}. Она не считается фактически выданными деньгами.</p>}
      <p className="mt-1 text-xs text-slate-600">Возвращено товаров на: {formatMoney(invoice.returnedAmount)}. Возвраты уже учтены в текущем итоге накладной.</p>
    </div>
    {original && <details className="rounded-2xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer font-bold text-sm">Исходная накладная · {formatMoney(original.netAmount)}</summary>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><thead><tr><th className="text-left">Товар</th><th>Кол-во</th><th>Цена</th><th>Скидка %</th><th>Сумма</th></tr></thead>
        <tbody>{original.items?.map((i: any) => <tr key={i.id} className="border-t border-slate-100"><td className="py-2">{i.productNameSnapshot || i.product_name || i.product?.name}</td><td className="text-center">{formatCount(i.quantity)}</td><td className="text-right">{formatMoney(i.sellingPrice)}</td><td className="text-center">{i.discount || 0}</td><td className="text-right">{formatMoney(i.totalPrice)}</td></tr>)}</tbody></table></div>
      <p className="mt-2 text-xs">Подытог: {formatMoney(original.totalAmount)} · Скидка накладной: {original.discount}% · Исходный итог: {formatMoney(original.netAmount)}</p>
      <h4 className="mt-3 font-semibold text-xs">Первоначальные платежи и последующие поступления</h4>
      {(original.payments || []).map((p: any) => <p key={p.id} className="mt-1 text-xs">{new Date(p.createdAt).toLocaleString('ru-RU')} · {methods[p.method] || p.method} · {formatMoney(p.amount)} · {p.staff_name}</p>)}
      <div className="mt-3 flex gap-4 text-xs"><button type="button" onClick={() => void document({ ...invoice, ...original, returnedAmount: 0 })}>Печать исходной</button><button type="button" onClick={() => void document({ ...invoice, ...original, returnedAmount: 0 }, true)}>PDF исходной</button></div>
    </details>}
    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
      <h3 className="font-bold text-sm">История возвратов</h3>
      {!(invoice.returns?.length) && <p className="mt-2 text-xs text-slate-500">Возвратов нет</p>}
      {[...(invoice.returns || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((r: any) => <details key={r.id} className="mt-3 rounded-xl border border-amber-100 bg-white p-3 text-xs">
        <summary className="cursor-pointer font-semibold">№{r.id} · {new Date(r.createdAt).toLocaleString('ru-RU')} · {formatMoney(r.totalValue)}</summary>
        <p className="mt-2">Деньгами возвращено: {r.refundedAmount == null ? 'неизвестно для старой записи' : formatMoney(r.refundedAmount)} · Долг уменьшен: {r.debtReduction == null ? 'неизвестно' : formatMoney(r.debtReduction)}</p>
        <p className="mt-1">Сотрудник: {r.staff_name} · Причина: {r.reason || '—'}</p>
        {r.items?.length ? <ul className="mt-2 space-y-2">{r.items.map((line: any) => <li key={line.id}>{line.invoiceItem?.productNameSnapshot || `Строка #${line.invoiceItemId}`} · {formatCount(line.quantity)} × {formatMoney(line.sellingPrice)} · Скидка товара {line.itemDiscount}% · Скидка накладной {formatMoney(line.allocatedOrderDiscount)} · Возврат {formatMoney(line.totalValue)}</li>)}</ul> : <p className="mt-2 text-amber-800">Старая запись: состав возврата не сохранён. Данные не восстанавливались предположениями.</p>}
        {(r.payments || []).map((p: any) => <p key={p.id} className="mt-1">Фактическая выплата {methods[p.method] || p.method}: {formatMoney(Math.abs(Number(p.amount)))}</p>)}
        {!!r.items?.length && <div className="mt-3 flex gap-4"><button type="button" onClick={() => void document(returnReceiptInvoice(invoice, r))}>Печать возврата</button><button type="button" onClick={() => void document(returnReceiptInvoice(invoice, r), true)}>PDF возврата</button></div>}
      </details>)}
    </div>
  </section>;
}
