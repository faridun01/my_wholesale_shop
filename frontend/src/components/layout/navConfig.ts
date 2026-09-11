import {
  Banknote,
  BarChart3,
  BookOpen,
  Calendar,
  History,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { isAdminUser, isCustomerUser, type AppUser } from '../../utils/userAccess';

export type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  section: string;
};

export const SHOW_CUSTOMER_ORDERS = false;

export const navItems: NavItem[] = [
  ...(SHOW_CUSTOMER_ORDERS
    ? [{ to: '/customer-orders', icon: ShoppingBag, label: 'Заказы клиентов', section: 'Отношения' }]
    : []),
  { to: '/dashboard', icon: LayoutDashboard, label: 'Дашборд', section: 'Управление' },
  { to: '/pos', icon: ShoppingBag, label: 'Продажа', section: 'Управление' },
  { to: '/catalog', icon: BookOpen, label: 'Каталог', section: 'Управление' },
  { to: '/products', icon: Package, label: 'Товары', section: 'Управление' },
  { to: '/sales', icon: History, label: 'История продаж', section: 'Управление' },
  { to: '/customers', icon: Users, label: 'Клиенты', section: 'Отношения' },
  { to: '/reminders', icon: Calendar, label: 'Напоминания', section: 'Отношения' },
  { to: '/expenses', icon: Banknote, label: 'Расходы', section: 'Система' },
  { to: '/reports', icon: BarChart3, label: 'Отчеты', section: 'Система' },
  { to: '/settings', icon: Settings, label: 'Настройки', section: 'Система' },
];

/** Same RBAC visibility + label rules used by the desktop sidebar — the single
 * source of truth so the mobile bottom nav / more-sheet never drift from it. */
export function getFilteredNavItems(user: AppUser): NavItem[] {
  const isAdmin = isAdminUser(user);
  const isCustomer = isCustomerUser(user);

  return navItems
    .filter((item) => {
      if (isCustomer) {
        return item.to === '/catalog' || item.to === '/pos';
      }

      if (
        !isAdmin &&
        (item.to === '/dashboard' ||
          item.to === '/' ||
          item.to === '/expenses' ||
          item.to === '/analytics' ||
          item.to === '/reports' ||
          item.to === '/settings')
      ) {
        return false;
      }
      if (
        item.to === '/expenses' ||
        item.to === '/analytics' ||
        item.to === '/reports' ||
        item.to === '/settings'
      ) {
        return isAdmin;
      }
      return true;
    })
    .map((item) => {
      if (!isAdmin && item.to === '/sales') {
        return {
          ...item,
          label: 'Мои накладные',
        };
      }

      return item;
    });
}
