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
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-[#f4f5fb] px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-6 text-center">
              <div
                className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
                  type === 'danger'
                    ? 'bg-rose-50 text-rose-600'
                    : type === 'warning'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-indigo-50 text-indigo-600'
                }`}
              >
                <AlertTriangle size={28} />
              </div>
              <p className="text-xs font-medium leading-relaxed text-slate-600">{message}</p>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting}
                className={`rounded-full px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-50 ${
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
