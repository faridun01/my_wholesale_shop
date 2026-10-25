import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { m } from 'motion/react';
import toast from 'react-hot-toast';
import { Banknote, ExternalLink, Loader2, Receipt, X } from 'lucide-react';
import client from '../../api/client';
import { formatMoney, toFixedNumber } from '../../utils/format';
import { formatProductName } from '../../utils/productName';
import {
  SALES_PAYMENT_EPSILON,
  getInvoiceAppliedPaidAmount,
  getInvoiceBalance,
  getInvoiceItemQuantityParts,
  getInvoiceNetAmount,
} from '../../utils/salesViewUtils';
import { StaffInvoiceStatusBadge } from './StaffInvoicesList';

type StaffInvoiceDetailsProps = {
  invoiceId: number;
  /** Only admins may record payments (the API enforces the same rule). */
  canRecordPayment: boolean;
  onClose: () => void;
  onPaid: () => void;
};

export default function StaffInvoiceDetails({ invoiceId, canRecordPayment, onClose, onPaid }: StaffInvoiceDetailsProps) {
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  // Kept in a ref so an inline `onClose` from the parent doesn't re-trigger the load.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const loadInvoice = useCallback(async () => {
    try {
      const res = await client.get(`/invoices/${invoiceId}`);
      setInvoice(res.data);
      setPaymentAmount(String(toFixedNumber(Math.max(0, getInvoiceBalance(res.data)))));
    } catch {
      toast.error('Не удалось загрузить накладную');
      onCloseRef.current();
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    setIsLoading(true);
    void loadInvoice();
  }, [loadInvoice]);

  const balance = invoice ? Math.max(0, getInvoiceBalance(invoice)) : 0;
  const canPay = canRecordPayment && invoice && !invoice.cancelled && balance > SALES_PAYMENT_EPSILON;

  const handlePayment = async () => {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Сумма оплаты должна быть больше нуля');
      return;
    }
    if (amount > balance + SALES_PAYMENT_EPSILON) {
      toast.error(`Сумма оплаты не может превышать долг (${formatMoney(balance)})`);
      return;
    }

    setIsPaying(true);
    try {
      await client.post('/payments', {
        customer_id: invoice.customerId,
        invoice_id: invoice.id,
        amount,
        method: 'cash',
        idempotency_key: crypto.randomUUID(),
      });
      toast.success('Оплата принята');
      await loadInvoice();
      onPaid();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Ошибка при приёме оплаты');
    } finally {
      setIsPaying(false);
    }
  };

  const payments: any[] = Array.isArray(invoice?.payments) ? invoice.payments : [];

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 backdrop-blur-xs sm:items-center sm:p-4"
    >
      <m.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border-slate-200/90 bg-white shadow-2xl sm:rounded-3xl sm:border"
      >
        <div className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-slate-300 sm:hidden" />
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Receipt size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-base font-black text-slate-900">Накладная №{invoiceId}</p>
              {invoice && (
                <p className="truncate text-[11px] text-slate-400">{new Date(invoice.createdAt).toLocaleString('ru-RU')}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <X size={17} />
          </button>
        </div>

        {isLoading || !invoice ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs font-semibold text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            Загрузка...
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-xs">
                <p className="truncate font-bold text-slate-900">{invoice.customer_name}</p>
                <p className="truncate text-slate-400">
                  {[invoice.customer_phone, invoice.warehouse?.name].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <StaffInvoiceStatusBadge invoice={invoice} />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 px-2 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Сумма</p>
                <p className="mt-0.5 truncate font-mono text-xs font-black text-slate-900">{formatMoney(getInvoiceNetAmount(invoice))}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 px-2 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Оплачено</p>
                <p className="mt-0.5 truncate font-mono text-xs font-black text-emerald-700">{formatMoney(getInvoiceAppliedPaidAmount(invoice))}</p>
              </div>
              <div className={balance > 0 ? 'rounded-xl bg-rose-50 px-2 py-2' : 'rounded-xl bg-slate-50 px-2 py-2'}>
                <p className={balance > 0 ? 'text-[10px] font-bold uppercase tracking-wider text-rose-500' : 'text-[10px] font-bold uppercase tracking-wider text-slate-400'}>Долг</p>
                <p className={balance > 0 ? 'mt-0.5 truncate font-mono text-xs font-black text-rose-600' : 'mt-0.5 truncate font-mono text-xs font-black text-slate-400'}>
                  {formatMoney(balance)}
                </p>
              </div>
            </div>

            {canPay && (
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3">
                <p className="mb-2 text-xs font-bold text-emerald-800">Принять оплату</p>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="h-10 w-full rounded-xl border border-emerald-200 bg-white pl-3 pr-10 font-mono text-sm font-black text-slate-900 outline-none focus:border-emerald-500"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold text-slate-400">TJS</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handlePayment()}
                    disabled={isPaying}
                    className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-black text-white shadow-xs transition-all hover:bg-emerald-500 active:scale-95 disabled:opacity-60"
                  >
                    {isPaying ? <Loader2 size={15} className="animate-spin" /> : <Banknote size={15} />}
                    <span>Оплатить</span>
                  </button>
                </div>
                {Number(paymentAmount) < balance - SALES_PAYMENT_EPSILON && (
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(String(toFixedNumber(balance)))}
                    className="mt-1.5 text-[11px] font-semibold text-emerald-700 underline-offset-2 hover:underline"
                  >
                    Вся сумма долга ({formatMoney(balance)})
                  </button>
                )}
              </div>
            )}

            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Товары ({invoice.items?.length || 0})</p>
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80">
                {(invoice.items || []).map((item: any) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="break-words whitespace-normal font-semibold text-slate-800 [overflow-wrap:anywhere]">
                        {formatProductName(item.product_name)}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {getInvoiceItemQuantityParts(item).primary} × {formatMoney(item.sellingPrice)}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono font-bold text-slate-900 tabular-nums">{formatMoney(item.totalPrice)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Оплаты ({payments.length})</p>
              {payments.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400">Оплат пока нет</p>
              ) : (
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80">
                  {payments.map((payment) => {
                    const amount = Number(payment.amount || 0);
                    return (
                      <div key={payment.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-500">{new Date(payment.createdAt).toLocaleString('ru-RU')}</p>
                          <p className="truncate text-[11px] font-semibold text-slate-600">{payment.staff_name}</p>
                        </div>
                        <span className={amount < 0 ? 'font-mono font-bold text-rose-600' : 'font-mono font-bold text-emerald-700'}>
                          {amount < 0 ? '−' : '+'}
                          {formatMoney(Math.abs(amount))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate('/sales', { state: { openInvoiceId: invoiceId } })}
              className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <ExternalLink size={14} />
              Открыть в истории продаж (печать, возврат, правка)
            </button>
          </div>
        )}
      </m.div>
    </m.div>
  );
}
