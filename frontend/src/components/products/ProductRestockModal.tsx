import React from 'react';
import { clsx } from 'clsx';
import {
  PlusCircle,
  X,
  Package,
  Warehouse,
  TrendingUp,
  Layers,
  ArrowDownCircle,
  Tag,
  ReceiptText
} from 'lucide-react';
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

  const cost = Number(restockData.costPrice || 0);
  const sell = Number(restockData.sellingPrice || 0);
  const marginPercent = sell > 0 && cost > 0 ? ((sell - cost) / sell) * 100 : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-slate-200/90 bg-white shadow-2xl sm:rounded-3xl"
          >
            {/* Mobile Drag Indicator */}
            <div className="flex justify-center pt-2.5 pb-0.5 sm:hidden">
              <div className="h-1.5 w-12 rounded-full bg-slate-300" />
            </div>

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3.5 sm:px-6">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-600 via-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/20 ring-4 ring-emerald-50">
                  <ArrowDownCircle size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-tight">
                    Пополнение товара
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 truncate max-w-[220px] sm:max-w-[280px] mt-0.5">
                    {formatProductName(selectedProduct?.name)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95 shadow-2xs"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={onSubmit} className="flex min-h-0 flex-col overflow-y-auto p-4 sm:p-6 space-y-3.5">
              {/* Product Status Strip Bento */}
              <div className="rounded-2xl border border-slate-200/90 bg-linear-to-br from-slate-50/80 via-white to-emerald-50/20 p-3 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                      Текущий остаток
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-100/90 text-emerald-700">
                        <Package size={12} />
                      </div>
                      <span className="font-mono text-xs sm:text-sm font-black text-slate-900">
                        {stockBreakdown.primary}
                      </span>
                      {stockBreakdown.secondary && (
                        <span className="text-[10px] font-medium text-slate-500">
                          ({stockBreakdown.secondary})
                        </span>
                      )}
                    </div>
                  </div>

                  {currentWarehouseName && (
                    <div className="text-right min-w-0 pl-2 border-l border-slate-200/70">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                        Склад
                      </span>
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <Warehouse size={12} className="text-slate-400 shrink-0" />
                        <span className="font-bold text-slate-800 text-xs truncate max-w-[130px]">
                          {currentWarehouseName}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Warehouse selector (if multiple warehouses exist) */}
              {warehouses.length > 1 && (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Склад для пополнения
                  </label>
                  <select
                    required
                    value={restockData.warehouseId}
                    onChange={(event) => setRestockData({ ...restockData, warehouseId: event.target.value })}
                    className="w-full rounded-xl border border-slate-200/90 bg-slate-50/50 px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
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
                <div className="rounded-2xl border border-emerald-100/90 bg-linear-to-br from-emerald-50/50 via-white to-emerald-50/20 p-3.5 space-y-3 shadow-2xs">
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                      <Layers size={13} className="text-emerald-600" />
                      <span>Формат фасовки / Упаковка</span>
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
                      className="w-full rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
                    >
                      {restockPackagings.map((packaging) => (
                        <option key={packaging.id} value={packaging.id}>
                          {packaging.packageName} ({packaging.unitsPerPackage} {normalizeDisplayBaseUnit(packaging.baseUnitName)})
                        </option>
                      ))}
                      <option value="">Только базовые ({baseUnitName})</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 truncate">
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
                        className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-mono font-black text-slate-900 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400 shadow-2xs"
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 truncate">
                        + Поштучно ({baseUnitName})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={restockData.quantity}
                        onChange={(event) => setRestockData({ ...restockData, quantity: event.target.value })}
                        className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-mono font-black text-slate-900 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400 shadow-2xs"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {totalRestockUnits > 0 && (
                    <div className="rounded-xl bg-linear-to-r from-emerald-600 via-emerald-500 to-teal-600 p-2.5 flex items-center justify-between text-white shadow-xs">
                      <span className="text-xs font-semibold text-emerald-50">К зачислению на склад:</span>
                      <span className="font-mono text-sm font-black text-white">
                        +{totalRestockUnits} {baseUnitName}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Количество к пополнению ({baseUnitName})
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={restockData.quantity}
                    onChange={(event) => setRestockData({ ...restockData, quantity: event.target.value })}
                    className="w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm font-mono font-black text-slate-900 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400 shadow-2xs"
                    placeholder="Введите количество..."
                  />
                </div>
              )}

              {/* Prices grid (Cost Price & Selling Price) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Цены поступления
                  </span>
                  {marginPercent !== null && (
                    <span className={clsx(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black border',
                      marginPercent > 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    )}>
                      <TrendingUp size={11} />
                      Маржа: {marginPercent > 0 ? '+' : ''}{marginPercent.toFixed(1)}%
                    </span>
                  )}
                </div>

                <div className={clsx('grid gap-2.5', isAdmin ? 'grid-cols-2' : 'grid-cols-1')}>
                  {isAdmin && (
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-600">
                        Цена закупки (за {baseUnitName})
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={restockData.costPrice}
                          onChange={(event) => setRestockData({ ...restockData, costPrice: event.target.value })}
                          onBlur={(event) => setRestockData({ ...restockData, costPrice: formatPriceInput(event.target.value) })}
                          className="w-full rounded-xl border border-slate-200/90 bg-slate-50/40 px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
                          placeholder="0.00"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                          TJS
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Цена продажи <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={restockData.sellingPrice}
                        onChange={(event) => setRestockData({ ...restockData, sellingPrice: event.target.value })}
                        onBlur={(event) => setRestockData({ ...restockData, sellingPrice: formatPriceInput(event.target.value) })}
                        className="w-full rounded-xl border border-slate-200/90 bg-slate-50/40 px-3 py-2 text-xs font-mono font-bold text-slate-900 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
                        placeholder="0.00"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        TJS
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comment / Reason */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600">
                  Комментарий к приходу <span className="text-slate-400 font-normal">(необязательно)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={restockData.reason}
                    onChange={(event) => setRestockData({ ...restockData, reason: event.target.value })}
                    className="w-full rounded-xl border border-slate-200/90 bg-slate-50/40 px-3 py-2 text-xs font-medium text-slate-900 outline-none transition-all focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400 shadow-2xs"
                    placeholder="Напр: Новая партия от поставщика..."
                  />
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3 mt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-linear-to-r from-emerald-600 via-emerald-500 to-teal-600 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-emerald-600/25 hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition-all flex items-center gap-2"
                >
                  <PlusCircle size={15} />
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
