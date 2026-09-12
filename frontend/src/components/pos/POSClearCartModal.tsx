import React, { useEffect } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { Trash2, X, ShoppingCart, Banknote, User } from 'lucide-react';
import { formatMoney } from '../../utils/format';

interface POSClearCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  cartCount: number;
  totalAmount: number;
  customerName?: string | null;
}

export default function POSClearCartModal({
  isOpen,
  onClose,
  onConfirm,
  cartCount,
  totalAmount,
  customerName,
}: POSClearCartModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-100 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        >
          <m.div
            initial={{ scale: 0.94, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-sm sm:max-w-md flex-col overflow-hidden rounded-t-3xl sm:rounded-[28px] border border-slate-200/90 bg-white shadow-2xl"
          >
            {/* Mobile Grab Handle */}
            <div className="flex justify-center pt-2.5 pb-0.5 sm:hidden">
              <div className="h-1.5 w-12 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 sm:px-6 sm:py-3.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Подтверждение действия
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95 shadow-2xs"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6 text-center">
              {/* Prominent Hero Icon Badge */}
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-rose-500 via-rose-600 to-red-600 text-white shadow-xl shadow-rose-500/30 ring-8 ring-rose-50 transition-transform">
                <Trash2 size={28} className="drop-shadow-xs" />
              </div>

              {/* Title & Subtitle */}
              <h3 className="mt-4 text-lg sm:text-xl font-black tracking-tight text-slate-900 leading-tight">
                Очистить всю корзину?
              </h3>
              <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">
                Все добавленные товары будут удалены.
              </p>

              {/* Cart Preview Summary Card */}
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 text-left space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <ShoppingCart size={13} className="text-slate-400" />
                    Позиций в корзине:
                  </span>
                  <span className="rounded-lg bg-white px-2 py-0.5 font-bold text-slate-800 border border-slate-200/70 shadow-2xs font-mono">
                    {cartCount} поз.
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <Banknote size={13} className="text-slate-400" />
                    Сумма заказа:
                  </span>
                  <span className="rounded-lg bg-white px-2 py-0.5 font-black text-rose-600 border border-rose-100 shadow-2xs font-mono">
                    {formatMoney(totalAmount, 'TJS')}
                  </span>
                </div>

                {customerName && (
                  <div className="flex items-center justify-between text-xs font-semibold pt-1 border-t border-slate-200/60">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <User size={13} className="text-slate-400" />
                      Клиент:
                    </span>
                    <span className="truncate font-bold text-slate-700 max-w-[180px]">
                      {customerName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-6 sm:py-3.5">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all text-center"
              >
                Оставить товары
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-rose-600 via-rose-500 to-red-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-rose-600/20 hover:from-rose-500 hover:to-red-500 active:scale-95 transition-all"
              >
                <Trash2 size={14} />
                <span>Да, очистить</span>
              </button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
