import React from 'react';
import { PlusCircle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  formatCountWithUnit,
  formatPriceInput,
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
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-white bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-[#f4f5fb] px-6 py-4">
          <div>
            <h3 className="flex items-center space-x-3 text-base font-semibold text-slate-900">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
                <PlusCircle size={18} />
              </div>
              <span>Пополнение товара</span>
            </h3>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{selectedProduct?.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-col overflow-y-auto p-6 space-y-4">
          {warehouses.length > 1 && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Склад</label>
              <select
                required
                value={restockData.warehouseId}
                onChange={(event) => setRestockData({ ...restockData, warehouseId: event.target.value })}
                className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
              >
                <option value="">Выберите склад</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {selectedRestockPackaging ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Упаковка</label>
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
                    className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                  >
                    {restockPackagings.map((packaging) => (
                      <option key={packaging.id} value={packaging.id}>
                        {packaging.packageName} ({packaging.unitsPerPackage} {normalizeDisplayBaseUnit(packaging.baseUnitName)})
                      </option>
                    ))}
                    <option value="">Только {normalizeDisplayBaseUnit(selectedProduct?.baseUnitName)}</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Количество ({selectedRestockPackaging.packageName})
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={restockData.packageQuantityInput ?? ''}
                    onChange={(event) =>
                      setRestockData((prev: any) => ({
                        ...prev,
                        packageQuantityInput: event.target.value,
                      }))
                    }
                    className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                    placeholder="0"
                  />
                </div>
              </>
            ) : null}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                {selectedRestockPackaging ? `Доп. ${normalizeDisplayBaseUnit(selectedProduct?.baseUnitName)}` : `Количество (${normalizeDisplayBaseUnit(selectedProduct?.baseUnitName)})`}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required={!selectedRestockPackaging}
                value={restockData.quantity}
                onChange={(event) => setRestockData({ ...restockData, quantity: event.target.value })}
                className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                placeholder="0"
              />
            </div>

            {isAdmin && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Цена закупки</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={restockData.costPrice}
                  onChange={(event) => setRestockData({ ...restockData, costPrice: event.target.value })}
                  onBlur={(event) => setRestockData({ ...restockData, costPrice: formatPriceInput(event.target.value) })}
                  className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Цена продажи</label>
              <input
                type="number"
                step="0.01"
                required
                value={restockData.sellingPrice}
                onChange={(event) => setRestockData({ ...restockData, sellingPrice: event.target.value })}
                onBlur={(event) => setRestockData({ ...restockData, sellingPrice: formatPriceInput(event.target.value) })}
                className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Причина / Комментарий</label>
            <input
              type="text"
              value={restockData.reason}
              onChange={(event) => setRestockData({ ...restockData, reason: event.target.value })}
              className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
              placeholder="Напр: Новая поставка"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-full bg-slate-900 px-6 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
            >
              Пополнить
            </button>
          </div>
        </form>
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
