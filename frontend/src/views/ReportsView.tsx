import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { FileSpreadsheet, FileText, Warehouse } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';
import client from '../api/client';
import { formatCount, formatMoney, toFixedNumber } from '../utils/format';

interface ReportsViewProps {
  warehouseId?: number | null;
}

type ReportType = 'sales' | 'profit' | 'returns';

type ReportRow = {
  date: string;
  invoice_id?: number;
  return_id?: number;
  warehouse_name?: string;
  customer_name?: string;
  staff_name?: string;
  product_name: string;
  unit?: string;
  quantity: number;
  selling_price?: number;
  cost_price?: number;
  gross_sales?: number;
  discount_percent?: number;
  net_sales?: number;
  total_sales?: number;
  total_value?: number;
  profit?: number;
  reason?: string;
};

const PIE_COLORS = ['#5b8def', '#7c6cf2', '#f3cb5d', '#5ec98f', '#ef6fae'];

function csvCell(value: unknown) {
  const normalized = value === null || value === undefined ? '' : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function buildCsv(rows: unknown[][]) {
  return ['sep=;', ...rows.map((row) => row.map(csvCell).join(';'))].join('\r\n');
}

const reportMeta: Record<
  ReportType,
  {
    title: string;
    description: string;
    chartTitle: string;
    pieTitle: string;
    accent: string;
    soft: string;
    border: string;
    badge: string;
    text: string;
  }
> = {
  sales: {
    title: 'Продажи',
    description: 'Динамика выручки и товары, которые продавались чаще всего.',
    chartTitle: 'Динамика продаж',
    pieTitle: 'Топ товаров',
    accent: '#5b8def',
    soft: 'bg-sky-50',
    border: 'border-sky-100',
    badge: 'bg-sky-100',
    text: 'text-sky-700',
  },
  profit: {
    title: 'Прибыль',
    description: 'Маржинальность продаж и вклад товаров в общую прибыль.',
    chartTitle: 'Динамика прибыли',
    pieTitle: 'Топ по прибыли',
    accent: '#5ec98f',
    soft: 'bg-emerald-50',
    border: 'border-emerald-100',
    badge: 'bg-emerald-100',
    text: 'text-emerald-700',
  },
  returns: {
    title: 'Возвраты',
    description: 'Возвраты по товарам и причины, которые требуют внимания.',
    chartTitle: 'Возвраты по датам',
    pieTitle: 'Частые позиции',
    accent: '#ef6fae',
    soft: 'bg-rose-50',
    border: 'border-rose-100',
    badge: 'bg-rose-100',
    text: 'text-rose-700',
  },
};

function Panel({
  title,
  children,
  className = '',
  headerActions,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}) {
  return (
    <section className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`.trim()}>
      {title && (
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {headerActions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function ReportsView({ warehouseId: initialWarehouseId = null }: ReportsViewProps) {
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(initialWarehouseId?.toString() || '');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [reportData, setReportData] = useState<ReportRow[]>([]);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin' || user.role === 'ADMIN' || user.role === 'MANAGER';
  const currentMeta = reportMeta[reportType];

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await client.get('/warehouses');
        setWarehouses(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
      }
    };

    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (!isAdmin && reportType === 'profit') {
      setReportType('sales');
      return;
    }

    const fetchReport = async () => {
      const warehouseQuery = selectedWarehouseId ? `&warehouse_id=${selectedWarehouseId}` : '';

      try {
        const res = await client.get(
          `/reports/${reportType}?start=${dateRange.start}&end=${dateRange.end}${warehouseQuery}`
        );
        setReportData(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error(err);
        toast.error('Ошибка при загрузке отчёта');
      }
    };

    fetchReport();
  }, [dateRange, isAdmin, reportType, selectedWarehouseId]);

  const handleMonthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const [year, month] = event.target.value.split('-');
    const start = new Date(Number(year), Number(month) - 1, 1);
    const end = new Date(Number(year), Number(month), 0);

    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  };

  const chartData = useMemo(() => {
    const grouped = reportData.reduce((acc: Array<{ date: string; value: number }>, row) => {
      const existing = acc.find((item) => item.date === row.date);
      const value =
        reportType === 'sales'
          ? Number(row.total_sales || 0)
          : reportType === 'profit'
            ? Number(row.profit || 0)
            : Number(row.quantity || 0);

      if (existing) {
        existing.value += value;
      } else {
        acc.push({ date: row.date, value });
      }

      return acc;
    }, []);

    return grouped;
  }, [reportData, reportType]);

  const pieData = useMemo(() => {
    return reportData
      .reduce((acc: Array<{ name: string; value: number }>, row) => {
        const existing = acc.find((item) => item.name === row.product_name);
        const value =
          reportType === 'sales'
            ? Number(row.total_sales || 0)
            : reportType === 'profit'
              ? Number(row.profit || 0)
              : Number(row.quantity || 0);

        if (existing) {
          existing.value += value;
        } else {
          acc.push({ name: row.product_name, value });
        }

        return acc;
      }, [])
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [reportData, reportType]);

  const summary = useMemo(() => {
    const totalQuantity = reportData.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const totalValue = reportData.reduce((sum, row) => {
      if (reportType === 'sales') {
        return sum + Number(row.total_sales || 0);
      }

      if (reportType === 'profit') {
        return sum + Number(row.profit || 0);
      }

      return sum + Number(row.quantity || 0);
    }, 0);

    return {
      rows: reportData.length,
      totalQuantity,
      totalValue,
    };
  }, [reportData, reportType]);

  const summaryCards = [
    {
      label: 'Тип отчёта',
      value: currentMeta.title,
      meta: dateRange.start,
      tone: currentMeta,
    },
    {
      label: 'Строк в отчёте',
      value: String(summary.rows),
      meta: dateRange.end,
      tone: reportMeta.sales,
    },
    {
      label: reportType === 'returns' ? 'Всего возвратов' : 'Сумма периода',
      value: reportType === 'returns' ? formatCount(summary.totalQuantity) : formatMoney(summary.totalValue),
      meta: `${summary.totalQuantity} шт`,
      tone: reportType === 'returns' ? reportMeta.returns : reportType === 'profit' ? reportMeta.profit : reportMeta.sales,
    },
  ];

  const exportToCSV = () => {
    const detailHeaders =
      reportType === 'sales'
        ? ['Дата', 'Накладная', 'Склад', 'Клиент', 'Товар', 'Ед.', 'Кол-во', 'Цена продажи', 'Сумма без скидки', 'Скидка %', 'Сумма после скидки']
        : reportType === 'profit'
          ? ['Дата', 'Накладная', 'Склад', 'Клиент', 'Товар', 'Ед.', 'Кол-во', 'Цена продажи', 'Сумма без скидки', 'Скидка %', 'Чистая выручка', 'Себестоимость за ед.', 'Прибыль']
          : ['Дата', 'Возврат', 'Склад', 'Сотрудник', 'Товар', 'Ед.', 'Кол-во', 'Цена продажи', 'Сумма возврата', 'Причина'];

    const detailRows = reportData.map((row) => {
      if (reportType === 'sales') {
        return [
          new Date(row.date).toLocaleDateString('ru-RU'),
          row.invoice_id ? '#' + row.invoice_id : '',
          row.warehouse_name || '',
          row.customer_name || '',
          row.product_name,
          row.unit || '',
          formatCount(row.quantity),
          toFixedNumber(row.selling_price || 0),
          toFixedNumber(row.gross_sales || 0),
          toFixedNumber(row.discount_percent || 0),
          toFixedNumber(row.total_sales || 0),
        ];
      }

      if (reportType === 'profit') {
        return [
          new Date(row.date).toLocaleDateString('ru-RU'),
          row.invoice_id ? '#' + row.invoice_id : '',
          row.warehouse_name || '',
          row.customer_name || '',
          row.product_name,
          row.unit || '',
          formatCount(row.quantity),
          toFixedNumber(row.selling_price || 0),
          toFixedNumber(row.gross_sales || 0),
          toFixedNumber(row.discount_percent || 0),
          toFixedNumber(row.net_sales || 0),
          toFixedNumber(row.cost_price || 0),
          toFixedNumber(row.profit || 0),
        ];
      }

      return [
        new Date(row.date).toLocaleDateString('ru-RU'),
        row.return_id ? '#' + row.return_id : '',
        row.warehouse_name || '',
        row.staff_name || '',
        row.product_name,
        row.unit || '',
        formatCount(row.quantity),
        toFixedNumber(row.selling_price || 0),
        toFixedNumber(row.total_value || 0),
        row.reason || '',
      ];
    });

    const warehouseName =
      warehouses.find((warehouse) => String(warehouse.id) === selectedWarehouseId)?.name || 'Все склады';

    const csvRows: unknown[][] = [
      ['Отчёт', currentMeta.title],
      ['Период с', dateRange.start],
      ['Период по', dateRange.end],
      ['Склад', warehouseName],
      ['Строк в отчёте', summary.rows],
      ['Общее количество', formatCount(summary.totalQuantity)],
      ['Сумма периода', reportType === 'returns' ? formatCount(summary.totalQuantity) : toFixedNumber(summary.totalValue)],
      [],
      detailHeaders,
      ...detailRows,
    ];

    const csvContent = '\uFEFF' + buildCsv(csvRows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `report_${reportType}_${dateRange.start}_${dateRange.end}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text(`Отчет: ${currentMeta.title}`, 14, 15);
    doc.text(`Период: ${dateRange.start} - ${dateRange.end}`, 14, 25);

    const headers =
      reportType === 'sales'
        ? [['Дата', 'Товар', 'Кол-во', 'Цена прод.', 'Итого']]
        : reportType === 'profit'
          ? [['Дата', 'Товар', 'Кол-во', 'Цена прод.', 'Себест.', 'Прибыль']]
          : [['Дата', 'Товар', 'Кол-во', 'Причина']];

    const rows = reportData.map((row) => {
      if (reportType === 'sales') {
        return [
          row.date,
          row.product_name,
          row.quantity,
          toFixedNumber(row.selling_price || 0),
          toFixedNumber(row.total_sales || 0),
        ];
      }

      if (reportType === 'profit') {
        return [
          row.date,
          row.product_name,
          row.quantity,
          toFixedNumber(row.selling_price || 0),
          toFixedNumber(row.cost_price || 0),
          toFixedNumber(row.profit || 0),
        ];
      }

      return [row.date, row.product_name, row.quantity, row.reason || ''];
    });

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 35,
      theme: 'grid',
      styles: { fontSize: 8 },
    });

    doc.save(`report_${reportType}_${dateRange.start}_${dateRange.end}.pdf`);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className={`rounded-3xl border bg-white p-5 shadow-sm ${currentMeta.border}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className={`text-sm ${currentMeta.text}`}>Аналитика</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Отчёты</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-500">{currentMeta.description}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={exportToCSV}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white transition-colors hover:bg-slate-800"
            >
              <FileSpreadsheet size={16} />
              <span>CSV</span>
            </button>
            <button
              onClick={exportToPDF}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
            >
              <FileText size={16} />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setReportType('sales')}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${reportType === 'sales' ? 'bg-sky-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Продажи
            </button>
            {isAdmin && (
              <button
                onClick={() => setReportType('profit')}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${reportType === 'profit' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Прибыль
              </button>
            )}
            <button
              onClick={() => setReportType('returns')}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${reportType === 'returns' ? 'bg-rose-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Возвраты
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <Warehouse size={16} className="text-slate-400" />
              <select
                value={selectedWarehouseId}
                onChange={(event) => setSelectedWarehouseId(event.target.value)}
                className="appearance-none bg-transparent text-sm text-slate-700 outline-none"
              >
                <option value="">Все склады</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <span className="text-sm text-slate-400">Месяц</span>
              <input
                type="month"
                value={dateRange.start.slice(0, 7)}
                onChange={handleMonthChange}
                className="bg-transparent text-sm text-slate-700 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <input
                type="date"
                value={dateRange.start}
                onChange={(event) => setDateRange({ ...dateRange, start: event.target.value })}
                className="bg-transparent text-sm text-slate-700 outline-none"
              />
              <span className="text-slate-300">→</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(event) => setDateRange({ ...dateRange, end: event.target.value })}
                className="bg-transparent text-sm text-slate-700 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card) => (
            <section
              key={card.label}
              className={`rounded-3xl border bg-white p-5 shadow-sm ${card.tone.border} ${card.tone.soft}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{card.value}</p>
                </div>
                <div className={`rounded-2xl px-3 py-2 text-sm ${card.tone.badge} ${card.tone.text}`}>{card.meta}</div>
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <Panel title={currentMeta.chartTitle}>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={10}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <RechartsTooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
                  }}
                  formatter={(value: number) => [
                    reportType === 'returns' ? formatCount(value) : formatMoney(value),
                    currentMeta.title,
                  ]}
                />
                <Bar dataKey="value" fill={currentMeta.accent} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title={currentMeta.pieTitle}>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={78} paddingAngle={4} dataKey="value">
                  {pieData.map((item, index) => (
                    <Cell key={`${item.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {pieData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                  <span className="truncate text-slate-600">{item.name}</span>
                </div>
                <span className="text-slate-900">
                  {reportType === 'returns' ? formatCount(item.value) : formatMoney(item.value)}
                </span>
              </div>
            ))}

            {!pieData.length && <div className="py-8 text-center text-sm text-slate-400">Нет данных для отображения</div>}
          </div>
        </Panel>
      </section>

      <Panel
        title="Детализация"
        headerActions={
          <div className="flex items-center gap-2">
            <button
              onClick={exportToCSV}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
            >
              CSV
            </button>
            <button
              onClick={exportToPDF}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
            >
              PDF
            </button>
          </div>
        }
      >
        <div className="max-h-[640px] overflow-auto -mx-5">
          <table className="min-w-[720px] w-full text-left">
            <thead className="bg-slate-50 text-sm text-slate-500">
              <tr>
                <th className="px-5 py-3">Дата</th>
                <th className="px-5 py-3">Товар</th>
                <th className="px-5 py-3">Кол-во</th>
                {reportType === 'sales' && (
                  <>
                    <th className="px-5 py-3">Цена прод.</th>
                    <th className="px-5 py-3">Итого</th>
                  </>
                )}
                {reportType === 'profit' && (
                  <>
                    <th className="px-5 py-3">Цена прод.</th>
                    <th className="px-5 py-3">Себест.</th>
                    <th className="px-5 py-3">Прибыль</th>
                  </>
                )}
                {reportType === 'returns' && <th className="px-5 py-3">Причина</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportData.map((row, index) => (
                <tr key={`${row.date}-${row.product_name}-${index}`} className="text-sm text-slate-700">
                  <td className="px-5 py-4">{new Date(row.date).toLocaleDateString('ru-RU')}</td>
                  <td className="px-5 py-4 text-slate-900">{row.product_name}</td>
                  <td className="px-5 py-4">{row.quantity}</td>
                  {reportType === 'sales' && (
                    <>
                      <td className="px-5 py-4">{toFixedNumber(row.selling_price || 0)}</td>
                      <td className="px-5 py-4 text-sky-700">{formatMoney(row.total_sales || 0)}</td>
                    </>
                  )}
                  {reportType === 'profit' && (
                    <>
                      <td className="px-5 py-4">{toFixedNumber(row.selling_price || 0)}</td>
                      <td className="px-5 py-4">{toFixedNumber(row.cost_price || 0)}</td>
                      <td className="px-5 py-4 text-emerald-700">{formatMoney(row.profit || 0)}</td>
                    </>
                  )}
                  {reportType === 'returns' && <td className="px-5 py-4 italic text-rose-600">{row.reason || '-'}</td>}
                </tr>
              ))}

              {!reportData.length && (
                <tr>
                  <td
                    colSpan={reportType === 'profit' ? 6 : reportType === 'sales' ? 5 : 4}
                    className="px-5 py-16 text-center text-sm text-slate-400"
                  >
                    Нет данных за выбранный период
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

