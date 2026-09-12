import { ChevronRight, ShoppingCart, Loader2, Banknote, Percent } from 'lucide-react';
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
        'order-3 space-y-2.5 border-t border-slate-100 bg-slate-50/60 px-3.5 py-3 sm:px-4 sm:py-3.5 lg:order-0',
        isCartExpanded
          ? 'lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:h-full lg:self-stretch lg:overflow-hidden lg:border-l lg:border-t-0'
          : 'z-10 shrink-0',
      )}
    >
      {/* Expanded view overview banner */}
      {isCartExpanded && (
        <div className="hidden rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs lg:block">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900 leading-tight">Корзина</h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">Позиций в чеке: {cartLength}</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-slate-700 shadow-2xs">
              <ShoppingCart size={14} className="text-slate-500" />
              <span className="font-mono text-xs font-bold">{cartLength}</span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Сумма</p>
              <p className="mt-0.5 font-mono text-sm font-black text-slate-900 truncate">{formatMoney(total)} TJS</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Масса/объем</p>
              <p className="mt-0.5 font-mono text-sm font-black text-emerald-800 truncate">
                {formatWeightKg(cartWeightSummary.totalWeightKg)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Payment Presets */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setPaidAmount(String(total))}
          className="flex-1 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-1 text-center text-xs font-black text-emerald-800 shadow-2xs hover:bg-emerald-600 hover:text-white active:scale-95 transition-all truncate"
        >
          Вся сумма ({formatMoney(total)})
        </button>
        <button
          type="button"
          onClick={() => setPaidAmount('0')}
          className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-900 hover:text-white active:scale-95 transition-all"
        >
          В долг (0 TJS)
        </button>
      </div>

      {/* Inputs for Discount % and Paid Amount */}
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <input
            type="number"
            min={0}
            max={100}
            value={discount === 0 ? '' : discount}
            onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
            placeholder="Скидка %"
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-2.5 pr-7 font-mono text-xs font-black text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 shadow-2xs"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
            %
          </span>
        </div>

        <div className="relative">
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
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-2.5 pr-9 font-mono text-xs font-black text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 shadow-2xs"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold text-slate-400">
            TJS
          </span>
        </div>
      </div>

      {/* Financial Breakdown Card */}
      <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-3 text-xs shadow-2xs">
        <div className="flex items-center justify-between text-slate-500">
          <span className="font-semibold">Подытог</span>
          <span className="font-mono font-bold text-slate-800 tabular-nums">{formatMoney(subtotal)} TJS</span>
        </div>

        {cartWeightSummary.totalWeightKg > 0 && (
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-semibold">Масса/объем товаров</span>
            <span className="font-mono font-bold text-emerald-700">
              {formatWeightKg(cartWeightSummary.totalWeightKg)}
            </span>
          </div>
        )}

        {cartWeightSummary.missingWeightItems > 0 && (
          <div className="text-[10px] font-medium text-amber-600">
            У {cartWeightSummary.missingWeightItems} поз. вес не найден в названии
          </div>
        )}

        {lineDiscountAmount > 0 && (
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-semibold">Скидка по товарам</span>
            <span className="font-mono font-black text-rose-600 tabular-nums">
              -{formatMoney(lineDiscountAmount)} TJS
            </span>
          </div>
        )}

        {invoiceDiscountAmount > 0 && (
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-semibold">Скидка на чек</span>
            <span className="font-mono font-black text-rose-600 tabular-nums">
              -{formatMoney(invoiceDiscountAmount)} TJS
            </span>
          </div>
        )}

        {paidAmount !== '' && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-slate-500">
            <span className="font-semibold">{balance >= 0 ? 'Сдача клиенту' : 'Остаток в долг'}</span>
            <span
              className={clsx(
                'font-mono font-black tabular-nums',
                balance >= 0 ? 'text-emerald-700' : 'text-rose-600',
              )}
            >
              {balance >= 0 ? `+${formatMoney(balance)}` : `${formatMoney(Math.abs(balance))}`} TJS
            </span>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">К оплате</span>
            <span className="text-xs font-black text-slate-900">Итого</span>
          </div>
          <span className="font-mono text-xl sm:text-2xl font-black tracking-tight text-slate-950 tabular-nums">
            {formatMoney(total)} <span className="text-xs font-bold text-slate-400 font-sans">TJS</span>
          </span>
        </div>
      </div>

      {/* Submit Button (Desktop) */}
      <button
        type="button"
        onClick={handleCheckout}
        disabled={isSubmitting || cartLength === 0 || !customerId}
        className="hidden w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-xs transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 lg:flex"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Обработка...</span>
          </>
        ) : (
          <>
            <Banknote size={15} />
            <span>Оформить продажу</span>
            <ChevronRight size={16} />
          </>
        )}
      </button>
    </div>
  );
}
