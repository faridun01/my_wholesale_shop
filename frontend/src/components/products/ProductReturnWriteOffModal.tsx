import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

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
  return (
    <AnimatePresence>
      {isOpen && transaction && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-90 flex items-end justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:items-center sm:p-4"
        >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-t-4xl bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] sm:rounded-4xl"
      >
        <div className="border-b border-emerald-100 bg-[linear-gradient(135deg,#eefcf6_0%,#ffffff_58%,#f3fbff_100%)] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">
                <RotateCcw size={12} />
                <span>Возврат списания</span>
              </div>
              <h3 className="mt-3 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">Вернуть товар на склад</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">Используйте это, если списание было введено ошибочно.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/70 bg-white/80 p-2 text-slate-400 transition-all hover:border-slate-200 hover:text-slate-600"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Списание</p>
              <p className="mt-2 text-sm font-bold text-slate-900">{new Date(transaction.createdAt).toLocaleString('ru-RU')}</p>
            </div>
            <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Доступно вернуть</p>
              <p className="mt-2 text-sm font-black text-emerald-900">{Math.abs(Number(transaction.qtyChange || 0))}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
            <label className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Количество возврата</label>
            <input
              type="number"
              min="1"
              step="1"
              required
              value={returnWriteOffData.quantity}
              onChange={(event) => setReturnWriteOffData((prev) => ({ ...prev, quantity: event.target.value.replace(/[^\d]/g, '') }))}
              className="mt-3 w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-2xl font-black text-slate-900 outline-none"
            />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <label className="block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Причина возврата</label>
            <input
              type="text"
              value={returnWriteOffData.reason}
              onChange={(event) => setReturnWriteOffData((prev) => ({ ...prev, reason: event.target.value }))}
              className="mt-3 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none"
              placeholder="Ошибка ввода"
            />
          </div>

          <div className="rounded-[22px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Возврат восстановит остаток на складе и приход по этому списанию.
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl px-3 py-2.5 text-sm font-bold text-slate-500 transition-all hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-2xl bg-[linear-gradient(135deg,#10b981_0%,#0f766e_100%)] px-6 py-3 text-sm font-black text-white shadow-[0_16px_34px_rgba(16,185,129,0.24)] transition-all hover:-translate-y-px hover:brightness-105"
            >
              Вернуть на склад
            </button>
          </div>
        </form>
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
