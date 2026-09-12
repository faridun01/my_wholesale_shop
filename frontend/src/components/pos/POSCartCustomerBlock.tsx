import { startTransition } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { User, AlertCircle, CheckCircle2, RotateCcw, Search } from 'lucide-react';
import { clsx } from 'clsx';

type CustomerOption = {
  id: number;
  name?: string | null;
  phone?: string | null;
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
  const selectedCustomer = filteredCustomers.find((c) => c.id === customerId);

  return (
    <div
      className={clsx(
        'order-2 space-y-2 border-b border-slate-100 bg-slate-50/50 px-3.5 py-2.5 sm:px-4 sm:py-3 lg:order-0',
        isCartExpanded && 'lg:col-start-1 lg:row-start-2',
      )}
    >
      {cartOverflowMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/90 px-3 py-2 text-xs font-semibold text-rose-700 shadow-2xs">
          <AlertCircle size={14} className="shrink-0 text-rose-600" />
          <span>{cartOverflowMessage}</span>
        </div>
      )}

      {customerId ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200/70 bg-linear-to-r from-emerald-50/50 via-white to-slate-50/50 p-2.5 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 font-black text-xs text-white shadow-2xs">
              {(customerSearch || selectedCustomer?.name || 'П')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs sm:text-[13px] font-black text-slate-900 leading-tight">
                {customerSearch || selectedCustomer?.name || 'Покупатель'}
              </p>
              <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 mt-0.5">
                <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                <span>Клиент привязан</span>
              </div>
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
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all"
            >
              <RotateCcw size={11} />
              <span>Сменить</span>
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
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
              }, 180);
            }}
            placeholder="Выберите покупателя (поиск по имени)..."
            readOnly={isCustomerPortal}
            className="h-9 w-full rounded-xl border border-slate-200/90 bg-white pl-9 pr-3 text-xs font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 shadow-2xs"
          />
          {isCustomerDropdownOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-60 overflow-y-auto rounded-xl border border-slate-200/90 bg-white p-1 shadow-xl">
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
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                    customerId === customer.id
                      ? 'bg-emerald-50 font-bold text-emerald-900'
                      : 'text-slate-700 hover:bg-slate-50',
                  )}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-bold text-[10px] text-slate-600">
                    {(customer.name || '?')[0].toUpperCase()}
                  </div>
                  <span className="truncate flex-1">{customer.name}</span>
                </button>
              ))}
              {!filteredCustomers.length && (
                <div className="px-3 py-3 text-center text-xs font-medium text-slate-400">
                  Клиенты не найдены
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!customerId && (
        <div className="flex items-center gap-1.5 rounded-lg border border-amber-200/70 bg-amber-50/80 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
          <AlertCircle size={12} className="shrink-0 text-amber-600" />
          <span>Для оформления продажи необходимо выбрать клиента</span>
        </div>
      )}
    </div>
  );
}
