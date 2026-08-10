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
    <div className="my-1.5 rounded-2xl border border-slate-200/60 bg-[#f4f5fb] p-2.5 transition-colors hover:bg-slate-100/70">
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
          {index + 1}
        </div>

        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <p
              className="wrap-break-word whitespace-normal text-xs font-semibold leading-4 text-slate-900"
              style={{ overflowWrap: 'anywhere' }}
            >
              {formatProductName(item.name)}
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
              Доступно: <span className="font-semibold text-slate-700">{stockSummary.availableLabel}</span>
            </p>
          </div>

          <div className="mt-2 space-y-2">
            <div className="flex items-start justify-between gap-2 rounded-xl border border-slate-200/60 bg-white px-3 py-2">
              <div className="min-w-0">
                <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">Расчет</p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-600">
                  {formatMoney(item.sellingPrice)} x {item.quantity} {item.baseUnitName}
                </p>
                {itemWeightKg > 0 ? (
                  <p className="mt-0.5 text-[11px] font-semibold text-emerald-600">
                    Масса/объем: {formatWeightKg(itemWeightKg)}
                  </p>
                ) : null}
              </div>
              <div className="flex items-start gap-2">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatMoney(itemLineTotal)}
                  </p>
                  {itemLineDiscount > 0 ? (
                    <p className="mt-0.5 text-[10px] text-slate-400 line-through">
                      {formatMoney(itemLineSubtotal)}
                    </p>
                  ) : null}
                </div>
                <button
                  onClick={() => removeFromCart(item.id)}
                  title="Удалить из корзины"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {isCartExpanded ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_80px]">
                <label className="min-w-0">
                  <span className="mb-1 block text-[10px] font-medium text-slate-500">Упаковка</span>
                  <select
                    value={item.selectedPackagingId || ''}
                    onChange={(e) => updateSelectedPackaging(item.id, e.target.value)}
                    title="Выберите коробку или продажу поштучно"
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none transition-colors focus:border-slate-300"
                  >
                    <option value="">Только {item.baseUnitName}</option>
                    {(Array.isArray(item.packagings) ? item.packagings : []).map((packaging) => {
                      const isDisabled = !isPackagingAvailableForCartItem(item, packaging);
                      return (
                        <option key={packaging.id} value={packaging.id} disabled={isDisabled}>
                          {packaging.packageName} = {packaging.unitsPerPackage} {item.baseUnitName}
                          {isDisabled ? ' (мало остатка)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </label>

                <div>
                  <span className="mb-1 block text-[10px] font-medium text-slate-500">Упаковок</span>
                  <div className="flex h-9 items-center rounded-xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => handleStepPackageQuantity(-1)}
                      disabled={!item.selectedPackagingId}
                      className="flex h-full w-8 items-center justify-center text-slate-400 hover:text-slate-900 disabled:opacity-30"
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={item.packageQuantityInput ?? String(item.packageQuantity)}
                      onChange={(e) => updatePackageQuantityInput(item.id, e.target.value)}
                      onBlur={() => commitPackageQuantityInput(item.id)}
                      disabled={!item.selectedPackagingId}
                      placeholder="0"
                      title="Количество выбранных упаковок"
                      className="h-full w-12 text-center text-xs font-semibold text-slate-800 outline-none disabled:bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => handleStepPackageQuantity(1)}
                      disabled={!item.selectedPackagingId}
                      className="flex h-full w-8 items-center justify-center text-slate-400 hover:text-slate-900 disabled:opacity-30"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="mb-1 block text-[10px] font-medium text-slate-500">{item.baseUnitName}</span>
                  <div className="flex h-9 items-center rounded-xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => handleStepExtraUnitQuantity(-1)}
                      disabled={isPackageSale}
                      className="flex h-full w-8 items-center justify-center text-slate-400 hover:text-slate-900 disabled:opacity-30"
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.extraUnitQuantityInput ?? String(item.extraUnitQuantity)}
                      onChange={(e) => updateExtraUnitQuantityInput(item.id, e.target.value)}
                      onBlur={() => commitExtraUnitQuantityInput(item.id)}
                      disabled={isPackageSale}
                      placeholder="0"
                      title="Дополнительное количество поштучно"
                      className="h-full w-12 text-center text-xs font-semibold text-slate-800 outline-none disabled:bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => handleStepExtraUnitQuantity(1)}
                      disabled={isPackageSale}
                      className="flex h-full w-8 items-center justify-center text-slate-400 hover:text-slate-900 disabled:opacity-30"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                <label>
                  <span className="mb-1 block text-[10px] font-medium text-slate-500">Скидка %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={item.lineDiscountInput !== undefined ? item.lineDiscountInput : (item.lineDiscountPercent > 0 ? String(item.lineDiscountPercent) : '')}
                    onChange={(e) => updateLineDiscountInput(item.id, e.target.value)}
                    onBlur={() => commitLineDiscountInput(item.id)}
                    placeholder="%"
                    title="Процент скидки на этот товар"
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-center text-xs text-slate-800 outline-none transition-colors focus:border-slate-300"
                  />
                </label>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <select
                    value={item.selectedPackagingId || ''}
                    onChange={(e) => updateSelectedPackaging(item.id, e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none transition-colors focus:border-slate-300"
                  >
                    <option value="">Только {item.baseUnitName}</option>
                    {(Array.isArray(item.packagings) ? item.packagings : []).map((packaging) => {
                      const isDisabled = !isPackagingAvailableForCartItem(item, packaging);
                      return (
                        <option key={packaging.id} value={packaging.id} disabled={isDisabled}>
                          {packaging.packageName} = {packaging.unitsPerPackage} {item.baseUnitName}
                          {isDisabled ? ' (мало остатка)' : ''}
                        </option>
                      );
                    })}
                  </select>

                  <div className="flex h-8 shrink-0 items-center rounded-xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => isPackageSale ? handleStepPackageQuantity(-1) : handleStepExtraUnitQuantity(-1)}
                      className="flex h-full w-6 items-center justify-center text-slate-400 hover:text-slate-900"
                    >
                      <Minus size={11} />
                    </button>
                    <input
                      type="number"
                      min={0}
                      step={isPackageSale ? "1" : "0.01"}
                      value={isPackageSale ? (item.packageQuantityInput ?? String(item.packageQuantity)) : (item.extraUnitQuantityInput ?? String(item.extraUnitQuantity))}
                      onChange={(e) => isPackageSale ? updatePackageQuantityInput(item.id, e.target.value) : updateExtraUnitQuantityInput(item.id, e.target.value)}
                      onBlur={() => isPackageSale ? commitPackageQuantityInput(item.id) : commitExtraUnitQuantityInput(item.id)}
                      placeholder="0"
                      className="h-full w-10 text-center text-xs font-semibold text-slate-800 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => isPackageSale ? handleStepPackageQuantity(1) : handleStepExtraUnitQuantity(1)}
                      className="flex h-full w-6 items-center justify-center text-slate-400 hover:text-slate-900"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                </div>

                <div className="w-16 shrink-0">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={item.lineDiscountInput !== undefined ? item.lineDiscountInput : (item.lineDiscountPercent > 0 ? String(item.lineDiscountPercent) : '')}
                    onChange={(e) => updateLineDiscountInput(item.id, e.target.value)}
                    onBlur={() => commitLineDiscountInput(item.id)}
                    placeholder="%"
                    className="h-8 w-full rounded-xl border border-slate-200 bg-white px-1.5 text-center text-xs text-slate-800 outline-none focus:border-slate-300"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
              <span>
                {item.selectedPackagingId
                  ? `${getCartPackaging(item)?.packageName || 'Упаковка'}: ${item.packageQuantity}`
                  : `Поштучно: ${item.extraUnitQuantity}`}
              </span>
              <span>
                Итого: <strong className="font-semibold text-slate-700">{item.quantity} шт</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
