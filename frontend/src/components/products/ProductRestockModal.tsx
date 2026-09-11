import React from 'react';
import { clsx } from 'clsx';
import { PlusCircle, X, Package } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { formatProductName } from '../../utils/productName';
import {
  formatPriceInput,
  getStockBreakdown,
  normalizeDisplayBaseUnit,
} from '../../utils/productsViewUtils';

interface ProductRestockModalProps {
  isOpen: boolean;
  isAdmin: boolean;
  selectedProduct: any;
  warehouses: any[];
  restockData: any;
  restockPackagings: any[];
  selectedRestockPackaging: any;
  totalRestockUnits: number;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  setRestockData: React.Dispatch<React.SetStateAction<any>>;
}

export default function ProductRestockModal({
  isOpen,
  isAdmin,
  selectedProduct,
  warehouses,
  restockData,
  restockPackagings,
  selectedRestockPackaging,
  totalRestockUnits,
  onClose,
  onSubmit,
  setRestockData,
}: ProductRestockModalProps) {
  if (!isOpen || !selectedProduct) return null;

  const baseUnitName = normalizeDisplayBaseUnit(selectedProduct?.baseUnitName);
  const stockBreakdown = getStockBreakdown(selectedProduct);
  const currentWarehouseName =
    selectedProduct?.warehouse?.name ||
    warehouses.find((w) => String(w.id) === String(restockData.warehouseId || selectedProduct?.warehouseId))?.name ||
    '';

  return (
    <AnimatePresence>
      {isOpen && (
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

            {/* Compact Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                  <PlusCircle size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    Пополнение товара
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500 truncate max-w-[240px] sm:max-w-[300px]">
                    {formatProductName(selectedProduct?.name)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700 active:scale-95"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={onSubmit} className="flex min-h-0 flex-col overflow-y-auto p-4 sm:p-5 space-y-3">
              {/* Product Status Strip */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Текущий остаток
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Package size={13} className="text-emerald-600" />
                    <span className="font-bold text-slate-900 text-xs">
                      {stockBreakdown.primary}
                    </span>
                  </div>
                </div>

                {currentWarehouseName && (
                  <div className="text-right min-w-0 pl-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Склад
                    </span>
                    <span className="font-semibold text-slate-700 text-xs truncate max-w-[140px] block">
                      {currentWarehouseName}
                    </span>
                  </div>
                )}
              </div>

              {/* Warehouse selector (if multiple warehouses exist) */}
              {warehouses.length > 1 && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                    Склад для пополнения
                  </label>
                  <select
                    required
                    value={restockData.warehouseId}
                    onChange={(event) => setRestockData({ ...restockData, warehouseId: event.target.value })}
                    className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Выберите склад</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Packaging and Quantity Controls */}
              {selectedRestockPackaging ? (
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-2.5 space-y-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                      Упаковка
                    </label>
                    <select
                      value={restockData.selectedPackagingId}
                      onChange={(event) =>
                        setRestockData((prev: any) => ({
                          ...prev,
                          selectedPackagingId: event.target.value,
                          packageQuantityInput: '',
                          quantity: '',
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    >
                      {restockPackagings.map((packaging) => (
                        <option key={packaging.id} value={packaging.id}>
                          {packaging.packageName} ({packaging.unitsPerPackage} {normalizeDisplayBaseUnit(packaging.baseUnitName)})
                        </option>
                      ))}
                      <option value="">Только {baseUnitName}</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-700 truncate">
                        Кол-во ({selectedRestockPackaging.packageName})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={restockData.packageQuantityInput ?? ''}
                        onChange={(event) =>
                          setRestockData((prev: any) => ({
                            ...prev,
                            packageQuantityInput: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-400"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-700 truncate">
                        + Доп. ({baseUnitName})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={restockData.quantity}
                        onChange={(event) => setRestockData({ ...restockData, quantity: event.target.value })}
                        className="w-full rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-400"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {totalRestockUnits > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 text-[11px]">
                      <span className="text-emerald-700 font-medium">Будет добавлено:</span>
                      <span className="font-bold text-emerald-800">
                        +{totalRestockUnits} {baseUnitName}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                    Количество к пополнению ({baseUnitName})
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={restockData.quantity}
                    onChange={(event) => setRestockData({ ...restockData, quantity: event.target.value })}
                    className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-400"
                    placeholder="0"
                  />
                </div>
              )}

              {/* Prices grid (Cost Price & Selling Price) */}
              <div className={clsx('grid gap-2.5', isAdmin ? 'grid-cols-2' : 'grid-cols-1')}>
                {isAdmin && (
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                      Цена закупки
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={restockData.costPrice}
                      onChange={(event) => setRestockData({ ...restockData, costPrice: event.target.value })}
                      onBlur={(event) => setRestockData({ ...restockData, costPrice: formatPriceInput(event.target.value) })}
                      className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      placeholder="0.00"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                    Цена продажи <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={restockData.sellingPrice}
                    onChange={(event) => setRestockData({ ...restockData, sellingPrice: event.target.value })}
                    onBlur={(event) => setRestockData({ ...restockData, sellingPrice: formatPriceInput(event.target.value) })}
                    className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Comment / Reason */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                  Комментарий / Причина <span className="text-slate-400 font-normal">(необязательно)</span>
                </label>
                <input
                  type="text"
                  value={restockData.reason}
                  onChange={(event) => setRestockData({ ...restockData, reason: event.target.value })}
                  className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-400"
                  placeholder="Напр: Новая поставка, приход..."
                />
              </div>

              {/* Compact Actions Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <PlusCircle size={14} />
                  <span>Пополнить</span>
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
