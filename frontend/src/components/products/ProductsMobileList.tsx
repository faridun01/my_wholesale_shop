import React from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  ChevronDown,
  History,
  Layers,
  Package,
  Pencil,
  PlusCircle,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { formatMoney, formatPercent } from '../../utils/format';
import { handleBrokenImage, resolveMediaUrl } from '../../utils/media';
import { formatProductName } from '../../utils/productName';
import {
  getProductEfficiencyMetrics,
  getStockBreakdown,
  normalizeDisplayBaseUnit,
} from '../../utils/productsViewUtils';
import ProductsEmptyState from './ProductsEmptyState';

interface ProductsMobileListProps {
  products: any[];
  totalItems: number;
  isLoading: boolean;
  isAdmin: boolean;
  isAggregateMode: boolean;
  canTransferProducts: boolean;
  selectedWarehouseId: string;
  currentPage: number;
  pageSize: number;
  expandedMobileActionsId: number | null;
  onToggleActions: (productId: number) => void;
  getDuplicateHintCount: (product: any) => number;
  onOpenMergeModal: (product: any) => void;
  onEditProduct: (product: any) => void;
  onRestockProduct: (product: any) => void;
  onShowHistory: (product: any) => void;
  onOpenWriteOffModal: (product: any) => void;
  onShowBatches: (product: any) => void;
  onTransferProduct: (product: any) => void;
  onDeleteProduct: (product: any) => void;
}

export default function ProductsMobileList({
  products,
  totalItems,
  isLoading,
  isAdmin,
  isAggregateMode,
  canTransferProducts,
  selectedWarehouseId,
  expandedMobileActionsId,
  onToggleActions,
  getDuplicateHintCount,
  onOpenMergeModal,
  onEditProduct,
  onRestockProduct,
  onShowHistory,
  onOpenWriteOffModal,
  onShowBatches,
  onTransferProduct,
  onDeleteProduct,
}: ProductsMobileListProps) {
  return (
    <div className="space-y-3.5 p-3 sm:p-4 md:hidden">
      {products.map((product, index) => {
        const isExpanded = expandedMobileActionsId === Number(product.id);
        const stockBreakdown = getStockBreakdown(product);
        const stockNumber = Number(product.stock || 0);
        const minStockNumber = Number(product.minStock || 0);
        const isOutOfStock = stockNumber <= 0;
        const isLowStock = !isOutOfStock && stockNumber <= minStockNumber;
        const efficiency = getProductEfficiencyMetrics(product);

        const activeBatches = (product.batches || [])
          .filter((batch: any) => Number(batch.remainingQuantity) > 0)
          .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const currentBatch = activeBatches[0];
        const costPrice = currentBatch ? currentBatch.costPrice : product.costPrice;

        return (
          <div
            key={`mobile-${product.id ?? product.name}-${index}`}
            className={clsx(
              'group relative overflow-hidden rounded-3xl border bg-white p-4 transition-all duration-200',
              isOutOfStock
                ? 'border-slate-200/80 bg-linear-to-b from-white to-rose-50/20 shadow-xs'
                : isLowStock
                  ? 'border-amber-200/70 bg-linear-to-b from-white to-amber-50/20 shadow-xs hover:border-amber-300'
                  : 'border-slate-200/80 shadow-[0_2px_12px_rgba(15,23,42,0.04)] hover:border-slate-300/90 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]'
            )}
          >
            {/* 1. Product Name: First at the top, full width without cramping */}
            <h4 className="text-[14.5px] sm:text-[15.5px] font-black text-slate-900 leading-snug tracking-tight break-words">
              {formatProductName(product.name)}
            </h4>

            {/* 2. Sub-row: Photo thumbnail & Category on the left, Menu button on the right */}
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                {/* Visual Thumbnail: product photo if available, or clean compact box icon */}
                <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100/90 shadow-2xs">
                  {product.photoUrl ? (
                    <img
                      src={resolveMediaUrl(product.photoUrl, product.id)}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(event) => handleBrokenImage(event, product.id)}
                    />
                  ) : (
                    <Package size={14} className="text-slate-400" />
                  )}
                </div>

                {/* Category Chip */}
                <span className="inline-flex items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50/80 px-2 py-0.5 text-[10.5px] font-bold text-indigo-700 max-w-[180px] truncate shadow-2xs">
                  <Tag size={10} className="shrink-0 text-indigo-500" />
                  <span className="truncate">{product.category?.name || 'Без категории'}</span>
                </span>

                {getDuplicateHintCount(product) > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenMergeModal(product)}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-linear-to-r from-amber-100 to-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800 shadow-2xs transition-transform active:scale-95 animate-pulse"
                  >
                    <Sparkles size={10} className="text-amber-600" />
                    <span>Дубликат</span>
                  </button>
                )}
              </div>

              {/* Repositioned Actions Menu Button */}
              {isAdmin && !isAggregateMode && (
                <button
                  type="button"
                  onClick={() => onToggleActions(Number(product.id))}
                  className={clsx(
                    'inline-flex h-7.5 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-all duration-150 active:scale-95 shadow-2xs',
                    isExpanded
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  )}
                  title="Действия с товаром"
                >
                  <span>Меню</span>
                  <ChevronDown
                    size={13}
                    className={clsx('transition-transform duration-200', isExpanded && 'rotate-180')}
                  />
                </button>
              )}
            </div>

            {/* Core Data Row: Stock Status on Left, Selling Price on Right */}
            <div className="mt-3.5 flex items-end justify-between gap-3 border-t border-slate-100/90 pt-3">
              {/* Left: Stock Status Badge */}
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Остаток на складе
                </span>
                <div
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-bold shadow-2xs transition-colors',
                    isOutOfStock
                      ? 'border-rose-200 bg-rose-50/90 text-rose-800'
                      : isLowStock
                        ? 'border-amber-200 bg-amber-50/90 text-amber-900'
                        : 'border-emerald-200/90 bg-emerald-50/90 text-emerald-900'
                  )}
                >
                  <span className="relative flex h-2 w-2 shrink-0">
                    {isLowStock && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    )}
                    <span
                      className={clsx(
                        'relative inline-flex h-2 w-2 rounded-full',
                        isOutOfStock ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                      )}
                    />
                  </span>
                  <span className="font-mono text-xs sm:text-sm font-black tabular-nums tracking-tight">
                    {stockBreakdown.primary}
                  </span>
                  {stockBreakdown.secondary && (
                    <span className="rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 shadow-2xs">
                      {stockBreakdown.secondary}
                    </span>
                  )}
                  {isOutOfStock && (
                    <span className="rounded-md bg-rose-200/80 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-900">
                      Нет
                    </span>
                  )}
                  {isLowStock && (
                    <span className="rounded-md bg-amber-200/80 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-900">
                      Мало
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Selling Price */}
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Цена продажи
                </span>
                <div className="inline-flex items-baseline gap-1">
                  <span className="font-mono text-base sm:text-lg font-black text-slate-950 tabular-nums tracking-tight">
                    {isAggregateMode ? '—' : formatMoney(product.sellingPrice)}
                  </span>
                  <span className="text-[10px] font-black text-slate-400">
                    TJS
                  </span>
                </div>
              </div>
            </div>

            {/* Admin Wholesale Metrics Strip (Закупка / Маржа / Приход) */}
            {isAdmin && (
              <div className="mt-3 grid grid-cols-3 divide-x divide-slate-200/70 rounded-2xl border border-slate-100 bg-linear-to-b from-slate-50/90 via-slate-50/50 to-slate-50/90 py-2 shadow-2xs">
                <div className="px-2 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Закупка
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-black text-slate-700 tabular-nums truncate">
                    {isAggregateMode ? '—' : formatMoney(costPrice)}
                  </p>
                </div>
                <div className="px-2 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Маржа
                  </p>
                  <div className="mt-0.5 flex items-center justify-center">
                    <span
                      className={clsx(
                        'inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-xs font-black tabular-nums',
                        efficiency.className?.includes('rose')
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-emerald-50 text-emerald-700'
                      )}
                    >
                      {isAggregateMode ? '—' : `${efficiency.marginPercent > 0 ? '+' : ''}${formatPercent(efficiency.marginPercent, 1)}`}
                    </span>
                  </div>
                </div>
                <div className="px-2 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Приход
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-black text-slate-700 tabular-nums truncate">
                    {product.totalIncoming} <span className="text-[10px] font-bold text-slate-400">{normalizeDisplayBaseUnit(product.unit || 'шт')}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Collapsible Actions Grid (Tactile luxury tiles) */}
            {isExpanded && isAdmin && !isAggregateMode && (
              <div className="mt-3.5 overflow-hidden rounded-2xl border border-slate-200/90 bg-linear-to-b from-slate-50/90 via-slate-50/40 to-white p-3 shadow-inner animate-in fade-in-50 duration-150">
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    Действия с товаром
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleActions(Number(product.id))}
                    className="text-[11px] font-bold text-slate-400 hover:text-slate-800 transition-colors"
                  >
                    Свернуть
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      label: 'Приход',
                      subtitle: 'Поступление',
                      icon: PlusCircle,
                      handler: onRestockProduct,
                      cardBg: 'bg-linear-to-br from-emerald-50/90 via-white to-emerald-50/30 border-emerald-200/90 hover:border-emerald-300 hover:bg-emerald-50/80',
                      iconBg: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/70',
                      titleColor: 'text-slate-900 group-hover:text-emerald-950',
                      subtitleColor: 'text-emerald-700/80',
                    },
                    {
                      label: 'Изменить',
                      subtitle: 'Редактировать',
                      icon: Pencil,
                      handler: onEditProduct,
                      cardBg: 'bg-linear-to-br from-blue-50/90 via-white to-blue-50/30 border-blue-200/90 hover:border-blue-300 hover:bg-blue-50/80',
                      iconBg: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200/70',
                      titleColor: 'text-slate-900 group-hover:text-blue-950',
                      subtitleColor: 'text-blue-700/80',
                    },
                    {
                      label: 'История',
                      subtitle: 'Движение товара',
                      icon: History,
                      handler: onShowHistory,
                      cardBg: 'bg-linear-to-br from-sky-50/90 via-white to-sky-50/30 border-sky-200/90 hover:border-sky-300 hover:bg-sky-50/80',
                      iconBg: 'bg-sky-100 text-sky-700 ring-1 ring-sky-200/70',
                      titleColor: 'text-slate-900 group-hover:text-sky-950',
                      subtitleColor: 'text-sky-700/80',
                    },
                    {
                      label: 'Списать',
                      subtitle: 'Списание со склада',
                      icon: AlertCircle,
                      handler: onOpenWriteOffModal,
                      disabled: Number(product.stock || 0) <= 0,
                      cardBg: 'bg-linear-to-br from-amber-50/90 via-white to-amber-50/30 border-amber-200/90 hover:border-amber-300 hover:bg-amber-50/80',
                      iconBg: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200/70',
                      titleColor: 'text-slate-900 group-hover:text-amber-950',
                      subtitleColor: 'text-amber-700/80',
                    },
                    {
                      label: 'Партии',
                      subtitle: 'Партии (FIFO)',
                      icon: Layers,
                      handler: onShowBatches,
                      cardBg: 'bg-linear-to-br from-violet-50/90 via-white to-violet-50/30 border-violet-200/90 hover:border-violet-300 hover:bg-violet-50/80',
                      iconBg: 'bg-violet-100 text-violet-700 ring-1 ring-violet-200/70',
                      titleColor: 'text-slate-900 group-hover:text-violet-950',
                      subtitleColor: 'text-violet-700/80',
                    },
                    ...(canTransferProducts
                      ? [
                          {
                            label: 'Перенести',
                            subtitle: 'Между складами',
                            icon: ArrowLeftRight,
                            handler: onTransferProduct,
                            cardBg: 'bg-linear-to-br from-indigo-50/90 via-white to-indigo-50/30 border-indigo-200/90 hover:border-indigo-300 hover:bg-indigo-50/80',
                            iconBg: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200/70',
                            titleColor: 'text-slate-900 group-hover:text-indigo-950',
                            subtitleColor: 'text-indigo-700/80',
                          },
                        ]
                      : []),
                    {
                      label: 'Удалить',
                      subtitle: 'Удалить позицию',
                      icon: Trash2,
                      handler: onDeleteProduct,
                      cardBg: 'bg-linear-to-br from-rose-50/90 via-white to-rose-50/30 border-rose-200/90 hover:border-rose-300 hover:bg-rose-50/80',
                      iconBg: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200/70',
                      titleColor: 'text-rose-700 group-hover:text-rose-800',
                      subtitleColor: 'text-rose-500/80',
                    },
                  ].map(({ label, subtitle, icon: Icon, handler, disabled, cardBg, iconBg, titleColor, subtitleColor }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => (handler as (p: any) => void)(product)}
                      disabled={disabled}
                      className={clsx(
                        'group flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition-all duration-150 active:scale-[0.96] shadow-2xs',
                        cardBg,
                        disabled
                          ? 'cursor-not-allowed opacity-40 grayscale-[60%]'
                          : 'hover:shadow-xs'
                      )}
                    >
                      <div className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-2xs transition-transform duration-150 group-hover:scale-105', iconBg)}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className={clsx('block text-xs font-bold truncate leading-tight', titleColor)}>
                          {label}
                        </span>
                        <span className={clsx('block text-[10px] truncate leading-tight mt-0.5 font-medium', subtitleColor)}>
                          {subtitle}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {totalItems === 0 && !isLoading && <ProductsEmptyState variant="mobile" />}
    </div>
  );
}
