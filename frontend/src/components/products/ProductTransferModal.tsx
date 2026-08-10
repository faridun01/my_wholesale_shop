import React from 'react';
import { ArrowRightLeft, X } from 'lucide-react';
import { motion } from 'motion/react';
import {
  formatCountWithUnit,
  normalizeDisplayBaseUnit,
} from '../../utils/productsViewUtils';

interface ProductTransferModalProps {
  isOpen: boolean;
  selectedProduct: any;
  warehouses: any[];
  transferData: {
    fromWarehouseId: string;
    toWarehouseId: string;
    quantity: string;
    selectedPackagingId: string;
    packageQuantityInput: string;
  };
  selectedTransferPackaging: any;
  transferUnitsPerPackage: number;
  transferAvailableFullPackages: number;
  transferRemainderUnits: number;
  transferPackageQuantity: number;
  totalTransferUnits: number;
  availableTransferStock: number | null;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  setTransferData: React.Dispatch<React.SetStateAction<any>>;
}

export default function ProductTransferModal({
  isOpen,
  selectedProduct,
  warehouses,
  transferData,
  selectedTransferPackaging,
  transferUnitsPerPackage,
  transferAvailableFullPackages,
  transferRemainderUnits,
  transferPackageQuantity,
  totalTransferUnits,
  availableTransferStock,
  onClose,
  onSubmit,
  setTransferData,
}: ProductTransferModalProps) {
  if (!isOpen) return null;

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
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-white bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-[#f4f5fb] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Перенос товара</h3>
              <p className="text-xs font-medium text-slate-500">{selectedProduct?.name}</p>
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

        <form onSubmit={onSubmit} className="flex min-h-0 flex-col overflow-y-auto p-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Из склада</label>
            <select
              required
              value={transferData.fromWarehouseId}
              onChange={(event) => setTransferData({ ...transferData, fromWarehouseId: event.target.value })}
              className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
            >
              <option value="">Выберите склад</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">В склад</label>
            <select
              required
              value={transferData.toWarehouseId}
              onChange={(event) => setTransferData({ ...transferData, toWarehouseId: event.target.value })}
              className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
            >
              <option value="">Выберите склад</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Количество</label>
            {selectedTransferPackaging && transferUnitsPerPackage > 0 ? (
              <div className="space-y-3">
                {availableTransferStock !== null && (
                  <div className="rounded-2xl border border-amber-200/70 bg-amber-50/50 p-3.5">
                    <p className="text-xs font-semibold text-amber-900">
                      Доступно: {formatCountWithUnit(transferAvailableFullPackages, selectedTransferPackaging.packageName)}
                    </p>
                    {transferRemainderUnits > 0 && (
                      <p className="mt-0.5 text-xs font-medium text-amber-700">
                        Остаток: {formatCountWithUnit(transferRemainderUnits, normalizeDisplayBaseUnit(selectedProduct?.unit || 'шт'))}
                      </p>
                    )}
                  </div>
                )}

                {transferAvailableFullPackages > 0 ? (
                  <>
                    <input
                      type="number"
                      required
                      min="1"
                      max={transferAvailableFullPackages || undefined}
                      placeholder={`Введите количество (${selectedTransferPackaging.packageName})`}
                      value={transferData.packageQuantityInput}
                      onChange={(event) =>
                        setTransferData((prev: any) => ({
                          ...prev,
                          packageQuantityInput: event.target.value,
                          quantity: String(
                            Math.max(0, Math.floor(Number(event.target.value || 0) || 0)) * transferUnitsPerPackage
                          ),
                        }))
                      }
                      className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                    />
                  </>
                ) : (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-500">
                    Для переноса нужна хотя бы одна полная {selectedTransferPackaging.packageName}.
                  </p>
                )}
              </div>
            ) : (
              <>
                {availableTransferStock !== null && (
                  <p className="mb-1 text-xs font-medium text-slate-500">
                    Доступно: {formatCountWithUnit(Number(availableTransferStock || 0), normalizeDisplayBaseUnit(selectedProduct?.unit || 'шт'))}
                  </p>
                )}
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Введите количество"
                  value={transferData.quantity}
                  onChange={(event) => setTransferData({ ...transferData, quantity: event.target.value })}
                  className="w-full rounded-full border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-300 focus:bg-white"
                />
              </>
            )}
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
              disabled={
                (selectedTransferPackaging && transferUnitsPerPackage > 0 && transferAvailableFullPackages <= 0) ||
                totalTransferUnits <= 0
              }
              className="rounded-full bg-slate-900 px-6 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
            >
              Перенести
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
