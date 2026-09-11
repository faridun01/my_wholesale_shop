import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BookOpen, History, MoreHorizontal, Package, ShoppingCart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { getCurrentUser, isCustomerUser } from '../../utils/userAccess';
import MobileMoreSheet from './MobileMoreSheet';

type PrimaryTab = {
  to: string;
  icon: LucideIcon;
  label: string;
};

const STAFF_TABS: PrimaryTab[] = [
  { to: '/pos', icon: ShoppingCart, label: 'Продажа' },
  { to: '/sales', icon: History, label: 'История' },
  { to: '/products', icon: Package, label: 'Склад' },
];

const CUSTOMER_TABS: PrimaryTab[] = [
  { to: '/pos', icon: ShoppingCart, label: 'Заказ' },
  { to: '/catalog', icon: BookOpen, label: 'Каталог' },
];

export default function MobileBottomNav() {
  const user = React.useMemo(() => getCurrentUser(), []);
  const isCustomer = isCustomerUser(user);
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const tabs = isCustomer ? CUSTOMER_TABS : STAFF_TABS;
  const isMoreActive = !tabs.some((tab) => location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Основная навигация"
      >
        <div className="mx-auto flex h-16 max-w-xl items-stretch">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-ink-faint"
            >
              {({ isActive }) => (
                <>
                  <tab.icon size={21} strokeWidth={isActive ? 2.3 : 2} className={isActive ? 'text-accent-600' : 'text-ink-faint'} />
                  <span className={clsx('text-[10px] font-medium', isActive ? 'font-semibold text-accent-600' : 'text-ink-faint')}>
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}

          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5"
          >
            <MoreHorizontal size={21} strokeWidth={isMoreActive ? 2.3 : 2} className={isMoreActive ? 'text-accent-600' : 'text-ink-faint'} />
            <span className={clsx('text-[10px] font-medium', isMoreActive ? 'font-semibold text-accent-600' : 'text-ink-faint')}>
              Ещё
            </span>
          </button>
        </div>
      </nav>

      <MobileMoreSheet isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} pinnedRoutes={tabs.map((tab) => tab.to)} />
    </>
  );
}
