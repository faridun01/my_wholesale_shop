import React from 'react';
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
import { formatMoney, formatPercent } from '../../utils/format';
import { formatProductName } from '../../utils/productName';

type OverviewPoint = {
  label: string;
  total: number;
};

type CategoryPoint = {
  name: string;
  value: number;
};

interface DashboardChartsProps {
  overviewData: OverviewPoint[];
  categoryData: CategoryPoint[];
  ringColors: string[];
  totalRevenue: number;
  onOpenProfitReport?: () => void;
  leftBottomContent?: React.ReactNode;
}

function CategoryPieTooltip({
  active,
  payload,
  totalCategoryValue,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: { name?: string; value?: number } }>;
  totalCategoryValue: number;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0]?.payload;
  const label = item?.name || payload[0]?.name || 'Без названия';
  const value = Number(item?.value ?? payload[0]?.value ?? 0);
  const percent = totalCategoryValue > 0 ? (value / totalCategoryValue) * 100 : 0;

  return (
    <div className="max-w-[280px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl text-left">
      <p className="break-words text-xs font-semibold leading-relaxed text-slate-900">{formatProductName(label)}</p>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-emerald-600">{formatMoney(value)}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
          {formatPercent(percent, 1)}
        </span>
      </div>
    </div>
  );
}

export default function DashboardCharts({
  overviewData,
  categoryData,
  ringColors,
  totalRevenue,
  onOpenProfitReport,
  leftBottomContent,
}: DashboardChartsProps) {
  const totalCategoryValue = categoryData.reduce((sum, item) => sum + item.value, 0);
  const topCategory = categoryData[0] || null;

  return (
    <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex h-full flex-col space-y-4">
        <div className="rounded-[24px] border border-white bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Продажи по дням</h2>
              <p className="mt-1 text-xs text-slate-400">Динамика выручки за выписанные накладные</p>
            </div>
          </div>

          <div className="mt-6 h-[260px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overviewData} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="overviewGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.16} />
                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
                  }}
                  formatter={(val: number) => [formatMoney(val), 'Выручка']}
                />
                <Area type="monotone" dataKey="total" stroke="#0f172a" strokeWidth={2.5} fill="url(#overviewGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {leftBottomContent}
      </div>

      <div className="flex h-full min-w-0 flex-col rounded-[24px] border border-white bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Продажи по категориям</h2>
            <p className="mt-2 text-[11px] text-slate-500">Общая выручка</p>
            <p className="mt-2 break-words text-[clamp(1.05rem,1.45vw,1.45rem)] font-semibold leading-none tracking-tight text-slate-900">
              {formatMoney(totalRevenue)}
            </p>
          </div>
          {onOpenProfitReport ? (
            <button
              type="button"
              onClick={onOpenProfitReport}
              className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              Товары по прибыли
            </button>
          ) : null}
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
                {categoryData.map((entry, index) => (
                  <Cell key={`${entry.name}-${index}`} fill={ringColors[index % ringColors.length]} />
                ))}
              </Pie>
              <Tooltip content={<CategoryPieTooltip totalCategoryValue={totalCategoryValue} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 flex-1 space-y-2">
          {categoryData.map((item, index) => {
            const percent = totalCategoryValue > 0 ? (item.value / totalCategoryValue) * 100 : 0;
            const fullName = formatProductName(item.name);
            return (
              <div
                key={`${item.name}-${index}`}
                className="group flex items-center justify-between gap-3 text-sm cursor-pointer rounded-xl p-1.5 transition-colors hover:bg-slate-50"
                title={`${fullName} • ${formatMoney(item.value)} (${formatPercent(percent, 1)})`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="h-3 w-3 shrink-0 rounded-full transition-transform group-hover:scale-110"
                    style={{ backgroundColor: ringColors[index % ringColors.length] }}
                  />
                  <span className="break-words text-[12px] font-medium leading-4 text-slate-700 group-hover:text-slate-900">
                    {fullName}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="block text-xs font-semibold text-slate-900">{formatPercent(percent, 1)}</span>
                  <span className="block text-[10px] font-medium text-slate-400">{formatMoney(item.value)}</span>
                </div>
              </div>
            );
          })}
          {!categoryData.length && <p className="text-sm text-slate-400">Нет данных по категориям</p>}
        </div>

        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Категорий</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{categoryData.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3" title={formatProductName(topCategory?.name || '')}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Лидер</p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-900">
              {topCategory?.name ? formatProductName(topCategory.name) : 'Нет данных'}
            </p>
            {topCategory ? (
              <p className="mt-1 text-xs text-slate-500">
                {totalCategoryValue > 0 ? formatPercent((topCategory.value / totalCategoryValue) * 100) : formatPercent(0)}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
