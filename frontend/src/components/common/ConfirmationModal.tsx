import React, { useEffect, useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2, AlertCircle, X, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  closeOnConfirmStart?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Удалить',
  cancelText = 'Отмена',
  type = 'danger',
  closeOnConfirmStart = false,
}: ConfirmationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  const handleConfirm = async () => {
    if (closeOnConfirmStart) {
      setIsSubmitting(true);
      onClose();

      try {
        await Promise.resolve(onConfirm());
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    try {
      setIsSubmitting(true);
      await Promise.resolve(onConfirm());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!isSubmitting) {
              onClose();
            }
          }}
          className="fixed inset-0 z-100 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        >
          <m.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-sm sm:max-w-md flex-col overflow-hidden rounded-t-3xl border border-slate-200/90 bg-white shadow-2xl sm:rounded-3xl"
          >
            {/* Mobile Grab Handle */}
            <div className="flex justify-center pt-2.5 pb-0.5 sm:hidden">
              <div className="h-1.5 w-12 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 sm:px-6 sm:py-3.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Подтверждение действия
              </span>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95 disabled:opacity-50 shadow-2xs"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6 text-center">
              {/* Prominent Hero Icon Badge */}
              <div
                className={clsx(
                  'mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-md ring-4 transition-transform',
                  type === 'danger'
                    ? 'bg-linear-to-br from-rose-500 via-rose-600 to-red-600 text-white shadow-rose-500/25 ring-rose-50'
                    : type === 'warning'
                      ? 'bg-linear-to-br from-amber-500 via-amber-600 to-orange-600 text-white shadow-amber-500/25 ring-amber-50'
                      : 'bg-linear-to-br from-blue-600 via-indigo-600 to-indigo-700 text-white shadow-indigo-500/25 ring-indigo-50'
                )}
              >
                {type === 'danger' ? (
                  <Trash2 size={24} />
                ) : type === 'warning' ? (
                  <AlertTriangle size={24} />
                ) : (
                  <AlertCircle size={24} />
                )}
              </div>

              {/* Title */}
              <h3 className="mt-3.5 text-base sm:text-lg font-black tracking-tight text-slate-900 leading-snug">
                {title}
              </h3>

              {/* Content Compartment */}
              <div
                className={clsx(
                  'mt-3 rounded-2xl border p-3.5 text-xs font-medium leading-relaxed shadow-2xs',
                  type === 'danger'
                    ? 'border-rose-100/90 bg-linear-to-br from-rose-50/60 via-white to-rose-50/20 text-slate-700'
                    : type === 'warning'
                      ? 'border-amber-100/90 bg-linear-to-br from-amber-50/60 via-white to-amber-50/20 text-slate-700'
                      : 'border-slate-100 bg-slate-50/80 text-slate-600'
                )}
              >
                <p>{message}</p>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-6 sm:py-3.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-full sm:w-auto rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50 text-center"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting}
                className={clsx(
                  'w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md transition-all active:scale-95 disabled:opacity-50',
                  type === 'danger'
                    ? 'bg-linear-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-600/20'
                    : type === 'warning'
                      ? 'bg-linear-to-r from-amber-600 via-amber-500 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-600/20'
                      : 'bg-linear-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 shadow-slate-900/20'
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Подождите...</span>
                  </>
                ) : (
                  <>
                    {type === 'danger' && <Trash2 size={14} />}
                    <span>{confirmText}</span>
                  </>
                )}
              </button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
