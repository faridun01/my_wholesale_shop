import { Trash2, Plus, Minus, Percent } from 'lucide-react';
import { formatMoney } from '../../utils/format';
import { formatProductName } from '../../utils/productName';

export type PackagingOption = {
  id: number;
  packageName: string;
  baseUnitName: string;
  unitsPerPackage: number;
  isDefault?: boolean;
};

export type CartItem = {
  id: number;
  name: string;
  quantity: number;
  stock: number;
  unit: string;
  baseUnitName: string;
  sellingPrice: number;
  photoUrl?: string | null;
  packagings: PackagingOption[];
  selectedPackagingId: number | null;
  packageQuantity: number;
  packageQuantityInput?: string;
  extraUnitQuantity: number;
  extraUnitQuantityInput?: string;
  lineDiscountPercent: number;
  lineDiscountInput?: string;
  [key: string]: any;
};

type POSCartItemProps = {
  item: CartItem;
  index: number;
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

export default function POSCartItem({
  item,
  index,
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
}: POSCartItemProps) {
  const stockSummary = getCartStockSummary(item);
  const itemLineSubtotal = getLineSubtotal(item);
  const itemLineDiscount = getLineDiscountAmount(item);
  const itemLineTotal = getLineTotal(item);
  const itemWeightKg = getProductUnitWeightKg(item) * Math.max(0, Number(item.quantity || 0));
  const isPackageSale = Boolean(item.selectedPackagingId);

  const handleStepPackageQuantity = (delta: number) => {
    const currentVal = Math.max(0, Number(item.packageQuantityInput ?? item.packageQuantity) || 0);
    const newVal = Math.max(0, currentVal + delta);
    updatePackageQuantityInput(item.id, String(newVal));
  };

  const handleStepExtraUnitQuantity = (delta: number) => {
    const currentVal = Math.max(0, Number(item.extraUnitQuantityInput ?? item.extraUnitQuantity) || 0);
    const newVal = Math.max(0, currentVal + delta);
    updateExtraUnitQuantityInput(item.id, String(newVal));
  };

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs transition-all hover:border-slate-300 hover:shadow-xs">
      {/* Line 1: Index, Product Name, Unit Price, Delete */}
      <div className="flex items-start justify-between gap-2 min-w-0 border-b border-slate-100/90 pb-1.5">
        <div className="flex items-start gap-1.5 min-w-0 flex-1">
          <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-mono font-black text-slate-500 mt-0.5">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="whitespace-normal wrap-break-word text-xs sm:text-[13px] font-black text-slate-900 leading-snug"
              style={{ overflowWrap: 'anywhere' }}
            >
              {formatProductName(item.name)}
            </p>
            <p className="mt-0.5 text-[10px] font-mono font-medium text-slate-400">
              {formatMoney(item.sellingPrice)} TJS <span className="text-[8.5px] font-normal text-slate-400">/ {item.baseUnitName}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => removeFromCart(item.id)}
          title="Удалить из корзины"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600 active:scale-90"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Line 2: Packaging Selector + Quantity Stepper */}
      <div className="mt-2 flex items-center justify-between gap-1.5">
        <select
          value={item.selectedPackagingId || ''}
          onChange={(e) => updateSelectedPackaging(item.id, e.target.value)}
          title="Выберите упаковку"
          className="h-6.5 sm:h-7 w-26 sm:w-32 shrink-0 rounded-lg border border-slate-200 bg-slate-50/60 px-1.5 text-[9.5px] sm:text-[10px] font-semibold text-slate-700 outline-none transition-colors hover:bg-white focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500/20"
        >
          <option value="">{item.baseUnitName}</option>
          {(Array.isArray(item.packagings) ? item.packagings : []).map((packaging) => {
            const isDisabled = !isPackagingAvailableForCartItem(item, packaging);
            return (
              <option key={packaging.id} value={packaging.id} disabled={isDisabled}>
                {packaging.packageName} ({packaging.unitsPerPackage} {item.baseUnitName})
              </option>
            );
          })}
        </select>

        {/* Stepper */}
        <div className="flex h-6.5 sm:h-7 shrink-0 items-center rounded-lg border border-slate-200/90 bg-slate-50/50 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => (isPackageSale ? handleStepPackageQuantity(-1) : handleStepExtraUnitQuantity(-1))}
            className="flex h-full w-6.5 items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900 active:scale-95 transition-all"
          >
            <Minus size={11} />
          </button>
          <input
            type="number"
            min={0}
            step="1"
            value={
              isPackageSale
                ? (item.packageQuantityInput ?? String(item.packageQuantity))
                : (item.extraUnitQuantityInput ?? String(item.extraUnitQuantity))
            }
            onChange={(e) => {
              const rawVal = e.target.value;
              const intVal = rawVal === '' ? '' : String(Math.max(0, Math.floor(Number(rawVal) || 0)));
              if (isPackageSale) {
                updatePackageQuantityInput(item.id, intVal);
              } else {
                updateExtraUnitQuantityInput(item.id, intVal);
              }
            }}
            onBlur={() => (isPackageSale ? commitPackageQuantityInput(item.id) : commitExtraUnitQuantityInput(item.id))}
            placeholder="0"
            className="h-full w-8.5 text-center font-mono text-xs font-black text-slate-950 bg-white border-x border-slate-200/80 outline-none"
          />
          <button
            type="button"
            onClick={() => (isPackageSale ? handleStepPackageQuantity(1) : handleStepExtraUnitQuantity(1))}
            className="flex h-full w-6.5 items-center justify-center text-slate-500 hover:bg-white hover:text-slate-900 active:scale-95 transition-all"
          >
            <Plus size={11} />
          </button>
        </div>
      </div>

      {/* Line 3: Discount Input + Total Price & Badges */}
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        {/* Discount input */}
        <div className="relative w-18 shrink-0">
          <input
            type="number"
            min={0}
            max={100}
            value={
              item.lineDiscountInput !== undefined
                ? item.lineDiscountInput
                : item.lineDiscountPercent > 0
                ? String(item.lineDiscountPercent)
                : ''
            }
            onChange={(e) => updateLineDiscountInput(item.id, e.target.value)}
            onBlur={() => commitLineDiscountInput(item.id)}
            placeholder="0"
            title="Скидка на позицию в %"
            className="h-7 w-full rounded-lg border border-slate-200 bg-white pl-1.5 pr-5 text-center font-mono text-[11px] font-black text-slate-900 placeholder:text-slate-300 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 shadow-2xs"
          />
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
            %
          </span>
        </div>

        {/* Calculation summary */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {itemLineDiscount > 0 && (
            <span className="font-mono text-[10px] text-slate-400 line-through tabular-nums">
              {formatMoney(itemLineSubtotal)}
            </span>
          )}
          <span className="font-mono text-xs sm:text-[13px] font-black text-slate-950 tabular-nums">
            {formatMoney(itemLineTotal)} <span className="text-[10px] font-bold text-slate-400 font-sans">TJS</span>
          </span>
          <span className="rounded-md border border-emerald-200/70 bg-emerald-50/80 px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-emerald-800 shadow-2xs">
            ={Math.round(item.quantity)} <span className="text-[8px] font-semibold text-emerald-700/90">{item.baseUnitName}</span>
          </span>
          {itemWeightKg > 0 && (
            <span className="hidden sm:inline-block rounded-md border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[9px] font-semibold text-slate-500">
              {formatWeightKg(itemWeightKg)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
