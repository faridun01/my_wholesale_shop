import {
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Edit,
  History,
  Image as ImageIcon,
  Layers,
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
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-100 bg-[#f4f5fb] text-xs font-medium uppercase tracking-wider text-slate-500">
            <th className="px-4 py-3">№</th>
            <th className="cursor-pointer px-4 py-3 transition-colors hover:text-slate-900" onClick={() => onSort('name')}>
              <div className="flex items-center space-x-1.5">
                <span>Товар</span>
                <SortIcon sortConfig={sortConfig} sortKey="name" />
              </div>
            </th>
            {isAdmin && (
              <th className="cursor-pointer px-4 py-3 transition-colors hover:text-slate-900" onClick={() => onSort('costPrice')}>
                <div className="flex items-center space-x-1.5">
                  <span>Закупка</span>
                  <SortIcon sortConfig={sortConfig} sortKey="costPrice" />
                </div>
              </th>
            )}
            <th className="cursor-pointer px-4 py-3 transition-colors hover:text-slate-900" onClick={() => onSort('sellingPrice')}>
              <div className="flex items-center space-x-1.5">
                <span>Продажа</span>
                <SortIcon sortConfig={sortConfig} sortKey="sellingPrice" />
              </div>
            </th>
            <th className="cursor-pointer px-4 py-3 transition-colors hover:text-slate-900" onClick={() => onSort('stock')}>
              <div className="flex items-center space-x-1.5">
                <span>Остаток</span>
                <SortIcon sortConfig={sortConfig} sortKey="stock" />
              </div>
            </th>
            <th className="px-4 py-3">Приход</th>
            {isAdmin && <th className="px-4 py-3">Рентабельность</th>}
            {isAdmin && <th className="px-4 py-3 text-center">Действия</th>}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {products.map((product, index) => (
            <tr key={product.id} className="transition-colors hover:bg-[#f4f5fb]">
              <td className="px-4 py-3 font-medium text-slate-400">{(currentPage - 1) * pageSize + index + 1}</td>
              <td className="px-4 py-3">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/70 bg-[#f4f5fb]">
                    {product.photoUrl ? (
                      <img
                        src={resolveMediaUrl(product.photoUrl, product.id)}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(event) => handleBrokenImage(event, product.id)}
                      />
                    ) : (
                      <ImageIcon className="text-slate-400" size={16} />
                    )}
                  </div>
                  <div>
                    <p className="font-medium leading-tight text-slate-900">{formatProductName(product.name)}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-[11px] text-slate-400">{product.category?.name || 'Без категории'}</p>
                      {getDuplicateHintCount(product) > 0 && (
                        <button
                          onClick={() => onOpenMergeModal(product)}
                          className="rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700"
                        >
                          Дубликат
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </td>

              {isAdmin && (
                <td className="px-4 py-3">
                  {selectedWarehouseId ? (
                    <div className="flex flex-col">
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

              <td className="px-4 py-3 font-semibold text-slate-900">
                {selectedWarehouseId ? formatMoney(product.sellingPrice) : <span className="text-slate-300">-</span>}
              </td>

              <td className="px-4 py-3">
                <div className="flex items-center space-x-2">
                  <div
                    className={clsx(
                      'h-2 w-2 rounded-full',
                      product.stock <= product.minStock ? 'animate-pulse bg-rose-500' : 'bg-emerald-500'
                    )}
                  />
                  <div className={clsx('min-w-0', product.stock <= product.minStock ? 'text-rose-600 font-medium' : 'text-slate-900 font-medium')}>
                    <p className="whitespace-pre-line leading-tight">{getStockBreakdown(product).primary}</p>
                    {getStockBreakdown(product).secondary && (
                      <p className="text-[10px] text-slate-400">{getStockBreakdown(product).secondary}</p>
                    )}
                  </div>
                </div>
              </td>

              <td className="px-4 py-3 text-slate-500">
                <p>
                  {product.totalIncoming}{' '}
                  <span className="text-[10px] uppercase text-slate-400">{normalizeDisplayBaseUnit(product.unit || 'шт')}</span>
                </p>
              </td>

              {isAdmin && (
                <td className="px-4 py-3">
                  {selectedWarehouseId ? (
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">
                        {formatPercent(getProductEfficiencyMetrics(product).marginPercent, 1)}
                      </p>
                      <span className={clsx('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium', getProductEfficiencyMetrics(product).className)}>
                        {getProductEfficiencyMetrics(product).label}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>
              )}

              {isAdmin && (
                <td className="px-4 py-3 text-center align-middle">
                  {selectedWarehouseId ? (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onEditProduct(product)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-900 hover:text-white"
                        title="Редактировать"
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        onClick={() => onRestockProduct(product)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100"
                        title="Пополнить"
                      >
                        <PlusCircle size={15} />
                      </button>
                      <button
                        onClick={() => onShowBatches(product)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-900 hover:text-white"
                        title="Партии (FIFO)"
                      >
                        <Layers size={15} />
                      </button>
                      <button
                        onClick={() => onShowHistory(product)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-900 hover:text-white"
                        title="История"
                      >
                        <History size={15} />
                      </button>
                      <button
                        onClick={() => onOpenWriteOffModal(product)}
                        disabled={Number(product.stock || 0) <= 0}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300"
                        title="Списать"
                      >
                        <Scissors size={15} />
                      </button>
                      {canTransferProducts && (
                        <button
                          onClick={() => onTransferProduct(product)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-900 hover:text-white"
                          title="Перенос"
                        >
                          <ArrowRightLeft size={15} />
                        </button>
                      )}
                      <button
                        onClick={() => onDeleteProduct(product)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100"
                        title="Удалить"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
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
