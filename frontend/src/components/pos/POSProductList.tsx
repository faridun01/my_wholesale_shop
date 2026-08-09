import { startTransition } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Plus, Search, Warehouse, X } from 'lucide-react';
import { clsx } from 'clsx';
import { formatMoney } from '../../utils/format';
import { formatProductName } from '../../utils/productName';

type ProductStockParts = {
  primary: string;
  secondary: string;
};

type POSProductListProps = {
  filteredProducts: any[];
  warehouses: any[];
  warehouseId: string;
  productSearch: string;
  highlightedProductId: number | null;
  isAdmin: boolean;
  productListRef: RefObject<HTMLDivElement>;
  setProductSearch: Dispatch<SetStateAction<string>>;
  handleWarehouseChange: (nextWarehouseId: string) => void;
  handleAddFromList: (product: any) => void;
  canAddProductFromList: (product: any) => boolean;
  getProductStockParts: (product: any, fallbackBaseUnitName?: string) => ProductStockParts;
  onClose: () => void;
};

export default function POSProductList({
  filteredProducts,
  warehouses,
  warehouseId,
  productSearch,
  highlightedProductId,
  isAdmin,
  productListRef,
  setProductSearch,
  handleWarehouseChange,
  handleAddFromList,
  canAddProductFromList,
  getProductStockParts,
  onClose,
}: POSProductListProps) {
  return (
    <div className="flex flex-col overflow-visible rounded-[28px] border border-white bg-white p-5 shadow-sm lg:h-full lg:min-h-0 lg:overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Товары</h2>
            <p className="mt-1 text-xs text-slate-500">{filteredProducts.length} доступных позиций</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {warehouses.length > 1 && (
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-700 shadow-sm">
                <Warehouse size={16} className="text-slate-400" />
                <select
                  value={warehouseId}
                  onChange={(e) => handleWarehouseChange(e.target.value)}
                  disabled={!isAdmin}
                  className="min-w-42.5 appearance-none bg-transparent outline-none"
                >
                  <option value="">Выберите склад</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-[#f4f5fb] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => {
                const value = e.target.value;
                startTransition(() => {
                  setProductSearch(value);
                });
              }}
              placeholder="Поиск товара, ID или штрихкода..."
              className="w-full rounded-full border border-slate-200 bg-[#f4f5fb] py-3 pl-12 pr-5 text-sm text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
            />
          </div>
        </div>

        {isAdmin && !warehouseId && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Перед добавлением товара выберите склад.
          </div>
        )}
      </div>

      <div className="mt-3 hidden grid-cols-[52px_minmax(0,1fr)_150px_110px_130px] rounded-2xl bg-[#f4f5fb] px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 md:grid">
        <div className="text-center">№</div>
        <div>Товар</div>
        <div className="text-center">Остаток</div>
        <div className="text-center">Цена</div>
        <div className="text-center">Действие</div>
      </div>

      <div ref={productListRef} className="overflow-visible bg-white lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
        <div className="space-y-3 p-3 md:hidden">
          {filteredProducts.map((product, index) => {
            const stockParts = getProductStockParts(product, product.unit);

            return (
              <div
                key={`mobile-pos-${product.id}`}
                onClick={() => handleAddFromList(product)}
                className={clsx(
                  'rounded-2xl border border-slate-100 bg-[#f4f5fb]/60 p-3 shadow-xs transition-colors hover:bg-[#f4f5fb]',
                  highlightedProductId === Number(product.id) && 'ring-2 ring-emerald-500 bg-emerald-50/50',
                  canAddProductFromList(product) ? 'cursor-pointer' : '',
                )}
              >
                <div className="min-w-0">
                  <p className="wrap-break-word text-sm font-semibold leading-5 text-slate-900" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {formatProductName(product.name)}
                  </p>
                </div>

                <div className="mt-2.5 rounded-xl border border-slate-200/60 bg-white px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Остаток</p>
                  <div className="mt-1 inline-flex flex-col rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                    <span className="whitespace-nowrap text-xs font-semibold leading-4">{stockParts.primary}</span>
                    {stockParts.secondary ? (
                      <span className="whitespace-nowrap text-[10px] font-medium leading-3 text-emerald-600/90">{stockParts.secondary}</span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-200/60 bg-white px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Цена</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatMoney(product.sellingPrice)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/60 bg-white px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">№</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-600">#{index + 1}</p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddFromList(product);
                  }}
                  disabled={!canAddProductFromList(product)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus size={15} />
                  <span>Добавить</span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="hidden flex-col md:flex">
          {filteredProducts.map((product, index) => {
            const stockParts = getProductStockParts(product, product.unit);

            return (
              <div
                key={product.id}
                onClick={() => handleAddFromList(product)}
                className={clsx(
                  'grid grid-cols-[52px_minmax(0,1fr)_150px_110px_130px] items-center border-b border-slate-100 px-4 py-3 transition-colors hover:bg-[#f4f5fb]',
                  highlightedProductId === Number(product.id) && 'bg-emerald-50/70',
                  canAddProductFromList(product) ? 'cursor-pointer' : '',
                )}
              >
                <div className="text-center text-xs font-semibold text-slate-400">{index + 1}</div>

                <div className="min-w-0 pr-3">
                  <p className="wrap-break-word text-sm font-medium text-slate-900">{formatProductName(product.name)}</p>
                </div>

                <div className="flex justify-center">
                  <div className="inline-flex min-w-27 flex-col items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1 text-center text-emerald-700">
                    <span className="whitespace-nowrap text-xs font-semibold leading-4">{stockParts.primary}</span>
                    {stockParts.secondary ? (
                      <span className="whitespace-nowrap text-[10px] font-medium leading-3 text-emerald-600/90">{stockParts.secondary}</span>
                    ) : null}
                  </div>
                </div>

                <div className="text-center text-sm font-medium text-slate-900">{formatMoney(product.sellingPrice)}</div>

                <div className="text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddFromList(product);
                    }}
                    disabled={!canAddProductFromList(product)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-[#f4f5fb] px-3.5 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus size={14} />
                    <span>Добавить</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {!filteredProducts.length && (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#f4f5fb] text-slate-400">
              <Search size={24} />
            </div>
            <p className="text-sm font-medium text-slate-700">Товары не найдены</p>
            <p className="mt-1 text-xs text-slate-400">Попробуйте изменить поисковый запрос</p>
          </div>
        )}
      </div>
    </div>
  );
}
