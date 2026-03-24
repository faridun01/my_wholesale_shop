import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { clsx } from 'clsx';
import { History, X } from 'lucide-react';
import { formatProductName } from '../../utils/productName';

interface ProductHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName?: string | null;
  productHistory: any[];
}

export default function ProductHistoryModal({
  isOpen,
  onClose,
  productName,
  productHistory,
}: ProductHistoryModalProps) {
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[56rem] overflow-hidden rounded-[2rem] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-5 sm:p-6">
              <h3 className="flex items-center space-x-3 text-xl font-black text-slate-900">
                <div className="rounded-2xl bg-sky-500 p-2.5 text-white">
                  <History size={20} />
                </div>
                <span>История товара: {formatProductName(productName)}</span>
              </h3>
              <button type="button" onClick={onClose} className="text-slate-400 transition-colors hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="max-h-[56vh] overflow-y-auto p-4 sm:p-6">
              <div className="space-y-3 sm:hidden">
                {productHistory.map((t, i) => (
                  <div key={i} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{new Date(t.createdAt).toLocaleString('ru-RU')}</p>
                        <p className="mt-1 text-xs text-slate-500">{t.warehouseName || t.warehouse?.name || '---'}</p>
                      </div>
                      <span
                        className={clsx(
                          'rounded-lg px-2 py-1 text-[10px] font-black uppercase',
                          t.type === 'incoming'
                            ? 'bg-emerald-50 text-emerald-600'
                            : t.type === 'outgoing'
                              ? 'bg-rose-50 text-rose-600'
                              : t.type === 'price_change' || t.type === 'adjustment'
                                ? 'bg-sky-50 text-sky-600'
                                : 'bg-amber-50 text-amber-600',
                        )}
                      >
                        {t.type === 'incoming'
                          ? 'Приход'
                          : t.type === 'outgoing'
                            ? 'Расход'
                            : t.type === 'price_change' || t.type === 'adjustment'
                              ? 'Изменение цены'
                              : 'Перенос'}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Кол-во</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{Number(t.qtyChange || 0) > 0 ? `+${t.qtyChange}` : (t.qtyChange ?? 0)}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Пользователь</p>
                        <p className="mt-1 break-words text-sm font-medium text-slate-900">{t.username || '---'}</p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl bg-white px-3 py-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Причина</p>
                      <p className="mt-1 break-words text-sm text-slate-600">{t.reason || '---'}</p>
                    </div>
                  </div>
                ))}
              </div>

              <table className="hidden w-full table-fixed text-left sm:table">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="w-[18%] pb-4">Дата</th>
                    <th className="w-[11%] pb-4">Тип</th>
                    <th className="w-[10%] pb-4">Кол-во</th>
                    <th className="w-[13%] pb-4">Склад</th>
                    <th className="w-[33%] pb-4">Причина</th>
                    <th className="w-[15%] pb-4">Пользователь</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {productHistory.map((t, i) => (
                    <tr key={i} className="text-[13px]">
                      <td className="py-3 pr-3 align-top text-slate-500">{new Date(t.createdAt).toLocaleString('ru-RU')}</td>
                      <td className="py-3 pr-3 align-top">
                        <span
                          className={clsx(
                            'rounded-lg px-2 py-1 text-[10px] font-black uppercase',
                            t.type === 'incoming'
                              ? 'bg-emerald-50 text-emerald-600'
                              : t.type === 'outgoing'
                                ? 'bg-rose-50 text-rose-600'
                                : t.type === 'price_change' || t.type === 'adjustment'
                                  ? 'bg-sky-50 text-sky-600'
                                  : 'bg-amber-50 text-amber-600',
                          )}
                        >
                          {t.type === 'incoming'
                            ? 'Приход'
                            : t.type === 'outgoing'
                              ? 'Расход'
                              : t.type === 'price_change' || t.type === 'adjustment'
                                ? 'Изменение цены'
                                : 'Перенос'}
                        </span>
                      </td>
                      <td className="py-3 pr-3 align-top font-black">{Number(t.qtyChange || 0) > 0 ? `+${t.qtyChange}` : (t.qtyChange ?? 0)}</td>
                      <td className="py-3 pr-3 align-top break-words text-slate-600">{t.warehouseName || t.warehouse?.name || '---'}</td>
                      <td className="py-3 pr-3 align-top break-words italic text-slate-500">{t.reason || '---'}</td>
                      <td className="py-3 align-top break-words text-slate-500">{t.username}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
