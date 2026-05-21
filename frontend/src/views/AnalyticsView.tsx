import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  Boxes,
  Briefcase,
  Building2,
  CalendarRange,
  DollarSign,
  Package,
  TrendingUp,
  Users,
  Warehouse,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getAnalytics } from '../api/reports.api';
import { getWarehouses } from '../api/warehouses.api';
import { formatCount, formatMoney, formatPercent } from '../utils/format';
import { filterWarehousesForUser, getCurrentUser } from '../utils/userAccess';

type AnalyticsSummary = {
  totalRevenue: number;
  totalProfit: number | null;
  totalCost: number | null;
  totalExpenses: number | null;
  totalSalesCount: number;
  totalCustomers: number;
  totalProducts: number;
  totalDebts: number;
  stockValuation: number | null;
  margin: number | null;
  netProfit: number | null;
};

type NamedMetric = {
  id?: number;
  name: string;
  sales?: number;
  profit?: number;
  revenue?: number;
  debt?: number;
  invoices?: number;
  quantity?: number;
  value?: number;
  operations?: number;
  profitPerUnit?: number;
  profitMargin?: number;
};

type AnalyticsPayload = {
  summary: AnalyticsSummary;
  chartData: Array<{ name: string; sales: number; profit: number }>;
  warehousePerformance: NamedMetric[];
  productPerformance: NamedMetric[];
  staffPerformance: NamedMetric[];
  customerPerformance: NamedMetric[];
  customerDebts: NamedMetric[];
  writeoffReasons: NamedMetric[];
  writeoffByStaff: NamedMetric[];
  writeoffByProduct: NamedMetric[];
  writeoffByWarehouse: NamedMetric[];
};

type PeriodMode = 'month' | 'quarter' | 'year';
type SectionKey = 'overview' | 'products' | 'staff' | 'customers' | 'writeoffs';

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthAnchor(date: Date) {
  return formatDateInputValue(date).slice(0, 7);
}

function getMonthRange(year: number, monthIndex: number) {
  return {
    start: formatDateInputValue(new Date(year, monthIndex, 1)),
    end: formatDateInputValue(new Date(year, monthIndex + 1, 0)),
  };
}

function getQuarterRange(year: number, monthIndex: number) {
  const quarterStartMonth = Math.floor(monthIndex / 3) * 3;
  return {
    start: formatDateInputValue(new Date(year, quarterStartMonth, 1)),
    end: formatDateInputValue(new Date(year, quarterStartMonth + 3, 0)),
  };
}

function getYearRange(year: number) {
  return {
    start: formatDateInputValue(new Date(year, 0, 1)),
    end: formatDateInputValue(new Date(year, 12, 0)),
  };
}

function getRangeFromAnchor(anchor: string, mode: PeriodMode) {
  const [yearRaw, monthRaw] = anchor.split('-');
  const year = Number(yearRaw) || new Date().getFullYear();
  const monthIndex = Math.max(0, Number(monthRaw || '1') - 1);

  if (mode === 'quarter') return getQuarterRange(year, monthIndex);
  if (mode === 'year') return getYearRange(year);
  return getMonthRange(year, monthIndex);
}

function getPeriodLabel(anchor: string, mode: PeriodMode) {
  const [yearRaw, monthRaw] = anchor.split('-');
  const year = Number(yearRaw) || new Date().getFullYear();
  const monthIndex = Math.max(0, Number(monthRaw || '1') - 1);

  if (mode === 'year') return `Год ${year}`;
  if (mode === 'quarter') return `${Math.floor(monthIndex / 3) + 1} квартал ${year}`;

  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(year, monthIndex, 1));
}

function getQuickRangeLabel(mode: PeriodMode) {
  if (mode === 'quarter') return 'Этот квартал';
  if (mode === 'year') return 'Этот год';
  return 'Этот месяц';
}

function sortByNumber<T extends NamedMetric>(rows: T[], key: keyof T, fallback?: keyof T) {
  return [...rows].sort((a, b) => {
    const primary = Number(b[key] || 0) - Number(a[key] || 0);
    if (primary !== 0 || !fallback) return primary;
    return Number(b[fallback] || 0) - Number(a[fallback] || 0);
  });
}

function EmptyState({ label = 'Нет данных за выбранный период' }: { label?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
      {label}
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_14px_36px_-24px_rgba(15,23,42,0.35)]">
      <div className="border-b border-slate-200/90 px-5 py-4">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  help,
  tone = 'slate',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  help: string;
  tone?: 'slate' | 'emerald' | 'amber' | 'sky' | 'rose';
}) {
  const toneMap = {
    slate: 'border-slate-200 bg-white',
    emerald: 'border-emerald-100 bg-gradient-to-br from-emerald-50 to-white',
    amber: 'border-amber-100 bg-gradient-to-br from-amber-50 to-white',
    sky: 'border-sky-100 bg-gradient-to-br from-sky-50 to-white',
    rose: 'border-rose-100 bg-gradient-to-br from-rose-50 to-white',
  } as const;

  return (
    <article className={`rounded-[26px] border p-4 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.35)] ${toneMap[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-2xl bg-white/90 p-2.5 shadow-sm">{icon}</div>
        <p className="text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      </div>
      <p className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{help}</p>
    </article>
  );
}

function LeaderInsight({
  icon,
  title,
  value,
  meta,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        {icon}
        <span>{title}</span>
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{meta}</p>
    </div>
  );
}

function RankTable({
  title,
  hint,
  rows,
  primaryLabel,
  primaryValue,
  secondaryValue,
}: {
  title: string;
  hint: string;
  rows: NamedMetric[];
  primaryLabel: string;
  primaryValue: (row: NamedMetric) => string;
  secondaryValue?: (row: NamedMetric) => string;
}) {
  return (
    <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-slate-50/70">
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{hint}</p>
      </div>
      <div className="space-y-2 p-4">
        {rows.length ? (
          rows.slice(0, 8).map((row, index) => (
            <article
              key={`${title}-${row.name}-${index}`}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white bg-white px-3 py-3 shadow-sm"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {index + 1}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                {secondaryValue ? <p className="mt-1 text-xs text-slate-500">{secondaryValue(row)}</p> : null}
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{primaryLabel}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{primaryValue(row)}</p>
              </div>
            </article>
          ))
        ) : (
          <EmptyState />
        )}
      </div>
    </section>
  );
}

function AnalyticsDataTable({
  title,
  hint,
  rows,
  columns,
}: {
  title: string;
  hint: string;
  rows: NamedMetric[];
  columns: Array<{
    key: string;
    label: string;
    align?: 'left' | 'right';
    className?: string;
    render: (row: NamedMetric, index: number) => React.ReactNode;
  }>;
}) {
  return (
    <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_12px_30px_-24px_rgba(15,23,42,0.32)]">
      <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{hint}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50/70">
            <tr className="text-slate-500">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] ${column.align === 'right' ? 'text-right' : 'text-left'} ${column.className || ''}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length ? (
              rows.slice(0, 10).map((row, index) => (
                <tr key={`${title}-${row.name}-${index}`} className="transition-colors hover:bg-slate-50/70">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-3 align-top ${column.align === 'right' ? 'text-right' : 'text-left'} ${column.className || ''}`}
                    >
                      {column.render(row, index)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-slate-400">
                  Нет данных за выбранный период
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AnalyticsChart({ rows }: { rows: AnalyticsPayload['chartData'] }) {
  return (
    <div className="h-[320px] rounded-[26px] border border-slate-200 bg-white p-4">
      {rows.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => formatMoney(value)} />
            <RechartsTooltip
              formatter={(value, name) => [formatMoney(value), name === 'sales' ? 'Выручка' : 'Прибыль']}
              labelFormatter={(label) => `Период: ${label}`}
            />
            <Legend formatter={(value) => (value === 'sales' ? 'Выручка' : 'Прибыль')} />
            <Bar dataKey="sales" fill="#0284c7" radius={[8, 8, 0, 0]} />
            <Bar dataKey="profit" fill="#059669" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">Нет данных для графика</div>
      )}
    </div>
  );
}

export default function AnalyticsView() {
  const today = new Date();
  const user = useMemo(() => getCurrentUser(), []);
  const defaultAnchor = getMonthAnchor(today);

  const [activeSection, setActiveSection] = useState<SectionKey>('overview');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [periodAnchor, setPeriodAnchor] = useState(defaultAnchor);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const dateRange = useMemo(() => getRangeFromAnchor(periodAnchor, periodMode), [periodAnchor, periodMode]);
  const periodLabel = useMemo(() => getPeriodLabel(periodAnchor, periodMode), [periodAnchor, periodMode]);

  useEffect(() => {
    getWarehouses()
      .then((items) => setWarehouses(filterWarehousesForUser(Array.isArray(items) ? items : [], user)))
      .catch(() => setWarehouses([]));
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    getAnalytics({
      warehouseId: selectedWarehouseId ? Number(selectedWarehouseId) : null,
      start: dateRange.start,
      end: dateRange.end,
    })
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setData(null);
          toast.error('Не удалось загрузить аналитику');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dateRange.end, dateRange.start, selectedWarehouseId]);

  const summary = data?.summary;
  const topProduct = data?.productPerformance?.[0] || null;
  const topStaff = data?.staffPerformance?.[0] || null;
  const topWarehouse = data?.warehousePerformance?.[0] || null;
  const topWriteoffReason = data?.writeoffReasons?.[0] || null;
  const topCustomer = data?.customerPerformance?.[0] || null;
  const topDebtor = data?.customerDebts?.[0] || null;

  const topSellingProducts = useMemo(
    () => sortByNumber(data?.productPerformance || [], 'quantity', 'revenue'),
    [data?.productPerformance]
  );

  const productEfficiencyRows = useMemo(
    () =>
      (data?.productPerformance || [])
        .map((row) => {
          const quantity = Number(row.quantity || 0);
          const revenue = Number(row.revenue || 0);
          const profit = Number(row.profit || 0);
          return {
            ...row,
            quantity,
            revenue,
            profit,
            profitPerUnit: quantity > 0 ? profit / quantity : 0,
            profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
          };
        })
        .filter((row) => Number(row.quantity || 0) > 0)
        .sort((a, b) => Number(b.profitPerUnit || 0) - Number(a.profitPerUnit || 0) || Number(b.profit || 0) - Number(a.profit || 0)),
    [data?.productPerformance]
  );

  const staffSalesLeaders = useMemo(() => sortByNumber(data?.staffPerformance || [], 'revenue', 'profit'), [data?.staffPerformance]);
  const staffProfitLeaders = useMemo(() => sortByNumber(data?.staffPerformance || [], 'profit', 'revenue'), [data?.staffPerformance]);
  const customerRevenueLeaders = useMemo(() => sortByNumber(data?.customerPerformance || [], 'revenue', 'debt'), [data?.customerPerformance]);
  const customerDebtLeaders = useMemo(() => sortByNumber(data?.customerDebts || [], 'debt', 'revenue'), [data?.customerDebts]);

  const actionItems = useMemo(() => {
    const items: Array<{ title: string; detail: string; tone: 'rose' | 'amber' | 'sky' | 'emerald' }> = [];
    const margin = Number(summary?.margin || 0);
    const debts = Number(summary?.totalDebts || 0);
    const revenue = Number(summary?.totalRevenue || 0);
    const debtShare = revenue > 0 ? (debts / revenue) * 100 : 0;
    const topLoss = Number(topWriteoffReason?.value || 0);
    const topLossShare = revenue > 0 ? (topLoss / revenue) * 100 : 0;

    if (margin > 0 && margin < 12) {
      items.push({
        title: 'Маржа низкая',
        detail: `Средняя маржа ${formatPercent(margin, 1)}. Проверьте цену и себестоимость товаров.`,
        tone: 'amber',
      });
    }

    if (debtShare >= 20) {
      items.push({
        title: 'Долги высокие',
        detail: `Доля долгов ${formatPercent(debtShare, 1)} от выручки. Нужен контроль оплат.`,
        tone: 'rose',
      });
    }

    if (topLossShare >= 3) {
      items.push({
        title: 'Списания заметные',
        detail: `Потери по главной причине уже ${formatPercent(topLossShare, 1)} от выручки.`,
        tone: 'rose',
      });
    }

    if (topProduct && Number(topProduct.profit || 0) > 0) {
      items.push({
        title: 'Лидер по товару',
        detail: `${topProduct.name} приносит максимум прибыли. Держите его в наличии.`,
        tone: 'emerald',
      });
    }

    if (topCustomer && topDebtor && topCustomer.name === topDebtor.name) {
      items.push({
        title: 'Крупный клиент в долге',
        detail: `${topDebtor.name} дает оборот и одновременно держит самый большой долг.`,
        tone: 'sky',
      });
    }

    if (!items.length) {
      items.push({
        title: 'Ситуация стабильна',
        detail: 'Критичных отклонений по прибыли, долгам и списаниям не видно.',
        tone: 'emerald',
      });
    }

    return items;
  }, [summary, topCustomer, topDebtor, topProduct, topWriteoffReason]);

  const sections: Array<{ key: SectionKey; label: string }> = [
    { key: 'overview', label: 'Главное' },
    { key: 'products', label: 'Товары' },
    { key: 'staff', label: 'Сотрудники' },
    { key: 'customers', label: 'Клиенты' },
    { key: 'writeoffs', label: 'Списания' },
  ];

  const commonProductColumns = [
    { key: 'rank', label: '№', render: (_: NamedMetric, index: number) => index + 1, className: 'w-14' },
    { key: 'name', label: 'Товар', render: (row: NamedMetric) => row.name || '-' },
    { key: 'quantity', label: 'Продано', render: (row: NamedMetric) => formatCount(row.quantity || 0), align: 'right' as const },
    { key: 'revenue', label: 'Выручка', render: (row: NamedMetric) => formatMoney(row.revenue || 0), align: 'right' as const },
    { key: 'profit', label: 'Прибыль', render: (row: NamedMetric) => formatMoney(row.profit || 0), align: 'right' as const },
  ];

  const commonStaffColumns = [
    { key: 'rank', label: '№', render: (_: NamedMetric, index: number) => index + 1, className: 'w-14' },
    { key: 'name', label: 'Сотрудник', render: (row: NamedMetric) => row.name || '-' },
    { key: 'invoices', label: 'Накладные', render: (row: NamedMetric) => formatCount(row.invoices || 0), align: 'right' as const },
    { key: 'revenue', label: 'Выручка', render: (row: NamedMetric) => formatMoney(row.revenue || 0), align: 'right' as const },
    { key: 'profit', label: 'Прибыль', render: (row: NamedMetric) => formatMoney(row.profit || 0), align: 'right' as const },
  ];

  return (
    <div className="app-page-shell bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(15,118,110,0.08),_transparent_24%)]">
      <div className="w-full space-y-6">
        <section className="overflow-hidden rounded-[32px] border border-slate-200/90 bg-white shadow-[0_24px_70px_-36px_rgba(15,23,42,0.4)]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.35fr)_420px]">
            <div className="border-b border-slate-200/80 px-6 py-6 xl:border-b-0 xl:border-r">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                <BarChart3 size={14} />
                Админ аналитика
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">Аналитика CRM</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Полная картина бизнеса: выручка, прибыль, расходы, склады, товары, сотрудники, клиенты, долги и списания за выбранный период.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Период</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{periodLabel}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {dateRange.start} - {dateRange.end}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Продажи</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{formatCount(summary?.totalSalesCount || 0)}</p>
                  <p className="mt-1 text-xs text-slate-500">Накладных за период</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Склад</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {selectedWarehouseId ? warehouses.find((item) => String(item.id) === selectedWarehouseId)?.name || 'Выбранный склад' : 'Все склады'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Фильтр применяется ко всем блокам</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <CalendarRange size={16} className="text-slate-500" />
                  Управление периодом
                </div>

                <div className="mt-4 inline-flex w-full rounded-2xl border border-slate-200 bg-white p-1">
                  {[
                    { key: 'month', label: 'Месяц' },
                    { key: 'quarter', label: 'Квартал' },
                    { key: 'year', label: 'Год' },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setPeriodMode(option.key as PeriodMode)}
                      className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        periodMode === option.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex flex-col gap-3">
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                    <Warehouse size={15} className="text-slate-400" />
                    <select
                      value={selectedWarehouseId}
                      onChange={(event) => setSelectedWarehouseId(event.target.value)}
                      className="w-full appearance-none bg-transparent text-[13px] text-slate-700 outline-none"
                    >
                      <option value="">Все склады</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                    <span className="text-[13px] text-slate-400">База</span>
                    <input
                      type="month"
                      value={periodAnchor}
                      onChange={(event) => setPeriodAnchor(event.target.value || defaultAnchor)}
                      className="w-full bg-transparent text-[13px] text-slate-700 outline-none"
                    />
                  </div>

                  <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Активный диапазон</p>
                    <p className="mt-2 text-sm font-semibold">{getQuickRangeLabel(periodMode)}</p>
                    <p className="mt-1 text-xs text-slate-300">
                      {dateRange.start} - {dateRange.end}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <MetricCard icon={<DollarSign size={18} className="text-emerald-700" />} label="Выручка" value={formatMoney(summary?.totalRevenue || 0)} help="Оборот за период." tone="emerald" />
          <MetricCard icon={<TrendingUp size={18} className="text-sky-700" />} label="Чистая прибыль" value={formatMoney(summary?.netProfit || 0)} help="Прибыль минус расходы." tone="sky" />
          <MetricCard icon={<Banknote size={18} className="text-rose-700" />} label="Расходы" value={formatMoney(summary?.totalExpenses || 0)} help="Расходы за период." tone="rose" />
          <MetricCard icon={<Boxes size={18} className="text-amber-700" />} label="Маржа" value={formatPercent(summary?.margin || 0, 1)} help="Рентабельность продаж." tone="amber" />
          <MetricCard icon={<Package size={18} className="text-slate-700" />} label="Долги" value={formatMoney(summary?.totalDebts || 0)} help="Неоплаченная сумма." tone="slate" />
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_14px_36px_-24px_rgba(15,23,42,0.35)]">
          <div className="grid gap-2 md:grid-cols-5">
            {sections.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`rounded-2xl px-3 py-3 text-sm font-medium transition ${
                  activeSection === section.key ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </section>

        {isLoading ? (
          <Panel title="Загрузка аналитики" description="Собираем данные по продажам, товарам, сотрудникам и списаниям.">
            <div className="py-16 text-center text-sm text-slate-400">Загрузка аналитики...</div>
          </Panel>
        ) : null}

        {!isLoading && activeSection === 'overview' ? (
          <Panel title="Главная аналитика" description="Ключевые показатели и быстрые выводы по выбранному периоду.">
            <div className="space-y-5">
              <AnalyticsChart rows={data?.chartData || []} />

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <LeaderInsight icon={<Package size={16} />} title="Товар-лидер" value={topProduct?.name || '-'} meta={topProduct ? formatMoney(topProduct.profit || 0) : 'Нет данных'} />
                <LeaderInsight icon={<Briefcase size={16} />} title="Сотрудник-лидер" value={topStaff?.name || '-'} meta={topStaff ? formatMoney(topStaff.revenue || 0) : 'Нет данных'} />
                <LeaderInsight icon={<Building2 size={16} />} title="Склад-лидер" value={topWarehouse?.name || '-'} meta={topWarehouse ? formatMoney(topWarehouse.sales || 0) : 'Нет данных'} />
                <LeaderInsight icon={<AlertTriangle size={16} />} title="Главная причина списаний" value={topWriteoffReason?.name || '-'} meta={topWriteoffReason ? formatMoney(topWriteoffReason.value || 0) : 'Нет данных'} />
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="grid gap-4 md:grid-cols-2">
                  <RankTable title="Склады по выручке" hint="Сравнение складов за период." rows={sortByNumber(data?.warehousePerformance || [], 'sales', 'profit')} primaryLabel="Выручка" primaryValue={(row) => formatMoney(row.sales || 0)} secondaryValue={(row) => `Прибыль: ${formatMoney(row.profit || 0)}`} />
                  <RankTable title="Клиенты по обороту" hint="Кто дал больше всего продаж." rows={customerRevenueLeaders} primaryLabel="Оборот" primaryValue={(row) => formatMoney(row.revenue || 0)} secondaryValue={(row) => `Накладные: ${formatCount(row.invoices || 0)}`} />
                </div>

                <section className="rounded-[26px] border border-slate-200 bg-slate-50/70 p-4">
                  <h3 className="text-base font-semibold text-slate-900">Что требует внимания</h3>
                  <div className="mt-4 space-y-3">
                    {actionItems.map((item) => (
                      <div key={item.title} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-sm leading-5 text-slate-500">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </Panel>
        ) : null}

        {!isLoading && activeSection === 'products' ? (
          <Panel title="Аналитика по товарам" description="Продажи, прибыль и эффективность ассортимента.">
            <div className="space-y-4">
              <AnalyticsDataTable title="Самые продаваемые товары" hint="Сортировка по количеству проданных единиц." rows={topSellingProducts} columns={commonProductColumns} />
              <AnalyticsDataTable
                title="Товары по рентабельности"
                hint="Показывает прибыль на единицу и маржу товара."
                rows={productEfficiencyRows}
                columns={[
                  { key: 'rank', label: '№', render: (_, index) => index + 1, className: 'w-14' },
                  { key: 'name', label: 'Товар', render: (row) => row.name || '-' },
                  { key: 'profitMargin', label: 'Маржа', render: (row) => formatPercent(row.profitMargin || 0, 1), align: 'right' },
                  { key: 'profitPerUnit', label: 'Прибыль / шт', render: (row) => formatMoney(row.profitPerUnit || 0), align: 'right' },
                  { key: 'profit', label: 'Общая прибыль', render: (row) => formatMoney(row.profit || 0), align: 'right' },
                ]}
              />
            </div>
          </Panel>
        ) : null}

        {!isLoading && activeSection === 'staff' ? (
          <Panel title="Аналитика по сотрудникам" description="Кто продает больше и кто приносит больше прибыли.">
            <div className="space-y-4">
              <AnalyticsDataTable title="Сотрудники по продажам" hint="Рейтинг по общей выручке и количеству накладных." rows={staffSalesLeaders} columns={commonStaffColumns} />
              <AnalyticsDataTable title="Сотрудники по прибыли" hint="Рейтинг по прибыли, затем по выручке." rows={staffProfitLeaders} columns={commonStaffColumns} />
            </div>
          </Panel>
        ) : null}

        {!isLoading && activeSection === 'customers' ? (
          <Panel title="Аналитика по клиентам" description="Оборот клиентов и контроль дебиторской задолженности.">
            <div className="space-y-4">
              <AnalyticsDataTable
                title="Клиенты по обороту"
                hint="Клиенты, которые купили больше всего за выбранный период."
                rows={customerRevenueLeaders}
                columns={[
                  { key: 'rank', label: '№', render: (_, index) => index + 1, className: 'w-14' },
                  { key: 'name', label: 'Клиент', render: (row) => row.name || '-' },
                  { key: 'invoices', label: 'Накладные', render: (row) => formatCount(row.invoices || 0), align: 'right' },
                  { key: 'revenue', label: 'Оборот', render: (row) => formatMoney(row.revenue || 0), align: 'right' },
                  { key: 'debt', label: 'Долг', render: (row) => formatMoney(row.debt || 0), align: 'right' },
                ]}
              />
              <AnalyticsDataTable
                title="Клиенты с долгами"
                hint="Дебиторская задолженность по выбранному периоду."
                rows={customerDebtLeaders}
                columns={[
                  { key: 'rank', label: '№', render: (_, index) => index + 1, className: 'w-14' },
                  { key: 'name', label: 'Клиент', render: (row) => row.name || '-' },
                  { key: 'debt', label: 'Долг', render: (row) => formatMoney(row.debt || 0), align: 'right' },
                  { key: 'revenue', label: 'Оборот', render: (row) => formatMoney(row.revenue || 0), align: 'right' },
                  { key: 'invoices', label: 'Накладные', render: (row) => formatCount(row.invoices || 0), align: 'right' },
                ]}
              />
            </div>
          </Panel>
        ) : null}

        {!isLoading && activeSection === 'writeoffs' ? (
          <Panel title="Аналитика списаний" description="Причины, товары, сотрудники и склады, где возникли потери.">
            <div className="grid gap-4 lg:grid-cols-2">
              <RankTable title="Причины списаний" hint="Главные источники потерь." rows={data?.writeoffReasons || []} primaryLabel="Сумма" primaryValue={(row) => formatMoney(row.value || 0)} secondaryValue={(row) => `Количество: ${formatCount(row.quantity || 0)}, операций: ${formatCount(row.operations || 0)}`} />
              <RankTable title="Товары в списаниях" hint="Какие товары списывались чаще всего." rows={data?.writeoffByProduct || []} primaryLabel="Сумма" primaryValue={(row) => formatMoney(row.value || 0)} secondaryValue={(row) => `Количество: ${formatCount(row.quantity || 0)}`} />
              <RankTable title="Сотрудники по списаниям" hint="Кто проводил операции списания." rows={data?.writeoffByStaff || []} primaryLabel="Сумма" primaryValue={(row) => formatMoney(row.value || 0)} secondaryValue={(row) => `Операций: ${formatCount(row.operations || 0)}`} />
              <RankTable title="Склады по списаниям" hint="Где возникали списания." rows={data?.writeoffByWarehouse || []} primaryLabel="Сумма" primaryValue={(row) => formatMoney(row.value || 0)} secondaryValue={(row) => `Количество: ${formatCount(row.quantity || 0)}`} />
            </div>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
