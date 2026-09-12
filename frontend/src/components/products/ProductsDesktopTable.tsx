import { useEffect, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Edit,
  History,
  Image as ImageIcon,
  Layers,
  MoreVertical,
  PlusCircle,
  Scissors,
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

interface ProductsDesktopTableProps {
  products: any[];
  totalItems: number;
  isLoading: boolean;
  isAdmin: boolean;
  canTransferProducts: boolean;
  selectedWarehouseId: string;
  currentPage: number;
  pageSize: number;
  sortConfig: { key: string; direction: 'asc' | 'desc' | null };
  onSort: (key: string) => void;
  getDuplicateHintCount: (product: any) => number;
  onOpenMergeModal: (product: any) => void;
  onEditProduct: (product: any) => void;
  onRestockProduct: (product: any) => void;
  onShowBatches: (product: any) => void;
  onShowHistory: (product: any) => void;
  onOpenWriteOffModal: (product: any) => void;
  onTransferProduct: (product: any) => void;
  onDeleteProduct: (product: any) => void;
  onAddProduct: () => void;
}

function ProductRowActions({
  product,
  canTransferProducts,
  onEditProduct,
  onRestockProduct,
  onShowBatches,
  onShowHistory,
  onOpenWriteOffModal,
  onTransferProduct,
  onDeleteProduct,
}: {
  product: any;
  canTransferProducts: boolean;
  onEditProduct: (product: any) => void;
  onRestockProduct: (product: any) => void;
  onShowBatches: (product: any) => void;
  onShowHistory: (product: any) => void;
  onOpenWriteOffModal: (product: any) => void;
  onTransferProduct: (product: any) => void;
  onDeleteProduct: (product: any) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative inline-flex items-center justify-center gap-1.5" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => onRestockProduct(product)}
        className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-200/90 bg-emerald-50/80 text-emerald-700 shadow-2xs transition-all duration-150 active:scale-90 hover:border-emerald-600 hover:bg-emerald-600 hover:text-white hover:shadow-xs"
        title="Пополнить"
      >
        <PlusCircle size={15} />
      </button>

      <button
        type="button"
        onClick={() => onEditProduct(product)}
        className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50/70 text-indigo-700 shadow-2xs transition-all duration-150 active:scale-90 hover:border-indigo-600 hover:bg-indigo-600 hover:text-white hover:shadow-xs"
        title="Редактировать"
      >
        <Edit size={15} />
      </button>

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={clsx(
          'flex h-8 w-8 items-center justify-center rounded-xl border transition-all duration-150 active:scale-90 shadow-2xs',
          isOpen
            ? 'border-slate-900 bg-slate-900 text-white shadow-xs ring-2 ring-slate-900/10'
            : 'border-slate-200/90 bg-white text-slate-500 hover:border-slate-900 hover:bg-slate-900 hover:text-white'
        )}
        title="Ещё действия"
      >
        <MoreVertical size={15} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-56 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-2xl backdrop-blur-md text-left animate-in fade-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenWriteOffModal(product);
            }}
            disabled={Number(product.stock || 0) <= 0}
            className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100 transition-colors group-hover:bg-amber-500 group-hover:text-white">
              <Scissors size={14} />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-semibold text-slate-800 group-hover:text-slate-900">Списать</span>
              <span className="text-[10px] font-normal text-slate-400">Списание со склада</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onShowBatches(product);
            }}
            className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 border border-violet-100 transition-colors group-hover:bg-violet-500 group-hover:text-white">
              <Layers size={14} />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-semibold text-slate-800 group-hover:text-slate-900">Партии (FIFO)</span>
              <span className="text-[10px] font-normal text-slate-400">Партии и себестоимость</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onShowHistory(product);
            }}
            className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 border border-sky-100 transition-colors group-hover:bg-sky-500 group-hover:text-white">
              <History size={14} />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-semibold text-slate-800 group-hover:text-slate-900">История</span>
              <span className="text-[10px] font-normal text-slate-400">Движение товара</span>
            </div>
          </button>

          {canTransferProducts && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onTransferProduct(product);
              }}
              className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 transition-colors group-hover:bg-indigo-500 group-hover:text-white">
                <ArrowRightLeft size={14} />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-semibold text-slate-800 group-hover:text-slate-900">Перенос</span>
                <span className="text-[10px] font-normal text-slate-400">Между складами</span>
              </div>
            </button>
          )}

          <div className="my-1 border-t border-slate-100" />

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onDeleteProduct(product);
            }}
            className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100/70 text-rose-600 border border-rose-200/80 transition-colors group-hover:bg-rose-500 group-hover:text-white">
              <Trash2 size={14} />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-semibold text-rose-600">Удалить</span>
              <span className="text-[10px] font-normal text-rose-400">Удалить позицию</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

const SortIcon = ({
  sortConfig,
  sortKey,
}: {
  sortConfig: ProductsDesktopTableProps['sortConfig'];
  sortKey: string;
}) => {
  if (sortConfig.key !== sortKey) return null;
  return sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
};

export default function ProductsDesktopTable({
  products,
  totalItems,
  isLoading,
  isAdmin,
  canTransferProducts,
  selectedWarehouseId,
  currentPage,
  pageSize,
  sortConfig,
  onSort,
  getDuplicateHintCount,
  onOpenMergeModal,
  onEditProduct,
  onRestockProduct,
  onShowBatches,
  onShowHistory,
  onOpenWriteOffModal,
  onTransferProduct,
  onDeleteProduct,
  onAddProduct,
}: ProductsDesktopTableProps) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs md:block">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200/80 bg-slate-100/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <th className="w-12 px-3 py-2.5 text-slate-400 font-mono">№</th>
            <th className="cursor-pointer px-3 py-2.5 transition-colors hover:text-slate-900" onClick={() => onSort('name')}>
              <div className="flex items-center space-x-1.5">
                <span>Товар</span>
                <SortIcon sortConfig={sortConfig} sortKey="name" />
              </div>
            </th>
            {isAdmin && (
              <th className="cursor-pointer px-3 py-2.5 text-right pr-4 transition-colors hover:text-slate-900" onClick={() => onSort('costPrice')}>
                <div className="flex items-center justify-end space-x-1.5">
                  <span>Закупка</span>
                  <SortIcon sortConfig={sortConfig} sortKey="costPrice" />
                </div>
              </th>
            )}
            <th className="cursor-pointer px-3 py-2.5 text-right pr-4 transition-colors hover:text-slate-900" onClick={() => onSort('sellingPrice')}>
              <div className="flex items-center justify-end space-x-1.5">
                <span>Продажа</span>
                <SortIcon sortConfig={sortConfig} sortKey="sellingPrice" />
              </div>
            </th>
            <th className="cursor-pointer px-3 py-2.5 transition-colors hover:text-slate-900" onClick={() => onSort('stock')}>
              <div className="flex items-center space-x-1.5">
                <span>Остаток</span>
                <SortIcon sortConfig={sortConfig} sortKey="stock" />
              </div>
            </th>
            <th className="px-3 py-2.5 text-right pr-4">Приход</th>
            {isAdmin && <th className="px-3 py-2.5 text-center">Рентабельность</th>}
            {isAdmin && <th className="px-3 py-2.5 text-center">Действия</th>}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {products.map((product, index) => (
            <tr key={product.id} className="transition-colors hover:bg-slate-50">
              <td className="px-3 py-2.5 font-mono text-[11px] text-slate-400">{(currentPage - 1) * pageSize + index + 1}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center space-x-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200/80 bg-slate-50">
                    {product.photoUrl ? (
                      <img
                        src={resolveMediaUrl(product.photoUrl, product.id)}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        onError={(event) => handleBrokenImage(event, product.id)}
                      />
                    ) : (
                      <ImageIcon className="text-slate-400" size={15} />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold leading-tight text-slate-900">{formatProductName(product.name)}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="text-[10px] text-slate-400">{product.category?.name || 'Без категории'}</p>
                      {getDuplicateHintCount(product) > 0 && (
                        <button
                          onClick={() => onOpenMergeModal(product)}
                          className="rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.2 text-[9px] font-semibold uppercase tracking-wider text-amber-700"
                        >
                          Дубликат
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </td>

              {isAdmin && (
                <td className="px-3 py-2.5 text-right pr-4 font-mono text-xs tabular-nums">
                  {selectedWarehouseId ? (
                    <div className="flex flex-col items-end">
                      <p className="font-semibold text-slate-900">
                        {(() => {
                          const activeBatches = (product.batches || [])
                            .filter((batch: any) => Number(batch.remainingQuantity) > 0)
                            .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                          const currentBatch = activeBatches[0];
                          return formatMoney(currentBatch ? currentBatch.costPrice : product.costPrice);
                        })()}
                      </p>
                      <p className="text-[10px] text-slate-400">Посл: {formatMoney(product.costPrice)}</p>
                    </div>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
              )}

              <td className="px-3 py-2.5 text-right pr-4 font-mono text-xs font-bold tabular-nums text-slate-900">
                {selectedWarehouseId ? formatMoney(product.sellingPrice) : <span className="text-slate-300">-</span>}
              </td>

              <td className="px-3 py-2.5">
                <div className="flex items-center space-x-2">
                  <div
                    className={clsx(
                      'h-2 w-2 rounded-full',
                      product.stock <= product.minStock ? 'animate-pulse bg-rose-500' : 'bg-emerald-500'
                    )}
                  />
                  <div className={clsx('min-w-0 font-mono text-xs tabular-nums', product.stock <= product.minStock ? 'text-rose-600 font-semibold' : 'text-slate-900 font-medium')}>
                    <p className="whitespace-pre-line leading-tight">{getStockBreakdown(product).primary}</p>
                    {getStockBreakdown(product).secondary && (
                      <p className="text-[10px] text-slate-400 font-sans">{getStockBreakdown(product).secondary}</p>
                    )}
                  </div>
                </div>
              </td>

              <td className="px-3 py-2.5 text-right pr-4 font-mono text-xs tabular-nums text-slate-500">
                <p>
                  {product.totalIncoming}{' '}
                  <span className="text-[10px] uppercase text-slate-400 font-sans">{normalizeDisplayBaseUnit(product.unit || 'шт')}</span>
                </p>
              </td>

              {isAdmin && (
                <td className="px-3 py-2.5 text-center">
                  {selectedWarehouseId ? (
                    <div className="flex flex-col items-center space-y-1">
                      <p className="font-mono text-xs font-semibold tabular-nums text-slate-900">
                        {formatPercent(getProductEfficiencyMetrics(product).marginPercent, 1)}
                      </p>
                      <span className={clsx('inline-flex rounded-full border px-2 py-0.2 text-[9px] font-semibold', getProductEfficiencyMetrics(product).className)}>
                        {getProductEfficiencyMetrics(product).label}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
              )}

              {isAdmin && (
                <td className="px-3 py-2.5 text-center align-middle">
                  {selectedWarehouseId ? (
                    <ProductRowActions
                      product={product}
                      canTransferProducts={canTransferProducts}
                      onEditProduct={onEditProduct}
                      onRestockProduct={onRestockProduct}
                      onShowBatches={onShowBatches}
                      onShowHistory={onShowHistory}
                      onOpenWriteOffModal={onOpenWriteOffModal}
                      onTransferProduct={onTransferProduct}
                      onDeleteProduct={onDeleteProduct}
                    />
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
              )}
            </tr>
          ))}

          {totalItems === 0 && !isLoading && (
            <ProductsEmptyState
              variant="table"
              colSpan={isAdmin ? 7 : 5}
              onAddProduct={onAddProduct}
            />
          )}
        </tbody>
      </table>
    </div>
  );
}
