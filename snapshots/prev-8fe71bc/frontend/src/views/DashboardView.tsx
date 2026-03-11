import React, { useEffect, useState } from 'react';
import { getDashboardSummary } from '../api/dashboard.api';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  Users,
  Warehouse,
  DollarSign,
  ShoppingCart,
  Plus,
  ArrowRight,
  Bell,
  Clock,
  Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

const data = [
  { name: 'Mon', sales: 4000, profit: 2400 },
  { name: 'Tue', sales: 3000, profit: 1398 },
  { name: 'Wed', sales: 2000, profit: 9800 },
  { name: 'Thu', sales: 2780, profit: 3908 },
  { name: 'Fri', sales: 1890, profit: 4800 },
  { name: 'Sat', sales: 2390, profit: 3800 },
  { name: 'Sun', sales: 3490, profit: 4300 },
];

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
        <Icon className={color.replace('bg-', 'text-')} size={24} />
      </div>
      {trend && (
        <div className={`flex items-center space-x-1 text-sm font-medium ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          <span>{Math.abs(trend)}%</span>
          {trend > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        </div>
      )}
    </div>
    <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
    <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
  </div>
);

export default function DashboardView() {
  const [summary, setSummary] = useState<any>(null);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin' || user.role === 'ADMIN' || user.role === 'MANAGER';

  useEffect(() => {
    getDashboardSummary().then(setSummary).catch(console.error);
  }, []);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 relative">
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-indigo-50/50 to-transparent -z-10 pointer-events-none" />
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-2xl shadow-indigo-600/30">
              <TrendingUp size={20} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Дашборд</h1>
          </div>
          <p className="text-slate-500 font-bold text-sm ml-1">
            Добро пожаловать, <span className="text-indigo-600">{user.username}</span>!
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden xl:flex items-center space-x-3 px-5 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Calendar size={16} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Сегодня</p>
              <p className="text-xs font-black text-slate-700 leading-none">
                {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/pos')}
            className="group bg-slate-900 text-white px-6 py-3.5 rounded-2xl font-black shadow-2xl shadow-slate-900/20 hover:bg-indigo-600 hover:-translate-y-0.5 transition-all duration-500 flex items-center space-x-2.5 active:scale-95 w-full md:w-auto justify-center"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" />
            <span className="text-sm">Новая продажа</span>
          </button>
        </div>
      </div>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6">
        
        {/* Left Column: Stats & Chart */}
        <div className="lg:col-span-8 space-y-5 md:space-y-6">
          
          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 md:gap-6">
            <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between group hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-700 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-50 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div className="p-3 md:p-4 bg-indigo-600 text-white rounded-xl md:rounded-2xl shadow-lg shadow-indigo-600/30 group-hover:scale-110 transition-transform duration-500">
                    <ShoppingCart size={20} className="md:w-6 md:h-6" />
                  </div>
                  <div className="flex items-center space-x-1 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full text-[9px] md:text-[10px] font-black tracking-wider">
                    <ArrowUpRight size={12} className="md:w-3 md:h-3" />
                    <span>+12%</span>
                  </div>
                </div>
                <div className="mt-6 md:mt-8">
                  <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">Продажи сегодня</p>
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 mt-1.5 tracking-tighter">
                    {summary?.todaySales?.toFixed(2) || 0} <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">TJS</span>
                  </h3>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between group hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-700 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-50 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div className="p-3 md:p-4 bg-emerald-500 text-white rounded-xl md:rounded-2xl shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform duration-500">
                    <Package size={20} className="md:w-6 md:h-6" />
                  </div>
                </div>
                <div className="mt-6 md:mt-8">
                  <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">Всего товаров</p>
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 mt-1.5 tracking-tighter">
                    {summary?.totalProducts || 0} <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">шт.</span>
                  </h3>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between group hover:shadow-2xl hover:shadow-rose-500/10 transition-all duration-700 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-rose-50 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div className="p-3 md:p-4 bg-rose-500 text-white rounded-xl md:rounded-2xl shadow-lg shadow-rose-500/30 group-hover:scale-110 transition-transform duration-500">
                    <AlertTriangle size={20} className="md:w-6 md:h-6" />
                  </div>
                </div>
                <div className="mt-6 md:mt-8">
                  <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">Долги клиентов</p>
                  <h3 className="text-xl md:text-2xl font-black text-rose-600 mt-1.5 tracking-tighter">
                    {summary?.totalDebts?.toFixed(2) || 0} <span className="text-[10px] font-bold text-rose-300 uppercase ml-1">TJS</span>
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* Main Chart Section */}
          <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-1000">
              <TrendingUp size={150} />
            </div>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-6 md:mb-8">
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Аналитика выручки</h3>
                  <p className="text-slate-400 font-bold mt-1 text-xs">Динамика продаж за последние 7 дней</p>
                </div>
                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                  <button className="px-4 py-2 bg-white shadow-xl shadow-slate-200 rounded-lg text-[10px] font-black text-indigo-600">Неделя</button>
                  <button className="px-4 py-2 text-[10px] font-black text-slate-400 hover:text-slate-600 transition-colors">Месяц</button>
                </div>
              </div>
              <div className="h-[250px] md:h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} 
                      dy={15}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '16px', 
                        border: 'none', 
                        boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', 
                        padding: '12px',
                        fontWeight: 900,
                        fontSize: '12px'
                      }}
                      itemStyle={{ color: '#6366f1' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="#6366f1" 
                      strokeWidth={4} 
                      fillOpacity={1} 
                      fill="url(#colorSales)" 
                      animationDuration={2500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Quick Actions & Lists */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Quick Actions Card */}
          <div className="bg-slate-900 p-6 md:p-8 rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl shadow-slate-900/40 group">
            <div className="relative z-10">
              <h3 className="text-xl md:text-2xl font-black mb-1.5 tracking-tight">Быстрые действия</h3>
              <p className="text-slate-400 font-bold mb-6 text-xs">Управляйте бизнесом эффективно.</p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => navigate('/sales')}
                  className="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group/btn border border-white/5 hover:border-white/10"
                >
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-indigo-600/20 group-hover/btn:scale-110 transition-transform">
                    <ShoppingCart size={20} />
                  </div>
                  <span className="font-black text-[10px] uppercase tracking-widest text-center">Продажа</span>
                </button>
                <button 
                  onClick={() => navigate('/products')}
                  className="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group/btn border border-white/5 hover:border-white/10"
                >
                  <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/20 group-hover/btn:scale-110 transition-transform">
                    <Package size={20} />
                  </div>
                  <span className="font-black text-[10px] uppercase tracking-widest text-center">Товары</span>
                </button>
                <button 
                  onClick={() => navigate('/customers')}
                  className="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group/btn border border-white/5 hover:border-white/10"
                >
                  <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-amber-500/20 group-hover/btn:scale-110 transition-transform">
                    <Users size={20} />
                  </div>
                  <span className="font-black text-[10px] uppercase tracking-widest text-center">Клиенты</span>
                </button>
                {isAdmin && (
                  <button 
                    onClick={() => navigate('/settings')}
                    className="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group/btn border border-white/5 hover:border-white/10"
                  >
                    <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-slate-700/20 group-hover/btn:scale-110 transition-transform">
                      <Warehouse size={20} />
                    </div>
                    <span className="font-black text-[10px] uppercase tracking-widest text-center">Склады</span>
                  </button>
                )}
              </div>
            </div>
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-indigo-600/20 rounded-full blur-[100px] group-hover:scale-150 transition-transform duration-1000" />
          </div>

          {/* Reminders Section */}
          <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Напоминания</h3>
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shadow-sm">
                <Bell size={20} />
              </div>
            </div>
            <div className="space-y-4">
              {summary?.reminders?.slice(0, 3).map((reminder: any) => (
                <div key={reminder.id} className="p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-indigo-100 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500 cursor-pointer group">
                  <p className="font-black text-slate-900 text-sm leading-tight group-hover:text-indigo-600 transition-colors">{reminder.title}</p>
                  <div className="flex items-center space-x-3 mt-3">
                    <div className="flex items-center space-x-1.5 px-2.5 py-0.5 bg-white rounded-full border border-slate-100 shadow-sm">
                      <Clock size={10} className="text-indigo-500" />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        {new Date(reminder.dueDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {(!summary?.reminders || summary.reminders.length === 0) && (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-200">
                    <Bell size={24} />
                  </div>
                  <p className="text-slate-400 font-bold italic text-xs">Нет активных задач</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Products Section */}
          <div className="bg-indigo-50 p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-indigo-100">
            <h3 className="text-xl md:text-2xl font-black text-indigo-900 mb-6 flex items-center space-x-3">
              <TrendingUp className="text-indigo-600" size={24} />
              <span>Топ продаж</span>
            </h3>
            <div className="space-y-4">
              {summary?.topProducts?.slice(0, 4).map((product: any, idx: number) => (
                <div key={product.id} className="flex items-center justify-between group">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-indigo-600 text-sm shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-xs line-clamp-1">{product.name}</p>
                      <p className="text-[9px] text-indigo-400 font-black uppercase tracking-widest mt-0.5">
                        {product.totalSold} {product.unit} продано
                      </p>
                    </div>
                  </div>
                  <div className="text-emerald-500 bg-white p-1.5 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                    <ArrowUpRight size={16} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Full-Width Section */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Recent Sales Table */}
        <div className="xl:col-span-8 bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-10 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Последние продажи</h3>
              <p className="text-slate-400 font-bold mt-1">История последних транзакций</p>
            </div>
            <button 
              onClick={() => navigate('/sales')} 
              className="bg-slate-50 text-slate-600 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-slate-900 hover:text-white transition-all duration-500 shadow-sm"
            >
              Все записи
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
                <tr>
                  <th className="px-10 py-6">Клиент</th>
                  <th className="px-10 py-6">Сумма</th>
                  <th className="px-10 py-6">Статус</th>
                  <th className="px-10 py-6">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {summary?.recentSales?.map((sale: any) => (
                  <tr key={sale.id} className="hover:bg-slate-50/30 transition-all duration-300 group cursor-pointer">
                    <td className="px-10 py-7">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-sm group-hover:scale-110 transition-transform duration-500">
                          {sale.customer.name[0]}
                        </div>
                        <div>
                          <p className="font-black text-slate-900">{sale.customer.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: #{sale.id.toString().padStart(4, '0')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-7">
                      <p className="font-black text-slate-900 text-lg">{sale.netAmount.toFixed(2)} <span className="text-slate-400 text-xs uppercase ml-1">TJS</span></p>
                    </td>
                    <td className="px-10 py-7">
                      <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
                        sale.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                        sale.status === 'partial' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                      }`}>
                        {sale.status === 'paid' ? 'Оплачено' : sale.status === 'partial' ? 'Частично' : 'Долг'}
                      </span>
                    </td>
                    <td className="px-10 py-7">
                      <p className="text-slate-400 font-black text-xs uppercase tracking-widest">
                        {new Date(sale.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="xl:col-span-4 bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Низкий остаток</h3>
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-sm">
              <AlertTriangle size={24} />
            </div>
          </div>
          <div className="space-y-6 flex-1">
            {summary?.lowStock?.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between group p-4 hover:bg-slate-50 rounded-[2rem] transition-all duration-500 border border-transparent hover:border-slate-100">
                <div className="flex items-center space-x-5">
                  <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-slate-400 group-hover:bg-rose-600 group-hover:text-white group-hover:shadow-xl group-hover:shadow-rose-600/30 transition-all duration-500">
                    <Package size={28} />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 leading-tight">{item.name}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">
                      Остаток: <span className="text-rose-600 font-black">{item.stock} {item.unit}</span>
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/products')} 
                  className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 hover:bg-slate-900 hover:text-white hover:shadow-xl transition-all duration-500 border border-slate-100"
                >
                  <ArrowUpRight size={20} />
                </button>
              </div>
            ))}
            {(!summary?.lowStock || summary.lowStock.length === 0) && (
              <div className="text-center py-20">
                <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <Package size={40} />
                </div>
                <p className="text-slate-900 text-xl font-black tracking-tight">Все в порядке!</p>
                <p className="text-slate-400 font-bold mt-2">Запасы на достаточном уровне.</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => navigate('/products')}
            className="w-full mt-10 py-5 bg-slate-50 text-slate-600 rounded-[1.5rem] font-black uppercase tracking-widest text-xs hover:bg-slate-900 hover:text-white transition-all duration-500"
          >
            Управление запасами
          </button>
        </div>
      </div>
    </div>
  );
}
