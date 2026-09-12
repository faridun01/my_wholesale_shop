import React from 'react';
import { RotateCcw, X, AlertCircle, Minus, Plus, FileText, CheckCircle2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { clsx } from 'clsx';

interface ProductReturnWriteOffModalProps {
  isOpen: boolean;
  transaction: any;
  returnWriteOffData: {
    quantity: string;
    reason: string;
  };
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  setReturnWriteOffData: React.Dispatch<
    React.SetStateAction<{
      quantity: string;
      reason: string;
    }>
  >;
}

export default function ProductReturnWriteOffModal({
  isOpen,
  transaction,
  returnWriteOffData,
  onClose,
  onSubmit,
  setReturnWriteOffData,
}: ProductReturnWriteOffModalProps) {
  if (!isOpen || !transaction) return null;

  const maxAvailable = Math.max(0, Math.floor(Math.abs(Number(transaction?.qtyChange || 0))));
  const quantityNum = Math.max(0, Math.floor(Number(returnWriteOffData.quantity || 0)));
  const isOverMax = quantityNum > maxAvailable;

  const handleDecrement = () => {
    const next = Math.max(1, quantityNum - 1);
    setReturnWriteOffData((prev) => ({ ...prev, quantity: String(next) }));
  };

  const handleIncrement = () => {
    const next = Math.min(maxAvailable, quantityNum + 1);
    setReturnWriteOffData((prev) => ({ ...prev, quantity: String(next) }));
  };

  const handleSetAll = () => {
    setReturnWriteOffData((prev) => ({ ...prev, quantity: String(maxAvailable) }));
  };

  return (
    <AnimatePresence>
      {isOpen && transaction && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-100 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[92vh] sm:max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[26px] border border-slate-200/90 bg-white shadow-2xl sm:rounded-3xl"
          >
            {/* Mobile Pull Handle */}
            <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
              <div className="h-1.25 w-12 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25 ring-4 ring-emerald-50">
                  <RotateCcw size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-tight">
                      Возврат списания
                    </h3>
                    <span className="hidden sm:inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-200/60">
                      Восстановление на склад
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">
                    Списание от {new Date(transaction.createdAt).toLocaleString('ru-RU')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3.5 sm:p-5 space-y-3.5 bg-slate-50/50">
              {/* Context Information Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Исходная причина
                  </span>
                  <p className="text-xs font-bold text-slate-800 capitalize truncate">
                    {transaction.reason || 'Списание'}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/70 p-3 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block mb-1">
                    Доступно вернуть
                  </span>
                  <p className="font-mono text-sm font-black text-emerald-900">
                    {maxAvailable} шт
                  </p>
                </div>
              </div>

              {/* Quantity Section with Stepper */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                    Количество для возврата <span className="text-emerald-600">*</span>
                  </label>
                  {isOverMax && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-600 border border-rose-200">
                      <AlertCircle size={11} />
                      Превышает максимум
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={quantityNum <= 1}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 shadow-xs transition-all hover:bg-slate-100 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Уменьшить"
                  >
                    <Minus size={18} />
                  </button>

                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      value={returnWriteOffData.quantity}
                      onChange={(event) => {
                        const val = event.target.value.replace(/[^\d]/g, '');
                        setReturnWriteOffData((prev) => ({ ...prev, quantity: val }));
                      }}
                      className={clsx(
                        'h-11 w-full rounded-xl border bg-slate-50/50 px-3 text-center font-mono text-xl sm:text-2xl font-black text-slate-900 outline-none transition-all shadow-2xs focus:bg-white',
                        isOverMax
                          ? 'border-rose-400 text-rose-600 focus:ring-2 focus:ring-rose-500/20'
                          : 'border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'
                      )}
                      placeholder="1"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase">
                      шт
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={quantityNum >= maxAvailable}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 shadow-xs transition-all hover:bg-slate-100 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Увеличить"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex gap-1.5">
                    {[1, 5].filter((v) => v <= maxAvailable).map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setReturnWriteOffData((prev) => ({ ...prev, quantity: String(val) }))}
                        className="h-7.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-900 hover:text-white transition-all active:scale-95"
                      >
                        {val} шт
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleSetAll}
                    className="h-7.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-black text-emerald-800 shadow-2xs hover:bg-emerald-600 hover:text-white transition-all active:scale-95"
                  >
                    Все ({maxAvailable} шт)
                  </button>
                </div>
              </div>

              {/* Reason for return */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 space-y-2.5 shadow-xs">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 block">
                  Причина возврата
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <FileText size={14} />
                  </div>
                  <input
                    type="text"
                    value={returnWriteOffData.reason}
                    onChange={(event) => setReturnWriteOffData((prev) => ({ ...prev, reason: event.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 shadow-2xs"
                    placeholder="Ошибка ввода или пересчет"
                  />
                </div>
              </div>

              {/* Help Notice */}
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3 text-xs text-emerald-800">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>Остаток на складе будет восстановлен, а запись скорректирована.</span>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-white px-4 py-3 sm:px-6 sm:py-3.5 -mx-3.5 -mb-3.5 sm:-mx-5 sm:-mb-5 mt-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition-all"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isOverMax || quantityNum <= 0}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw size={14} />
                  <span>Вернуть на склад</span>
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
