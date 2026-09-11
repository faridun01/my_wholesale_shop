import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!isSubmitting) {
              onClose();
            }
          }}
          className="fixed inset-0 z-100 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl sm:rounded-2xl"
          >
            {/* Mobile Drag Indicator */}
            <div className="flex justify-center pt-2 pb-0.5 sm:hidden">
              <div className="h-1 w-9 rounded-full bg-slate-300" />
            </div>

            {/* Compact Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 sm:px-5 sm:py-3">
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors disabled:opacity-50 active:scale-95"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-4 py-4 sm:px-5 sm:py-4 text-center">
              <div
                className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl shadow-xs ${
                  type === 'danger'
                    ? 'bg-rose-50 text-rose-600 border border-rose-200/60'
                    : type === 'warning'
                      ? 'bg-amber-50 text-amber-600 border border-amber-200/60'
                      : 'bg-sky-50 text-sky-600 border border-sky-200/60'
                }`}
              >
                <AlertTriangle size={20} />
              </div>
              <p className="text-xs leading-relaxed text-slate-600 font-medium">{message}</p>
            </div>

            {/* Compact Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 sm:px-5 sm:py-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting}
                className={`inline-flex items-center justify-center rounded-xl px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-all active:scale-95 disabled:opacity-50 ${
                  type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : type === 'warning'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {isSubmitting && !closeOnConfirmStart ? 'Подождите...' : confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
