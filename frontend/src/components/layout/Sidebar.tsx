import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Banknote,
  Bell,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Users,
  Warehouse,
  BarChart3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import client from '../../api/client';
import { getCurrentUser, isAdminUser } from '../../utils/userAccess';
import { clearAuthSession, getAuthToken } from '../../utils/authStorage';

type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  section: 'Управление' | 'Отношения' | 'Система';
  primary?: boolean;
};

const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Дашборд', section: 'Управление' },
  { to: '/pos', icon: ShoppingCart, label: 'POS Терминал', section: 'Управление', primary: true },
  { to: '/catalog', icon: BookOpen, label: 'Каталог', section: 'Управление' },
  { to: '/products', icon: Package, label: 'Товары', section: 'Управление' },
  { to: '/sales', icon: History, label: 'История продаж', section: 'Управление' },
  { to: '/customers', icon: Users, label: 'Клиенты', section: 'Отношения' },
  { to: '/reminders', icon: Calendar, label: 'Напоминания', section: 'Отношения' },
  { to: '/expenses', icon: Banknote, label: 'Расходы', section: 'Система' },
  { to: '/reports', icon: BarChart3, label: 'Отчёты', section: 'Система' },
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
    const token = getAuthToken();
    if (!token) return;

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

  const handleLogout = () => {
    clearAuthSession();
    navigate('/login');
  };

  const filteredNavItems = navItems.filter((item) => {
    if (!isAdmin && (item.to === '/' || item.to === '/reports' || item.to === '/settings')) {
      return false;
    }
    if (item.to === '/reports' || item.to === '/settings') {
      return isAdmin;
    }
    return true;
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
          'fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-[#223041] bg-[#121a24] text-[#eaf1f8] transition-all duration-300 lg:sticky lg:top-0 lg:translate-x-0',
          isCollapsed ? 'lg:w-[88px]' : 'lg:w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className={clsx('pb-3 pt-4', isCollapsed ? 'px-3' : 'px-4')}>
          <div className={clsx('flex items-center', isCollapsed ? 'justify-center' : 'gap-3')}>
            <button
              type="button"
              onClick={() => navigate('/')}
              className={clsx('flex items-center text-left', isCollapsed ? 'justify-center' : 'gap-3')}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a2533] text-white">
                <Warehouse size={18} />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col">
                  <span className="text-base font-semibold leading-none tracking-tight">Wholesale</span>
                  <span className="mt-0.5 text-[10px] text-[#708398]">Commerce admin</span>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={onToggleCollapse}
              className={clsx(
                'hidden h-9 w-9 items-center justify-center rounded-xl bg-[#1a2533] text-[#c9d5e3] transition-all hover:bg-[#233243] hover:text-white lg:flex',
                isCollapsed ? 'mt-3' : 'ml-auto',
              )}
              title={isCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
        </div>

        <nav className={clsx('flex-1 overflow-hidden', isCollapsed ? 'px-2' : 'px-3')}>
          <div className="space-y-3">
            {Object.entries(navSections).map(([section, items]) => (
              <div key={section}>
                {!isCollapsed && (
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7f92a8]">
                    {section}
                  </p>
                )}

                <div className="space-y-1">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => {
                        if (window.innerWidth < 1024) onClose();
                      }}
                      title={isCollapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        clsx(
                          'relative flex overflow-hidden rounded-2xl border transition-all duration-200',
                          isCollapsed ? 'justify-center px-2 py-2.5' : 'items-center gap-3 px-3 py-2.5',
                          item.primary && !isActive && 'border-[#202d3d] bg-[#182331] text-[#eef4fb]',
                          isActive
                            ? 'border-white/10 bg-white text-[#111827] shadow-sm'
                            : 'border-transparent text-[#eef4fb] hover:bg-[#182331] hover:text-white',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon size={16} className="relative z-10 shrink-0" />
                          {!isCollapsed && <span className="relative z-10 text-[15px] font-medium">{item.label}</span>}

                          {item.to === '/reminders' && remindersCount > 0 && !isActive && !isCollapsed && (
                            <span className="relative z-10 ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[9px] font-semibold text-white">
                              {remindersCount > 9 ? '9+' : remindersCount}
                            </span>
                          )}

                          {item.to === '/reminders' && remindersCount > 0 && !isActive && isCollapsed && (
                            <span className="absolute right-1 top-1 z-20 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[9px] font-semibold text-white">
                              {remindersCount > 9 ? '9+' : remindersCount}
                            </span>
                          )}

                          {isActive && (
                            <motion.div
                              layoutId="active-pill"
                              className="absolute inset-0 rounded-2xl bg-white"
                              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                            />
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

        <div className={clsx('mt-auto pb-3 pt-3', isCollapsed ? 'px-2' : 'px-3')}>
          <div className="relative rounded-[18px] border border-[#223041] bg-[#182331] p-3">
            <div className={clsx('flex items-center', isCollapsed ? 'justify-center' : 'gap-3')}>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#263447] text-[11px] font-semibold text-white">
                {user.username?.[0]?.toUpperCase()}
              </div>

              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[#eaf1f8]">{user.username}</p>
                  <p className="truncate text-[10px] uppercase tracking-[0.12em] text-[#73869d]">{user.role}</p>
                </div>
              )}

              <button
                onClick={() => navigate('/reminders')}
                className={clsx(
                  'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#233243] text-[#c9d5e3] transition-all duration-200 hover:bg-[#2b3c50] hover:text-white',
                  isCollapsed && 'absolute right-3 top-3',
                )}
                title="Напоминания"
              >
                <Bell size={15} />
                {remindersCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-[#182331] bg-[#ef4444] px-1 text-[9px] font-semibold text-white">
                    {remindersCount > 9 ? '9+' : remindersCount}
                  </span>
                )}
              </button>
            </div>

            <button
              onClick={handleLogout}
              className={clsx(
                'mt-3 flex w-full items-center justify-center rounded-xl bg-[#233243] py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c9d5e3] transition-all duration-200 hover:bg-[#3a2430] hover:text-[#fecdd3]',
                isCollapsed ? 'px-0' : 'gap-2',
              )}
              title="Выйти"
            >
              <LogOut size={14} />
              {!isCollapsed && <span>Выйти</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
