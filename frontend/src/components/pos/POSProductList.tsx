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
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <span className="text-xs font-semibold text-slate-600">Всего позиций: {filteredProducts.length}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {warehouses.length > 1 && (
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-700 shadow-xs">
                <Warehouse size={14} className="text-slate-400" />
                <select
                  value={warehouseId}
                  onChange={(e) => handleWarehouseChange(e.target.value)}
                  disabled={!isAdmin}
                  className="min-w-36 appearance-none bg-transparent outline-none"
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
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-[#f4f5fb] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
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
              className="w-full rounded-full border border-slate-200 bg-[#f4f5fb] py-2 pl-10 pr-4 text-xs text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
            />
          </div>
        </div>

        {isAdmin && !warehouseId && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
            Перед добавлением товара выберите склад.
          </div>
        )}
      </div>

      <div className="mt-2 hidden grid-cols-[40px_minmax(0,1fr)_130px_100px_50px] rounded-2xl bg-[#f4f5fb] px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 md:grid">
        <div className="text-center">№</div>
        <div>Товар</div>
        <div className="text-center">Остаток</div>
        <div className="text-center">Цена</div>
        <div className="text-center"></div>
      </div>

      <div
        ref={productListRef}
        className="bg-white max-h-[calc(100vh-230px)] lg:max-h-[calc(100vh-190px)] lg:min-h-0 lg:flex-1 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400"
      >
        <div className="space-y-2 p-2 md:hidden">
          {filteredProducts.map((product, index) => {
            const stockParts = getProductStockParts(product, product.unit);

            return (
              <div
                key={`mobile-pos-${product.id}`}
                onClick={() => handleAddFromList(product)}
                className={clsx(
                  'rounded-xl border border-slate-200/70 bg-[#f4f5fb] p-2.5 shadow-xs transition-colors hover:bg-slate-100/80',
                  highlightedProductId === Number(product.id) && 'ring-2 ring-emerald-500 bg-emerald-50/50',
                  canAddProductFromList(product) ? 'cursor-pointer' : '',
                )}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <p
                      className="whitespace-normal wrap-break-word text-[11px] font-semibold leading-snug text-slate-900"
                      style={{ overflowWrap: 'anywhere' }}
                    >
                      {formatProductName(product.name)}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-900">{formatMoney(product.sellingPrice)}</span>
                      <span className="text-[10px] text-slate-400">#{index + 1}</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddFromList(product);
                    }}
                    disabled={!canAddProductFromList(product)}
                    title="Добавить в корзину"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-xs transition-all hover:bg-slate-800 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Plus size={15} />
                  </button>
                </div>

                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                  <span className="text-[10px] font-semibold">{stockParts.primary}</span>
                  {stockParts.secondary ? (
                    <span className="text-[9px] font-medium text-emerald-600">{stockParts.secondary}</span>
                  ) : null}
                </div>
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
                  'grid grid-cols-[36px_minmax(0,1fr)_120px_90px_44px] items-center border-b border-slate-100 px-3 py-1.5 transition-colors hover:bg-[#f4f5fb]',
                  highlightedProductId === Number(product.id) && 'bg-emerald-50/70',
                  canAddProductFromList(product) ? 'cursor-pointer' : '',
                )}
              >
                <div className="text-center text-[11px] font-medium text-slate-400">{index + 1}</div>

                <div className="min-w-0 pr-2">
                  <p
                    className="whitespace-normal wrap-break-word text-[11px] font-semibold leading-snug text-slate-900"
                    style={{ overflowWrap: 'anywhere' }}
                  >
                    {formatProductName(product.name)}
                  </p>
                </div>

                <div className="flex justify-center">
                  <div className="inline-flex flex-col items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-center text-emerald-700">
                    <span className="whitespace-nowrap text-[10px] font-semibold leading-tight">{stockParts.primary}</span>
                    {stockParts.secondary ? (
                      <span className="whitespace-nowrap text-[9px] font-medium leading-tight text-emerald-600/90">{stockParts.secondary}</span>
                    ) : null}
                  </div>
                </div>

                <div className="text-center text-[11px] font-bold text-slate-900">{formatMoney(product.sellingPrice)}</div>

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddFromList(product);
                    }}
                    disabled={!canAddProductFromList(product)}
                    title="Добавить в корзину"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-xs transition-all hover:bg-slate-800 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100"
                  >
                    <Plus size={14} />
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
