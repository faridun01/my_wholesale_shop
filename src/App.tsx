import React, { useState, useEffect } from 'react';
import { Package, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Product, Customer, Invoice, DashboardStats, Warehouse } from './types';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './views/DashboardView';
import { ProductView } from './views/ProductView';
import { SalesView } from './views/SalesView';
import { CustomerView } from './views/CustomerView';
import { ReportsView } from './views/ReportsView';
import { CatalogView } from './views/CatalogView';
import { SettingsView } from './views/SettingsView';
import { InvoiceDetailsModal } from './components/InvoiceDetailsModal';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [settings, setSettings] = useState<any>({});

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // Auth
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const query = selectedWarehouseId ? `?warehouse_id=${selectedWarehouseId}` : '';
      const [pRes, custRes, invRes, statRes, setRes, wRes] = await Promise.all([
        fetch(`/api/products${query}`),
        fetch('/api/customers'),
        fetch('/api/invoices'),
        fetch(`/api/reports/dashboard${query}`),
        fetch('/api/settings'),
        fetch('/api/warehouses')
      ]);
      
      setProducts(await pRes.json());
      setCustomers(await custRes.json());
      setInvoices(await invRes.json());
      setStats(await statRes.json());
      setSettings(await setRes.json());
      setWarehouses(await wRes.json());
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.warehouse_id && !selectedWarehouseId) {
      setSelectedWarehouseId(user.warehouse_id);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, selectedWarehouseId]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (user?.role === 'admin') {
        const res = await fetch('/api/users');
        const data = await res.json();
        setUsers(data);
      }
    };
    if (user) {
      fetchUsers();
    }
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      if (res.ok) {
        setUser(await res.json());
      } else {
        alert("Неверные учетные данные");
      }
    } catch (error) {
      alert("Ошибка входа");
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView('dashboard');
  };

  if (!user && currentView !== 'catalog') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl text-white mb-4 shadow-lg shadow-indigo-200">
              <Package size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">WholesalePro</h1>
            <p className="text-slate-500">Войдите, чтобы управлять вашим бизнесом</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Имя пользователя</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                value={loginForm.username}
                onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Пароль</label>
              <input
                type="password"
                required
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                value={loginForm.password}
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
            >
              Войти
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <button 
              onClick={() => setCurrentView('catalog')}
              className="text-indigo-600 font-medium hover:text-indigo-700 transition-colors"
            >
              Посмотреть каталог товаров
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (currentView === 'catalog' && !user) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans">
        <header className="bg-white border-b border-slate-200 py-4 px-6 flex justify-between items-center sticky top-0 z-30">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Package size={20} />
            </div>
            <span className="text-xl font-black text-slate-900 tracking-tight">WHOLESALE</span>
          </div>
          <button 
            onClick={() => setCurrentView('dashboard')}
            className="text-indigo-600 font-bold hover:text-indigo-700"
          >
            Вход для сотрудников
          </button>
        </header>
        <main className="p-6 max-w-7xl mx-auto">
          <CatalogView products={products} settings={settings} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-72 bg-slate-900 text-white border-r border-slate-800">
        <Sidebar currentView={currentView} setCurrentView={setCurrentView} user={user} onLogout={handleLogout} />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed inset-y-0 left-0 w-[86vw] max-w-72 bg-slate-900 text-white z-50 lg:hidden"
            >
              <Sidebar 
                currentView={currentView} 
                setCurrentView={setCurrentView} 
                user={user} 
                onLogout={handleLogout} 
                isMobile 
                onClose={() => setIsSidebarOpen(false)} 
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-bold text-slate-900 ml-2 lg:ml-0 capitalize">
              {currentView === 'dashboard' ? 'Дашборд' : 
               currentView === 'products' ? 'Товары' : 
               currentView === 'sales' ? 'Продажи' : 
               currentView === 'customers' ? 'Клиенты' : 
               currentView === 'reports' ? 'Отчеты' : 
               currentView === 'catalog' ? 'Каталог' : 'Настройки'}
            </h2>
          </div>
          <div className="flex items-center space-x-4">
            {user?.role === 'admin' && warehouses.length > 0 && (
              <select 
                className="hidden md:block bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                value={selectedWarehouseId || ''}
                onChange={(e) => setSelectedWarehouseId(Number(e.target.value))}
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name_address}</option>
                ))}
              </select>
            )}
            {isLoading && <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>}
            <div className="hidden sm:block text-right">
              <p className="text-sm font-bold text-slate-900">{user?.username}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user?.role === 'admin' ? 'Администратор' : 'Сотрудник'}</p>
            </div>
          </div>
        </header>

        <main className="p-6 overflow-x-hidden">
          {currentView === 'dashboard' && <DashboardView stats={stats} />}
          {currentView === 'products' && <ProductView products={products} fetchData={fetchData} user={user} warehouseId={selectedWarehouseId} warehouses={warehouses} />}
          {currentView === 'sales' && <SalesView invoices={invoices} products={products} customers={customers} fetchData={fetchData} user={user} warehouseId={selectedWarehouseId} />}
          {currentView === 'customers' && <CustomerView customers={customers} fetchData={fetchData} user={user} onViewInvoice={setSelectedInvoiceId} />}
          {currentView === 'reports' && <ReportsView warehouseId={selectedWarehouseId} />}
          {currentView === 'catalog' && <CatalogView products={products} settings={settings} />}
          {currentView === 'settings' && <SettingsView users={users} settings={settings} fetchData={fetchData} warehouses={warehouses} user={user} />}
        </main>
      </div>

      {selectedInvoiceId && (
        <InvoiceDetailsModal 
          invoiceId={selectedInvoiceId} 
          onClose={() => setSelectedInvoiceId(null)} 
          user={user}
          onActionSuccess={fetchData}
        />
      )}
    </div>
  );
}
