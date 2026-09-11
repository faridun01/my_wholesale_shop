import React from 'react';
import { Scissors, X, Package } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { clsx } from 'clsx';
import { formatProductName } from '../../utils/productName';
import { getStockBreakdown, normalizeDisplayBaseUnit } from '../../utils/productsViewUtils';

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

  const stock = Number(selectedProduct?.stock || 0);
  const stockBreakdown = getStockBreakdown(selectedProduct);
  const baseUnit = normalizeDisplayBaseUnit(selectedProduct?.baseUnitName);
  const currentWarehouseName =
    selectedProduct?.warehouse?.name ||
    warehouses.find((w) => w.id === selectedProduct?.warehouseId)?.name ||
    '---';

  return (
    <AnimatePresence>
      {isOpen && selectedProduct && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl sm:rounded-2xl"
          >
            {/* Mobile Drag Indicator */}
            <div className="flex justify-center pt-2 pb-0.5 sm:hidden">
              <div className="h-1 w-9 rounded-full bg-slate-300" />
            </div>

            {/* Compact Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 sm:px-5 sm:py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
                  <Scissors size={15} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">Списание товара</h3>
                  <p className="text-[11px] font-medium text-slate-500 truncate max-w-[220px] sm:max-w-xs">
                    {formatProductName(selectedProduct.name)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors active:scale-95"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={onSubmit} className="flex min-h-0 flex-col overflow-y-auto p-4 sm:p-5 space-y-3">
              {/* Product & Stock Context Strip */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Остаток на складе
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Package size={13} className="text-rose-600" />
                    <span className="font-bold text-slate-900 text-xs">{stockBreakdown.primary}</span>
                  </div>
                </div>

                <div className="text-right min-w-0 pl-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Склад
                  </span>
                  <span className="font-semibold text-slate-700 text-xs truncate max-w-[140px] block">
                    {currentWarehouseName}
                  </span>
                </div>
              </div>

              {/* Quantity Section */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-2.5 space-y-2">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Количество к списанию ({baseUnit}) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={writeOffData.quantity}
                    onChange={(event) => setWriteOffData((prev: any) => ({ ...prev, quantity: event.target.value }))}
                    className="h-8.5 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition-colors focus:border-rose-500 focus:ring-1 focus:ring-rose-500 placeholder:text-slate-400"
                    placeholder="0"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    {[1, 5, 10].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => onSetQuantity(val)}
                        className="h-8.5 rounded-lg border border-slate-200/80 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-900 hover:text-white transition-colors"
                      >
                        {val}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => onSetQuantity(stock)}
                      className="h-8.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-bold text-rose-700 hover:bg-rose-600 hover:text-white transition-colors"
                      title="Списать весь остаток"
                    >
                      Всё
                    </button>
                  </div>
                </div>
              </div>

              {/* Reason Presets & Input */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-700">Причина списания</label>
                <div className="flex flex-wrap gap-1.5">
                  {reasonPresets.map((reason) => {
                    const isSelected = normalizedReason === reason.toLowerCase();
                    return (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setWriteOffData((prev: any) => ({ ...prev, reason: reason.toLowerCase() }))}
                        className={clsx(
                          'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all',
                          isSelected
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
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
                  className="h-8.5 w-full rounded-xl border border-slate-200/80 bg-white px-3 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-rose-500 focus:ring-1 focus:ring-rose-500 placeholder:text-slate-400"
                  placeholder="Своя причина..."
                />
              </div>

              {/* Compact Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-rose-600 px-5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Scissors size={13} />
                  <span>Списать</span>
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
