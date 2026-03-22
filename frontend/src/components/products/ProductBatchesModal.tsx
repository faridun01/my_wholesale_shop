import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { Layers, X } from 'lucide-react';
import { formatMoney } from '../../utils/format';

interface ProductBatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProduct: any;
  productBatches: any[];
}

export default function ProductBatchesModal({
  isOpen,
  onClose,
  selectedProduct,
  productBatches,
}: ProductBatchesModalProps) {
  return (
    <AnimatePresence>
      {isOpen && selectedProduct && (
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
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[52rem] overflow-hidden rounded-[2rem] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-violet-50/50 p-5 sm:p-6">
              <h3 className="flex items-center space-x-3 text-xl font-black text-slate-900">
                <div className="rounded-2xl bg-violet-500 p-2.5 text-white">
                  <Layers size={20} />
                </div>
                <span>Партии товара (FIFO): {selectedProduct.name}</span>
              </h3>
              <button onClick={onClose} className="text-slate-400 transition-colors hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="max-h-[56vh] overflow-y-auto p-4 sm:p-6">
              <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-sm font-medium text-amber-800">
                Система списывает товар из самых старых партий в первую очередь (FIFO).
              </div>
              <div className="space-y-3 sm:hidden">
                {productBatches.map((b, i) => (
                  <div key={b.id} className={clsx('rounded-3xl border border-slate-100 p-4', i === 0 ? 'bg-violet-50/60' : 'bg-slate-50')}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{new Date(b.createdAt).toLocaleDateString('ru-RU')}</p>
                        <p className="mt-1 text-sm text-slate-500">{b.warehouse?.name || '---'}</p>
                      </div>
                      {i === 0 && (
                        <span className="rounded-md bg-violet-500 px-2 py-1 text-[8px] uppercase text-white">След. на списание</span>
                      )}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Нач. кол-во</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{b.quantity} {selectedProduct.unit}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Остаток</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{b.remainingQuantity} {selectedProduct.unit}</p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl bg-white px-3 py-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Цена закупки</p>
                      <p className="mt-1 text-sm font-black text-emerald-600">{formatMoney(b.costPrice)}</p>
                    </div>
                  </div>
                ))}
                {productBatches.length === 0 && (
                  <div className="rounded-3xl bg-slate-50 px-4 py-10 text-center text-sm font-bold text-slate-400">Активных партий не найдено</div>
                )}
              </div>
              <table className="hidden w-full text-left sm:table">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="pb-4">Дата закупки</th>
                    <th className="pb-4">Склад</th>
                    <th className="pb-4 text-right">Начальное кол-во</th>
                    <th className="pb-4 text-right">Остаток</th>
                    <th className="pb-4 text-right">Цена закупки</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {productBatches.map((b, i) => (
                    <tr key={b.id} className={clsx('text-[13px]', i === 0 && 'bg-violet-50/40')}>
                      <td className="py-3 font-bold text-slate-500">
                        {new Date(b.createdAt).toLocaleDateString('ru-RU')}
                        {i === 0 && <span className="ml-2 rounded-md bg-violet-500 px-2 py-0.5 text-[8px] uppercase text-white">След. на списание</span>}
                      </td>
                      <td className="py-3 font-bold text-slate-600">{b.warehouse?.name}</td>
                      <td className="py-3 text-right font-bold text-slate-400">{b.quantity} {selectedProduct.unit}</td>
                      <td className="py-3 text-right font-black text-slate-900">{b.remainingQuantity} {selectedProduct.unit}</td>
                      <td className="py-3 text-right font-black text-emerald-600">{formatMoney(b.costPrice)}</td>
                    </tr>
                  ))}
                  {productBatches.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center font-bold text-slate-400">Активных партий не найдено</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t border-slate-100 bg-slate-50 p-6">
              <button onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-8 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50">
                Закрыть
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
