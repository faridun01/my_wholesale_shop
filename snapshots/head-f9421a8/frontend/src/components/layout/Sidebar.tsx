import React from 'react';
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
  History
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'motion/react';

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
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin' || user.role === 'ADMIN' || user.role === 'MANAGER';

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const filteredNavItems = navItems.filter(item => {
    if (item.to === '/reports' || item.to === '/settings') {
      return isAdmin;
    }
    return true;
  });

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={clsx(
          "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      <aside className={clsx(
        "fixed inset-y-0 left-0 w-64 bg-[#0F172A] text-white flex flex-col h-screen z-50 transition-transform duration-500 lg:translate-x-0 lg:sticky lg:top-0 lg:shrink-0 shadow-2xl lg:shadow-none border-r border-white/5",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-xl shadow-indigo-500/20 group-hover:scale-110 transition-transform duration-500">
              <Warehouse size={22} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tighter leading-none">Wholesale</span>
              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.3em] mt-1">Professional</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-2 overflow-y-auto custom-scrollbar">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => {
                if (window.innerWidth < 1024) onClose();
              }}
              className={({ isActive }) =>
                clsx(
                  'flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-300 group relative overflow-hidden',
                  item.primary && !isActive && 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 mb-3',
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-600/40' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} className={clsx("transition-transform duration-300 group-hover:scale-110 relative z-10")} />
                  <span className="font-bold text-sm relative z-10">{item.label}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="active-pill"
                      className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <div className="mb-4 p-4 bg-white/5 rounded-[1.5rem] border border-white/5 backdrop-blur-md">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-gradient-to-tr from-slate-700 to-slate-600 rounded-xl flex items-center justify-center font-black text-white text-xs shadow-inner">
                {user.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-white truncate">{user.username}</p>
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest truncate">{user.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-3 flex items-center justify-center space-x-2 w-full py-2 bg-white/5 hover:bg-rose-600/20 hover:text-rose-400 text-slate-400 rounded-lg transition-all duration-300 group text-[10px] font-black uppercase tracking-widest"
            >
              <LogOut size={14} className="group-hover:-translate-x-1 transition-transform" />
              <span>Выйти</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
