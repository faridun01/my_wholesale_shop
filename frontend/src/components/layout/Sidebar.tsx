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
import { clearAuthSession, getAuthToken } from '../../utils/authStorage';

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
    const token = getAuthToken();
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
    clearAuthSession();
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
          'fixed inset-0 bg-[#0f172a]/45 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 w-72 bg-[#243042] text-[#eaf1f8] flex flex-col h-screen z-50 transition-transform duration-300 lg:translate-x-0 lg:sticky lg:top-0 lg:shrink-0 border-r border-[#314155]',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-6">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#5b8def] text-white shadow-lg shadow-[#5b8def]/25">
              <Warehouse size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-semibold tracking-tight leading-none">Wholesale</span>
              <span className="text-[10px] text-[#94a3b8] mt-0.5">Commerce admin</span>
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
                  item.primary && !isActive && 'bg-[#2d3b4f] text-[#eaf1f8] border-[#3a4b63] mb-3',
                  isActive
                    ? 'bg-[#5b8def] text-white border-[#5b8def] shadow-lg shadow-[#5b8def]/20'
                    : 'text-[#c9d5e3] border-transparent hover:bg-[#2d3b4f] hover:text-white'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} className="relative z-10" />
                  <span className="text-sm relative z-10">{item.label}</span>
                  {isActive && <motion.div layoutId="active-pill" className="absolute inset-0 bg-[#5b8def]" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <div className="rounded-[18px] border border-[#314155] bg-[#1d2736] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.28)]">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-[#32445c] flex items-center justify-center text-xs font-semibold text-white">
                {user.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#eaf1f8] truncate">{user.username}</p>
                <p className="text-[10px] text-[#94a3b8] uppercase tracking-[0.12em] truncate">{user.role}</p>
              </div>
              <button
                onClick={() => navigate('/reminders')}
                className="relative w-9 h-9 shrink-0 rounded-xl bg-[#2d3b4f] hover:bg-[#354861] text-[#c9d5e3] hover:text-white flex items-center justify-center transition-all duration-200"
                title="Напоминания"
              >
                <Bell size={16} />
                {remindersCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#ef4444] text-white rounded-full text-[9px] font-semibold flex items-center justify-center border-2 border-[#1d2736]">
                    {remindersCount > 9 ? '9+' : remindersCount}
                  </span>
                )}
              </button>
            </div>
            <button
              onClick={handleLogout}
              className="mt-3 flex items-center justify-center space-x-2 w-full py-2.5 rounded-lg bg-[#2d3b4f] hover:bg-[#3a2430] hover:text-[#fecdd3] text-[#c9d5e3] transition-all duration-200 text-[10px] font-semibold uppercase tracking-[0.14em]"
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
