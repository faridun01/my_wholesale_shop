import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Banknote, ChevronLeft, Download, LogOut, Warehouse } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { logout } from '../../api/auth.api';
import { clearAuthSession, hasStoredSession } from '../../utils/authStorage';
import { getCurrentUser, isAdminUser, isCustomerUser } from '../../utils/userAccess';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import InstallPwaModal from '../pwa/InstallPwaModal';
import { SHOW_CUSTOMER_ORDERS, getFilteredNavItems, type NavItem } from './navConfig';
import { getPendingHandoversCount } from '../../api/cash.api';
import { useCashEvents } from '../../api/cashEvents';
import { formatMoney } from '../../utils/format';

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
  const [cashPendingCount, setCashPendingCount] = useState(0);
  const previousCashPendingCountRef = useRef<number | null>(null);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );
  const { isStandalone, isInstalled, isIOS, canPromptNative, promptInstall, markAsInstalled } = usePWAInstall();
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const syncViewport = (event?: MediaQueryListEvent) => {
      const isDesktop = event ? event.matches : mediaQuery.matches;
      setIsDesktopViewport(isDesktop);
      if (isDesktop && isOpen) {
        onClose();
      }
    };

    syncViewport();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewport);
      return () => mediaQuery.removeEventListener('change', syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, [isOpen, onClose]);

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

  const showCashHandoverToast = React.useCallback((title: string) => {
    toast(
      (t) => (
        <button
          type="button"
          className="text-left"
          onClick={() => {
            toast.dismiss(t.id);
            navigate('/cash');
          }}
        >
          <span className="block font-semibold">{title}</span>
          <span className="block text-xs text-slate-500">Пересчитайте деньги и подтвердите приём</span>
        </button>
      ),
      { id: 'cash-handover', duration: 10000, icon: <Banknote size={18} className="text-emerald-600" /> },
    );
  }, [navigate]);

  // Tells an administrator that a staff member sent cash to be confirmed. The live
  // notice below does it at once; this count check is the fallback and the badge.
  const refreshCashPendingRef = useRef<(silent?: boolean) => void>(() => {});
  useEffect(() => {
    if (!hasStoredSession() || !isAdmin) return;

    const refreshCashPendingCount = (silent = false) => {
      getPendingHandoversCount()
        .then((nextCount) => {
          const previousCount = previousCashPendingCountRef.current;
          if (!silent && nextCount > 0 && (previousCount === null || nextCount > previousCount)) {
            showCashHandoverToast(previousCount === null ? `Передач кассы ждут подтверждения: ${nextCount}` : 'Сотрудник передал кассу');
          }
          previousCashPendingCountRef.current = nextCount;
          setCashPendingCount(nextCount);
        })
        .catch(() => setCashPendingCount(0));
    };
    refreshCashPendingRef.current = refreshCashPendingCount;

    refreshCashPendingCount();
    const intervalId = window.setInterval(refreshCashPendingCount, 30000);
    const refreshOnEvent = () => refreshCashPendingCount();
    window.addEventListener('focus', refreshOnEvent);
    window.addEventListener('cash-handovers-updated', refreshOnEvent);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshOnEvent);
      window.removeEventListener('cash-handovers-updated', refreshOnEvent);
    };
  }, [isAdmin, showCashHandoverToast]);

  // Live cash notices: the administrator hears of every handover at once, a staff member
  // of the administrator's decision on their own cash, wherever they are in the app.
  useCashEvents((event) => {
    if (isAdmin) {
      if (event.type === 'handover_sent') showCashHandoverToast(`${event.username || 'Сотрудник'} передал кассу · ${formatMoney(event.amount)}`);
      refreshCashPendingRef.current(true);
      return;
    }
    if (event.userId !== user.id) return;
    if (event.type === 'handover_confirmed') {
      toast.success(`${event.by || 'Администратор'} подтвердил приём ${formatMoney(event.amount)}`, { duration: 8000 });
    } else if (event.type === 'handover_returned' && event.by !== user.username) {
      toast(`Касса ${formatMoney(event.amount)} возвращена вам: ${event.reason || 'без причины'}`, { duration: 10000, icon: <Banknote size={18} className="text-amber-600" /> });
    }
  }, hasStoredSession() && !isCustomer);

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

  const filteredNavItems = React.useMemo(() => getFilteredNavItems(user), [user]);

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

                          {item.to === '/cash' && cashPendingCount > 0 && (
                            <span
                              className={clsx(
                                'flex items-center justify-center rounded-full bg-amber-500 text-[9px] font-semibold text-white',
                                sidebarCollapsed ? 'absolute right-1 top-1 h-4 min-w-4 px-1' : 'ml-auto h-4 min-w-4 px-1',
                              )}
                            >
                              {cashPendingCount > 9 ? '9+' : cashPendingCount}
                            </span>
                          )}

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
        isOpen={isPwaModalOpen && !isStandalone && !isInstalled}
        onClose={() => setIsPwaModalOpen(false)}
        isIOS={isIOS}
        canPromptNative={canPromptNative}
        onNativeInstall={promptInstall}
        onMarkAsInstalled={markAsInstalled}
      />
    </>
  );
}
