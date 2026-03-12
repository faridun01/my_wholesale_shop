import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  LogOut,
  Warehouse,
  BookOpen,
  BarChart3,
  Calendar,
  History,
  Bell,
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import client from '../../api/client';
import { getCurrentUser, isAdminUser } from '../../utils/userAccess';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Дашборд' },
  { to: '/pos', icon: ShoppingCart, label: 'POS Терминал', primary: true },
  { to: '/catalog', icon: BookOpen, label: 'Каталог' },
  { to: '/products', icon: Package, label: 'Товары' },
  { to: '/sales', icon: History, label: 'История продаж' },
  { to: '/customers', icon: Users, label: 'Клиенты' },
  { to: '/reminders', icon: Calendar, label: 'Напоминания' },
  { to: '/reports', icon: BarChart3, label: 'Отчёты' },
  { to: '/settings', icon: Settings, label: 'Настройки' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const isAdmin = isAdminUser(user);
  const [remindersCount, setRemindersCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const refreshRemindersCount = () => {
      client.get('/reminders')
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
    localStorage.removeItem('token');
    navigate('/login');
  };

  const filteredNavItems = navItems.filter((item) => {
    if (item.to === '/reports' || item.to === '/settings') {
      return isAdmin;
    }
    return true;
  });

  return (
    <>
      <div
        className={clsx(
          'fixed inset-0 bg-[#202223]/30 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 w-72 bg-[#fbfbfb] text-[#202223] flex flex-col h-screen z-50 transition-transform duration-300 lg:translate-x-0 lg:sticky lg:top-0 lg:shrink-0 border-r border-[#e1e3e5]',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-6">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#e3f1df] text-[#008060]">
              <Warehouse size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-semibold tracking-tight leading-none">Wholesale</span>
              <span className="text-[10px] text-[#6d7175] mt-0.5">Commerce admin</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => {
                if (window.innerWidth < 1024) onClose();
              }}
              className={({ isActive }) =>
                clsx(
                  'flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 relative overflow-hidden border',
                  item.primary && !isActive && 'bg-[#eef7f4] text-[#008060] border-[#cae9dd] mb-3',
                  isActive
                    ? 'bg-[#edf6f3] text-[#008060] border-[#cae9dd]'
                    : 'text-[#4a4f55] border-transparent hover:bg-[#f6f6f7] hover:text-[#202223]'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} className="relative z-10" />
                  <span className="text-sm relative z-10">{item.label}</span>
                  {isActive && <motion.div layoutId="active-pill" className="absolute inset-0 bg-[#edf6f3]" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <div className="rounded-[18px] border border-[#e1e3e5] bg-white p-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-[#eef1f3] flex items-center justify-center text-xs font-semibold text-[#202223]">
                {user.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#202223] truncate">{user.username}</p>
                <p className="text-[10px] text-[#6d7175] uppercase tracking-[0.12em] truncate">{user.role}</p>
              </div>
              <button
                onClick={() => navigate('/reminders')}
                className="relative w-9 h-9 shrink-0 rounded-xl bg-[#f6f6f7] hover:bg-[#eef1f3] text-[#6d7175] hover:text-[#202223] flex items-center justify-center transition-all duration-200"
                title="Напоминания"
              >
                <Bell size={16} />
                {remindersCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#d82c0d] text-white rounded-full text-[9px] font-semibold flex items-center justify-center border-2 border-white">
                    {remindersCount > 9 ? '9+' : remindersCount}
                  </span>
                )}
              </button>
            </div>
            <button
              onClick={handleLogout}
              className="mt-3 flex items-center justify-center space-x-2 w-full py-2.5 rounded-lg bg-[#f6f6f7] hover:bg-[#fde7e9] hover:text-[#8e1f0b] text-[#4a4f55] transition-all duration-200 text-[10px] font-semibold uppercase tracking-[0.14em]"
            >
              <LogOut size={14} />
              <span>Выйти</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
