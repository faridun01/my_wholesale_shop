import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Clock,
  Clock3,
  Package,
  Search,
  ShoppingBag,
  Store,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { getDashboardSummary } from '../api/dashboard.api';
import { getWarehouses } from '../api/warehouses.api';
import { formatCount, formatMoney, formatPercent } from '../utils/format';
import { filterWarehousesForUser, getCurrentUser, getUserWarehouseId, isAdminUser } from '../utils/userAccess';
import client from '../api/client';
import ChartSkeleton from '../components/charts/ChartSkeleton';

const DashboardCharts = React.lazy(() => import('../components/charts/DashboardCharts'));

const getDashboardStatusBadge = (status: string) => {
  const normStatus = String(status || '').toLowerCase();
  if (normStatus === 'paid') {
    return (
      <span
        title="Оплачено"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-200/80 bg-emerald-50 text-emerald-600 shadow-xs"
      >
        <CheckCircle2 size={15} />
      </span>
    );
  }
  if (normStatus === 'partial') {
    return (
      <span
        title="Частично оплачено"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-amber-200/80 bg-amber-50 text-amber-600 shadow-xs"
      >
        <Clock size={15} />
      </span>
    );
  }
  return (
    <span
      title="Не оплачено / Долг"
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200/80 bg-rose-50 text-rose-500 shadow-xs"
    >
      <AlertCircle size={15} />
    </span>
  );
};

const ringColors = ['#5b8def', '#7c6cf2', '#f3cb5d', '#5ec98f', '#ef6fae'];
const LOW_STOCK_THRESHOLD = 5;

function card(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

const formatShortRuDate = (date: Date) =>
  date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  });

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const formatMetricDelta = (value: number) => {
  const safeValue = Number.isFinite(value) ? value : 0;
  const prefix = safeValue > 0 ? '+' : '';
  return `${prefix}${formatPercent(safeValue)}`;
};

const normalizeDisplayBaseUnit = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'шт';
  if (['пачка', 'пачки', 'пачек', 'шт', 'штук', 'штука', 'штуки', 'pcs', 'piece', 'pieces'].includes(normalized)) {
    return 'шт';
  }
  return normalized;
};

const normalizePackagings = (item: any) =>
  Array.isArray(item?.packagings)
    ? item.packagings
        .map((entry: any) => ({
          id: Number(entry.id),
          packageName: String(entry.packageName || '').trim(),
          baseUnitName: normalizeDisplayBaseUnit(entry.baseUnitName || item?.baseUnitName || item?.unit || 'шт'),
          unitsPerPackage: Number(entry.unitsPerPackage || 0),
          isDefault: Boolean(entry.isDefault),
        }))
        .filter((entry: any) => entry.id > 0 && entry.packageName && entry.unitsPerPackage > 0)
    : [];

const getDefaultPackaging = (packagings: any[]) =>
  packagings.find((entry: any) => entry.isDefault) || packagings[0] || null;

const getProductStockParts = (item: any) => {
  const packagings = normalizePackagings(item);
  const defaultPackaging = getDefaultPackaging(packagings);
  const stock = Math.max(0, Math.floor(Number(item?.stock || 0)));
  const baseUnitName = normalizeDisplayBaseUnit(item?.baseUnitName || item?.unit || defaultPackaging?.baseUnitName || 'шт');

  if (!defaultPackaging || Number(defaultPackaging.unitsPerPackage || 0) <= 1) {
    return {
      primary: `${stock} ${baseUnitName}`,
      secondary: '',
    };
  }

  const unitsPerPackage = Number(defaultPackaging.unitsPerPackage || 0);
  const packageQuantity = Math.floor(stock / unitsPerPackage);
  const extraUnits = stock % unitsPerPackage;

  if (stock <= 0) {
    return {
      primary: `0 ${defaultPackaging.packageName}`,
      secondary: '',
    };
  }

  if (packageQuantity > 0 && extraUnits > 0) {
    return {
      primary: `${packageQuantity} ${defaultPackaging.packageName} +${extraUnits} ${baseUnitName}`,
      secondary: `${packageQuantity}*${unitsPerPackage}=${packageQuantity * unitsPerPackage} ${baseUnitName}`,
    };
  }

  if (packageQuantity > 0) {
    return {
      primary: `${packageQuantity} ${defaultPackaging.packageName}`,
      secondary: `${packageQuantity}*${unitsPerPackage}=${packageQuantity * unitsPerPackage} ${baseUnitName}`,
    };
  }

  return {
    primary: `${extraUnits} ${baseUnitName}`,
    secondary: '',
  };
};

export default function DashboardView() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [overviewPeriod, setOverviewPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('week');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const lastSummaryWarehouseIdRef = React.useRef<string | null>(null);
  const hasLoadedWarehousesRef = React.useRef(false);
  const user = useMemo(() => getCurrentUser(), []);
  const isAdmin = isAdminUser(user);
  const defaultWarehouseId = getUserWarehouseId(user);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    const saved = localStorage.getItem('dashboard_selected_warehouse_id');
    if (saved !== null) {
      return saved;
    }
    if (!isAdmin && defaultWarehouseId) {
      return String(defaultWarehouseId);
    }
    return '';
  });

  const handleWarehouseSelect = (id: string) => {
    setSelectedWarehouseId(id);
    localStorage.setItem('dashboard_selected_warehouse_id', id);
  };

  const getWarehouseLabel = React.useCallback((item: any) => {
    const directName = item?.warehouse?.name || item?.warehouseName;
    if (directName) {
      return directName;
    }

    const warehouseId = Number(item?.warehouseId || item?.warehouse?.id || 0);
    if (warehouseId > 0) {
      const matchedWarehouse = warehouses.find((warehouse) => Number(warehouse?.id) === warehouseId);
      if (matchedWarehouse?.name) {
        return matchedWarehouse.name;
      }
    }

    return item?.warehouse?.city || 'Склад не указан';
  }, [warehouses]);

  useEffect(() => {
    if (lastSummaryWarehouseIdRef.current === selectedWarehouseId) {
      return;
    }

    lastSummaryWarehouseIdRef.current = selectedWarehouseId;
    getDashboardSummary(selectedWarehouseId ? Number(selectedWarehouseId) : null).then(setSummary).catch(console.error);
  }, [selectedWarehouseId]);

  useEffect(() => {
    if (hasLoadedWarehousesRef.current) {
      return;
    }

    hasLoadedWarehousesRef.current = true;
    getWarehouses()
      .then((data) => {
        const items = Array.isArray(data) ? data : [];
        const filteredWarehouses = filterWarehousesForUser(items, user);
        setWarehouses(filteredWarehouses);
        if (filteredWarehouses.length === 1) {
          const singleId = String(filteredWarehouses[0].id);
          setSelectedWarehouseId(singleId);
          localStorage.setItem('dashboard_selected_warehouse_id', singleId);
        }
      })
      .catch((error) => {
        hasLoadedWarehousesRef.current = false;
        console.error(error);
      });
  }, [isAdmin, user]);

  const recentSales = summary?.recentSales || [];
  const overviewSales = summary?.overviewSales || [];
  const topProducts = summary?.topProducts || [];
  const lowStock = summary?.lowStock || [];
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

  const visibleLowStock = useMemo(() => filteredLowStock.slice(0, 5), [filteredLowStock]);
  const totalLowStockCount = lowStock.length;

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
    if (overviewPeriod === 'week') {
      const current = new Date();
      const monday = dayStart(current);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return `Текущая неделя: ${formatShortRuDate(monday)} - ${formatShortRuDate(sunday)}.`;
    }
    if (overviewPeriod === 'month') return 'Динамика выручки за текущий месяц.';
    if (overviewPeriod === 'quarter') return 'Динамика выручки за текущий квартал.';
    return 'Динамика выручки за текущий год.';
  }, [overviewPeriod]);

  const categoryData = useMemo(() => {
    const source = filteredTopProducts.length ? filteredTopProducts.slice(0, 4) : filteredLowStock.slice(0, 4);
    return source.map((item: any) => ({
      name: item.name,
      value: Number(item.totalSold || item.stock || 0),
    }));
  }, [filteredLowStock, filteredTopProducts]);

  const hasSearchResults =
    !searchQuery ||
    filteredSales.length > 0 ||
    filteredTopProducts.length > 0 ||
    filteredLowStock.length > 0 ||
    filteredCustomers.length > 0;
  const showSearchDropdown = searchQuery.length > 0;

  const recentSalesPanel = (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
      <div className="border-b border-slate-100 px-3.5 py-3 sm:px-5 sm:py-4">
        <h2 className="text-sm sm:text-base font-semibold text-slate-900">Последние продажи</h2>
      </div>
      <div className="space-y-1.5 p-2.5 sm:hidden">
        {filteredSales.slice(0, 5).map((sale: any) => (
          <div key={sale.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-xs font-bold text-slate-900">#{sale.id}</span>
                <span className="mx-1.5 text-slate-300">•</span>
                <span className="text-xs font-medium text-slate-700 truncate">{sale.customer?.name || 'Клиент'}</span>
              </div>
              {getDashboardStatusBadge(sale.status)}
            </div>
            <div className="mt-1.5 flex items-center justify-between border-t border-slate-200/40 pt-1.5">
              <span className="text-[10px] text-slate-400">Сумма заказа</span>
              <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">{formatMoney(sale.netAmount || 0)}</span>
            </div>
          </div>
        ))}
        {!filteredSales.length && (
          <div className="rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
            Нет недавних продаж
          </div>
        )}
      </div>
      <div className="hidden sm:block">
        <div className={filteredSales.length > 5 ? 'max-h-90 overflow-y-auto' : ''}>
          <table className="w-full text-left">
          <thead className="bg-[#f4f5fb] text-sm text-slate-500">
            <tr>
              <th className="px-6 py-4">Заказ</th>
              <th className="px-6 py-4">Клиент</th>
              <th className="px-6 py-4">Сумма</th>
              <th className="px-6 py-4">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSales.slice(0, 5).map((sale: any) => (
              <tr key={sale.id}>
                <td className="px-6 py-4 text-sm text-slate-700">#{sale.id}</td>
                <td className="px-6 py-4 text-sm text-slate-900">{sale.customer?.name || 'Клиент'}</td>
                <td className="px-6 py-4 text-sm text-slate-900">{formatMoney(sale.netAmount || 0)}</td>
                <td className="px-6 py-4">
                  {getDashboardStatusBadge(sale.status)}
                </td>
              </tr>
            ))}
            {!filteredSales.length && (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center text-sm text-slate-400">
                  Нет недавних продаж
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-page-shell min-h-full font-sans">
      <div className="overflow-hidden lg:rounded-2xl bg-canvas">
        <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-3 py-2 sm:px-5 sm:py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="hidden lg:flex items-center gap-2.5 shrink-0">
              <h1 className="text-base font-bold tracking-tight text-slate-900">Дашборд</h1>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                Аналитика
              </span>
            </div>

            <div className="relative flex-1 max-w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск по товарам, продажам, клиентам..."
                className="h-8.5 sm:h-10 w-full rounded-xl border border-slate-200/90 bg-slate-50/80 pl-9 pr-4 text-xs text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/5"
              />

              {showSearchDropdown && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="max-h-105 overflow-y-auto p-2">
                    <div className="space-y-3">
                      <div>
                        <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Товары</p>
                        <div className="space-y-0.5">
                          {dropdownProducts.map((item: any) => (
                            <button
                              key={`product-${item.id}`}
                              onClick={() => {
                                navigate('/products');
                                setSearch('');
                              }}
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">{item.name}</p>
                                <p className="text-[10px] text-slate-400">{item.category?.name || 'Без категории'}</p>
                              </div>
                              <span className="ml-3 shrink-0 font-mono text-[11px] text-slate-500">{item.stock} {item.unit}</span>
                            </button>
                          ))}
                          {!dropdownProducts.length && <p className="px-3 py-1 text-xs text-slate-400">Нет товаров</p>}
                        </div>
                      </div>

                      <div>
                        <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Продажи</p>
                        <div className="space-y-0.5">
                          {dropdownSales.map((sale: any) => (
                            <button
                              key={`sale-${sale.id}`}
                              onClick={() => {
                                navigate('/sales');
                                setSearch('');
                              }}
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">Продажа #{sale.id}</p>
                                <p className="text-[10px] text-slate-400">{sale.customer?.name || 'Клиент'}</p>
                              </div>
                              <span className="ml-3 shrink-0 font-mono text-[11px] font-semibold text-slate-900">{formatMoney(sale.netAmount || 0)}</span>
                            </button>
                          ))}
                          {!dropdownSales.length && <p className="px-3 py-1 text-xs text-slate-400">Нет продаж</p>}
                        </div>
                      </div>

                      <div>
                        <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Клиенты</p>
                        <div className="space-y-0.5">
                          {dropdownCustomers.map((sale: any, index: number) => (
                            <button
                              key={`customer-${sale.customer?.id || sale.id || sale.customer?.name || 'unknown'}-${index}`}
                              onClick={() => {
                                navigate('/customers');
                                setSearch('');
                              }}
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">{sale.customer?.name}</p>
                                <p className="text-[10px] text-slate-400">Из последних продаж</p>
                              </div>
                              <span className="ml-3 shrink-0 text-xs text-slate-500">Открыть</span>
                            </button>
                          ))}
                          {!dropdownCustomers.length && <p className="px-3 py-1 text-xs text-slate-400">Нет клиентов</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-slate-700">{user.username || 'Admin'}</span>
              <span className="rounded bg-slate-200/70 px-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                {user.role || 'ADMIN'}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-3 sm:space-y-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {searchQuery && (
                <p className="text-[11px] text-slate-500">
                  Результаты по запросу "{search}": товары {Math.max(filteredTopProducts.length, filteredLowStock.length)}, продажи {filteredSales.length}, клиенты {filteredCustomers.length}
                </p>
              )}
            </div>
            {warehouses.length > 1 && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-xs sm:w-auto">
                  <Store size={14} className="text-slate-400" />
                  <select
                    value={selectedWarehouseId}
                    onChange={(event) => handleWarehouseSelect(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent pr-1 outline-none sm:flex-none"
                  >
                    {isAdmin && <option value="">Все склады</option>}
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {searchQuery && !hasSearchResults && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
              Ничего не найдено по запросу "{search}".
            </div>
          )}

          <section className="grid grid-cols-2 gap-2 sm:gap-3.5 xl:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.title} className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white p-2.5 sm:p-4 shadow-xs">
                <div className="flex items-start justify-between gap-1.5">
                  <div className={card('flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl', metric.iconWrap)}>
                    <metric.icon size={15} />
                  </div>
                  <span className={card('text-[10px] sm:text-xs font-semibold', metric.deltaValue < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                    {metric.delta}
                    {metric.deltaValue < 0 ? <TrendingDown className="ml-0.5 inline" size={10} /> : <TrendingUp className="ml-0.5 inline" size={10} />}
                  </span>
                </div>
                <div className="mt-2 sm:mt-3">
                  <p className="truncate text-[11px] sm:text-xs font-medium text-slate-500">{metric.title}</p>
                  <p className="mt-0.5 font-mono text-base sm:text-xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {metric.value}
                  </p>
                  <p className="mt-0.5 text-[9px] sm:text-[11px] text-slate-400 truncate">{metric.subtitle}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="grid grid-cols-3 gap-1.5 sm:gap-3.5">
            <div className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white p-2 sm:p-3.5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div className="min-w-0">
                  <p className="truncate text-[10px] sm:text-[11px] font-medium text-slate-500">Продажи сегодня</p>
                  <p className="mt-0.5 font-mono text-xs sm:text-lg font-bold tracking-tight text-slate-900 tabular-nums truncate">
                    {formatMoney(summary?.todaySales || 0)}
                  </p>
                </div>
                <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 shrink-0">
                  <Clock3 size={16} />
                </div>
              </div>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white p-2 sm:p-3.5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div className="min-w-0">
                  <p className="truncate text-[10px] sm:text-[11px] font-medium text-slate-500">Долги клиентов</p>
                  <p className="mt-0.5 font-mono text-xs sm:text-lg font-bold tracking-tight text-rose-600 tabular-nums truncate">
                    {formatMoney(summary?.totalDebts || 0)}
                  </p>
                </div>
                <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 shrink-0">
                  <TrendingDown size={16} />
                </div>
              </div>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white p-2 sm:p-3.5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div className="min-w-0">
                  <p className="truncate text-[10px] sm:text-[11px] font-medium text-slate-500">Сумма склада</p>
                  <p className="mt-0.5 font-mono text-xs sm:text-lg font-bold tracking-tight text-slate-900 tabular-nums truncate">
                    {formatMoney(summary?.inventoryValue || 0)}
                  </p>
                </div>
                <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 shrink-0">
                  <Package size={16} />
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-xs">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-slate-900">Обзор продаж</h2>
                  <p className="mt-0.5 text-[10px] sm:text-[11px] text-slate-400">{overviewDescription}</p>
                </div>
                <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-0.5 text-xs">
                  {[
                    { key: 'week', label: 'Нед' },
                    { key: 'month', label: 'Мес' },
                    { key: 'quarter', label: 'Кварт' },
                    { key: 'year', label: 'Год' },
                  ].map((period) => (
                    <button
                      key={period.key}
                      type="button"
                      onClick={() => setOverviewPeriod(period.key as 'week' | 'month' | 'quarter' | 'year')}
                      className={
                        overviewPeriod === period.key
                          ? 'rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-900 shadow-xs'
                          : 'rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900'
                      }
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <React.Suspense
              fallback={
                <section className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_360px]">
                  <ChartSkeleton variant="area" />
                  <ChartSkeleton variant="pie" />
                </section>
              }
            >
              <DashboardCharts
                overviewData={overviewData}
                categoryData={categoryData}
                ringColors={ringColors}
                totalRevenue={summary?.totalRevenue || 0}
                leftBottomContent={recentSalesPanel}
                onOpenProfitReport={() => navigate('/reports?type=profit')}
              />
            </React.Suspense>
          </section>

          <section className="grid gap-3">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-3 sm:px-5 sm:py-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-semibold text-slate-900">Товары с низким остатком</h2>
                  <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                    {formatCount(totalLowStockCount)}
                  </span>
                </div>
                <button
                  onClick={() => navigate(isAdmin ? '/products?sort=low-stock&view=warehouse-low-stock' : '/products?sort=low-stock')}
                  className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <span>Все</span>
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="space-y-1.5 p-2.5 sm:hidden">
                {visibleLowStock.map((item: any) => {
                  const stockValue = Number(item.stock || 0);
                  const outOfStock = stockValue <= 0;
                  const isCriticalLowStock = stockValue > 0 && stockValue <= LOW_STOCK_THRESHOLD;
                  const warehouseLabel = getWarehouseLabel(item);
                  const stockInfo = getProductStockParts(item);
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">{item.name}</p>
                        <p className="mt-0.5 text-[10px] font-medium text-slate-400">{warehouseLabel}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                          {stockInfo.primary}
                        </span>
                        <span
                          title={outOfStock ? 'Нет в наличии' : isCriticalLowStock ? 'Критично' : 'Низкий остаток'}
                          className={card(
                            'inline-flex h-6 w-6 items-center justify-center rounded-lg border shadow-xs',
                            outOfStock || isCriticalLowStock
                              ? 'border-rose-200/80 bg-rose-50 text-rose-600'
                              : 'border-amber-200/80 bg-amber-50 text-amber-600'
                          )}
                        >
                          <AlertTriangle size={13} />
                        </span>
                      </div>
                    </div>
                  );
                })}
                {!visibleLowStock.length && (
                  <div className="rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
                    Нет товаров с таким фильтром
                  </div>
                )}
              </div>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left">
                  <thead className="bg-[#f4f5fb] text-sm text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Товар</th>
                      <th className="px-5 py-4">Склад</th>
                      <th className="px-5 py-4">Остаток</th>
                      <th className="px-5 py-4">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleLowStock.map((item: any) => {
                      const stockValue = Number(item.stock || 0);
                      const outOfStock = stockValue <= 0;
                      const isCriticalLowStock = stockValue > 0 && stockValue <= LOW_STOCK_THRESHOLD;
                      const warehouseLabel = getWarehouseLabel(item);
                      const stockInfo = getProductStockParts(item);
                      return (
                        <tr key={item.id}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                <Package size={18} />
                              </div>
                              <span className="wrap-break-word text-[12px] leading-4 text-slate-900">{item.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-sky-600">{warehouseLabel}</td>
                          <td className="px-5 py-4 text-sm text-slate-900">
                            <p className="text-sm text-slate-900">{stockInfo.primary}</p>
                            {stockInfo.secondary && <p className="text-[10px] text-slate-400">{stockInfo.secondary}</p>}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              title={outOfStock ? 'Нет в наличии' : isCriticalLowStock ? 'Критично' : 'Низкий остаток'}
                              className={card(
                                'inline-flex h-7 w-7 items-center justify-center rounded-full border shadow-xs',
                                outOfStock || isCriticalLowStock
                                  ? 'border-rose-200/80 bg-rose-50 text-rose-600'
                                  : 'border-amber-200/80 bg-amber-50 text-amber-600'
                              )}
                            >
                              <AlertTriangle size={15} />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {!visibleLowStock.length && (
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
