import { clsx } from 'clsx';
import { Banknote, X } from 'lucide-react';
import { formatMoney } from '../../utils/format';

export type GiveBackMethod = 'cash' | 'card' | 'transfer';

const METHODS: Array<{ key: GiveBackMethod; label: string }> = [
  { key: 'cash', label: 'Наличные' },
  { key: 'card', label: 'Карта' },
  { key: 'transfer', label: 'Перевод' },
];

type GiveBackModalProps = {
  invoice: any;
  amountToReturn: number;
  amount: string;
  method: GiveBackMethod;
  isSaving: boolean;
  onAmountChange: (value: string) => void;
  onMethodChange: (method: GiveBackMethod) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export default function GiveBackModal({
  invoice,
  amountToReturn,
  amount,
  method,
  isSaving,
  onAmountChange,
  onMethodChange,
  onClose,
  onConfirm,
}: GiveBackModalProps) {
  return (
    <div
      className="fixed inset-0 z-60 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Выдача денег покупателю"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border border-slate-200/90 bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900">Деньги выданы покупателю</h3>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">
              Накладная №{invoice.id}{invoice.customer_name ? ` · ${invoice.customer_name}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-orange-300 bg-orange-50 px-3 py-2.5 text-orange-800">
          <span className="text-xs font-bold">Нужно вернуть</span>
          <span className="font-mono text-sm font-black">{formatMoney(amountToReturn)}</span>
        </div>

        <label className="mt-3 block text-xs font-semibold text-slate-700" htmlFor="give-back-amount">
          Выдано покупателю
        </label>
        <input
          id="give-back-amount"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-base font-bold text-slate-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
        />

        <p className="mt-3 text-xs font-semibold text-slate-700">Способ выдачи</p>
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          {METHODS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={method === option.key}
              onClick={() => onMethodChange(option.key)}
              className={clsx(
                'h-10 rounded-xl border text-xs font-bold transition-colors',
                method === option.key
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onConfirm}
          disabled={isSaving || !amount}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 text-sm font-bold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Banknote size={16} />
          {isSaving ? 'Сохранение...' : 'Подтвердить выдачу'}
        </button>
      </div>
    </div>
  );
}
