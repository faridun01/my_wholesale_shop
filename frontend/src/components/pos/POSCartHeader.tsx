import { Maximize2, Minimize2, ShoppingCart } from 'lucide-react';
import { clsx } from 'clsx';

type POSCartHeaderProps = {
  isCartExpanded: boolean;
  cartLength: number;
  totalWeightKg: number;
  formatWeightKg: (value: unknown) => string;
  setIsCartExpanded: (updater: (value: boolean) => boolean) => void;
};

export default function POSCartHeader({
  isCartExpanded,
  cartLength,
  totalWeightKg,
  formatWeightKg,
  setIsCartExpanded,
}: POSCartHeaderProps) {
  return (
    <div className={clsx('flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4', isCartExpanded && 'lg:col-start-1 lg:row-start-1')}>
      <div className={clsx(isCartExpanded && 'lg:hidden')}>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-slate-900">Корзина</h2>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            {cartLength}
          </span>
        </div>
        <p className="mt-1 text-xs font-medium text-emerald-600">
          Масса/объем: {formatWeightKg(totalWeightKg)}
        </p>
      </div>
      <div className={clsx('flex items-center gap-2', isCartExpanded && 'lg:ml-auto')}>
        <button
          type="button"
          onClick={() => setIsCartExpanded((value) => !value)}
          title={isCartExpanded ? 'Свернуть корзину' : 'Развернуть корзину'}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-[#f4f5fb] text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          {isCartExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
        <div className={clsx('flex items-center gap-2 rounded-full border border-slate-200 bg-[#f4f5fb] px-3 py-1.5 text-slate-700', isCartExpanded && 'lg:hidden')}>
          <ShoppingCart size={16} />
          <span className="text-xs font-semibold">{cartLength}</span>
        </div>
      </div>
    </div>
  );
}
