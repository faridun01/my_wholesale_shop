import { ShoppingBag, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import POSCartItem, { type CartItem, type PackagingOption } from './POSCartItem';

type POSCartItemsListProps = {
  cart: CartItem[];
  isCartExpanded: boolean;
  getCartStockSummary: (item: CartItem) => { availableLabel: string; remainingLabel: string };
  getCartPackaging: (item: CartItem) => PackagingOption | null;
  isPackagingAvailableForCartItem: (item: CartItem, packaging: PackagingOption | null) => boolean;
  getLineSubtotal: (item: CartItem) => number;
  getLineDiscountAmount: (item: CartItem) => number;
  getLineTotal: (item: CartItem) => number;
  getProductUnitWeightKg: (item: CartItem) => number;
  formatWeightKg: (value: unknown) => string;
  removeFromCart: (id: number) => void;
  updateSelectedPackaging: (id: number, value: string) => void;
  updatePackageQuantityInput: (id: number, value: string) => void;
  commitPackageQuantityInput: (id: number) => void;
  updateExtraUnitQuantityInput: (id: number, value: string) => void;
  commitExtraUnitQuantityInput: (id: number) => void;
  updateLineDiscountInput: (id: number, value: string) => void;
  commitLineDiscountInput: (id: number) => void;
};

export default function POSCartItemsList({
  cart,
  isCartExpanded,
  getCartStockSummary,
  getCartPackaging,
  isPackagingAvailableForCartItem,
  getLineSubtotal,
  getLineDiscountAmount,
  getLineTotal,
  getProductUnitWeightKg,
  formatWeightKg,
  removeFromCart,
  updateSelectedPackaging,
  updatePackageQuantityInput,
  commitPackageQuantityInput,
  updateExtraUnitQuantityInput,
  commitExtraUnitQuantityInput,
  updateLineDiscountInput,
  commitLineDiscountInput,
}: POSCartItemsListProps) {
  return (
    <div
      className={clsx(
        'order-1 px-2.5 py-1.5 md:px-3 lg:order-0',
        'lg:max-h-[calc(100vh-330px)] lg:overflow-y-auto lg:pr-1.5',
        'lg:[&::-webkit-scrollbar]:w-1.5 lg:[&::-webkit-scrollbar-track]:bg-transparent lg:[&::-webkit-scrollbar-thumb]:bg-slate-200 lg:[&::-webkit-scrollbar-thumb]:rounded-full hover:lg:[&::-webkit-scrollbar-thumb]:bg-slate-300',
        isCartExpanded
          ? 'min-h-0 lg:col-start-1 lg:row-start-3 lg:max-h-[calc(100vh-210px)]'
          : '',
      )}
    >
      <div className="space-y-1.5">
        {cart.map((item, index) => (
          <POSCartItem
            key={item.id}
            item={item}
            index={index}
            isCartExpanded={isCartExpanded}
            getCartStockSummary={getCartStockSummary}
            getCartPackaging={getCartPackaging}
            isPackagingAvailableForCartItem={isPackagingAvailableForCartItem}
            getLineSubtotal={getLineSubtotal}
            getLineDiscountAmount={getLineDiscountAmount}
            getLineTotal={getLineTotal}
            getProductUnitWeightKg={getProductUnitWeightKg}
            formatWeightKg={formatWeightKg}
            removeFromCart={removeFromCart}
            updateSelectedPackaging={updateSelectedPackaging}
            updatePackageQuantityInput={updatePackageQuantityInput}
            commitPackageQuantityInput={commitPackageQuantityInput}
            updateExtraUnitQuantityInput={updateExtraUnitQuantityInput}
            commitExtraUnitQuantityInput={commitExtraUnitQuantityInput}
            updateLineDiscountInput={updateLineDiscountInput}
            commitLineDiscountInput={commitLineDiscountInput}
          />
        ))}
      </div>

      {!cart.length && (
        <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
          <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-slate-50 to-slate-100 border border-slate-200/60 text-slate-400 shadow-2xs">
            <ShoppingBag size={24} className="text-slate-400" />
            <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xs">
              <Sparkles size={11} />
            </div>
          </div>
          <h3 className="text-sm font-black text-slate-800 tracking-tight">Корзина пуста</h3>
          <p className="mt-1 max-w-[200px] text-xs font-medium text-slate-400 leading-relaxed">
            Выберите товары в каталоге слева или воспользуйтесь поиском
          </p>
        </div>
      )}
    </div>
  );
}
