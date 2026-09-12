import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { clsx } from 'clsx';
import { History, RotateCcw, X } from 'lucide-react';
import { formatProductName } from '../../utils/productName';
import { formatTransactionReason } from '../../utils/format';

interface ProductHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName?: string | null;
  product?: any;
  productHistory: any[];
  onReverseIncoming?: (transactionId: number) => void | Promise<void>;
  onReverseCorrectionWriteOff?: (transactionId: number) => void | Promise<void>;
  onReturnWriteOff?: (transaction: any) => void | Promise<void>;
  onDeleteWriteOffPermanently?: (transaction: any) => void | Promise<void>;
  onWriteOff?: () => void | Promise<void>;
}

const getTypeLabel = (type: string) => {
  if (type === 'incoming') return 'Приход';
  if (type === 'outgoing') return 'Расход';
  if (type === 'price_change' || type === 'adjustment') return 'Изменение';
  return 'Перенос';
};

const getTypeClassName = (type: string) =>
  clsx(
    'rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
    type === 'incoming'
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
      : type === 'outgoing'
        ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
        : type === 'price_change' || type === 'adjustment'
          ? 'bg-sky-50 text-sky-700 border border-sky-200/60'
          : 'bg-amber-50 text-amber-700 border border-amber-200/60',
  );

const getWriteOffStatusLabel = (status: string | null | undefined) => {
  if (status === 'partial_return') return 'Частично возврат';
  if (status === 'full_return') return 'Полный возврат';
  if (status === 'return_record') return 'Возврат списания';
  if (status === 'writeoff') return 'Списание';
  return null;
};

const getWriteOffStatusClassName = (status: string | null | undefined) =>
  clsx(
    'rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
    status === 'partial_return'
      ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
      : status === 'full_return'
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
        : status === 'return_record'
          ? 'bg-sky-50 text-sky-700 border border-sky-200/60'
          : status === 'writeoff'
            ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
            : 'hidden',
  );

const normalizePackageName = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'упаковка';
  if (['мешок', 'мешка', 'мешков', 'bag'].includes(normalized)) return 'мешок';
  if (['коробка', 'коробки', 'коробок', 'box'].includes(normalized)) return 'коробка';
  if (['упаковка', 'упаковки', 'упаковок', 'pack'].includes(normalized)) return 'упаковка';
  if (['пачка', 'пачки', 'пачек'].includes(normalized)) return 'пачка';
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
  const intCount = Math.round(Number(count) || 0);
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
  return `${intCount} ${pluralizeRu(intCount, forms)}`;
};

const getQuantityBreakdown = (rawQty: number, product: any) => {
  const baseUnit = product?.baseUnitName || 'шт';
  const qty = Number(rawQty || 0);
  const sign = qty > 0 ? '+' : qty < 0 ? '−' : '';
  const absQty = Math.abs(qty);

  const packagings = Array.isArray(product?.packagings) ? product.packagings : [];
  const defaultPackaging = packagings.find((p: any) => p.isDefault) || packagings[0];
  const unitsPerPackage = Number(defaultPackaging?.unitsPerPackage || 0);
  const packageName = normalizePackageName(defaultPackaging?.packageName || 'упаковка');

  if (!unitsPerPackage || unitsPerPackage <= 1) {
    return `${sign}${formatCountWithUnit(absQty, baseUnit)}`;
  }

  const packageCount = Math.floor(absQty / unitsPerPackage);
  const remainderUnits = absQty % unitsPerPackage;

  if (packageCount === 0) {
    return `${sign}${formatCountWithUnit(remainderUnits, baseUnit)}`;
  }

  if (remainderUnits > 0) {
    return `${sign}${formatCountWithUnit(packageCount, packageName)} + ${remainderUnits} ${baseUnit}`;
  }

  return `${sign}${formatCountWithUnit(packageCount, packageName)}`;
};

export default function ProductHistoryModal({
  isOpen,
  onClose,
  productName,
  product,
  productHistory,
  onReverseIncoming,
  onReverseCorrectionWriteOff,
  onReturnWriteOff,
  onDeleteWriteOffPermanently,
  onWriteOff,
}: ProductHistoryModalProps) {
  const [historyFilter, setHistoryFilter] = useState<'all' | 'incoming' | 'writeoff' | 'returns'>('all');

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

  useEffect(() => {
    if (!isOpen) {
      setHistoryFilter('all');
    }
  }, [isOpen]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'incoming') {
      return productHistory.filter((item) => item.type === 'incoming');
    }

    if (historyFilter === 'writeoff') {
      return productHistory.filter(
        (item) => item.writeOffStatus === 'writeoff' || item.writeOffStatus === 'partial_return' || item.writeOffStatus === 'full_return',
      );
    }

    if (historyFilter === 'returns') {
      return productHistory.filter((item) => item.writeOffStatus === 'return_record');
    }

    return productHistory;
  }, [historyFilter, productHistory]);

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
                <div className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-xs">
                  <History size={15} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">История товара</h3>
                  <p className="text-[11px] font-medium text-slate-500 truncate max-w-[200px] sm:max-w-md">
                    {formatProductName(productName)}
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
              {/* Quick Filter Tabs */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'all', label: 'Все' },
                  { key: 'incoming', label: 'Приход' },
                  { key: 'writeoff', label: 'Списания' },
                  { key: 'returns', label: 'Возвраты' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setHistoryFilter(item.key as typeof historyFilter)}
                    className={clsx(
                      'rounded-xl border px-3 py-1 text-[11px] font-bold transition-all',
                      historyFilter === item.key
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Mobile Cards List */}
              <div className="space-y-2 sm:hidden">
                {filteredHistory.map((t, i) => {
                  const qtyNumber = Number(t.qtyChange ?? 0);
                  const isPositive = qtyNumber > 0;

                  return (
                    <div key={i} className="rounded-xl border border-slate-200/80 bg-white p-3 space-y-2 shadow-2xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {new Date(t.createdAt).toLocaleString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {t.warehouseName || t.warehouse?.name || 'Основной склад'} • {t.username || 'admin'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <span className={getTypeClassName(t.type)}>{getTypeLabel(t.type)}</span>
                          {getWriteOffStatusLabel(t.writeOffStatus) && (
                            <span className={getWriteOffStatusClassName(t.writeOffStatus)}>
                              {getWriteOffStatusLabel(t.writeOffStatus)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                        <span className="text-[11px] text-slate-500 font-medium">Изменение:</span>
                        <span className={clsx('font-bold', isPositive ? 'text-emerald-700' : 'text-rose-600')}>
                          {getQuantityBreakdown(t.qtyChange ?? 0, product)}
                        </span>
                      </div>

                      {t.reason && (
                        <p className="text-[11px] text-slate-600 italic bg-slate-50/50 rounded-lg px-2.5 py-1">
                          {formatTransactionReason(t.reason)}
                        </p>
                      )}

                      {/* Action buttons if available */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {t.canReverseIncoming && onReverseIncoming && (
                          <button
                            type="button"
                            onClick={() => onReverseIncoming(Number(t.transactionId))}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                          >
                            <RotateCcw size={12} />
                            <span>Отменить приход</span>
                          </button>
                        )}
                        {t.canReverseCorrectionWriteOff && onReverseCorrectionWriteOff && (
                          <button
                            type="button"
                            onClick={() => onReverseCorrectionWriteOff(Number(t.transactionId))}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
                          >
                            <RotateCcw size={12} />
                            <span>Отменить</span>
                          </button>
                        )}
                        {t.canReturnWriteOff && onReturnWriteOff && (
                          <button
                            type="button"
                            onClick={() => onReturnWriteOff(t)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                          >
                            <RotateCcw size={12} />
                            <span>Вернуть на склад</span>
                          </button>
                        )}
                        {t.canDeleteWriteOffPermanently && onDeleteWriteOffPermanently && (
                          <button
                            type="button"
                            onClick={() => onDeleteWriteOffPermanently(t)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                          >
                            <X size={12} />
                            <span>Удалить навсегда</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {!filteredHistory.length && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs font-semibold text-slate-400">
                    Нет записей по выбранному фильтру
                  </div>
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-hidden rounded-xl border border-slate-200/80">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-3">Дата</th>
                      <th className="py-2.5 px-3">Тип</th>
                      <th className="py-2.5 px-3 text-right">Кол-во</th>
                      <th className="py-2.5 px-3">Склад</th>
                      <th className="py-2.5 px-3">Причина</th>
                      <th className="py-2.5 px-3">Пользователь</th>
                      <th className="py-2.5 px-3 text-right">Действие</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistory.map((t, i) => {
                      const qtyNumber = Number(t.qtyChange ?? 0);
                      const isPositive = qtyNumber > 0;

                      return (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {new Date(t.createdAt).toLocaleString('ru-RU')}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap items-center gap-1">
                              <span className={getTypeClassName(t.type)}>{getTypeLabel(t.type)}</span>
                              {getWriteOffStatusLabel(t.writeOffStatus) && (
                                <span className={getWriteOffStatusClassName(t.writeOffStatus)}>
                                  {getWriteOffStatusLabel(t.writeOffStatus)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold">
                            <span className={isPositive ? 'text-emerald-700' : 'text-rose-600'}>
                              {getQuantityBreakdown(t.qtyChange ?? 0, product)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-medium">
                            {t.warehouseName || t.warehouse?.name || '---'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 italic max-w-xs truncate">
                            {formatTransactionReason(t.reason)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-medium">{t.username || '---'}</td>
                          <td className="py-2.5 px-3 text-right">
                            {t.canReverseIncoming && onReverseIncoming ? (
                              <button
                                type="button"
                                onClick={() => onReverseIncoming(Number(t.transactionId))}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-100"
                              >
                                <RotateCcw size={11} />
                                <span>Отменить</span>
                              </button>
                            ) : t.canReverseCorrectionWriteOff && onReverseCorrectionWriteOff ? (
                              <button
                                type="button"
                                onClick={() => onReverseCorrectionWriteOff(Number(t.transactionId))}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-100"
                              >
                                <RotateCcw size={11} />
                                <span>Отменить</span>
                              </button>
                            ) : t.canReturnWriteOff && onReturnWriteOff ? (
                              <button
                                type="button"
                                onClick={() => onReturnWriteOff(t)}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"
                              >
                                <RotateCcw size={11} />
                                <span>Вернуть</span>
                              </button>
                            ) : t.canDeleteWriteOffPermanently && onDeleteWriteOffPermanently ? (
                              <button
                                type="button"
                                onClick={() => onDeleteWriteOffPermanently(t)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-100"
                              >
                                <X size={11} />
                                <span>Удалить</span>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {!filteredHistory.length && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-xs font-semibold text-slate-400">
                          Нет записей по выбранному фильтру
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
