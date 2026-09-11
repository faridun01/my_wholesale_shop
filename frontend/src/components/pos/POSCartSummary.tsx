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

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setPaidAmount(String(total))}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
        >
          Вся сумма
        </button>
        <button
          type="button"
          onClick={() => setPaidAmount('0')}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
        >
          В долг (0 TJS)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          min={0}
          value={discount === 0 ? '' : discount}
          onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
          placeholder="Скидка %"
          className="h-9 rounded-xl border border-slate-200/90 bg-white px-3 text-xs text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 font-mono"
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
          className="h-9 rounded-xl border border-slate-200/90 bg-white px-3 text-xs text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 font-mono"
        />
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white p-3 text-xs shadow-xs">
        <div className="flex items-center justify-between text-slate-500">
          <span>Подытог</span>
          <span className="font-mono font-medium text-slate-900 tabular-nums">{formatMoney(subtotal)}</span>
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
        {lineDiscountAmount > 0 && (
          <div className="flex items-center justify-between text-slate-500">
            <span>Скидка по товарам</span>
            <span className="font-mono font-medium text-slate-900 tabular-nums">-{formatMoney(lineDiscountAmount)}</span>
          </div>
        )}
        {invoiceDiscountAmount > 0 && (
          <div className="flex items-center justify-between text-slate-500">
            <span>Скидка на чек</span>
            <span className="font-mono font-medium text-slate-900 tabular-nums">-{formatMoney(invoiceDiscountAmount)}</span>
          </div>
        )}
        {paidAmount !== '' && (
          <div className="flex items-center justify-between text-slate-500">
            <span>{balance >= 0 ? 'Сдача' : 'Остаток в долг'}</span>
            <span className={clsx('font-mono font-semibold tabular-nums', balance >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
              {formatMoney(Math.abs(balance))}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
          <span className="text-xs font-bold text-slate-900">Итого к оплате</span>
          <span className="font-mono text-lg font-bold tracking-tight text-slate-900 tabular-nums">{formatMoney(total)}</span>
        </div>
      </div>

      <button
        onClick={handleCheckout}
        disabled={isSubmitting || cartLength === 0 || !customerId}
        className="hidden w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-semibold text-white shadow-xs transition-all hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 lg:flex"
      >
        {isSubmitting ? 'Обработка...' : 'Оформить продажу'}
        {!isSubmitting && <ChevronRight size={16} />}
      </button>
    </div>
  );
}
