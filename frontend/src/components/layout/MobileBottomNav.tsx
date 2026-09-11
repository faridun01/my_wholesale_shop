import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BookOpen, History, Menu, Package, ShoppingBag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { getCurrentUser, isCustomerUser } from '../../utils/userAccess';

type PrimaryTab = {
  to: string;
  icon: LucideIcon;
  label: string;
  isCenter?: boolean;
};

// Staff / Admin: Склад, История продаж, Продажа (по середине), Каталог, Меню
const STAFF_TABS: PrimaryTab[] = [
  { to: '/products', icon: Package, label: 'Склад' },
  { to: '/sales', icon: History, label: 'История' },
  { to: '/pos', icon: ShoppingBag, label: 'Продажа', isCenter: true },
  { to: '/catalog', icon: BookOpen, label: 'Каталог' },
  { to: '/menu', icon: Menu, label: 'Меню' },
];

const CUSTOMER_TABS: PrimaryTab[] = [
  { to: '/catalog', icon: BookOpen, label: 'Каталог' },
  { to: '/pos', icon: ShoppingBag, label: 'Заказ', isCenter: true },
  { to: '/menu', icon: Menu, label: 'Меню' },
];

export default function MobileBottomNav() {
  const user = React.useMemo(() => getCurrentUser(), []);
  const isCustomer = isCustomerUser(user);
  const location = useLocation();

  const tabs = isCustomer ? CUSTOMER_TABS : STAFF_TABS;

  const isTabActive = (tab: PrimaryTab) => {
    if (tab.to === '/menu') {
      return (
        location.pathname === '/menu' ||
        !tabs
          .filter((t) => t.to !== '/menu')
          .some((t) => location.pathname === t.to || location.pathname.startsWith(`${t.to}/`))
      );
    }
    return location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`);
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.04)] lg:hidden"
      aria-label="Основная навигация"
    >
      <div className="mx-auto flex h-16 max-w-xl items-stretch px-1">
        {tabs.map((tab) => {
          const active = isTabActive(tab);

          if (tab.isCenter) {
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className="relative -top-2.5 flex min-w-0 flex-1 flex-col items-center justify-center"
              >
                <div
                  className={clsx(
                    'flex h-12 w-12 items-center justify-center rounded-2xl shadow-md transition-all',
                    active
                      ? 'bg-accent-600 text-white shadow-accent-600/35 scale-105 ring-4 ring-white'
                      : 'bg-accent-500 text-white shadow-accent-500/25 ring-4 ring-white hover:bg-accent-600'
                  )}
                >
                  <tab.icon size={22} strokeWidth={2.3} />
                </div>
                <span
                  className={clsx(
                    'mt-0.5 text-[10px] font-semibold tracking-tight transition-colors',
                    active ? 'text-accent-700' : 'text-slate-600'
                  )}
                >
                  {tab.label}
                </span>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5"
            >
              <tab.icon
                size={21}
                strokeWidth={active ? 2.4 : 1.9}
                className={clsx('transition-colors', active ? 'text-accent-600' : 'text-slate-400')}
              />
              <span
                className={clsx(
                  'text-[10px] tracking-tight transition-colors',
                  active ? 'font-semibold text-accent-600' : 'font-medium text-slate-500'
                )}
              >
                {tab.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
