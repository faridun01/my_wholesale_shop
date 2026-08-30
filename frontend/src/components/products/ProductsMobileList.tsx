import { ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';
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

const mobileMetricBaseClass =
  'min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]';

const MobileMetricLabel = ({ children }: { children: string }) => (
  <p className="wrap-break-word text-[9px] font-black uppercase leading-3 tracking-[0.12em] text-slate-400">
    {children}
  </p>
);

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
    <div className="space-y-3 p-3 md:hidden">
      {products.map((product, index) => (
        <div key={`mobile-${product.id ?? product.name}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-xs">
          <div className="border-b border-slate-100 bg-[#f4f5fb] p-3.5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/70 bg-white">
                {product.photoUrl ? (
                  <img
                    src={resolveMediaUrl(product.photoUrl, product.id)}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(event) => handleBrokenImage(event, product.id)}
                  />
                ) : (
                  <ImageIcon className="text-slate-400" size={18} />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 wrap-break-word text-sm font-semibold leading-snug text-slate-900">
                    {formatProductName(product.name)}
                  </p>
                  <span className="shrink-0 rounded-full bg-slate-200/60 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                    #{(currentPage - 1) * pageSize + index + 1}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-medium text-slate-600">
                    {product.category?.name || 'Без категории'}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-medium text-slate-500">
                    {selectedWarehouseId ? product.warehouse?.name || 'Склад' : 'Все склады'}
                  </span>
                  {getDuplicateHintCount(product) > 0 && (
                    <button
                      onClick={() => onOpenMergeModal(product)}
                      className="rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700"
                    >
                      Дубликат
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 p-3">
            <div
              className={clsx(
                'rounded-lg border px-3 py-2.5',
                product.stock <= product.minStock ? 'border-rose-200 bg-rose-50/70' : 'border-emerald-100 bg-emerald-50/60'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className={clsx(
                        'text-[10px] font-semibold uppercase tracking-[0.18em]',
                        product.stock <= product.minStock ? 'text-rose-500' : 'text-emerald-600'
                      )}
                    >
                      Остаток
                    </p>
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        product.stock <= product.minStock ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      )}
                    >
                      {product.stock <= product.minStock ? 'Низкий' : 'В норме'}
                    </span>
                  </div>
                  <p
                    className={clsx(
                      'mt-1 whitespace-pre-line wrap-break-word text-[17px] font-semibold leading-5',
                      product.stock <= product.minStock ? 'text-rose-700' : 'text-slate-900'
                    )}
                  >
                    {getStockBreakdown(product).primary}
                  </p>
                  {getStockBreakdown(product).secondary && (
                    <p
                      className={clsx(
                        'mt-1 wrap-break-word text-[11px] font-medium',
                        product.stock <= product.minStock ? 'text-rose-500' : 'text-slate-500'
                      )}
                    >
                      {getStockBreakdown(product).secondary}
                    </p>
                  )}
                </div>
                <div
                  className={clsx(
                    'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
                    product.stock <= product.minStock
                      ? 'bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.12)]'
                      : 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]'
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className={mobileMetricBaseClass}>
                <MobileMetricLabel>Продажа</MobileMetricLabel>
                <p className="mt-1.5 wrap-break-word text-[17px] font-bold leading-5 text-slate-900">
                  {isAggregateMode ? '-' : formatMoney(product.sellingPrice)}
                </p>
              </div>
              <div className={mobileMetricBaseClass}>
                <MobileMetricLabel>Приход</MobileMetricLabel>
                <p className="mt-1.5 wrap-break-word text-[17px] font-bold leading-5 text-slate-900">
                  {product.totalIncoming}{' '}
                  <span className="text-[10px] uppercase text-slate-400">{normalizeDisplayBaseUnit(product.unit || 'шт')}</span>
                </p>
              </div>
              {isAdmin && (
                <div className={mobileMetricBaseClass}>
                  <MobileMetricLabel>Закупка</MobileMetricLabel>
                  <div className="mt-1.5 flex flex-col">
                    {isAggregateMode ? (
                      <p className="wrap-break-word text-[17px] font-bold leading-5 text-slate-900">-</p>
                    ) : (
                      <>
                        <p className="wrap-break-word text-[17px] font-bold leading-5 text-slate-900">
                          {(() => {
                            const activeBatches = (product.batches || [])
                              .filter((batch: any) => Number(batch.remainingQuantity) > 0)
                              .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                            const currentBatch = activeBatches[0];
                            return formatMoney(currentBatch ? currentBatch.costPrice : product.costPrice);
                          })()}
                        </p>
                        <p className="mt-1 wrap-break-word text-[10px] font-medium text-slate-400">
                          Посл: {formatMoney(product.costPrice)}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
              {isAdmin && (
                <div className={mobileMetricBaseClass}>
                  <MobileMetricLabel>Рентабельность</MobileMetricLabel>
                  <div className="mt-1.5 flex flex-col items-start">
                    <p className="wrap-break-word text-[17px] font-bold leading-5 text-slate-900">
                      {isAggregateMode ? '-' : formatPercent(getProductEfficiencyMetrics(product).marginPercent, 1)}
                    </p>
                    {!isAggregateMode && (
                      <span className={clsx('mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight', getProductEfficiencyMetrics(product).className)}>
                        {getProductEfficiencyMetrics(product).label}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {isAdmin && !isAggregateMode && (
            <div className="border-t border-slate-200 p-3">
              <button
                type="button"
                onClick={() => onToggleActions(Number(product.id))}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-white"
              >
                <span>Действия</span>
                {expandedMobileActionsId === Number(product.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {expandedMobileActionsId === Number(product.id) && (
                <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/80">
                  {[
                    ['Изменить товар', onEditProduct, 'hover:bg-violet-50 hover:text-violet-700'],
                    ['Оформить приход', onRestockProduct, 'hover:bg-emerald-50 hover:text-emerald-700'],
                    ['Открыть историю', onShowHistory, 'hover:bg-sky-50 hover:text-sky-700'],
                    ['Списать товар', onOpenWriteOffModal, 'hover:bg-amber-50 hover:text-amber-700'],
                    ['Посмотреть партии', onShowBatches, 'hover:bg-violet-50 hover:text-violet-700'],
                    ...(canTransferProducts ? [['Перенести товар', onTransferProduct, 'hover:bg-amber-50 hover:text-amber-700']] : []),
                    ['Удалить товар', onDeleteProduct, 'hover:bg-rose-50 hover:text-rose-700'],
                  ].map(([label, handler, hoverClass], actionIndex) => (
                    <button
                      key={String(label)}
                      onClick={() => (handler as (nextProduct: any) => void)(product)}
                      disabled={label === 'Списать товар' && Number(product.stock || 0) <= 0}
                      className={clsx(
                        'flex w-full items-center justify-between bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition-all disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400',
                        actionIndex < 6 && 'border-b border-slate-200/80',
                        hoverClass
                      )}
                    >
                      <span>{String(label)}</span>
                      <ChevronDown size={14} className="-rotate-90 text-slate-300" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {totalItems === 0 && !isLoading && <ProductsEmptyState variant="mobile" />}
    </div>
  );
}
