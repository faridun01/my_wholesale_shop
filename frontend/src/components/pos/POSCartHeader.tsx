import { Maximize2, Minimize2, ShoppingCart } from 'lucide-react';
import { clsx } from 'clsx';

type POSCartHeaderProps = {
  isCartExpanded: boolean;
  cartLength: number;
  totalWeightKg: number;
  formatWeightKg: (value: unknown) => string;
  setIsCartExpanded: (updater: (value: boolean) => boolean) => void;
  cartWidth?: number;
  setCartWidth?: (width: number) => void;
};

export default function POSCartHeader({
  isCartExpanded,
  cartLength,
  totalWeightKg,
  formatWeightKg,
  setIsCartExpanded,
  cartWidth,
  setCartWidth,
}: POSCartHeaderProps) {
  return (
    <div className={clsx('flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3', isCartExpanded && 'lg:col-start-1 lg:row-start-1')}>
      <div className={clsx(isCartExpanded && 'lg:hidden')}>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Корзина</h2>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {cartLength}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] font-medium text-emerald-600">
          Масса/объем: {formatWeightKg(totalWeightKg)}
        </p>
      </div>
      <div className={clsx('flex items-center gap-2', isCartExpanded && 'lg:ml-auto')}>
        {!isCartExpanded && setCartWidth && (
          <div className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-200 bg-[#f4f5fb] p-1">
            <button
              type="button"
              onClick={() => setCartWidth(320)}
              title="Компактная корзина (320px)"
              className={clsx(
                'rounded-lg px-2 py-0.5 text-[10px] font-bold transition-all',
                cartWidth === 320 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              )}
            >
              S
            </button>
            <button
              type="button"
              onClick={() => setCartWidth(440)}
              title="Стандартная корзина (440px)"
              className={clsx(
                'rounded-lg px-2 py-0.5 text-[10px] font-bold transition-all',
                cartWidth === 440 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              )}
            >
              M
            </button>
            <button
              type="button"
              onClick={() => setCartWidth(580)}
              title="Широкая корзина (580px)"
              className={clsx(
                'rounded-lg px-2 py-0.5 text-[10px] font-bold transition-all',
                cartWidth === 580 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              )}
            >
              L
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsCartExpanded((value) => !value)}
          title={isCartExpanded ? 'Свернуть корзину' : 'Развернуть корзину'}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-[#f4f5fb] text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          {isCartExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <div className={clsx('flex items-center gap-1.5 rounded-full border border-slate-200 bg-[#f4f5fb] px-2.5 py-1 text-slate-700', isCartExpanded && 'lg:hidden')}>
          <ShoppingCart size={14} />
          <span className="text-xs font-semibold">{cartLength}</span>
        </div>
      </div>
    </div>
  );
}
