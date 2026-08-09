import { ChevronRight, ShoppingCart } from 'lucide-react';
import { clsx } from 'clsx';
import { formatMoney } from '../../utils/format';

type CartWeightSummary = {
  totalWeightKg: number;
  missingWeightItems: number;
};

type POSCartSummaryProps = {
  isCartExpanded: boolean;
  cartLength: number;
  customerId: number | null;
  discount: number;
  paidAmount: string;
  subtotal: number;
  total: number;
  lineDiscountAmount: number;
  invoiceDiscountAmount: number;
  balance: number;
  cartWeightSummary: CartWeightSummary;
  isSubmitting: boolean;
  formatWeightKg: (value: unknown) => string;
  setDiscount: (value: number) => void;
  setPaidAmount: (value: string) => void;
  handleCheckout: () => void;
};

export default function POSCartSummary({
  isCartExpanded,
  cartLength,
  customerId,
  discount,
  paidAmount,
  subtotal,
  total,
  lineDiscountAmount,
  invoiceDiscountAmount,
  balance,
  cartWeightSummary,
  isSubmitting,
  formatWeightKg,
  setDiscount,
  setPaidAmount,
  handleCheckout,
}: POSCartSummaryProps) {
  return (
    <div
      className={clsx(
        'order-3 space-y-3 border-t border-slate-100 bg-[#f4f5fb]/40 px-5 py-4 lg:order-0',
        isCartExpanded
          ? 'lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:h-full lg:self-stretch lg:overflow-hidden lg:border-l lg:border-t-0'
          : 'z-10 shrink-0',
      )}
    >
      {isCartExpanded && (
        <div className="hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xs lg:block">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Корзина</h2>
              <p className="mt-0.5 text-xs text-slate-500">Выбрано позиций: {cartLength}</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-[#f4f5fb] px-3 py-1.5 text-slate-700">
              <ShoppingCart size={16} />
              <span className="text-xs font-semibold">{cartLength}</span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-100 bg-[#f4f5fb] px-3 py-2">
              <p className="text-[10px] font-medium text-slate-400">Сумма</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatMoney(total)}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2">
              <p className="text-[10px] font-medium text-emerald-600">Масса/объем</p>
              <p className="mt-0.5 text-sm font-semibold text-emerald-700">{formatWeightKg(cartWeightSummary.totalWeightKg)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          type="number"
          min={0}
          value={discount === 0 ? '' : discount}
          onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
          placeholder="Скидка %"
          className="rounded-2xl border border-slate-200 bg-[#f4f5fb] px-4 py-2.5 text-xs text-slate-800 outline-none transition-colors focus:border-slate-300 focus:bg-white"
        />
        <input
          type="number"
          value={paidAmount}
          min={0}
          step="0.01"
          onChange={(e) => {
            const value = e.target.value;
            setPaidAmount(value === '' ? '' : String(Math.max(0, Number(value) || 0)));
          }}
          placeholder="Оплачено"
          className="rounded-2xl border border-slate-200 bg-[#f4f5fb] px-4 py-2.5 text-xs text-slate-800 outline-none transition-colors focus:border-slate-300 focus:bg-white"
        />
      </div>

      <div className="hidden space-y-2 rounded-2xl border border-slate-200/70 bg-white p-4 text-xs shadow-xs lg:block">
        <div className="flex items-center justify-between text-slate-500">
          <span>Подытог</span>
          <span className="font-medium text-slate-900">{formatMoney(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-500">
          <span>Масса/объем товаров</span>
          <span className="font-semibold text-emerald-600">{formatWeightKg(cartWeightSummary.totalWeightKg)}</span>
        </div>
        {cartWeightSummary.missingWeightItems > 0 ? (
          <div className="text-[10px] font-medium text-amber-600">
            У {cartWeightSummary.missingWeightItems} поз. вес не найден в названии
          </div>
        ) : null}
        <div className="flex items-center justify-between text-slate-500">
          <span>Скидка по товарам</span>
          <span className="font-medium text-slate-900">-{formatMoney(lineDiscountAmount)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-500">
          <span>Скидка на чек</span>
          <span className="font-medium text-slate-900">-{formatMoney(invoiceDiscountAmount)}</span>
        </div>
        {paidAmount && (
          <div className="flex items-center justify-between text-slate-500">
            <span>{balance >= 0 ? 'Сдача' : 'Долг'}</span>
            <span className={clsx('font-semibold', balance >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
              {formatMoney(Math.abs(balance))}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-base font-semibold text-slate-900">Итого</span>
          <span className="text-2xl font-bold tracking-tight text-slate-900">{formatMoney(total)}</span>
        </div>
      </div>

      <button
        onClick={handleCheckout}
        disabled={isSubmitting || cartLength === 0 || !customerId}
        className="hidden w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 lg:flex"
      >
        {isSubmitting ? 'Обработка...' : 'Оформить продажу'}
        {!isSubmitting && <ChevronRight size={18} />}
      </button>
    </div>
  );
}
