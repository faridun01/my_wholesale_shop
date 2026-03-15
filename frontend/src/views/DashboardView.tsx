import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Boxes,
  ChevronRight,
  Clock3,
  Package,
  Store,
  Search,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getDashboardSummary } from '../api/dashboard.api';
import { formatCount, formatMoney, formatPercent } from '../utils/format';
import { filterWarehousesForUser, getCurrentUser, getUserWarehouseId, isAdminUser } from '../utils/userAccess';
import client from '../api/client';

const statusTone = (status: string) => {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-700';
  if (status === 'partial') return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
};

const statusLabel = (status: string) => {
  if (status === 'paid') return 'Оплачено';
  if (status === 'partial') return 'Частично';
  return 'Долг';
};

const ringColors = ['#5b8def', '#7c6cf2', '#f3cb5d', '#5ec98f', '#ef6fae'];

function card(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

const formatMetricDelta = (value: number) => {
  const safeValue = Number.isFinite(value) ? value : 0;
  const prefix = safeValue > 0 ? '+' : '';
  return `${prefix}${formatPercent(safeValue)}`;
};

export default function DashboardView() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [overviewPeriod, setOverviewPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('week');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const user = getCurrentUser();
  const isAdmin = isAdminUser(user);
  const defaultWarehouseId = getUserWarehouseId(user);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(defaultWarehouseId ? String(defaultWarehouseId) : '');

  useEffect(() => {
    getDashboardSummary(selectedWarehouseId ? Number(selectedWarehouseId) : null).then(setSummary).catch(console.error);
  }, [selectedWarehouseId]);

  useEffect(() => {
    client.get('/warehouses')
      .then((res) => {
        const items = Array.isArray(res.data) ? res.data : [];
        setWarehouses(filterWarehousesForUser(items, user));
      })
      .catch(console.error);
  }, [user]);

  const recentSales = summary?.recentSales || [];
  const overviewSales = summary?.overviewSales || [];
  const topProducts = summary?.topProducts || [];
  const lowStock = summary?.lowStock || [];
  const reminders = summary?.reminders || [];
  const searchQuery = search.trim().toLowerCase();

  const metrics = [
    {
      title: 'Выручка',
      value: formatMoney(summary?.totalRevenue || 0),
      subtitle: 'Общая выручка',
      deltaValue: Number(summary?.metricChanges?.revenue || 0),
      delta: formatMetricDelta(summary?.metricChanges?.revenue || 0),
      iconWrap: 'bg-emerald-100 text-emerald-600',
      icon: Wallet,
    },
    {
      title: 'Заказы',
      value: formatCount(summary?.totalOrders || 0),
      subtitle: 'Количество заказов',
      deltaValue: Number(summary?.metricChanges?.orders || 0),
      delta: formatMetricDelta(summary?.metricChanges?.orders || 0),
      iconWrap: 'bg-sky-100 text-sky-600',
      icon: ShoppingBag,
    },
    {
      title: 'Клиенты',
      value: formatCount(summary?.totalCustomers || 0),
      subtitle: 'Активные клиенты',
      deltaValue: Number(summary?.metricChanges?.customers || 0),
      delta: formatMetricDelta(summary?.metricChanges?.customers || 0),
      iconWrap: 'bg-violet-100 text-violet-600',
      icon: Users,
    },
    {
      title: 'Товары в наличии',
      value: formatCount(summary?.totalProducts || 0),
      subtitle: selectedWarehouseId ? 'Товары выбранного склада' : 'Уникальные товары по всем складам',
      deltaValue: Number(summary?.metricChanges?.products || 0),
      delta: formatMetricDelta(summary?.metricChanges?.products || 0),
      iconWrap: 'bg-orange-100 text-orange-500',
      icon: Boxes,
    },
  ];

  const filteredSales = useMemo(() => {
    return recentSales.filter((sale: any) => {
      if (!searchQuery) return true;
      return (
        String(sale.id).includes(searchQuery) ||
        String(sale.netAmount || '').includes(searchQuery) ||
        (sale.status || '').toLowerCase().includes(searchQuery) ||
        (sale.customer?.name || '').toLowerCase().includes(searchQuery)
      );
    });
  }, [recentSales, searchQuery]);

  const filteredTopProducts = useMemo(() => {
    return topProducts.filter((item: any) => {
      if (!searchQuery) return true;
      return (
        String(item.id || '').includes(searchQuery) ||
        (item.name || '').toLowerCase().includes(searchQuery) ||
        (item.category?.name || '').toLowerCase().includes(searchQuery) ||
        (item.unit || '').toLowerCase().includes(searchQuery)
      );
    });
  }, [searchQuery, topProducts]);

  const filteredLowStock = useMemo(() => {
    return lowStock.filter((item: any) => {
      if (!searchQuery) return true;
      return (
        String(item.id || '').includes(searchQuery) ||
        String(item.stock || '').includes(searchQuery) ||
        (item.name || '').toLowerCase().includes(searchQuery) ||
        (item.category?.name || '').toLowerCase().includes(searchQuery) ||
        (item.unit || '').toLowerCase().includes(searchQuery)
      );
    });
  }, [lowStock, searchQuery]);

  const filteredCustomers = useMemo(() => {
    const seen = new Set<string>();

    return recentSales.filter((sale: any) => {
      const customerName = (sale.customer?.name || '').trim();
      if (!customerName) return false;
      if (seen.has(customerName)) return false;
      seen.add(customerName);
      if (!searchQuery) return true;
      return customerName.toLowerCase().includes(searchQuery);
    });
  }, [recentSales, searchQuery]);

  const dropdownProducts = useMemo(() => {
    const seen = new Set<string>();
    return [...filteredTopProducts, ...filteredLowStock]
      .filter((item: any) => {
        const key = String(item?.name || '').trim().toLowerCase();
        if (!key) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 4);
  }, [filteredLowStock, filteredTopProducts]);

  const dropdownSales = useMemo(() => filteredSales.slice(0, 4), [filteredSales]);

  const dropdownCustomers = useMemo(() => filteredCustomers.slice(0, 4), [filteredCustomers]);

  const overviewData = useMemo(() => {
    const salesSource = (searchQuery ? filteredSales : overviewSales)
      .slice()
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const now = new Date();
    const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (overviewPeriod === 'week') {
      const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const monday = dayStart(now);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

      const buckets = Array.from({ length: 7 }).map((_, index) => {
        const current = new Date(monday);
        current.setDate(monday.getDate() + index);
        return {
          label: labels[index],
          start: current,
          end: new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1),
          total: 0,
        };
      });

      salesSource.forEach((sale: any) => {
        const saleDate = new Date(sale.createdAt);
        const bucket = buckets.find((item) => saleDate >= item.start && saleDate < item.end);
        if (bucket) bucket.total += Number(sale.netAmount || 0);
      });

      return buckets.map(({ label, total }) => ({ label, total }));
    }

    if (overviewPeriod === 'month') {
      const year = now.getFullYear();
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const step = daysInMonth <= 15 ? 1 : 3;
      const buckets: Array<{ label: string; start: Date; end: Date; total: number }> = [];

      for (let day = 1; day <= daysInMonth; day += step) {
        const start = new Date(year, month, day);
        const end = new Date(year, month, Math.min(day + step, daysInMonth + 1));
        buckets.push({
          label: step === 1 ? `${day}` : `${day}-${Math.min(day + step - 1, daysInMonth)}`,
          start,
          end,
          total: 0,
        });
      }

      salesSource.forEach((sale: any) => {
        const saleDate = new Date(sale.createdAt);
        const bucket = buckets.find((item) => saleDate >= item.start && saleDate < item.end);
        if (bucket) bucket.total += Number(sale.netAmount || 0);
      });

      return buckets.map(({ label, total }) => ({ label, total }));
    }

    if (overviewPeriod === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const startMonth = currentQuarter * 3;
      const buckets = Array.from({ length: 3 }).map((_, index) => {
        const monthIndex = startMonth + index;
        return {
          label: new Date(now.getFullYear(), monthIndex, 1).toLocaleDateString('ru-RU', { month: 'short' }),
          monthIndex,
          total: 0,
        };
      });

      salesSource.forEach((sale: any) => {
        const saleDate = new Date(sale.createdAt);
        if (saleDate.getFullYear() !== now.getFullYear()) return;
        const bucket = buckets.find((item) => saleDate.getMonth() === item.monthIndex);
        if (bucket) bucket.total += Number(sale.netAmount || 0);
      });

      return buckets.map(({ label, total }) => ({ label, total }));
    }

    const buckets = Array.from({ length: 12 }).map((_, index) => ({
      label: new Date(now.getFullYear(), index, 1).toLocaleDateString('ru-RU', { month: 'short' }),
      monthIndex: index,
      total: 0,
    }));

    salesSource.forEach((sale: any) => {
      const saleDate = new Date(sale.createdAt);
      if (saleDate.getFullYear() !== now.getFullYear()) return;
      const bucket = buckets.find((item) => saleDate.getMonth() === item.monthIndex);
      if (bucket) bucket.total += Number(sale.netAmount || 0);
    });

    return buckets.map(({ label, total }) => ({ label, total }));
  }, [filteredSales, overviewPeriod, overviewSales, searchQuery]);

  const overviewDescription = useMemo(() => {
    if (overviewPeriod === 'week') return 'Динамика выручки за текущую неделю.';
    if (overviewPeriod === 'month') return 'Динамика выручки за текущий месяц.';
    if (overviewPeriod === 'quarter') return 'Динамика выручки за текущий квартал.';
    return 'Динамика выручки за текущий год.';
  }, [overviewPeriod]);

  const categoryData = useMemo(() => {
    const source = filteredTopProducts.length ? filteredTopProducts.slice(0, 5) : filteredLowStock.slice(0, 5);
    return source.map((item: any) => ({
      name: item.name,
      value: Number(item.totalSold || item.stock || 0),
    }));
  }, [filteredLowStock, filteredTopProducts]);

  const totalCategoryValue = categoryData.reduce((sum: number, item: { value: number }) => sum + item.value, 0);
  const hasSearchResults =
    !searchQuery ||
    filteredSales.length > 0 ||
    filteredTopProducts.length > 0 ||
    filteredLowStock.length > 0 ||
    filteredCustomers.length > 0;
  const showSearchDropdown = searchQuery.length > 0;

  return (
    <div className="min-h-full rounded-4xl bg-[#f4f5fb] p-4 md:p-6">
      <div className="rounded-[30px] border border-white/70 bg-[#f4f5fb] shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-3xl">
              <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск..."
                className="w-full rounded-full border border-slate-200 bg-[#f4f5fb] py-3 pl-12 pr-5 text-sm text-slate-700 outline-none transition-colors focus:border-slate-300"
              />

              {showSearchDropdown && (
                <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 overflow-hidden rounded-3xlrder border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
                  <div className="max-h-105 overflow-y-auto p-3">
                    <div className="space-y-3">
                      <div>
                        <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">Товары</p>
                        <div className="space-y-1">
                          {dropdownProducts.map((item: any) => (
                            <button
                              key={`product-${item.id}`}
                              onClick={() => {
                                navigate('/products');
                                setSearch('');
                              }}
                              className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-[#f4f5fb]"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm text-slate-900">{item.name}</p>
                                <p className="mt-0.5 text-xs text-slate-400">{item.category?.name || 'Без категории'}</p>
                              </div>
                              <span className="ml-3 shrink-0 text-xs text-slate-500">{item.stock} {item.unit}</span>
                            </button>
                          ))}
                          {!dropdownProducts.length && <p className="px-3 py-2 text-sm text-slate-400">Нет товаров</p>}
                        </div>
                      </div>

                      <div>
                        <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">Продажи</p>
                        <div className="space-y-1">
                          {dropdownSales.map((sale: any) => (
                            <button
                              key={`sale-${sale.id}`}
                              onClick={() => {
                                navigate('/sales');
                                setSearch('');
                              }}
                              className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-[#f4f5fb]"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm text-slate-900">Продажа #{sale.id}</p>
                                <p className="mt-0.5 text-xs text-slate-400">{sale.customer?.name || 'Клиент'}</p>
                              </div>
                              <span className="ml-3 shrink-0 text-xs text-slate-500">{formatMoney(sale.netAmount || 0)}</span>
                            </button>
                          ))}
                          {!dropdownSales.length && <p className="px-3 py-2 text-sm text-slate-400">Нет продаж</p>}
                        </div>
                      </div>

                      <div>
                        <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">Клиенты</p>
                        <div className="space-y-1">
                          {dropdownCustomers.map((sale: any, index: number) => (
                            <button
                              key={`customer-${sale.customer?.id || sale.id || sale.customer?.name || 'unknown'}-${index}`}
                              onClick={() => {
                                navigate('/customers');
                                setSearch('');
                              }}
                              className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-[#f4f5fb]"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm text-slate-900">{sale.customer?.name}</p>
                                <p className="mt-0.5 text-xs text-slate-400">Из последних продаж</p>
                              </div>
                              <span className="ml-3 shrink-0 text-xs text-slate-500">Открыть</span>
                            </button>
                          ))}
                          {!dropdownCustomers.length && <p className="px-3 py-2 text-sm text-slate-400">Нет клиентов</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <div className="flex items-center gap-3 rounded-full bg-white pl-1 pr-3 py-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                  {(user.username || 'A').slice(0, 1).toUpperCase()}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">{user.username || 'Admin'}</p>
                  <p className="text-xs text-slate-400">{user.role || 'ADMIN'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">Дашборд</h1>
              <p className="mt-1 text-[11px] text-slate-500">Обзор продаж, остатков и активности клиентов.</p>
              {searchQuery && (
                <p className="mt-2 text-[11px] text-slate-500">
                  Результаты по запросу "{search}": товары {Math.max(filteredTopProducts.length, filteredLowStock.length)}, продажи {filteredSales.length}, клиенты {filteredCustomers.length}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
                <Store size={14} className="text-slate-400" />
                <select
                  value={selectedWarehouseId}
                  onChange={(event) => setSelectedWarehouseId(event.target.value)}
                  className="bg-transparent pr-1 outline-none"
                >
                  {isAdmin && <option value="">Все склады</option>}
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
              <span>Главная</span>
              <span>/</span>
              <span className="text-slate-600">Дашборд</span>
            </div>
          </div>

          {searchQuery && !hasSearchResults && (
            <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Ничего не найдено по запросу "{search}".
            </div>
          )}

          <section className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
            {metrics.map((metric) => (
              <div key={metric.title} className="rounded-3xl border border-white bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className={card('flex h-14 w-14 items-center justify-center rounded-full', metric.iconWrap)}>
                    <metric.icon size={24} />
                  </div>
                  <span className={card('text-sm font-medium', metric.deltaValue < 0 ? 'text-rose-500' : 'text-emerald-500')}>
                    {metric.delta}
                    {metric.deltaValue < 0 ? <TrendingDown className="ml-1 inline" size={14} /> : <TrendingUp className="ml-1 inline" size={14} />}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-[13px] text-slate-700">{metric.title}</p>
                  <p className="mt-2 wrap-break-word text-[clamp(1rem,1.5vw,1.45rem)] font-semibold leading-none tracking-tight text-slate-900">
                    {metric.value}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400">{metric.subtitle}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-3xl border border-white bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-500">Продажи за сегодня</p>
                  <p className="mt-2 wrap-break-word text-[clamp(1rem,1.35vw,1.35rem)] font-semibold leading-none tracking-tight text-slate-900">
                    {formatMoney(summary?.todaySales || 0)}
                  </p>
                </div>
                <div className="rounded-full bg-sky-100 p-4 text-sky-600">
                  <Clock3 size={22} />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-500">Долги клиентов</p>
                  <p className="mt-2 wrap-break-word text-[clamp(1rem,1.35vw,1.35rem)] font-semibold leading-none tracking-tight text-slate-900">
                    {formatMoney(summary?.totalDebts || 0)}
                  </p>
                </div>
                <div className="rounded-full bg-rose-100 p-4 text-rose-600">
                  <TrendingDown size={22} />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-500">Напоминания</p>
                  <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                    {formatCount(reminders.length || 0)}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/reminders')}
                  className="rounded-full bg-violet-100 p-4 text-violet-600 transition-colors hover:bg-violet-200"
                >
                  <Bell size={22} />
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_360px]">
            <div className="rounded-3xl border border-white bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Обзор продаж</h2>
                  <p className="mt-2 text-[11px] text-slate-500">{overviewDescription}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-[22px] bg-[#f4f5fb] p-1 text-sm sm:flex sm:items-center sm:rounded-full">
                  {[
                    { key: 'week', label: 'Неделя' },
                    { key: 'month', label: 'Месяц' },
                    { key: 'quarter', label: 'Квартал' },
                    { key: 'year', label: 'Год' },
                  ].map((period) => (
                    <button
                      key={period.key}
                      type="button"
                      onClick={() => setOverviewPeriod(period.key as 'week' | 'month' | 'quarter' | 'year')}
                      className={
                        overviewPeriod === period.key
                          ? 'rounded-full bg-white px-4 py-2 text-sky-600 shadow-sm'
                          : 'rounded-full px-3 py-2 text-slate-500 transition-colors hover:text-slate-700'
                      }
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 h-[220px] sm:h-[280px] lg:h-70">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overviewData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashboardArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5b8def" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#5b8def" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 16,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
                      }}
                      formatter={(value: number) => [formatMoney(value), 'Выручка']}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#5b8def"
                      strokeWidth={3}
                      fill="url(#dashboardArea)"
                      dot={{ r: 0 }}
                      activeDot={{ r: 5, fill: '#5b8def', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="min-w-0 rounded-[24px] border border-white bg-white p-4 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Продажи по категориям</h2>
                <p className="mt-2 text-[11px] text-slate-500">Общая выручка</p>
                <p className="mt-2 break-words text-[clamp(1.05rem,1.45vw,1.45rem)] font-semibold leading-none tracking-tight text-slate-900">
                  {formatMoney(summary?.totalRevenue || 0)}
                </p>
              </div>

              <div className="mt-5 h-[220px] sm:h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={74}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryData.map((entry: any, index: number) => (
                        <Cell key={`${entry.name}-${index}`} fill={ringColors[index % ringColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 16,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 space-y-3">
                {categoryData.map((item: any, index: number) => (
                  <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: ringColors[index % ringColors.length] }} />
                      <span className="break-words text-[12px] leading-4 text-slate-600">{item.name}</span>
                    </div>
                    <span className="text-slate-900">
                      {totalCategoryValue > 0 ? formatPercent((item.value / totalCategoryValue) * 100) : formatPercent(0)}
                    </span>
                  </div>
                ))}
                {!categoryData.length && <p className="text-sm text-slate-400">Нет данных по категориям</p>}
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div className="overflow-hidden rounded-[24px] border border-white bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-2xl font-semibold text-slate-900">Последние продажи</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#f4f5fb] text-sm text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Заказ</th>
                      <th className="px-5 py-4">Клиент</th>
                      <th className="px-5 py-4">Сумма</th>
                      <th className="px-5 py-4">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSales.slice(0, 5).map((sale: any) => (
                      <tr key={sale.id}>
                        <td className="px-5 py-4 text-sm text-slate-700">#{sale.id}</td>
                        <td className="px-5 py-4 text-sm text-slate-900">{sale.customer?.name || 'Клиент'}</td>
                        <td className="px-5 py-4 text-sm text-slate-900">{formatMoney(sale.netAmount || 0)}</td>
                        <td className="px-5 py-4">
                          <span className={card('rounded-xl px-3 py-1.5 text-sm', statusTone(sale.status))}>
                            {statusLabel(sale.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!filteredSales.length && (
                      <tr>
                        <td colSpan={4} className="px-5 py-16 text-center text-sm text-slate-400">
                          Нет недавних продаж
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-white bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="text-2xl font-semibold text-slate-900">Товары с низким остатком</h2>
                <button
                  onClick={() => navigate('/products')}
                  className="inline-flex items-center gap-1 text-sm text-[#5b8def] transition-colors hover:text-[#3d73da]"
                >
                  <span>Смотреть все</span>
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#f4f5fb] text-sm text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Товар</th>
                      <th className="px-5 py-4">Категория</th>
                      <th className="px-5 py-4">Остаток</th>
                      <th className="px-5 py-4">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLowStock.slice(0, 5).map((item: any) => {
                      const outOfStock = Number(item.stock || 0) <= 0;
                      return (
                        <tr key={item.id}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                <Package size={18} />
                              </div>
                              <span className="break-words text-[12px] leading-4 text-slate-900">{item.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-500">{item.category?.name || 'Без категории'}</td>
                          <td className="px-5 py-4 text-sm text-slate-900">
                            {item.stock} {item.unit}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={card(
                                'inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm',
                                outOfStock ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                              )}
                            >
                              <AlertTriangle size={14} />
                              <span>{outOfStock ? 'Нет в наличии' : 'Низкий остаток'}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {!filteredLowStock.length && (
                      <tr>
                        <td colSpan={4} className="px-5 py-16 text-center text-sm text-slate-400">
                          Нет товаров с таким фильтром
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
