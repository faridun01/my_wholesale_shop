import {
  AlertCircle,
  ArrowLeftRight,
  ChevronDown,
  History,
  Image as ImageIcon,
  Layers,
  Package,
  Pencil,
  PlusCircle,
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
  currentPage,
  pageSize,
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
    <div className="space-y-2.5 p-2.5 md:hidden">
      {products.map((product, index) => {
        const isExpanded = expandedMobileActionsId === Number(product.id);
        const stockBreakdown = getStockBreakdown(product);
        const isLowStock = Number(product.stock || 0) <= Number(product.minStock || 0);
        const efficiency = getProductEfficiencyMetrics(product);

        const activeBatches = (product.batches || [])
          .filter((batch: any) => Number(batch.remainingQuantity) > 0)
          .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const currentBatch = activeBatches[0];
        const costPrice = currentBatch ? currentBatch.costPrice : product.costPrice;

        return (
          <div
            key={`mobile-${product.id ?? product.name}-${index}`}
            className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all hover:border-slate-300 hover:shadow-xs"
          >
            {/* Top row: Photo, title, tags, actions button */}
            <div className="flex items-start gap-2.5">
              {/* Product Photo */}
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/60 bg-slate-50 shadow-2xs">
                {product.photoUrl ? (
                  <img
                    src={resolveMediaUrl(product.photoUrl, product.id)}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(event) => handleBrokenImage(event, product.id)}
                  />
                ) : (
                  <Package className="text-slate-400" size={18} />
                )}
              </div>

              {/* Product Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-bold text-slate-900 leading-tight">
                      {formatProductName(product.name)}
                    </h4>

                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="truncate max-w-[120px] font-medium text-slate-600">
                        {product.category?.name || 'Без категории'}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="truncate max-w-[110px] text-slate-400">
                        {selectedWarehouseId ? product.warehouse?.name || 'Склад' : 'Все склады'}
                      </span>
                      {getDuplicateHintCount(product) > 0 && (
                        <button
                          type="button"
                          onClick={() => onOpenMergeModal(product)}
                          className="ml-0.5 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700"
                        >
                          Дубликат
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Actions toggle button */}
                  {isAdmin && !isAggregateMode && (
                    <button
                      type="button"
                      onClick={() => onToggleActions(Number(product.id))}
                      className={clsx(
                        'flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all active:scale-95',
                        isExpanded
                          ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
                      )}
                      title="Действия с товаром"
                    >
                      <span>Действия</span>
                      <ChevronDown
                        size={11}
                        className={clsx('transition-transform duration-200', isExpanded && 'rotate-180')}
                      />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Core Row: Stock on Left, Price on Right */}
            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
              {/* Stock Status Indicator */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={clsx(
                    'h-2 w-2 shrink-0 rounded-full',
                    isLowStock ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                  )}
                />
                <div className="flex items-baseline gap-1 truncate text-xs">
                  <span className="font-semibold text-slate-800">{stockBreakdown.primary}</span>
                  {stockBreakdown.secondary && (
                    <span className="text-[10px] text-slate-400 truncate">({stockBreakdown.secondary})</span>
                  )}
                </div>
                {isLowStock && (
                  <span className="shrink-0 rounded bg-rose-50 border border-rose-200/80 px-1.5 py-0.2 text-[9px] font-bold text-rose-700">
                    {Number(product.stock || 0) <= 0 ? 'Нет' : 'Мало'}
                  </span>
                )}
              </div>

              {/* Selling Price */}
              <div className="text-right shrink-0">
                <div className="flex items-baseline justify-end gap-1">
                  <span className="font-mono text-base font-extrabold text-slate-900 tabular-nums">
                    {isAggregateMode ? '—' : formatMoney(product.sellingPrice)}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">TJS</span>
                </div>
              </div>
            </div>

            {/* Admin Wholesale Metrics Strip */}
            {isAdmin && (
              <div className="mt-2 grid grid-cols-3 divide-x divide-slate-200/60 rounded-xl border border-slate-100 bg-slate-50/70 py-1.5 text-center">
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

            {/* Collapsible Actions Menu */}
            {isExpanded && isAdmin && !isAggregateMode && (
              <div className="mt-2.5 space-y-1 rounded-xl border border-slate-200/90 bg-slate-50/50 p-1.5 animate-in fade-in-50 duration-150">
                {[
                  {
                    label: 'Изменить товар',
                    icon: Pencil,
                    handler: onEditProduct,
                    color: 'text-slate-700 hover:bg-white',
                  },
                  {
                    label: 'Оформить приход',
                    icon: PlusCircle,
                    handler: onRestockProduct,
                    color: 'text-emerald-700 hover:bg-emerald-50',
                  },
                  {
                    label: 'История товара',
                    icon: History,
                    handler: onShowHistory,
                    color: 'text-sky-700 hover:bg-sky-50',
                  },
                  {
                    label: 'Списать товар',
                    icon: AlertCircle,
                    handler: onOpenWriteOffModal,
                    disabled: Number(product.stock || 0) <= 0,
                    color: 'text-amber-700 hover:bg-amber-50',
                  },
                  {
                    label: 'Посмотреть партии',
                    icon: Layers,
                    handler: onShowBatches,
                    color: 'text-violet-700 hover:bg-violet-50',
                  },
                  ...(canTransferProducts
                    ? [
                        {
                          label: 'Перенести товар',
                          icon: ArrowLeftRight,
                          handler: onTransferProduct,
                          color: 'text-indigo-700 hover:bg-indigo-50',
                        },
                      ]
                    : []),
                  {
                    label: 'Удалить товар',
                    icon: Trash2,
                    handler: onDeleteProduct,
                    color: 'text-rose-600 hover:bg-rose-50',
                  },
                ].map(({ label, icon: Icon, handler, disabled, color }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => (handler as (p: any) => void)(product)}
                    disabled={disabled}
                    className={clsx(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors',
                      disabled ? 'cursor-not-allowed text-slate-300' : color
                    )}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="flex-1">{label}</span>
                    <ChevronDown size={12} className="-rotate-90 opacity-40" />
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
