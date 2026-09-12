import { Maximize2, Minimize2, ShoppingCart, Trash2, Package } from 'lucide-react';
import { clsx } from 'clsx';

type POSCartHeaderProps = {
  isCartExpanded: boolean;
  cartLength: number;
  totalWeightKg: number;
  formatWeightKg: (value: unknown) => string;
  setIsCartExpanded: (updater: (value: boolean) => boolean) => void;
  cartWidth?: number;
  setCartWidth?: (width: number) => void;
  onClearCart?: () => void;
};

export default function POSCartHeader({
  isCartExpanded,
  cartLength,
  totalWeightKg,
  formatWeightKg,
  setIsCartExpanded,
  cartWidth,
  setCartWidth,
  onClearCart,
}: POSCartHeaderProps) {
  return (
    <div
      className={clsx(
        'flex items-center justify-between border-b border-slate-100/80 bg-white px-3.5 py-2.5 sm:px-4 sm:py-3',
        isCartExpanded && 'lg:col-start-1 lg:row-start-1',
      )}
    >
      <div className={clsx('flex items-center gap-2.5 min-w-0', isCartExpanded && 'lg:hidden')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white shadow-xs">
          <ShoppingCart size={15} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-black tracking-tight text-slate-900 leading-tight">
              Корзина
            </h2>
            <span className="inline-flex items-center rounded-full bg-emerald-100/80 px-2 py-0.5 font-mono text-[11px] font-black text-emerald-800 border border-emerald-200/60">
              {cartLength}
            </span>
          </div>
          {totalWeightKg > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 mt-0.5">
              <Package size={11} className="text-emerald-600 shrink-0" />
              <span>{formatWeightKg(totalWeightKg)}</span>
            </div>
          )}
        </div>
      </div>

      <div className={clsx('flex items-center gap-1.5 sm:gap-2', isCartExpanded && 'lg:ml-auto')}>
        {/* Clear Cart Button */}
        {cartLength > 0 && onClearCart && (
          <button
            type="button"
            onClick={onClearCart}
            title="Очистить корзину"
            className="flex h-8 items-center gap-1 rounded-lg border border-slate-200/80 bg-slate-50/70 px-2 text-[11px] font-bold text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 active:scale-95 transition-all shadow-2xs"
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">Очистить</span>
          </button>
        )}

        {/* Width Switcher (Desktop only) */}
        {!isCartExpanded && setCartWidth && (
          <div className="hidden sm:flex items-center gap-0.5 rounded-lg border border-slate-200/90 bg-slate-100/90 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setCartWidth(320)}
              title="Компактная корзина (320px)"
              className={clsx(
                'rounded-md px-2 py-0.5 text-[10px] font-black transition-all',
                cartWidth === 320
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900',
              )}
            >
              S
            </button>
            <button
              type="button"
              onClick={() => setCartWidth(440)}
              title="Стандартная корзина (440px)"
              className={clsx(
                'rounded-md px-2 py-0.5 text-[10px] font-black transition-all',
                cartWidth === 440
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900',
              )}
            >
              M
            </button>
            <button
              type="button"
              onClick={() => setCartWidth(580)}
              title="Широкая корзина (580px)"
              className={clsx(
                'rounded-md px-2 py-0.5 text-[10px] font-black transition-all',
                cartWidth === 580
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900',
              )}
            >
              L
            </button>
          </div>
        )}

        {/* Expand/Collapse Toggle */}
        <button
          type="button"
          onClick={() => setIsCartExpanded((value) => !value)}
          title={isCartExpanded ? 'Свернуть корзину' : 'Развернуть корзину'}
          className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 shadow-2xs active:scale-95"
        >
          {isCartExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        {/* Counter Pill for expanded state */}
        <div
          className={clsx(
            'flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-slate-50/60 px-2.5 py-1 text-slate-700 shadow-2xs',
            isCartExpanded && 'lg:hidden',
          )}
        >
          <ShoppingCart size={13} className="text-slate-500" />
          <span className="font-mono text-xs font-black tabular-nums">{cartLength}</span>
        </div>
      </div>
    </div>
  );
}
