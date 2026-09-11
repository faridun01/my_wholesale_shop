import { startTransition } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { User } from 'lucide-react';
import { clsx } from 'clsx';

type CustomerOption = {
  id: number;
  name?: string | null;
};

type POSCartCustomerBlockProps = {
  isCartExpanded: boolean;
  cartOverflowMessage: string;
  customerId: number | null;
  customerSearch: string;
  isCustomerPortal: boolean;
  isCustomerDropdownOpen: boolean;
  filteredCustomers: CustomerOption[];
  setCustomerId: Dispatch<SetStateAction<number | null>>;
  setCustomerSearch: Dispatch<SetStateAction<string>>;
  setIsCustomerDropdownOpen: Dispatch<SetStateAction<boolean>>;
};

export default function POSCartCustomerBlock({
  isCartExpanded,
  cartOverflowMessage,
  customerId,
  customerSearch,
  isCustomerPortal,
  isCustomerDropdownOpen,
  filteredCustomers,
  setCustomerId,
  setCustomerSearch,
  setIsCustomerDropdownOpen,
}: POSCartCustomerBlockProps) {
  return (
    <div className={clsx('order-2 space-y-2.5 border-b border-slate-100 bg-slate-50/50 px-4 py-3 lg:order-0', isCartExpanded && 'lg:col-start-1 lg:row-start-2')}>
      {cartOverflowMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {cartOverflowMessage}
        </div>
      )}

      {customerId ? (
        <div className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <User size={15} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">{customerSearch || 'Покупатель'}</p>
              <p className="text-[10px] font-medium text-emerald-600">✓ Клиент выбран</p>
            </div>
          </div>
          {!isCustomerPortal && (
            <button
              type="button"
              onClick={() => {
                setCustomerId(null);
                setCustomerSearch('');
                setIsCustomerDropdownOpen(true);
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-xs hover:bg-slate-100 transition-colors"
            >
              Сменить
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            value={customerSearch}
            onChange={(e) => {
              if (isCustomerPortal) return;
              const value = e.target.value;
              startTransition(() => {
                setCustomerSearch(value);
                setCustomerId(null);
                setIsCustomerDropdownOpen(true);
              });
            }}
            onFocus={() => !isCustomerPortal && setIsCustomerDropdownOpen(true)}
            onBlur={() => {
              window.setTimeout(() => {
                setIsCustomerDropdownOpen(false);
              }, 150);
            }}
            placeholder="Поиск клиента по имени..."
            readOnly={isCustomerPortal}
            className="h-9 w-full rounded-xl border border-slate-200/90 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
          />
          {isCustomerDropdownOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              {filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setCustomerId(customer.id);
                    setCustomerSearch(customer.name || '');
                    setIsCustomerDropdownOpen(false);
                  }}
                  className={clsx(
                    'flex w-full rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50',
                    customerId === customer.id ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-700',
                  )}
                >
                  {customer.name}
                </button>
              ))}
              {!filteredCustomers.length && (
                <div className="px-3 py-2 text-xs text-slate-400">Клиенты не найдены</div>
              )}
            </div>
          )}
        </div>
      )}

      {!customerId && (
        <div className="rounded-xl border border-amber-200/70 bg-amber-50/80 px-2.5 py-1.5 text-[11px] font-medium text-amber-800">
          Для оформления выберите клиента
        </div>
      )}
    </div>
  );
}
