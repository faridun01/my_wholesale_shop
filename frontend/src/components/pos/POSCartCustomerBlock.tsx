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
    <div className={clsx('order-2 space-y-3 border-b border-slate-100 bg-[#f4f5fb]/40 px-5 py-4 lg:order-0', isCartExpanded && 'lg:col-start-1 lg:row-start-2')}>
      {cartOverflowMessage && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
          {cartOverflowMessage}
        </div>
      )}

      <div className="relative">
        <User className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
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
          className="w-full rounded-2xl border border-slate-200 bg-[#f4f5fb] py-2.5 pl-10 pr-4 text-xs text-slate-800 outline-none transition-colors focus:border-slate-300 focus:bg-white"
        />
        {isCustomerDropdownOpen && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-60 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl">
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
                  'flex w-full rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-[#f4f5fb]',
                  customerId === customer.id ? 'bg-[#f4f5fb] font-semibold text-slate-900' : 'text-slate-700',
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

      {!customerId && (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700">
          Выберите клиента для оформления продажи.
        </div>
      )}
    </div>
  );
}
