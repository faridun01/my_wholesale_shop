import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Banknote,
  BarChart3,
  BookOpen,
  Calendar,
  ChevronLeft,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Users,
  Warehouse,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import client from '../../api/client';
import { logout } from '../../api/auth.api';
import { clearAuthSession, hasStoredSession } from '../../utils/authStorage';
import { getCurrentUser, isAdminUser } from '../../utils/userAccess';

type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  section: 'Управление' | 'Отношения' | 'Система';
};

const navItems: NavItem[] = [
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
  const [remindersCount, setRemindersCount] = useState(0);

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

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // If server session is already gone, clear local session anyway.
    }

    clearAuthSession();
    navigate('/login');
  };

  const filteredNavItems = navItems.filter((item) => {
    if (!isAdmin && (item.to === '/' || item.to === '/expenses' || item.to === '/reports' || item.to === '/settings')) {
      return false;
    }
    if (item.to === '/expenses' || item.to === '/reports' || item.to === '/settings') {
      return isAdmin;
    }
    return true;
  }).map((item) => {
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

  return (
    <>
      <div
        className={clsx(
          'fixed inset-0 z-40 bg-[#0f172a]/45 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex h-[100dvh] flex-col overflow-hidden border-r border-[#202c3c] bg-[#111927] text-[#eaf1f8] shadow-2xl transition-[width,transform] duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none',
          isCollapsed
            ? 'w-[86vw] max-w-[320px] lg:w-[92px] lg:max-w-none'
            : 'w-[86vw] max-w-[320px] lg:w-[246px] lg:max-w-none',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className={clsx('border-b border-white/5', isCollapsed ? 'px-3 py-2.5' : 'px-3.5 py-3')}>
          <div className={clsx('flex items-center', isCollapsed ? 'justify-center' : 'gap-3')}>
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
              title={isCollapsed ? 'Развернуть меню' : 'Оптовая торговля'}
              className={clsx(
                'flex shrink-0 items-center justify-center transition-all duration-200',
                isCollapsed
                  ? 'h-[50px] w-[50px] rounded-[18px] bg-[linear-gradient(180deg,#5a49ff_0%,#4a2fe0_100%)] text-white shadow-[0_12px_28px_rgba(88,72,255,0.28)]'
                  : 'h-11 w-11 rounded-[16px] bg-[linear-gradient(180deg,#5a49ff_0%,#4a2fe0_100%)] text-white shadow-[0_12px_24px_rgba(88,72,255,0.24)]',
              )}
            >
              <Warehouse size={isCollapsed ? 21 : 19} />
            </button>

            {!isCollapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-semibold leading-[1.1] tracking-tight text-white">Оптовая торговля</div>
                </div>

                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="ml-auto hidden h-9 w-9 items-center justify-center rounded-xl bg-[#1a2535] text-[#c6d3e3] transition-colors hover:bg-[#223247] hover:text-white lg:flex"
                  title="Свернуть меню"
                >
                  <ChevronLeft size={17} />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a2535] text-[#c6d3e3] transition-colors hover:bg-[#223247] hover:text-white lg:hidden"
              title="Закрыть меню"
            >
              <ChevronLeft size={17} />
            </button>
          </div>
        </div>

        <nav
          className={clsx(
            'flex-1 overflow-hidden',
            isCollapsed ? 'px-2.5 py-2' : 'px-3.5 py-2.5',
          )}
        >
          <div className={clsx(isCollapsed ? 'space-y-2' : 'space-y-1.5')}>
            {Object.entries(navSections).map(([section, items]) => (
              <div key={section}>
                {!isCollapsed && (
                  <p className="mb-1 px-3 text-[8px] font-semibold uppercase tracking-[0.14em] text-[#74859a]">{section}</p>
                )}

                <div className={clsx(isCollapsed ? 'space-y-1' : 'space-y-0.5')}>
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/customers'}
                      onClick={() => {
                        if (window.innerWidth < 1024) onClose();
                      }}
                      title={isCollapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        clsx(
                          'group relative flex border transition-all duration-200',
                          isCollapsed
                            ? 'mx-auto h-[50px] w-[50px] items-center justify-center rounded-[16px]'
                            : 'items-center gap-3 rounded-[16px] px-3.5 py-2.5',
                          isActive
                            ? 'border-[#31426b] bg-[#192542] text-white shadow-[0_10px_22px_rgba(9,15,28,0.24)]'
                            : 'border-transparent bg-transparent text-[#9daec4] hover:border-[#243146] hover:bg-[#182231] hover:text-white',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon size={isCollapsed ? 22 : 17} className="shrink-0" strokeWidth={isActive ? 2.2 : 2} />

                          {!isCollapsed && <span className="truncate text-[14px] font-medium">{item.label}</span>}

                          {item.to === '/reminders' && remindersCount > 0 && (
                            <span
                              className={clsx(
                                'flex items-center justify-center rounded-full bg-[#ef4444] text-[9px] font-semibold text-white',
                                isCollapsed ? 'absolute right-1.5 top-1.5 h-4 min-w-4 px-1' : 'ml-auto h-4 min-w-4 px-1',
                              )}
                            >
                              {remindersCount > 9 ? '9+' : remindersCount}
                            </span>
                          )}

                          {isCollapsed && isActive && (
                            <span className="absolute inset-0 rounded-[16px] bg-[linear-gradient(180deg,rgba(99,76,255,0.30)_0%,rgba(79,57,197,0.26)_100%)]" />
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

        <div className={clsx('mt-auto border-t border-white/5', isCollapsed ? 'px-2.5 py-2' : 'px-3.5 py-2.5')}>
          <div
            className={clsx(
              'rounded-[18px] border border-[#223043] bg-[#172133]',
              isCollapsed ? 'px-0 py-2' : 'p-2.5',
            )}
          >
            <div className={clsx('flex items-center', isCollapsed ? 'justify-center' : 'gap-3')}>
              <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[14px] bg-[#223148] text-sm font-semibold text-white">
                {user.username?.[0]?.toUpperCase()}
              </div>

              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[#eaf1f8]">{user.username}</p>
                  <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#73869d]">{user.role}</p>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <button
                onClick={handleLogout}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-transparent bg-[#223148] py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#c9d5e3] transition-colors hover:border-[#5a3441] hover:bg-[#3a2430] hover:text-[#fecdd3]"
                title="Выйти"
              >
                <LogOut size={13} />
                <span>Выйти</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
