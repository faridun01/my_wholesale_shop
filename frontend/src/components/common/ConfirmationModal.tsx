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
          className="fixed inset-0 z-100 flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="text-section-title">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-surface-muted hover:text-slate-700 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-5 text-center">
              <div
                className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
                  type === 'danger'
                    ? 'bg-rose-50 text-rose-600'
                    : type === 'warning'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-sky-50 text-sky-600'
                }`}
              >
                <AlertTriangle size={24} />
              </div>
              <p className="text-sm leading-relaxed text-slate-600">{message}</p>
            </div>

            <div className="flex flex-col-reverse gap-2.5 border-t border-line bg-surface-muted px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="btn-secondary text-sm"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting}
                className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
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
