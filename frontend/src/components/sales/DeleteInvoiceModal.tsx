import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Trash2,
  X,
  Loader2,
  User,
  Building2,
  Calendar,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { formatMoney, formatCount } from '../../utils/format';
import {
  getEffectiveStatus,
  getInvoiceNetAmount,
  getInvoiceBalance,
  getInvoiceAppliedPaidAmount,
  hasInvoiceReturns,
} from '../../utils/salesViewUtils';

interface DeleteInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: any | null;
  isDeleting: boolean;
  error: string | null;
  needsForceDelete: boolean;
  onConfirm: (force?: boolean) => Promise<void>;
}

export default function DeleteInvoiceModal({
  isOpen,
  onClose,
  invoice,
  isDeleting,
  error,
  needsForceDelete,
  onConfirm,
}: DeleteInvoiceModalProps) {
  const [forceDelete, setForceDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForceDelete(needsForceDelete);
    } else {
      setForceDelete(false);
    }
  }, [isOpen, needsForceDelete]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!invoice) return null;

  const invoiceId = invoice.id ?? invoice.invoiceNumber ?? '—';
  const customerName = invoice.customer_name || invoice.customer?.name || 'Розничный покупатель';
  const warehouseName = invoice.warehouse?.name || invoice.warehouse_name || 'Основной склад';
  const createdAt = invoice.createdAt
    ? new Date(invoice.createdAt).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const netAmount = getInvoiceNetAmount(invoice);
  const paidAmount = getInvoiceAppliedPaidAmount(invoice);
  const balance = getInvoiceBalance(invoice);
  const effectiveStatus = getEffectiveStatus(invoice);
  const hasReturns = hasInvoiceReturns(invoice);
  const itemCount = Array.isArray(invoice.items) ? invoice.items.length : (invoice.itemCount ?? null);

  const hasFinancialCommitments = paidAmount > 0.005 || hasReturns || needsForceDelete;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDeleting) return;
    onConfirm(forceDelete || needsForceDelete);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!isDeleting) onClose();
          }}
          className="fixed inset-0 z-100 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: '100%', opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.6 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-2xl"
          >
            {/* Mobile Drag Pill */}
            <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
              <div className="h-1.5 w-10 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 shadow-2xs">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    Удалить накладную №{invoiceId}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                    Отмена продажи и возврат товаров на склад
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:scale-95 transition-all disabled:opacity-50"
                aria-label="Закрыть"
              >
                <X size={19} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto px-4 py-3.5 sm:px-6 sm:py-4 space-y-3.5">
              {/* Invoice Summary Card */}
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-3 sm:p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 truncate">
                      <User size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{customerName}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Building2 size={12} className="text-slate-400" />
                        {warehouseName}
                      </span>
                      {createdAt && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          {createdAt}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      effectiveStatus === 'paid'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : effectiveStatus === 'partial'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {effectiveStatus === 'paid'
                      ? 'Оплачено'
                      : effectiveStatus === 'partial'
                        ? 'Частично'
                        : 'Не оплачено'}
                  </span>
                </div>

                {/* Numbers Grid */}
                <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-200/80 bg-white p-2 text-center shadow-2xs">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Сумма</p>
                    <p className="mt-0.5 font-mono text-xs sm:text-sm font-bold text-slate-900">
                      {formatMoney(netAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Оплачено</p>
                    <p className="mt-0.5 font-mono text-xs sm:text-sm font-bold text-emerald-600">
                      {formatMoney(paidAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      {balance > 0.005 ? 'Долг' : 'Остаток'}
                    </p>
                    <p
                      className={`mt-0.5 font-mono text-xs sm:text-sm font-bold ${
                        balance > 0.005 ? 'text-rose-600' : 'text-slate-600'
                      }`}
                    >
                      {formatMoney(balance)}
                    </p>
                  </div>
                </div>

                {typeof itemCount === 'number' && itemCount > 0 && (
                  <p className="text-right text-[10px] text-slate-400 font-medium">
                    Позиций в накладной: <span className="text-slate-600 font-semibold">{formatCount(itemCount)}</span>
                  </p>
                )}
              </div>

              {/* Consequence Warning */}
              <div className="rounded-2xl border border-rose-200/80 bg-rose-50/70 p-3 sm:p-3.5 flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-950 leading-relaxed space-y-1">
                  <p className="font-semibold text-rose-900">
                    Это действие нельзя будет отменить
                  </p>
                  <p className="text-[11px] text-rose-800/90 leading-snug">
                    Все списанные товары из накладной будут автоматически возвращены на склад, а накладная будет аннулирована.
                  </p>
                </div>
              </div>

              {/* Financial commitments / force delete alert */}
              {(hasFinancialCommitments || forceDelete) && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-3 sm:p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2 text-xs font-bold text-amber-900 leading-snug">
                    <ShieldAlert size={17} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>Внимание: по накладной зафиксированы платежи или возвраты</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    {paidAmount > 0.005
                      ? `По этой накладной внесены оплаты на сумму ${formatMoney(paidAmount)}. При принудительном удалении полученные платежи не будут удалены автоматически.`
                      : 'По этой накладной производились возвраты. Требуется принудительный режим.'}
                  </p>

                  <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={forceDelete}
                      onChange={(e) => setForceDelete(e.target.checked)}
                      className="h-4 w-4 rounded border-amber-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-xs font-bold text-rose-800">
                      Удалить принудительно (force delete)
                    </span>
                  </label>
                </div>
              )}

              {/* Error Callout */}
              {error && (
                <div className="rounded-2xl border border-rose-300 bg-rose-100/80 p-3 text-xs text-rose-900 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">{error}</p>
                    {(error.includes('оплата') || error.includes('возврат')) && !forceDelete && (
                      <button
                        type="button"
                        onClick={() => setForceDelete(true)}
                        className="underline text-[11px] text-rose-700 font-bold hover:text-rose-900"
                      >
                        Включить принудительное удаление и повторить
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <form onSubmit={handleSubmit} className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isDeleting}
                  className="flex-1 h-11 sm:h-12 rounded-xl sm:rounded-2xl border border-slate-200 bg-white px-4 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isDeleting || (needsForceDelete && !forceDelete)}
                  className="flex-[1.4] sm:flex-1 h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-rose-600 px-4 text-xs sm:text-sm font-semibold text-white shadow-sm shadow-rose-200 hover:bg-rose-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Удаление...</span>
                    </>
                  ) : forceDelete ? (
                    <>
                      <Trash2 size={16} />
                      <span>Удалить принудительно</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>Удалить накладную</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
