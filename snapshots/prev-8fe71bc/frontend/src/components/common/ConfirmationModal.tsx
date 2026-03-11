import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Удалить',
  cancelText = 'Отмена',
  type = 'danger'
}: ConfirmationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden"
          >
            <div className="p-6 flex justify-between items-center border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-900">{title}</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 text-center">
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${
                type === 'danger' ? 'bg-rose-50 text-rose-600' : 
                type === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
              }`}>
                <AlertTriangle size={40} />
              </div>
              <p className="text-slate-600 font-medium leading-relaxed">{message}</p>
            </div>
            <div className="p-6 bg-slate-50 flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-all"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex-1 px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 ${
                  type === 'danger' ? 'bg-rose-600 shadow-rose-600/20 hover:bg-rose-700' : 
                  type === 'warning' ? 'bg-amber-600 shadow-amber-600/20 hover:bg-amber-700' : 'bg-indigo-600 shadow-indigo-600/20 hover:bg-indigo-700'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
