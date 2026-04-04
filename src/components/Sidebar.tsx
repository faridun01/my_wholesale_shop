import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut, 
  BookOpen,
  X
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  user: any;
  onLogout: () => void;
  isMobile?: boolean;
  onClose?: () => void;
}

export const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void, key?: any }) => (
  <button 
    onClick={onClick}
    className={`w-full min-w-0 flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 translate-x-1' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <Icon size={20} className="shrink-0" />
    <span className="min-w-0 truncate font-medium">{label}</span>
  </button>
);

export const Sidebar = ({ currentView, setCurrentView, user, onLogout, isMobile, onClose }: SidebarProps) => {
  const items = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Дашборд', roles: ['admin', 'staff'] },
    { id: 'products', icon: Package, label: 'Товары', roles: ['admin', 'staff'] },
    { id: 'sales', icon: ShoppingCart, label: 'Продажи', roles: ['admin', 'staff'] },
    { id: 'customers', icon: Users, label: 'Клиенты', roles: ['admin', 'staff'] },
    { id: 'reports', icon: BarChart3, label: 'Отчеты', roles: ['admin'] },
    { id: 'catalog', icon: BookOpen, label: 'Каталог', roles: ['admin', 'staff'] },
    { id: 'settings', icon: Settings, label: 'Настройки', roles: ['admin'] },
  ];

  return (
    <div className={`flex flex-col h-full ${isMobile ? 'bg-slate-900' : ''}`}>
      <div className="p-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/50">
            <Package className="text-white" size={24} />
          </div>
          <span className="truncate text-lg font-black text-white tracking-tight sm:text-xl">WHOLESALE</span>
        </div>
        {isMobile && (
          <button onClick={onClose} className="shrink-0 text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        )}
      </div>

      <nav className="mt-3 flex-1 px-3 space-y-2">
        {items.filter(item => !item.roles || item.roles.includes(user?.role)).map(item => (
          <SidebarItem 
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={currentView === item.id}
            onClick={() => {
              setCurrentView(item.id);
              if (onClose) onClose();
            }}
          />
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <div className="bg-slate-800/50 rounded-2xl p-4 mb-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Пользователь</p>
          <p className="text-white font-bold truncate">{user?.username}</p>
          <p className="text-slate-400 text-xs capitalize">{user?.role === 'admin' ? 'Администратор' : 'Сотрудник'}</p>
        </div>
        <button 
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Выйти</span>
        </button>
      </div>
    </div>
  );
};
