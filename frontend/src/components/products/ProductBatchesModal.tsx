import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { clsx } from 'clsx';
import { Layers, Trash2, X } from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { formatProductName } from '../../utils/productName';

interface ProductBatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProduct: any;
  productBatches: any[];
  canManage?: boolean;
  onDeleteBatch?: (batchId: number) => void;
}

const normalizePackageName = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'упаковка';
  if (['мешок', 'мешка', 'мешков', 'bag'].includes(normalized)) return 'мешок';
  if (['коробка', 'коробки', 'коробок', 'box'].includes(normalized)) return 'коробка';
  if (['упаковка', 'упаковки', 'упаковок', 'pack'].includes(normalized)) return 'упаковка';
  if (['пачка', 'пачки', 'пачек'].includes(normalized)) return 'пачка';
  return normalized;
};

const normalizeDisplayBaseUnit = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'шт';
  if (['пачка', 'пачки', 'пачек', 'шт', 'штук', 'штука', 'штуки', 'pcs', 'piece', 'pieces'].includes(normalized)) {
    return 'шт';
  }
  return normalized;
};

const pluralizeRu = (count: number, forms: [string, string, string]) => {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;

  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
};

const formatCountWithUnit = (count: number, unit: string) => {
  const normalized = String(unit || '').trim().toLowerCase();
  const formsMap: Record<string, [string, string, string]> = {
    'шт': ['шт', 'шт', 'шт'],
    'штука': ['штука', 'штуки', 'штук'],
    'пачка': ['пачка', 'пачки', 'пачек'],
    'мешок': ['мешок', 'мешка', 'мешков'],
    'коробка': ['коробка', 'коробки', 'коробок'],
    'упаковка': ['упаковка', 'упаковки', 'упаковок'],
    'флакон': ['флакон', 'флакона', 'флаконов'],
    'ёмкость': ['ёмкость', 'ёмкости', 'ёмкостей'],
    'емкость': ['ёмкость', 'ёмкости', 'ёмкостей'],
    'бутылка': ['бутылка', 'бутылки', 'бутылок'],
  };

  const forms = formsMap[normalized] || [unit, unit, unit];
  return `${count} ${pluralizeRu(count, forms)}`;
};

const getQuantityBreakdown = (rawQty: number, product: any) => {
  const totalUnits = Math.max(0, Number(rawQty || 0));
  const baseUnit = normalizeDisplayBaseUnit(product?.baseUnitName || 'шт');
  const packagings = Array.isArray(product?.packagings) ? product.packagings : [];
  const defaultPackaging = packagings.find((p: any) => p.isDefault) || packagings[0];
  const unitsPerPackage = Number(defaultPackaging?.unitsPerPackage || 0);
  const packageName = normalizePackageName(defaultPackaging?.packageName || 'упаковка');

  if (!unitsPerPackage || unitsPerPackage <= 1 || totalUnits <= 0) {
    return {
      primary: formatCountWithUnit(totalUnits, baseUnit),
      secondary: null,
    };
  }

  const packageCount = Math.floor(totalUnits / unitsPerPackage);
  const remainderUnits = totalUnits % unitsPerPackage;

  if (packageCount === 0) {
    return {
      primary: formatCountWithUnit(remainderUnits, baseUnit),
      secondary: null,
    };
  }

  return {
    primary:
      remainderUnits > 0
        ? `${formatCountWithUnit(packageCount, packageName)} + ${remainderUnits} ${baseUnit}`
        : formatCountWithUnit(packageCount, packageName),
    secondary: `${totalUnits} ${baseUnit} всего`,
  };
};

export default function ProductBatchesModal({
  isOpen,
  onClose,
  selectedProduct,
  productBatches,
  canManage = false,
  onDeleteBatch,
}: ProductBatchesModalProps) {
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

  if (!isOpen || !selectedProduct) return null;

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
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl sm:max-h-[85vh] sm:rounded-2xl"
          >
            {/* Mobile Drag Indicator */}
            <div className="flex justify-center pt-2 pb-0.5 sm:hidden">
              <div className="h-1 w-9 rounded-full bg-slate-300" />
            </div>

            {/* Compact Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 sm:px-5 sm:py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs">
                  <Layers size={15} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">Партии товара (FIFO)</h3>
                  <p className="text-[11px] font-medium text-slate-500 truncate max-w-[220px] sm:max-w-md">
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

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3">
              {/* Compact Information Notice */}
              <div className="rounded-xl border border-amber-200/60 bg-amber-50/80 px-3 py-2 text-[11px] font-medium text-amber-900">
                Списание происходит автоматически по принципу <span className="font-bold">FIFO</span>: сначала расходуются самые ранние партии.
              </div>

              {/* Mobile Cards List */}
              <div className="space-y-2 sm:hidden">
                {productBatches.map((b, i) => {
                  const quantityInfo = getQuantityBreakdown(b.quantity, selectedProduct);
                  const remainingInfo = getQuantityBreakdown(b.remainingQuantity, selectedProduct);
                  const isNext = i === 0 && Number(b.remainingQuantity || 0) > 0;

                  return (
                    <div
                      key={b.id}
                      className={clsx(
                        'rounded-xl border p-3 space-y-2 shadow-2xs transition-all',
                        isNext ? 'border-violet-200 bg-violet-50/30' : 'border-slate-200/80 bg-white',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {new Date(b.createdAt).toLocaleDateString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {b.warehouse?.name || 'Основной склад'}
                          </p>
                        </div>
                        {isNext && (
                          <span className="rounded-md bg-violet-600 px-2 py-0.5 text-[9px] font-bold uppercase text-white tracking-wider">
                            След. на списание
                          </span>
                        )}
                      </div>

                      {/* 3-Column Metrics Strip */}
                      <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-slate-50/80 p-2 text-center text-xs">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Начальное</span>
                          <span className="font-semibold text-slate-800 text-[11px] block">{quantityInfo.primary}</span>
                        </div>
                        <div className="border-x border-slate-200/60 px-1">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Остаток</span>
                          <span className="font-bold text-emerald-700 text-[11px] block">{remainingInfo.primary}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Себест.</span>
                          <span className="font-bold text-slate-900 text-[11px] block">{formatMoney(b.costPrice)}</span>
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            disabled={!b.canDelete}
                            onClick={() => onDeleteBatch?.(b.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-rose-100 transition-colors"
                          >
                            <Trash2 size={11} />
                            <span>Удалить партию</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {productBatches.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs font-semibold text-slate-400">
                    Партий не найдено
                  </div>
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-hidden rounded-xl border border-slate-200/80">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-3">Дата закупки</th>
                      <th className="py-2.5 px-3">Склад</th>
                      <th className="py-2.5 px-3 text-right">Начальное кол-во</th>
                      <th className="py-2.5 px-3 text-right">Остаток</th>
                      <th className="py-2.5 px-3 text-right">Цена закупки</th>
                      {canManage && <th className="py-2.5 px-3 text-right">Действия</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productBatches.map((b, i) => {
                      const quantityInfo = getQuantityBreakdown(b.quantity, selectedProduct);
                      const remainingInfo = getQuantityBreakdown(b.remainingQuantity, selectedProduct);
                      const isNext = i === 0 && Number(b.remainingQuantity || 0) > 0;

                      return (
                        <tr key={b.id} className={clsx('hover:bg-slate-50/50 transition-colors', isNext && 'bg-violet-50/20')}>
                          <td className="py-2.5 px-3 font-medium text-slate-600">
                            {new Date(b.createdAt).toLocaleDateString('ru-RU')}
                            {isNext && (
                              <span className="ml-2 rounded-md bg-violet-600 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white tracking-wider">
                                След.
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-600">{b.warehouse?.name || '---'}</td>
                          <td className="py-2.5 px-3 text-right text-slate-500">
                            <div className="font-semibold">{quantityInfo.primary}</div>
                            {quantityInfo.secondary && (
                              <div className="text-[10px] text-slate-400">{quantityInfo.secondary}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            <div className="text-emerald-700">{remainingInfo.primary}</div>
                            {remainingInfo.secondary && (
                              <div className="text-[10px] text-slate-400">{remainingInfo.secondary}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {formatMoney(b.costPrice)}
                          </td>
                          {canManage && (
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                disabled={!b.canDelete}
                                onClick={() => onDeleteBatch?.(b.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-rose-100 transition-colors"
                              >
                                <Trash2 size={11} />
                                <span>Удалить</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}

                    {productBatches.length === 0 && (
                      <tr>
                        <td colSpan={canManage ? 6 : 5} className="py-8 text-center text-xs font-semibold text-slate-400">
                          Партий не найдено
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Compact Footer */}
            <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 sm:px-5 sm:py-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200/80 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Закрыть
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
