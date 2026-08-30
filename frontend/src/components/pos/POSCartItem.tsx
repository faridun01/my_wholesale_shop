import { Trash2, Plus, Minus } from 'lucide-react';
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
    <div className="my-1 rounded-xl border border-slate-200/70 bg-[#f8f9fc] p-1.5 transition-colors hover:bg-slate-100/80">
      {/* Line 1: ONLY Product Name & Delete button */}
      <div className="flex items-start justify-between gap-1.5 min-w-0 border-b border-slate-200/40 pb-1">
        <div className="flex items-start gap-1 min-w-0 flex-1">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-700 mt-0.5">
            {index + 1}
          </span>
          <p
            className="whitespace-normal wrap-break-word text-[11px] font-bold text-slate-900 leading-snug"
            style={{ overflowWrap: 'anywhere' }}
          >
            {formatProductName(item.name)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => removeFromCart(item.id)}
          title="Удалить из корзины"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Line 2: All the rest (Packaging Select, Stepper, Discount %, Total Price & Badge) */}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[10px]">

        {/* Packaging / Unit Selector */}
        <select
          value={item.selectedPackagingId || ''}
          onChange={(e) => updateSelectedPackaging(item.id, e.target.value)}
          title="Выберите упаковку"
          className="h-6 min-w-0 flex-1 max-w-28 rounded-md border border-slate-200 bg-white px-1 text-[10px] text-slate-800 outline-none focus:border-slate-300"
        >
          <option value="">{item.baseUnitName}</option>
          {(Array.isArray(item.packagings) ? item.packagings : []).map((packaging) => {
            const isDisabled = !isPackagingAvailableForCartItem(item, packaging);
            return (
              <option key={packaging.id} value={packaging.id} disabled={isDisabled}>
                {packaging.packageName} ({packaging.unitsPerPackage}{item.baseUnitName})
              </option>
            );
          })}
        </select>

        {/* Stepper */}
        <div className="flex h-6 shrink-0 items-center rounded-md border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => (isPackageSale ? handleStepPackageQuantity(-1) : handleStepExtraUnitQuantity(-1))}
            className="flex h-full w-4 items-center justify-center text-slate-400 hover:text-slate-900"
          >
            <Minus size={9} />
          </button>
          <input
            type="number"
            min={0}
            step={isPackageSale ? '1' : '0.01'}
            value={
              isPackageSale
                ? (item.packageQuantityInput ?? String(item.packageQuantity))
                : (item.extraUnitQuantityInput ?? String(item.extraUnitQuantity))
            }
            onChange={(e) =>
              isPackageSale
                ? updatePackageQuantityInput(item.id, e.target.value)
                : updateExtraUnitQuantityInput(item.id, e.target.value)
            }
            onBlur={() => (isPackageSale ? commitPackageQuantityInput(item.id) : commitExtraUnitQuantityInput(item.id))}
            placeholder="0"
            className="h-full w-8 text-center text-[10px] font-bold text-slate-900 outline-none"
          />
          <button
            type="button"
            onClick={() => (isPackageSale ? handleStepPackageQuantity(1) : handleStepExtraUnitQuantity(1))}
            className="flex h-full w-4 items-center justify-center text-slate-400 hover:text-slate-900"
          >
            <Plus size={9} />
          </button>
        </div>

        {/* Discount % Input */}
        <div className="w-10 shrink-0">
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
            placeholder="%"
            title="Скидка в %"
            className="h-6 w-full rounded-md border border-slate-200 bg-white px-0.5 text-center text-[10px] text-slate-800 outline-none focus:border-slate-300"
          />
        </div>

        {/* Total Price & Badge */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {itemLineDiscount > 0 && (
            <span className="text-[9px] text-slate-400 line-through">
              {formatMoney(itemLineSubtotal)}
            </span>
          )}
          <span className="text-[11px] font-bold text-slate-900">{formatMoney(itemLineTotal)}</span>
          <span className="rounded bg-slate-200/80 px-1 py-0.5 text-[9px] font-semibold text-slate-700">
            ={item.quantity}{item.baseUnitName}
          </span>
        </div>
      </div>
    </div>
  );
}
