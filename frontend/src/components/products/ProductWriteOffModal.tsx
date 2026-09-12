import React from 'react';
import {
  Trash2,
  X,
  Package,
  Warehouse,
  AlertCircle,
  TrendingDown,
  AlertTriangle,
  PackageX,
  Store,
  Sliders,
  Check,
  Minus,
  Plus,
  FileText,
  Tag,
  Boxes,
} from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { clsx } from 'clsx';
import { formatProductName } from '../../utils/productName';
import { getStockBreakdown, normalizeDisplayBaseUnit } from '../../utils/productsViewUtils';
import { formatMoney } from '../../utils/format';

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

const getReasonPresetIcon = (reason: string) => {
  const lower = reason.toLowerCase();
  if (lower.includes('брак')) return AlertTriangle;
  if (lower.includes('потер') || lower.includes('бой')) return PackageX;
  if (lower.includes('внутренн') || lower.includes('исп')) return Store;
  if (lower.includes('коррект') || lower.includes('инвент')) return Sliders;
  return Tag;
};

export default function ProductWriteOffModal({
  isOpen,
  selectedProduct,
  warehouses,
  writeOffData,
  selectedPackaging,
  reasonPresets,
  normalizedReason,
  onClose,
  onSubmit,
  onSetQuantity,
  setWriteOffData,
}: ProductWriteOffModalProps) {
  if (!isOpen || !selectedProduct) return null;

  const stock = Math.max(0, Math.floor(Number(selectedProduct?.stock || 0)));
  const stockBreakdown = getStockBreakdown(selectedProduct);
  const baseUnit = normalizeDisplayBaseUnit(selectedProduct?.baseUnitName);
  const currentWarehouseName =
    selectedProduct?.warehouse?.name ||
    warehouses.find((w) => String(w.id) === String(selectedProduct?.warehouseId))?.name ||
    'Основной склад';

  const quantityNum = Math.max(0, Math.floor(Number(writeOffData.quantity || 0)));
  const remainingStock = Math.max(0, stock - quantityNum);
  const isOverStock = quantityNum > stock;
  const costPrice = Number(selectedProduct?.costPrice ?? selectedProduct?.cost_price ?? 0);
  const estimatedLoss = quantityNum * costPrice;
  const unitsPerPackage = Math.floor(
    Number(selectedPackaging?.unitsPerPackage || selectedProduct?.unitsPerPackage || 0)
  );
  const packageName = selectedPackaging?.packageName || selectedProduct?.packageName || 'упак';

  // Percentage of stock being written off
  const writeOffPercent = stock > 0 ? Math.min(100, Math.round((quantityNum / stock) * 100)) : 0;

  // Handle Stepper
  const handleDecrement = () => {
    const next = Math.max(1, quantityNum - 1);
    setWriteOffData((prev: any) => ({ ...prev, quantity: String(next) }));
  };

  const handleIncrement = () => {
    const next = Math.min(stock, quantityNum + 1);
    setWriteOffData((prev: any) => ({ ...prev, quantity: String(next) }));
  };

  const handleAddDelta = (delta: number) => {
    const current = quantityNum || 0;
    const next = Math.max(1, Math.min(stock, current + delta));
    setWriteOffData((prev: any) => ({ ...prev, quantity: String(next) }));
  };

  const handleSetAll = () => {
    onSetQuantity(stock);
  };

  return (
    <AnimatePresence>
      {isOpen && selectedProduct && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-100 flex items-end justify-center bg-slate-950/65 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        >
          <m.div
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[94vh] sm:max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[26px] border border-slate-200/90 bg-white shadow-2xl sm:rounded-3xl"
          >
            {/* Mobile Pull / Grab Handle */}
            <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
              <div className="h-1.25 w-12 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-rose-500 via-rose-600 to-red-600 text-white shadow-md shadow-rose-500/25 ring-4 ring-rose-50">
                  <Trash2 size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-tight">
                      Списание товара
                    </h3>
                    <span className="hidden sm:inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-700 border border-rose-200/60">
                      Расход со склада
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 truncate max-w-[220px] sm:max-w-sm mt-0.5">
                    {formatProductName(selectedProduct.name)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95"
                title="Закрыть"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3.5 sm:p-5 space-y-3.5 bg-slate-50/50">
              {/* Product Stock & Warehouse Context Card */}
              <div className="rounded-2xl border border-slate-200/90 bg-linear-to-br from-slate-50 via-white to-rose-50/25 p-3.5 sm:p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Текущий остаток
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 rounded-lg bg-slate-900 text-white px-2.5 py-1 shadow-xs">
                        <Package size={13} className="text-rose-400 shrink-0" />
                        <span className="font-mono text-xs sm:text-sm font-black tabular-nums">
                          {stockBreakdown.primary}
                        </span>
                      </div>
                      {stockBreakdown.secondary && (
                        <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-slate-600 shadow-2xs border border-slate-200/90">
                          {stockBreakdown.secondary}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right min-w-0 pl-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Склад списания
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200/80 px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs truncate max-w-[170px]">
                      <Warehouse size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate">{currentWarehouseName}</span>
                    </span>
                  </div>
                </div>

                {/* Real-time Dynamic Stock Projection Bar */}
                {quantityNum > 0 && (
                  <div className="pt-2.5 border-t border-slate-100 space-y-2">
                    {!isOverStock ? (
                      <>
                        {/* Progress comparison bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="text-slate-600">
                              Останется:{' '}
                              <strong className="font-mono text-emerald-700 font-black">
                                {remainingStock} {baseUnit}
                              </strong>
                            </span>
                            <span className="text-rose-600 font-mono">
                              Списывается: {quantityNum} {baseUnit} ({writeOffPercent}%)
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 flex p-0.5 border border-slate-200/60">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${Math.max(0, 100 - writeOffPercent)}%` }}
                              title={`Останется: ${remainingStock}`}
                            />
                            <div
                              className="h-full rounded-full bg-rose-500 transition-all duration-300"
                              style={{ width: `${writeOffPercent}%` }}
                              title={`Списывается: ${quantityNum}`}
                            />
                          </div>
                        </div>

                        {/* Estimated Loss Badge */}
                        {estimatedLoss > 0 && (
                          <div className="flex items-center justify-between rounded-xl bg-rose-50/80 border border-rose-200/70 px-3 py-1.5 text-xs">
                            <span className="font-bold text-rose-900 flex items-center gap-1.5">
                              <TrendingDown size={14} className="text-rose-600" />
                              Оценочная сумма списания:
                            </span>
                            <span className="font-mono font-black text-rose-700 text-sm">
                              ~{formatMoney(estimatedLoss, 'TJS')}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl bg-rose-100 border border-rose-300 px-3 py-2 text-xs font-bold text-rose-900">
                        <AlertCircle size={16} className="text-rose-600 shrink-0" />
                        <span>
                          Количество превышает остаток склада на{' '}
                          <strong className="font-mono font-black text-rose-700">
                            {quantityNum - stock} {baseUnit}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quantity Section with Stepper */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    Количество к списанию ({baseUnit}) <span className="text-rose-500">*</span>
                  </label>
                  {isOverStock && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-600 border border-rose-200">
                      <AlertCircle size={11} />
                      Превышение остатка
                    </span>
                  )}
                </div>

                {/* Stepper Control */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={quantityNum <= 1}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 shadow-xs transition-all hover:bg-slate-100 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Уменьшить на 1"
                  >
                    <Minus size={18} />
                  </button>

                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      value={writeOffData.quantity}
                      onChange={(event) => {
                        const val = event.target.value.replace(/[^\d]/g, '');
                        setWriteOffData((prev: any) => ({
                          ...prev,
                          quantity: val,
                        }));
                      }}
                      className={clsx(
                        'h-11 w-full rounded-xl border bg-slate-50/50 px-3 text-center font-mono text-xl sm:text-2xl font-black text-slate-900 outline-none transition-all shadow-2xs focus:bg-white placeholder:text-slate-300',
                        isOverStock
                          ? 'border-rose-400 text-rose-600 focus:ring-2 focus:ring-rose-500/20'
                          : 'border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10'
                      )}
                      placeholder="0"
                      autoFocus
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase">
                      {baseUnit}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={quantityNum >= stock}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 shadow-xs transition-all hover:bg-slate-100 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Увеличить на 1"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                {/* Quick Selection Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {[1, 5, 10].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleAddDelta(val)}
                      className="h-7.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all active:scale-95"
                    >
                      +{val}
                    </button>
                  ))}

                  {unitsPerPackage > 1 && (
                    <button
                      type="button"
                      onClick={() => handleAddDelta(unitsPerPackage)}
                      className="inline-flex items-center gap-1 h-7.5 rounded-lg border border-indigo-200 bg-indigo-50/80 px-2.5 text-xs font-bold text-indigo-700 shadow-2xs hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all active:scale-95"
                      title={`1 ${packageName} = ${unitsPerPackage} ${baseUnit}`}
                    >
                      <Boxes size={12} />
                      <span>+1 {packageName} ({unitsPerPackage})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSetAll}
                    className="h-7.5 ml-auto rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700 shadow-2xs hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all active:scale-95"
                    title="Списать весь доступный остаток"
                  >
                    Весь остаток ({stock})
                  </button>
                </div>
              </div>

              {/* Reason Presets & Custom Input */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                    Причина списания <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-400">Выберите причину</span>
                </div>

                {/* Preset Chips */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {reasonPresets.map((reason) => {
                    const isSelected = normalizedReason === reason.toLowerCase();
                    const Icon = getReasonPresetIcon(reason);
                    return (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setWriteOffData((prev: any) => ({ ...prev, reason: reason.toLowerCase() }))}
                        className={clsx(
                          'flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold transition-all active:scale-95 text-center',
                          isSelected
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25 ring-2 ring-rose-600 ring-offset-1'
                            : 'border border-slate-200/90 bg-slate-50/70 text-slate-700 hover:bg-slate-100/90 hover:border-slate-300'
                        )}
                      >
                        <Icon size={13} className={isSelected ? 'text-white' : 'text-slate-500'} />
                        <span className="truncate">{reason}</span>
                        {isSelected && <Check size={12} className="ml-auto shrink-0 text-white" />}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Note or Specific Details */}
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <FileText size={14} />
                  </div>
                  <input
                    type="text"
                    required
                    value={writeOffData.reason}
                    onChange={(event) => setWriteOffData((prev: any) => ({ ...prev, reason: event.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 shadow-2xs"
                    placeholder="Укажите подробности или примечание..."
                  />
                </div>
              </div>

              {/* Modal Actions Footer */}
              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-white px-4 py-3 sm:px-6 sm:py-3.5 -mx-3.5 -mb-3.5 sm:-mx-5 sm:-mb-5 mt-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition-all"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isOverStock || quantityNum <= 0 || !writeOffData.reason?.trim()}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 px-5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-rose-600/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  <Trash2 size={14} />
                  <span>
                    {quantityNum > 0 && !isOverStock
                      ? `Списать ${quantityNum} ${baseUnit}`
                      : 'Списать со склада'}
                  </span>
                </button>
              </div>
            </form>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
