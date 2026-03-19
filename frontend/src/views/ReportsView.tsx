import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Warehouse } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../api/client';
import { formatCount, formatMoney, toFixedNumber } from '../utils/format';
import { formatProductName } from '../utils/productName';
import { getCurrentUser } from '../utils/userAccess';

const ReportsCharts = React.lazy(() => import('../components/charts/ReportsCharts'));

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

function normalizeSheetName(value: string) {
  return String(value || 'Лист')
    .replace(/[\\/*?:[\]]/g, ' ')
    .trim()
    .slice(0, 31) || 'Лист';
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthRange(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);

  return {
    start: formatDateInputValue(start),
    end: formatDateInputValue(end),
  };
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
  const today = new Date();
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(initialWarehouseId?.toString() || '');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState(() => getMonthRange(today.getFullYear(), today.getMonth()));
  const [reportData, setReportData] = useState<ReportRow[]>([]);

  const user = getCurrentUser();
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
    setDateRange(getMonthRange(Number(year), Number(month) - 1));
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
          acc.push({ name: formatProductName(row.product_name), value });
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

  const productProfitData = useMemo(() => {
    if (reportType !== 'profit') {
      return [];
    }

    return reportData
      .reduce((acc: Array<{ name: string; quantity: number; revenue: number; profit: number }>, row) => {
        const existing = acc.find((item) => item.name === row.product_name);
        const quantity = Number(row.quantity || 0);
        const revenue = Number(row.net_sales || 0);
        const profit = Number(row.profit || 0);

        if (existing) {
          existing.quantity += quantity;
          existing.revenue += revenue;
          existing.profit += profit;
        } else {
          acc.push({
            name: formatProductName(row.product_name),
            quantity,
            revenue,
            profit,
          });
        }

        return acc;
      }, [])
      .sort((a, b) => b.profit - a.profit);
  }, [reportData, reportType]);

  const buildReportRows = (rows: ReportRow[]) => {
    const detailHeaders =
      reportType === 'sales'
        ? ['Дата', 'Накладная', 'Склад', 'Клиент', 'Товар', 'Ед.', 'Кол-во', 'Цена продажи', 'Сумма без скидки', 'Скидка %', 'Сумма после скидки']
        : reportType === 'profit'
          ? ['Дата', 'Накладная', 'Склад', 'Клиент', 'Товар', 'Ед.', 'Кол-во', 'Цена продажи', 'Сумма без скидки', 'Скидка %', 'Чистая выручка', 'Себестоимость за ед.', 'Прибыль']
          : ['Дата', 'Возврат', 'Склад', 'Сотрудник', 'Товар', 'Ед.', 'Кол-во', 'Цена продажи', 'Сумма возврата', 'Причина'];

    const detailRows = rows.map((row) => {
      if (reportType === 'sales') {
        return [
          new Date(row.date).toLocaleDateString('ru-RU'),
          row.invoice_id ? '#' + row.invoice_id : '',
          row.warehouse_name || '',
          row.customer_name || '',
          formatProductName(row.product_name),
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
          formatProductName(row.product_name),
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
        formatProductName(row.product_name),
        row.unit || '',
        formatCount(row.quantity),
        toFixedNumber(row.selling_price || 0),
        toFixedNumber(row.total_value || 0),
        row.reason || '',
      ];
    });

    return { detailHeaders, detailRows };
  };

  const buildSummaryRows = (rows: ReportRow[], warehouseName: string) => {
    const totalQuantity = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const totalValue = rows.reduce((sum, row) => {
      if (reportType === 'sales') {
        return sum + Number(row.total_sales || 0);
      }

      if (reportType === 'profit') {
        return sum + Number(row.profit || 0);
      }

      return sum + Number(row.quantity || 0);
    }, 0);

    return [
      ['Отчёт', currentMeta.title],
      ['Период с', dateRange.start],
      ['Период по', dateRange.end],
      ['Склад', warehouseName],
      ['Строк в отчёте', String(rows.length)],
      ['Общее количество', formatCount(totalQuantity)],
      ['Сумма периода', reportType === 'returns' ? formatCount(totalQuantity) : toFixedNumber(totalValue)],
    ];
  };

  const exportToExcel = async () => {
    const XLSX = await import('xlsx');
    const { detailHeaders, detailRows } = buildReportRows(reportData);
    const warehouseName =
      warehouses.find((warehouse) => String(warehouse.id) === selectedWarehouseId)?.name || 'Все склады';
    const workbook = XLSX.utils.book_new();

    const overallRows: unknown[][] = [
      ...buildSummaryRows(reportData, warehouseName),
      [],
      detailHeaders,
      ...detailRows,
    ];

    if (reportType === 'profit' && productProfitData.length) {
      overallRows.push(
        [],
        ['Прибыль по товарам'],
        ['Товар', 'Количество', 'Чистая выручка', 'Прибыль'],
        ...productProfitData.map((row) => [
          row.name,
          formatCount(row.quantity),
          toFixedNumber(row.revenue),
          toFixedNumber(row.profit),
        ])
      );
    }

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(overallRows),
      normalizeSheetName('Общий отчёт')
    );

    const groupedByWarehouse = reportData.reduce((acc, row) => {
      const key = row.warehouse_name || 'Без склада';
      if (!acc.has(key)) {
        acc.set(key, []);
      }
      acc.get(key)!.push(row);
      return acc;
    }, new Map<string, ReportRow[]>());

    groupedByWarehouse.forEach((rows, name) => {
      const { detailRows: warehouseDetailRows } = buildReportRows(rows);
      const sheetRows: unknown[][] = [
        ...buildSummaryRows(rows, name),
        [],
        detailHeaders,
        ...warehouseDetailRows,
      ];

      if (reportType === 'profit' && productProfitData.length) {
        const warehouseProfitData = rows
          .reduce((acc: Array<{ name: string; quantity: number; revenue: number; profit: number }>, row) => {
            const existing = acc.find((item) => item.name === row.product_name);
            const quantity = Number(row.quantity || 0);
            const revenue = Number(row.net_sales || 0);
            const profit = Number(row.profit || 0);

            if (existing) {
              existing.quantity += quantity;
              existing.revenue += revenue;
              existing.profit += profit;
            } else {
              acc.push({ name: formatProductName(row.product_name), quantity, revenue, profit });
            }

            return acc;
          }, [])
          .sort((a, b) => b.profit - a.profit);

        if (warehouseProfitData.length) {
          sheetRows.push(
            [],
            ['Прибыль по товарам'],
            ['Товар', 'Количество', 'Чистая выручка', 'Прибыль'],
            ...warehouseProfitData.map((row) => [
              row.name,
              formatCount(row.quantity),
              toFixedNumber(row.revenue),
              toFixedNumber(row.profit),
            ])
          );
        }
      }

      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(sheetRows),
        normalizeSheetName(name)
      );
    });

    XLSX.writeFile(workbook, `otchet_${reportType}_${dateRange.start}_${dateRange.end}.xlsx`);
  };

  return (
    <div className="app-page-shell app-page-pad">
      <div className="mx-auto max-w-7xl space-y-6">
      <section className={`app-surface p-5 ${currentMeta.border}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className={`text-sm ${currentMeta.text}`}>Аналитика</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Отчёты</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-500">{currentMeta.description}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={exportToExcel}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white transition-colors hover:bg-slate-800"
            >
              <FileSpreadsheet size={16} />
              <span>Excel</span>
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
                readOnly
                className="bg-transparent text-sm text-slate-700 outline-none"
              />
              <span className="text-slate-300">→</span>
              <input
                type="date"
                value={dateRange.end}
                readOnly
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

      <React.Suspense
        fallback={
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
            <div className="h-[392px] rounded-3xl border border-slate-200 bg-white shadow-sm" />
            <div className="h-[392px] rounded-3xl border border-slate-200 bg-white shadow-sm" />
          </section>
        }
      >
        <ReportsCharts
          chartData={chartData}
          pieData={pieData}
          reportType={reportType}
          currentMeta={currentMeta}
          pieColors={PIE_COLORS}
          panel={Panel}
        />
      </React.Suspense>

      {reportType === 'profit' && (
        <Panel title="Прибыль по товарам">
          <div className="max-h-[420px] overflow-auto -mx-5">
            <table className="min-w-[720px] w-full text-left">
              <thead className="bg-slate-50 text-sm text-slate-500">
                <tr>
                  <th className="px-5 py-3">Товар</th>
                  <th className="px-5 py-3">Количество</th>
                  <th className="px-5 py-3">Чистая выручка</th>
                  <th className="px-5 py-3">Прибыль</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productProfitData.map((row) => (
                  <tr key={row.name} className="text-sm text-slate-700">
                    <td className="px-5 py-4 text-slate-900">{row.name}</td>
                    <td className="px-5 py-4">{formatCount(row.quantity)}</td>
                    <td className="px-5 py-4">{formatMoney(row.revenue)}</td>
                    <td className="px-5 py-4 text-emerald-700">{formatMoney(row.profit)}</td>
                  </tr>
                ))}

                {!productProfitData.length && (
                  <tr>
                    <td colSpan={4} className="px-5 py-16 text-center text-sm text-slate-400">
                      Нет данных о прибыли по товарам
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel
        title="Детализация"
        headerActions={
          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
            >
              Excel
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
                  <td className="px-5 py-4 text-slate-900">{formatProductName(row.product_name)}</td>
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
    </div>
  );
}

