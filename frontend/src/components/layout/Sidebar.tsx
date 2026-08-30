import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Banknote,
  BarChart3,
  BookOpen,
  Calendar,
  ChevronLeft,
  Download,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Users,
  Warehouse,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { logout } from '../../api/auth.api';
import { clearAuthSession, hasStoredSession } from '../../utils/authStorage';
import { getCurrentUser, isAdminUser, isCustomerUser } from '../../utils/userAccess';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import InstallPwaModal from '../pwa/InstallPwaModal';

type NavSection = string;

type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  section: NavSection;
};

const SHOW_CUSTOMER_ORDERS = false;

const navItems: NavItem[] = [
  ...(SHOW_CUSTOMER_ORDERS
    ? [{ to: '/customer-orders', icon: ShoppingBag, label: 'Заказы клиентов', section: 'Отношения' }]
    : []),
  { to: '/', icon: LayoutDashboard, label: 'Дашборд', section: 'Управление' },
  { to: '/pos', icon: ShoppingCart, label: 'POS терминал', section: 'Управление' },
  { to: '/catalog', icon: BookOpen, label: 'Каталог', section: 'Управление' },
  { to: '/products', icon: Package, label: 'Товары', section: 'Управление' },
  { to: '/sales', icon: History, label: 'История продаж', section: 'Управление' },
  { to: '/customers', icon: Users, label: 'Клиенты', section: 'Отношения' },
  { to: '/reminders', icon: Calendar, label: 'Напоминания', section: 'Отношения' },
  { to: '/expenses', icon: Banknote, label: 'Расходы', section: 'Система' },
  { to: '/reports', icon: BarChart3, label: 'Отчеты', section: 'Система' },
  { to: '/settings', icon: Settings, label: 'Настройки', section: 'Система' },
];

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

export default function Sidebar({ isOpen, isCollapsed, onClose, onToggleCollapse }: SidebarProps) {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const isAdmin = isAdminUser(user);
  const isCustomer = isCustomerUser(user);
  const [remindersCount, setRemindersCount] = useState(0);
  const [customerOrdersCount, setCustomerOrdersCount] = useState(0);
  const previousCustomerOrdersCountRef = useRef<number | null>(null);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );
  const { isStandalone, isInstalled, isIOS, canPromptNative, promptInstall } = usePWAInstall();
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const syncViewport = (event?: MediaQueryListEvent) => {
      setIsDesktopViewport(event ? event.matches : mediaQuery.matches);
    };

    syncViewport();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewport);
      return () => mediaQuery.removeEventListener('change', syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    if (!hasStoredSession()) return;

    const refreshRemindersCount = () => {
      client
        .get('/reminders')
        .then((res) => {
          const items = Array.isArray(res.data) ? res.data : [];
          setRemindersCount(items.filter((item: any) => !item.isCompleted).length);
        })
        .catch(() => {
          setRemindersCount(0);
        });
    };

    refreshRemindersCount();
    window.addEventListener('focus', refreshRemindersCount);
    window.addEventListener('reminders-updated', refreshRemindersCount as EventListener);

    return () => {
      window.removeEventListener('focus', refreshRemindersCount);
      window.removeEventListener('reminders-updated', refreshRemindersCount as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!SHOW_CUSTOMER_ORDERS || !hasStoredSession() || isCustomer) return;

    const refreshCustomerOrdersCount = () => {
      client
        .get('/customer-orders/pending-count')
        .then((res) => {
          const nextCount = Number(res.data?.count || 0);
          const previousCount = previousCustomerOrdersCountRef.current;
          if (previousCount !== null && nextCount > previousCount) {
            toast.success('Новый заказ клиента ожидает проверки');
          }
          previousCustomerOrdersCountRef.current = nextCount;
          setCustomerOrdersCount(nextCount);
        })
        .catch(() => setCustomerOrdersCount(0));
    };

    refreshCustomerOrdersCount();
    const intervalId = window.setInterval(refreshCustomerOrdersCount, 30000);
    window.addEventListener('focus', refreshCustomerOrdersCount);
    window.addEventListener('customer-orders-updated', refreshCustomerOrdersCount as EventListener);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshCustomerOrdersCount);
      window.removeEventListener('customer-orders-updated', refreshCustomerOrdersCount as EventListener);
    };
  }, [isCustomer]);

  useEffect(() => {
    if (typeof document === 'undefined' || isDesktopViewport) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = isOpen ? 'hidden' : previousOverflow;

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDesktopViewport, isOpen]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // If server session is already gone, clear local session anyway.
    }

    clearAuthSession();
    navigate('/login');
  };

  const filteredNavItems = navItems
    .filter((item) => {
      if (isCustomer) {
        return item.to === '/catalog' || item.to === '/pos';
      }

      if (
        !isAdmin &&
        (item.to === '/' ||
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

  const navSections = filteredNavItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {});

  const sidebarCollapsed = isDesktopViewport && isCollapsed;

  return (
    <>
      <div
        className={clsx(
          'fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-200 lg:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex h-dvh flex-col overflow-y-auto overflow-x-hidden border-r border-sidebar-line bg-sidebar text-sidebar-fg transition-[width,transform] duration-200 ease-out [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          sidebarCollapsed ? 'w-20 lg:w-20' : 'w-[min(86vw,300px)] lg:w-60',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div
          className={clsx(
            'border-b border-sidebar-line',
            sidebarCollapsed ? 'px-2.5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]' : 'px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]',
          )}
        >
          <div className={clsx('flex items-center', sidebarCollapsed ? 'justify-center' : 'gap-3')}>
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth >= 1024) {
                  onToggleCollapse();
                  return;
                }

                navigate('/');
                onClose();
              }}
              title={sidebarCollapsed ? 'Развернуть меню' : 'Оптовая торговля'}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-white"
            >
              <Warehouse size={19} />
            </button>

            {!sidebarCollapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold leading-tight text-white">Оптовая</div>
                  <div className="truncate text-[15px] font-semibold leading-tight text-white">торговля</div>
                </div>

                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="ml-auto hidden h-8 w-8 items-center justify-center rounded-md text-sidebar-fg-muted transition-colors hover:bg-sidebar-raised hover:text-white lg:flex"
                  title="Свернуть меню"
                >
                  <ChevronLeft size={16} />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-sidebar-line text-sidebar-fg transition-colors hover:bg-sidebar-raised lg:hidden"
              title="Закрыть меню"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>

        <nav className={clsx('flex-1 overflow-visible', sidebarCollapsed ? 'px-2 py-2' : 'px-3 py-3')}>
          <div className="space-y-3">
            {Object.entries(navSections).map(([section, items]) => (
              <div key={section}>
                {!sidebarCollapsed && (
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-fg-muted">
                    {section}
                  </p>
                )}

                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/customers'}
                      onClick={() => {
                        if (window.innerWidth < 1024) onClose();
                      }}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        clsx(
                          'group relative flex border transition-colors',
                          sidebarCollapsed
                            ? 'mx-auto h-11 w-11 items-center justify-center rounded-lg'
                            : 'items-center gap-3 rounded-lg px-3 py-2.5',
                          isActive
                            ? 'border-sidebar-active-line bg-sidebar-active text-white'
                            : 'border-transparent text-sidebar-fg hover:bg-sidebar-raised hover:text-white',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon size={18} className="shrink-0" strokeWidth={isActive ? 2.2 : 2} />

                          {!sidebarCollapsed && <span className="truncate text-[13.5px] font-medium">{item.label}</span>}

                          {item.to === '/reminders' && remindersCount > 0 && (
                            <span
                              className={clsx(
                                'flex items-center justify-center rounded-full bg-rose-500 text-[9px] font-semibold text-white',
                                sidebarCollapsed ? 'absolute right-1 top-1 h-4 min-w-4 px-1' : 'ml-auto h-4 min-w-4 px-1',
                              )}
                            >
                              {remindersCount > 9 ? '9+' : remindersCount}
                            </span>
                          )}

                          {SHOW_CUSTOMER_ORDERS && item.to === '/customer-orders' && customerOrdersCount > 0 && (
                            <span
                              className={clsx(
                                'flex items-center justify-center rounded-full bg-amber-500 text-[9px] font-semibold text-white',
                                sidebarCollapsed ? 'absolute right-1 top-1 h-4 min-w-4 px-1' : 'ml-auto h-4 min-w-4 px-1',
                              )}
                            >
                              {customerOrdersCount > 9 ? '9+' : customerOrdersCount}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className={clsx('mt-auto border-t border-sidebar-line', sidebarCollapsed ? 'px-2 py-2' : 'px-3 py-2.5')}>
          {!isStandalone && !isInstalled && (
            <button
              onClick={async () => {
                if (canPromptNative) {
                  const success = await promptInstall();
                  if (!success) setIsPwaModalOpen(true);
                } else {
                  setIsPwaModalOpen(true);
                }
              }}
              title={sidebarCollapsed ? 'Установить приложение' : undefined}
              className={clsx(
                'mb-2 flex w-full items-center justify-center gap-2 rounded-lg bg-accent-500 font-medium text-white transition-colors hover:bg-accent-600',
                sidebarCollapsed ? 'h-11 w-11 p-0' : 'px-3.5 py-2.5 text-xs',
              )}
            >
              <Download size={sidebarCollapsed ? 20 : 16} className="shrink-0" />
              {!sidebarCollapsed && <span>Установить приложение</span>}
            </button>
          )}

          <div className={clsx('rounded-lg border border-sidebar-line bg-sidebar-raised', sidebarCollapsed ? 'px-0 py-2' : 'p-2.5')}>
            <div className={clsx('flex items-center', sidebarCollapsed ? 'justify-center' : 'gap-3')}>
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar text-sm font-semibold text-white">
                {user.username?.[0]?.toUpperCase()}
              </div>

              {!sidebarCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">{user.username}</p>
                </div>
              )}
            </div>

            {!sidebarCollapsed && (
              <button
                onClick={handleLogout}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-md py-1.5 text-[9px] font-semibold uppercase tracking-wider text-sidebar-fg-muted transition-colors hover:bg-rose-950/40 hover:text-rose-300"
                title="Выйти"
              >
                <LogOut size={13} />
                <span>Выйти</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      <InstallPwaModal
        isOpen={isPwaModalOpen}
        onClose={() => setIsPwaModalOpen(false)}
        isIOS={isIOS}
        canPromptNative={canPromptNative}
        onNativeInstall={promptInstall}
      />
    </>
  );
}
