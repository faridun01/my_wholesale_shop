import React from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  ChevronDown,
  History,
  Layers,
  Package,
  Pencil,
  Plus,
  PlusCircle,
  Tag,
  Trash2,
  Warehouse,
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
    <div className="space-y-3 p-2.5 sm:p-3 md:hidden">
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
            className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_2px_8px_rgba(15,23,42,0.03)] transition-all hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)]"
          >
            {/* Top row: Photo, title, tags, actions button */}
            <div className="flex items-start gap-3">
              {/* Product Photo / Icon with soft gradient */}
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50 to-slate-100/90 shadow-2xs">
                {product.photoUrl ? (
                  <img
                    src={resolveMediaUrl(product.photoUrl, product.id)}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(event) => handleBrokenImage(event, product.id)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600">
                    <Package size={22} className="opacity-80" />
                  </div>
                )}
              </div>

              {/* Product Info & Action Button */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[13px] sm:text-sm font-bold text-slate-900 leading-snug break-words">
                      {formatProductName(product.name)}
                    </h4>

                    {/* Meta Chips: Category & Warehouse */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 max-w-[130px] truncate">
                        <Tag size={10} className="shrink-0 text-slate-400" />
                        <span className="truncate">{product.category?.name || 'Без категории'}</span>
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200/60 bg-slate-50/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 max-w-[120px] truncate">
                        <Warehouse size={10} className="shrink-0 text-slate-400" />
                        <span className="truncate">{selectedWarehouseId ? product.warehouse?.name || 'Склад' : 'Все склады'}</span>
                      </span>

                      {getDuplicateHintCount(product) > 0 && (
                        <button
                          type="button"
                          onClick={() => onOpenMergeModal(product)}
                          className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 transition-colors hover:bg-amber-100"
                        >
                          Дубликат
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Top Right: Quick Actions Toggle */}
                  {isAdmin && !isAggregateMode && (
                    <div className="flex items-center gap-1 shrink-0">
                      {/* 1-tap quick restock button */}
                      <button
                        type="button"
                        onClick={() => onRestockProduct(product)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200/80 bg-emerald-50/90 text-emerald-700 shadow-2xs transition-all hover:bg-emerald-100 active:scale-95"
                        title="Быстрый приход"
                      >
                        <Plus size={14} className="stroke-[2.5]" />
                      </button>

                      {/* Full Actions Menu Toggle */}
                      <button
                        type="button"
                        onClick={() => onToggleActions(Number(product.id))}
                        className={clsx(
                          'flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold transition-all active:scale-95',
                          isExpanded
                            ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                            : 'border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
                        )}
                        title="Действия с товаром"
                      >
                        <span>Меню</span>
                        <ChevronDown
                          size={11}
                          className={clsx('transition-transform duration-200', isExpanded && 'rotate-180')}
                        />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Core Data Row: Stock Status on Left, Selling Price on Right */}
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
              {/* Stock Status Badge */}
              <div
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold shadow-2xs',
                  isOutOfStock
                    ? 'border-rose-200/80 bg-rose-50/80 text-rose-700'
                    : isLowStock
                      ? 'border-amber-200/80 bg-amber-50/80 text-amber-800'
                      : 'border-emerald-200/70 bg-emerald-50/80 text-emerald-800'
                )}
              >
                <span
                  className={clsx(
                    'h-2 w-2 shrink-0 rounded-full',
                    isOutOfStock
                      ? 'bg-rose-500'
                      : isLowStock
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-emerald-500'
                  )}
                />
                <span className="font-bold">{stockBreakdown.primary}</span>
                {stockBreakdown.secondary && (
                  <span className="text-[10px] opacity-75 font-medium">({stockBreakdown.secondary})</span>
                )}
                {isOutOfStock && (
                  <span className="ml-0.5 rounded bg-rose-200/70 px-1 py-0.2 text-[9px] font-bold uppercase text-rose-800">
                    Нет
                  </span>
                )}
                {isLowStock && (
                  <span className="ml-0.5 rounded bg-amber-200/70 px-1 py-0.2 text-[9px] font-bold uppercase text-amber-800">
                    Мало
                  </span>
                )}
              </div>

              {/* Selling Price */}
              <div className="text-right shrink-0">
                <div className="flex items-baseline justify-end gap-1">
                  <span className="font-mono text-base font-extrabold text-slate-900 tabular-nums">
                    {isAggregateMode ? '—' : formatMoney(product.sellingPrice)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">TJS</span>
                </div>
              </div>
            </div>

            {/* Admin Wholesale Metrics Strip (Закупка / Маржа / Приход) */}
            {isAdmin && (
              <div className="mt-2.5 grid grid-cols-3 divide-x divide-slate-200/60 rounded-xl border border-slate-100 bg-[#f8f9fc] py-1.5 text-center shadow-2xs">
                <div className="px-1">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Закупка</p>
                  <p className="mt-0.5 font-mono text-xs font-bold text-slate-700 tabular-nums truncate">
                    {isAggregateMode ? '—' : formatMoney(costPrice)}
                  </p>
                </div>
                <div className="px-1">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Маржа</p>
                  <p
                    className={clsx(
                      'mt-0.5 font-mono text-xs font-bold tabular-nums truncate',
                      efficiency.className?.includes('rose') ? 'text-rose-600' : 'text-emerald-600'
                    )}
                  >
                    {isAggregateMode ? '—' : `${efficiency.marginPercent > 0 ? '+' : ''}${formatPercent(efficiency.marginPercent, 1)}`}
                  </p>
                </div>
                <div className="px-1">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Приход</p>
                  <p className="mt-0.5 font-mono text-xs font-bold text-slate-700 tabular-nums truncate">
                    {product.totalIncoming} {normalizeDisplayBaseUnit(product.unit || 'шт')}
                  </p>
                </div>
              </div>
            )}

            {/* Collapsible Actions Grid (2-column compact tactile tiles) */}
            {isExpanded && isAdmin && !isAggregateMode && (
              <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2 animate-in fade-in-50 duration-150">
                {[
                  {
                    label: 'Приход',
                    icon: PlusCircle,
                    handler: onRestockProduct,
                    iconBg: 'bg-emerald-100 text-emerald-700',
                  },
                  {
                    label: 'Изменить',
                    icon: Pencil,
                    handler: onEditProduct,
                    iconBg: 'bg-blue-100 text-blue-700',
                  },
                  {
                    label: 'История',
                    icon: History,
                    handler: onShowHistory,
                    iconBg: 'bg-sky-100 text-sky-700',
                  },
                  {
                    label: 'Списать',
                    icon: AlertCircle,
                    handler: onOpenWriteOffModal,
                    disabled: Number(product.stock || 0) <= 0,
                    iconBg: 'bg-amber-100 text-amber-700',
                  },
                  {
                    label: 'Партии',
                    icon: Layers,
                    handler: onShowBatches,
                    iconBg: 'bg-violet-100 text-violet-700',
                  },
                  ...(canTransferProducts
                    ? [
                        {
                          label: 'Перенести',
                          icon: ArrowLeftRight,
                          handler: onTransferProduct,
                          iconBg: 'bg-indigo-100 text-indigo-700',
                        },
                      ]
                    : []),
                  {
                    label: 'Удалить',
                    icon: Trash2,
                    handler: onDeleteProduct,
                    iconBg: 'bg-rose-100 text-rose-700',
                  },
                ].map(({ label, icon: Icon, handler, disabled, iconBg }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => (handler as (p: any) => void)(product)}
                    disabled={disabled}
                    className={clsx(
                      'flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white p-2 text-left text-xs font-semibold shadow-2xs transition-all active:scale-95',
                      disabled
                        ? 'cursor-not-allowed opacity-40'
                        : 'hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <div className={clsx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-2xs', iconBg)}>
                      <Icon size={14} />
                    </div>
                    <span className="truncate text-slate-800 font-medium">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {totalItems === 0 && !isLoading && <ProductsEmptyState variant="mobile" />}
    </div>
  );
}
