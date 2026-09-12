import { startTransition } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Check, Plus, Search, Warehouse, X } from 'lucide-react';
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
  cart?: any[];
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
  cart = [],
}: POSProductListProps) {
  const getCartItemQuantity = (productId: number) => {
    if (!cart || !Array.isArray(cart)) return 0;
    const item = cart.find((entry) => Number(entry.id) === Number(productId));
    return item ? Number(item.quantity || 0) : 0;
  };
  return (
    <div className="flex flex-col overflow-visible rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs lg:h-full lg:min-h-0 lg:overflow-hidden lg:rounded-2xl lg:p-4">
      <div className="flex flex-col gap-2.5 border-b border-slate-100 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
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
            autoComplete="off"
            className="h-10 w-full rounded-xl border border-slate-200/90 bg-slate-50/80 pl-10 pr-9 text-xs text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/5"
          />
          {productSearch && (
            <button
              type="button"
              onClick={() => {
                startTransition(() => {
                  setProductSearch('');
                });
              }}
              title="Очистить поиск"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          {warehouses.length > 1 && (
              <div className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700">
                <Warehouse size={13} className="text-slate-400 shrink-0" />
                <select
                  value={warehouseId}
                  onChange={(e) => handleWarehouseChange(e.target.value)}
                  disabled={!isAdmin}
                  className="min-w-0 max-w-36 bg-transparent text-xs font-medium outline-none"
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
              title="Закрыть терминал"
              className="hidden h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:flex"
            >
              <X size={15} />
            </button>
          </div>

        {isAdmin && !warehouseId && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Перед добавлением товара выберите склад.
          </div>
        )}
      </div>

      <div className="mt-2 hidden grid-cols-[36px_minmax(0,1fr)_120px_100px_44px] rounded-xl bg-slate-100/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 md:grid">
        <div className="text-center">№</div>
        <div>Товар</div>
        <div className="text-center">Доступно</div>
        <div className="text-right pr-3">Цена</div>
        <div className="text-center"></div>
      </div>

      <div
        ref={productListRef}
        className="bg-white lg:max-h-[calc(100vh-190px)] lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1 lg:[&::-webkit-scrollbar]:w-1.5 lg:[&::-webkit-scrollbar-track]:bg-transparent lg:[&::-webkit-scrollbar-thumb]:bg-slate-300 lg:[&::-webkit-scrollbar-thumb]:rounded-full hover:lg:[&::-webkit-scrollbar-thumb]:bg-slate-400"
      >
        <div className="space-y-2.5 py-1 md:hidden">
          {filteredProducts.map((product, index) => {
            const stockParts = getProductStockParts(product, product.unit);
            const isOutOfStock = Number(product.stock || 0) <= 0;
            const inCartQuantity = getCartItemQuantity(product.id);
            const isInCart = inCartQuantity > 0;

            return (
              <div
                key={`mobile-pos-${product.id}`}
                onClick={() => canAddProductFromList(product) && handleAddFromList(product)}
                className={clsx(
                  'relative overflow-hidden rounded-2xl border bg-white p-3 shadow-2xs transition-all duration-150 select-none',
                  isInCart
                    ? 'border-emerald-300/90 bg-emerald-50/15 shadow-xs ring-1 ring-emerald-500/20'
                    : 'border-slate-200/80 hover:border-slate-300',
                  highlightedProductId === Number(product.id) && 'ring-2 ring-emerald-500 bg-emerald-50/40',
                  canAddProductFromList(product)
                    ? 'cursor-pointer active:scale-[0.985] active:bg-slate-50/80'
                    : 'opacity-60 cursor-not-allowed',
                )}
              >
                {/* Header: Номер, Название, Бейдж количества в чеке */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span
                      className={clsx(
                        'flex h-6 min-w-6 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-extrabold mt-0.5',
                        isInCart ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="whitespace-normal wrap-break-word text-[13.5px] font-bold leading-snug text-slate-900 line-clamp-2"
                        style={{ overflowWrap: 'anywhere' }}
                      >
                        {formatProductName(product.name)}
                      </p>
                    </div>
                  </div>

                  {isInCart && (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-100/90 text-emerald-800 border border-emerald-300/80 px-2 py-0.5 text-[10px] font-extrabold shadow-2xs">
                      <Check size={11} strokeWidth={3} />
                      {inCartQuantity} {product.unit || 'шт'}
                    </span>
                  )}
                </div>

                {/* Информационная панель: Цена + Доступно + Кнопка добавления */}
                <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-slate-50/90 border border-slate-100 p-2 sm:p-2.5">
                  {/* Блок «Цена» */}
                  <div className="flex flex-col min-w-0 pl-0.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-none">
                      Цена
                    </span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="font-mono text-sm sm:text-[15px] font-black text-slate-950 tabular-nums">
                        {formatMoney(product.sellingPrice)}
                      </span>
                      <span className="text-[10px] font-extrabold text-slate-400">TJS</span>
                    </div>
                  </div>

                  {/* Тонкий разделитель */}
                  <div className="h-6 w-px bg-slate-200/80 shrink-0 mx-1" />

                  {/* Блок «Доступно» */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-none">
                      Доступно
                    </span>
                    <div className="mt-1 flex items-center gap-1.5 min-w-0">
                      <span
                        className={clsx(
                          'h-2 w-2 rounded-full shrink-0',
                          isOutOfStock ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'
                        )}
                      />
                      <span
                        className={clsx(
                          'font-mono text-xs font-black tabular-nums leading-tight truncate',
                          isOutOfStock ? 'text-rose-700' : 'text-slate-800'
                        )}
                      >
                        {stockParts.primary}
                      </span>
                      {stockParts.secondary && (
                        <span className="rounded bg-white px-1 py-0.2 text-[9.5px] font-bold text-slate-500 border border-slate-200/70 shadow-2xs shrink-0">
                          {stockParts.secondary}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Кнопка быстрого добавления в чек */}
                  <div className="shrink-0 pl-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canAddProductFromList(product)) {
                          handleAddFromList(product);
                        }
                      }}
                      disabled={!canAddProductFromList(product)}
                      className={clsx(
                        'flex h-8 w-8 items-center justify-center rounded-xl shadow-xs transition-all active:scale-90',
                        isOutOfStock
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : isInCart
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/25'
                            : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'
                      )}
                      title="Добавить в чек"
                    >
                      <Plus size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden flex-col md:flex">
          {filteredProducts.map((product, index) => {
            const stockParts = getProductStockParts(product, product.unit);
            const inCartQuantity = getCartItemQuantity(product.id);
            const isInCart = inCartQuantity > 0;

            return (
              <div
                key={product.id}
                onClick={() => handleAddFromList(product)}
                className={clsx(
                  'grid grid-cols-[36px_minmax(0,1fr)_120px_100px_44px] items-center border-b border-slate-100 px-3 py-2 transition-colors hover:bg-slate-50',
                  isInCart && 'bg-emerald-50/30',
                  highlightedProductId === Number(product.id) && 'bg-emerald-50/70',
                  canAddProductFromList(product) ? 'cursor-pointer' : '',
                )}
              >
                <div className="text-center font-mono text-[11px] text-slate-400">{index + 1}</div>

                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <p
                      className="whitespace-normal wrap-break-word text-xs font-medium leading-snug text-slate-900"
                      style={{ overflowWrap: 'anywhere' }}
                    >
                      {formatProductName(product.name)}
                    </p>
                    {isInCart && (
                      <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 border border-emerald-200">
                        <Check size={9} strokeWidth={3} /> {inCartQuantity}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-center">
                  <div className="inline-flex flex-col items-center rounded-md border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-center text-emerald-700 font-mono">
                    <span className="whitespace-nowrap text-[10px] font-semibold leading-tight">{stockParts.primary}</span>
                    {stockParts.secondary ? (
                      <span className="whitespace-nowrap text-[9px] font-medium leading-tight text-emerald-600/90">{stockParts.secondary}</span>
                    ) : null}
                  </div>
                </div>

                <div className="text-right pr-3 font-mono text-xs font-bold tabular-nums text-slate-900">{formatMoney(product.sellingPrice)}</div>

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddFromList(product);
                    }}
                    disabled={!canAddProductFromList(product)}
                    title="Добавить в корзину"
                    className={clsx(
                      'flex h-7 w-7 items-center justify-center rounded-lg shadow-xs transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-20',
                      isInCart
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    )}
                  >
                    <Plus size={14} strokeWidth={2.5} />
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
