import React, { useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import {
  Trash2,
  X,
  AlertTriangle,
  ShieldAlert,
  Package,
  Warehouse,
  FolderTree,
  Loader2,
} from 'lucide-react';
import { formatProductName } from '../../utils/productName';
import { formatMoney } from '../../utils/format';
import { normalizeDisplayBaseUnit } from '../../utils/productsViewUtils';
import { resolveMediaUrl, handleBrokenImage } from '../../utils/media';

interface ProductDeleteModalProps {
  isOpen: boolean;
  product: any;
  warehouses: any[];
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function ProductDeleteModal({
  isOpen,
  product,
  warehouses,
  onClose,
  onConfirm,
}: ProductDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !product) return null;

  const stock = Number(product.stock || 0);
  const baseUnit = normalizeDisplayBaseUnit(product.baseUnitName || product.unit);
  const warehouseName =
    product.warehouse?.name ||
    warehouses.find((w) => w.id === product.warehouseId)?.name ||
    'Основной склад';
  const categoryName = product.category?.name || product.category || '';
  const price = Number(product.sellingPrice || 0);

  const handleConfirm = async () => {
    try {
      setIsDeleting(true);
      await Promise.resolve(onConfirm());
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!isDeleting) onClose();
          }}
          className="fixed inset-0 z-100 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-xs sm:items-center sm:p-3"
        >
          <m.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] sm:max-h-[86vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-200/90 bg-white shadow-2xl sm:rounded-2xl"
          >
            {/* Mobile Grab Handle */}
            <div className="flex justify-center pt-2 pb-0.5 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-3.5 py-2.5 sm:px-5 sm:py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-rose-500 via-rose-600 to-red-600 text-white shadow-xs">
                  <Trash2 size={15} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black tracking-tight text-slate-900 leading-tight">
                    Удалить товар навсегда?
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500 truncate max-w-[200px] sm:max-w-xs mt-0.5">
                    Подтверждение удаления позиции
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95 disabled:opacity-40"
                title="Закрыть"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-3 sm:p-4 space-y-2.5 bg-slate-50/40">
              {/* Product Info Card */}
              <div className="rounded-xl border border-rose-100/90 bg-linear-to-br from-rose-50/35 via-white to-rose-50/15 p-3 space-y-2.5 shadow-2xs">
                <div className="flex items-start gap-3">
                  {/* Photo thumbnail */}
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-center">
                    {product.photoUrl ? (
                      <img
                        src={resolveMediaUrl(product.photoUrl, product.name || 'product')}
                        alt={product.name || 'Товар'}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => handleBrokenImage(e, product.name || 'product')}
                      />
                    ) : (
                      <Package size={22} className="text-slate-400" />
                    )}
                  </div>

                  {/* Name and Meta */}
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-black text-slate-900 leading-snug">
                      {formatProductName(product.name)}
                    </h4>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {categoryName && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 shadow-2xs">
                          <FolderTree size={10} className="text-slate-400" />
                          <span className="truncate max-w-[120px]">{categoryName}</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 shadow-2xs">
                        <Warehouse size={10} className="text-slate-400" />
                        <span className="truncate max-w-[120px]">{warehouseName}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stock & Price metrics */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-rose-100/70">
                  <div className="rounded-lg bg-white/90 border border-slate-200/80 p-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Остаток
                    </span>
                    <span className="font-mono text-xs sm:text-sm font-black text-slate-900">
                      {stock} {baseUnit}
                    </span>
                  </div>
                  <div className="rounded-lg bg-white/90 border border-slate-200/80 p-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Цена
                    </span>
                    <span className="font-mono text-xs sm:text-sm font-black text-slate-900">
                      {price > 0 ? formatMoney(price, 'TJS') : '—'}
                    </span>
                  </div>
                </div>

                {/* Warning if stock > 0 */}
                {stock > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200/90 p-2 text-[11px] font-bold text-amber-900">
                    <AlertTriangle size={14} className="shrink-0 text-amber-600" />
                    <span>На складе еще есть {stock} {baseUnit}. При удалении этот товар пропадет из каталога.</span>
                  </div>
                )}
              </div>

              {/* Safety notice */}
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-white p-2.5 text-xs text-slate-600 shadow-2xs">
                <ShieldAlert size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed font-medium text-slate-600">
                  Если товар уже использовался в продажах или накладных, база данных не разрешит полное удаление для сохранения финансовой отчетности.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-3.5 py-2 sm:px-5 sm:py-2.5 shadow-xs">
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="h-8.5 rounded-lg border border-slate-200/90 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs disabled:opacity-40"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isDeleting}
                className="inline-flex h-8.5 items-center justify-center gap-1.5 rounded-lg bg-linear-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 px-5 text-xs font-black uppercase tracking-wider text-white shadow-xs active:scale-95 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Удаление...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Удалить товар</span>
                  </>
                )}
              </button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
