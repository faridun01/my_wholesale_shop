import React from 'react';
import { Scissors, X } from 'lucide-react';
import { motion } from 'motion/react';
import { clsx } from 'clsx';
import { formatProductName } from '../../utils/productName';
import { getStockBreakdown } from '../../utils/productsViewUtils';

interface ProductWriteOffModalProps {
  isOpen: boolean;
  selectedProduct: any;
  warehouses: any[];
  writeOffData: any;
  selectedPackaging: any;
  reasonPresets: string[];
  normalizedReason: string;
  isCustomReason: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSetQuantity: (value: number) => void;
  setWriteOffData: React.Dispatch<React.SetStateAction<any>>;
}

export default function ProductWriteOffModal({
  isOpen,
  selectedProduct,
  warehouses,
  writeOffData,
  selectedPackaging,
  reasonPresets,
  normalizedReason,
  isCustomReason,
  onClose,
  onSubmit,
  onSetQuantity,
  setWriteOffData,
}: ProductWriteOffModalProps) {
  if (!isOpen || !selectedProduct) return null;

  const stock = Number(selectedProduct.stock || 0);
  const packageUnits = Number(selectedPackaging?.unitsPerPackage || 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-[#f4f5fb] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
              <Scissors size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Списание товара</h3>
              <p className="text-xs text-slate-500">{formatProductName(selectedProduct.name)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 space-y-4 overflow-y-auto bg-[#f4f5fb]/40 p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/60 bg-white p-3.5 shadow-xs">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Товар</p>
              <p className="mt-1 text-xs font-semibold text-slate-900 truncate">
                {formatProductName(selectedProduct.name)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 bg-white p-3.5 shadow-xs">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Склад</p>
              <p className="mt-1 text-xs font-semibold text-slate-900 truncate">
                {selectedProduct?.warehouse?.name || warehouses.find((warehouse) => warehouse.id === selectedProduct?.warehouseId)?.name || '---'}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50 p-3.5 shadow-xs">
              <p className="text-[10px] uppercase tracking-wider text-emerald-600">Остаток</p>
              <p className="mt-1 text-xs font-bold text-emerald-800">
                {getStockBreakdown(selectedProduct).primary}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-xs space-y-4">
            <section className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">Количество к списанию</label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={writeOffData.quantity}
                  onChange={(event) => setWriteOffData((prev: any) => ({ ...prev, quantity: event.target.value }))}
                  className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                  placeholder="0"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  {[1, 5, 10].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onSetQuantity(val)}
                      className="rounded-full border border-slate-200 bg-[#f4f5fb] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-900 hover:text-white transition-colors"
                    >
                      {val}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onSetQuantity(stock)}
                    className="rounded-full border border-slate-200 bg-[#f4f5fb] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-900 hover:text-white transition-colors"
                  >
                    Всё
                  </button>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-xs font-semibold text-slate-700">Причина списания</p>
              <div className="flex flex-wrap gap-2">
                {reasonPresets.map((reason) => {
                  const isSelected = normalizedReason === reason.toLowerCase();
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setWriteOffData((prev: any) => ({ ...prev, reason: reason.toLowerCase() }))}
                      className={clsx(
                        'rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
                        isSelected
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'border border-slate-200 bg-[#f4f5fb] text-slate-700 hover:bg-slate-200/70'
                      )}
                    >
                      {reason}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                required
                value={writeOffData.reason}
                onChange={(event) => setWriteOffData((prev: any) => ({ ...prev, reason: event.target.value }))}
                className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                placeholder="Своя причина"
              />
            </section>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 rounded-2xl">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-full bg-rose-600 px-6 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-700"
            >
              Подтвердить списание
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
