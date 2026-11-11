import { useState } from 'react';
import { clsx } from 'clsx';
import { Banknote } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../UI';
import { acceptPayment } from '../../api/cash.api';
import { formatMoney, parseMoneyInput } from '../../utils/format';
import { addMoney, toCents } from '../../utils/financial';
import { errorText, formatDateTime } from './cashUi';

export default function AcceptPaymentModal({ customer, onClose, onDone }: { customer: any; onClose: () => void; onDone: () => void }) {
  const [invoiceId, setInvoiceId] = useState<number | null>(customer.invoices.length === 1 ? customer.invoices[0].id : null);
  const invoice = customer.invoices.find((item: any) => item.id === invoiceId);
  const [amount, setAmount] = useState(invoice ? String(invoice.remaining) : '');
  const [isSaving, setIsSaving] = useState(false);

  const parsed = parseMoneyInput(amount);
  const problem = !invoice
    ? 'Выберите накладную'
    : parsed === null || parsed <= 0
      ? 'Введите полученную сумму'
      : toCents(parsed) > toCents(invoice.remaining)
        ? `Больше остатка по накладной (${formatMoney(invoice.remaining)})`
        : null;

  const confirm = async () => {
    if (problem || !invoice || parsed === null) return;
    setIsSaving(true);
    try {
      await acceptPayment({ invoice_id: invoice.id, customer_id: customer.id, amount: parsed });
      toast.success(`Оплата ${formatMoney(parsed)} принята`);
      onDone();
    } catch (error) {
      toast.error(errorText(error, 'Не удалось принять оплату'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Принять оплату"
      subtitle={`${customer.name} · долг ${formatMoney(customer.debt)}`}
      footer={
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={Boolean(problem) || isSaving}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          <Banknote size={16} aria-hidden="true" />
          {isSaving ? 'Сохраняем...' : !problem && parsed !== null ? `Принять ${formatMoney(parsed)}` : 'Подтвердить оплату'}
        </button>
      }
    >
      <p className="text-xs font-semibold text-slate-700">
        {customer.invoices.length > 1 ? '1. Выберите накладную' : 'Накладная'}
      </p>
      <div className="mt-1.5 space-y-1.5">
        {customer.invoices.map((item: any) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === invoiceId}
            onClick={() => {
              setInvoiceId(item.id);
              setAmount(String(item.remaining));
            }}
            className={clsx(
              'flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-left text-xs transition-colors',
              item.id === invoiceId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            <span className="min-w-0">
              <span className="block text-sm font-bold">№{item.id}</span>
              <span className={clsx('block text-[11px]', item.id === invoiceId ? 'text-slate-300' : 'text-slate-500')}>{formatDateTime(item.createdAt)}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className={clsx('block text-[10px]', item.id === invoiceId ? 'text-slate-300' : 'text-slate-500')}>остаток</span>
              <span className="block font-mono text-sm font-bold tabular-nums">{formatMoney(item.remaining)}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-end justify-between gap-2">
        <label htmlFor="accept-payment-amount" className="block text-xs font-semibold text-slate-700">
          {customer.invoices.length > 1 ? '2. Получено от клиента' : 'Получено от клиента'}
        </label>
        {invoice && (
          <button type="button" onClick={() => setAmount(String(invoice.remaining))} className="h-8 rounded-lg px-2 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">
            Весь остаток
          </button>
        )}
      </div>
      <input
        id="accept-payment-amount"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        disabled={!invoice}
        className="mt-1 h-13 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-xl font-bold tabular-nums text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 disabled:bg-slate-50"
      />
      {/* Choosing the invoice is the next step, not a mistake. */}
      {problem && <p className={clsx('mt-1.5 text-xs font-semibold', invoice ? 'text-rose-600' : 'text-slate-500')}>{problem}</p>}
      {!problem && invoice && parsed !== null && (
        <p className="mt-1.5 text-xs text-slate-600">
          {toCents(parsed) === toCents(invoice.remaining)
            ? 'Накладная будет полностью оплачена'
            : `Останется долга по накладной: ${formatMoney(addMoney(invoice.remaining, -parsed))}`}
        </p>
      )}
    </Modal>
  );
}
