import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, BarChart3, Calendar, DollarSign, FileSpreadsheet, FileText, Package, RotateCcw, Search, ShoppingBag, Target, Trash2, TrendingUp, Warehouse, X } from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../api/client';
import { deleteWriteOffTransactionPermanently, returnWriteOffTransaction } from '../api/products.api';
import { getWarehouses } from '../api/warehouses.api';
import { formatCount, formatMoney, formatPercent, toFixedNumber } from '../utils/format';
import { formatProductName } from '../utils/productName';
import { getCurrentUser } from '../utils/userAccess';
import ChartSkeleton from '../components/charts/ChartSkeleton';
import PaginationControls from '../components/common/PaginationControls';

const ReportsCharts = React.lazy(() => import('../components/charts/ReportsCharts'));

interface ReportsViewProps {
  warehouseId?: number | null;
}

type ReportType = 'sales' | 'profit' | 'returns' | 'writeoffs';

type ReportRow = {
  date: string;
  transaction_id?: number;
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
  returned_qty?: number;
  can_return?: boolean;
  can_delete?: boolean;
  status?: 'writeoff' | 'partial_return' | 'full_return';
};

type ProductProfitInsight = {
  name: string;
  quantity: number;
  revenue: number;
  profit: number;
  margin: number;
  profitPerUnit: number;
  revenuePerUnit: number;
  quantityShare: number;
  profitShare: number;
  efficiencyScore: number;
  inefficiencyReason: string | null;
};

type ProductSalesSummaryRow = {
  name: string;
  quantity: number;
  salesCount: number;
  costTotal: number;
  revenue: number;
  profit: number;
};

const PIE_COLORS = ['#5b8def', '#7c6cf2', '#f3cb5d', '#5ec98f', '#ef6fae'];

function normalizeDisplayBaseUnit(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'шт';
  if (['пачка', 'пачки', 'пачек', 'шт', 'штук', 'штука', 'штуки', 'pcs', 'piece', 'pieces'].includes(normalized)) {
    return 'шт';
  }
  return normalized;
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

function getPresetRange(preset: 'currentMonth' | 'prevMonth' | 'quarter' | 'year') {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (preset === 'currentMonth') {
    return getMonthRange(year, month);
  }
  if (preset === 'prevMonth') {
    return getMonthRange(year, month - 1);
  }
  if (preset === 'quarter') {
    const quarterMonth = Math.floor(month / 3) * 3;
    const start = new Date(year, quarterMonth, 1);
    const end = new Date(year, quarterMonth + 3, 0);
    return {
      start: formatDateInputValue(start),
      end: formatDateInputValue(end),
    };
  }
  if (preset === 'year') {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    return {
      start: formatDateInputValue(start),
      end: formatDateInputValue(end),
    };
  }
  return getMonthRange(year, month);
}

function getReportMonthKey(startDate: string) {
  return startDate.slice(0, 7);
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
  writeoffs: {
    title: 'Списания',
    description: 'Складские списания по товарам, причинам и сотрудникам за выбранный период.',
    chartTitle: 'Списания по датам',
    pieTitle: 'Топ списываемых товаров',
    accent: '#f59e0b',
    soft: 'bg-amber-50',
    border: 'border-amber-100',
    badge: 'bg-amber-100',
    text: 'text-amber-700',
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
    <section className={`overflow-hidden rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-xs ${className}`.trim()}>
      {title && (
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
          {headerActions}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}

export default function ReportsView({ warehouseId: initialWarehouseId = null }: ReportsViewProps) {
  const detailPageSize = 15;
  const today = new Date();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reportType, setReportType] = useState<ReportType>(() => {
    const requestedType = String(searchParams.get('type') || '').trim().toLowerCase();
    return requestedType === 'profit' || requestedType === 'returns' || requestedType === 'writeoffs'
      ? (requestedType as ReportType)
      : 'sales';
  });
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(initialWarehouseId?.toString() || '');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState(() => getMonthRange(today.getFullYear(), today.getMonth()));
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [detailPage, setDetailPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [isExcelExporting, setIsExcelExporting] = useState(false);
  const [returnWriteoffRow, setReturnWriteoffRow] = useState<ReportRow | null>(null);
  const [returnWriteoffQuantity, setReturnWriteoffQuantity] = useState('1');
  const [returnWriteoffReason, setReturnWriteoffReason] = useState('ошибка ввода');
  const [deleteWriteoffRow, setDeleteWriteoffRow] = useState<ReportRow | null>(null);
  const [isSubmittingWriteoffAction, setIsSubmittingWriteoffAction] = useState(false);

  const [summarySearchTerm, setSummarySearchTerm] = useState('');
  const [detailSearchTerm, setDetailSearchTerm] = useState('');

  const user = React.useMemo(() => getCurrentUser(), []);
  const isAdmin = user.role === 'admin' || user.role === 'ADMIN' || user.role === 'MANAGER';
  const currentMeta = reportMeta[reportType];

  const filteredReportData = useMemo(() => {
    if (!detailSearchTerm.trim()) {
      return reportData;
    }
    const term = detailSearchTerm.trim().toLowerCase();
    return reportData.filter((row) =>
      String(row.product_name || '').toLowerCase().includes(term) ||
      String(row.customer_name || '').toLowerCase().includes(term) ||
      String(row.staff_name || '').toLowerCase().includes(term) ||
      String(row.warehouse_name || '').toLowerCase().includes(term) ||
      String(row.reason || '').toLowerCase().includes(term)
    );
  }, [detailSearchTerm, reportData]);

  const detailTotalPages = Math.max(1, Math.ceil(filteredReportData.length / detailPageSize));
  const paginatedDetailRows = filteredReportData.slice((detailPage - 1) * detailPageSize, detailPage * detailPageSize);
  const selectedWarehouseName =
    warehouses.find((warehouse) => String(warehouse.id) === selectedWarehouseId)?.name || 'Все склады';

  const loadReport = async () => {
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

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const data = await getWarehouses();
        const items = Array.isArray(data) ? data : [];
        setWarehouses(items);
        if (items.length === 1 && !selectedWarehouseId) {
          setSelectedWarehouseId(String(items[0].id));
        }
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

    void loadReport();
  }, [dateRange, isAdmin, reportType, selectedWarehouseId]);

  useEffect(() => {
    const requestedType = String(searchParams.get('type') || '').trim().toLowerCase();
    if (!requestedType) {
      return;
    }

    if (
      (requestedType === 'sales' || requestedType === 'profit' || requestedType === 'returns' || requestedType === 'writeoffs') &&
      !(requestedType === 'profit' && !isAdmin)
    ) {
      setReportType(requestedType as ReportType);
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('type');
    setSearchParams(nextParams, { replace: true });
  }, [isAdmin, searchParams, setSearchParams]);

  useEffect(() => {
    setDetailPage(1);
  }, [dateRange, reportType, selectedWarehouseId]);

  useEffect(() => {
    if (detailPage > detailTotalPages) {
      setDetailPage(detailTotalPages);
    }
  }, [detailPage, detailTotalPages]);

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
            : reportType === 'returns'
              ? Number(row.quantity || 0)
              : Number(row.total_value || 0);

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
              : reportType === 'returns'
                ? Number(row.quantity || 0)
                : Number(row.total_value || 0);

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

      if (reportType === 'writeoffs') {
        return sum + Number(row.total_value || 0);
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
      label: reportType === 'returns' ? 'Объем возвратов' : reportType === 'profit' ? 'Общая прибыль' : reportType === 'writeoffs' ? 'Сумма списаний' : 'Сумма продаж',
      value: reportType === 'returns' ? formatCount(summary.totalQuantity) : formatMoney(summary.totalValue),
      subtext: reportType === 'returns' ? 'вернулось единиц товара' : `${summary.totalQuantity} шт обработано`,
      badgeText: currentMeta.title,
      badgeStyle: `${currentMeta.badge} ${currentMeta.text}`,
      iconBg: currentMeta.badge,
      iconColor: currentMeta.text,
      icon: reportType === 'profit' ? TrendingUp : reportType === 'returns' ? RotateCcw : reportType === 'writeoffs' ? Trash2 : ShoppingBag,
    },
    {
      label: 'Общий объём',
      value: `${formatCount(summary.totalQuantity)} шт`,
      subtext: 'кол-во товаров за период',
      badgeText: 'Единиц',
      badgeStyle: 'bg-sky-100 text-sky-700',
      iconBg: 'bg-sky-100',
      iconColor: 'text-sky-600',
      icon: Package,
    },
    {
      label: 'Записей в отчёте',
      value: formatCount(summary.rows),
      subtext: 'строк в детализации',
      badgeText: 'Позиций',
      badgeStyle: 'bg-indigo-100 text-indigo-700',
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
      icon: FileText,
    },
    {
      label: 'Фильтр склада',
      value: selectedWarehouseName,
      subtext: `${dateRange.start} → ${dateRange.end}`,
      badgeText: dateRange.start.slice(0, 7),
      badgeStyle: 'bg-slate-100 text-slate-700',
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-600',
      icon: Warehouse,
    },
  ];

  const getWriteoffStatusLabel = (status?: ReportRow['status']) => {
    if (status === 'partial_return') return 'Частично возвращено';
    if (status === 'full_return') return 'Полностью возвращено';
    return 'Списание';
  };

  const getWriteoffStatusClassName = (status?: ReportRow['status']) =>
    status === 'partial_return'
      ? 'bg-amber-50 text-amber-700'
      : status === 'full_return'
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-rose-50 text-rose-700';

  const openReturnWriteoffModal = (row: ReportRow) => {
    const availableQuantity = Math.max(0, Number(row.quantity || 0) - Number(row.returned_qty || 0));
    setReturnWriteoffRow(row);
    setReturnWriteoffQuantity(String(availableQuantity > 0 ? availableQuantity : 1));
    setReturnWriteoffReason('ошибка ввода');
  };

  const closeReturnWriteoffModal = () => {
    setReturnWriteoffRow(null);
    setReturnWriteoffQuantity('1');
    setReturnWriteoffReason('ошибка ввода');
  };

  const submitReturnWriteoffFromReport = async () => {
    if (!returnWriteoffRow) {
      return;
    }

    const transactionId = Number(returnWriteoffRow.transaction_id || 0);
    const availableQuantity = Math.max(0, Number(returnWriteoffRow.quantity || 0) - Number(returnWriteoffRow.returned_qty || 0));
    const quantity = Number(returnWriteoffQuantity || 0);

    if (!transactionId) {
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > availableQuantity) {
      toast.error(`Введите корректное количество от 1 до ${availableQuantity}`);
      return;
    }

    try {
      setIsSubmittingWriteoffAction(true);
      await returnWriteOffTransaction(transactionId, {
        quantity,
        reason: String(returnWriteoffReason || '').trim() || 'ошибка ввода',
      });
      setReportData((prev) =>
        prev.flatMap((row) => {
          if (Number(row.transaction_id || 0) !== transactionId) {
            return [row];
          }

          const nextReturnedQty = Number(row.returned_qty || 0) + quantity;
          const originalQty = Number(row.quantity || 0);

          if (nextReturnedQty >= originalQty) {
            return [];
          }

          return [{
            ...row,
            returned_qty: nextReturnedQty,
            can_return: nextReturnedQty < originalQty,
            can_delete: false,
            status: 'partial_return' as const,
          }];
        })
      );
      await loadReport();
      closeReturnWriteoffModal();
      toast.success('Списание возвращено на склад');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Не удалось вернуть списание');
    } finally {
      setIsSubmittingWriteoffAction(false);
    }
  };

  const openDeleteWriteoffModal = (row: ReportRow) => {
    setDeleteWriteoffRow(row);
  };

  const closeDeleteWriteoffModal = () => {
    setDeleteWriteoffRow(null);
  };

  const submitDeleteWriteoffFromReport = async () => {
    const transactionId = Number(deleteWriteoffRow?.transaction_id || 0);
    if (!transactionId) {
      return;
    }

    try {
      setIsSubmittingWriteoffAction(true);
      await deleteWriteOffTransactionPermanently(transactionId);
      setReportData((prev) => prev.filter((row) => Number(row.transaction_id || 0) !== transactionId));
      await loadReport();
      closeDeleteWriteoffModal();
      toast.success('Списание удалено навсегда');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Не удалось удалить списание');
    } finally {
      setIsSubmittingWriteoffAction(false);
    }
  };

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
  const productProfitAnalytics = useMemo(() => {
    if (reportType !== 'profit' || !productProfitData.length) {
      return null;
    }

    const totalQuantity = productProfitData.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const totalRevenue = productProfitData.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
    const totalProfit = productProfitData.reduce((sum, row) => sum + Number(row.profit || 0), 0);
    const averageQuantity = totalQuantity / Math.max(productProfitData.length, 1);
    const averageRevenue = totalRevenue / Math.max(productProfitData.length, 1);
    const averageProfit = totalProfit / Math.max(productProfitData.length, 1);

    const insights = productProfitData.map<ProductProfitInsight>((row) => {
      const quantity = Number(row.quantity || 0);
      const revenue = Number(row.revenue || 0);
      const profit = Number(row.profit || 0);
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      const profitPerUnit = quantity > 0 ? profit / quantity : 0;
      const revenuePerUnit = quantity > 0 ? revenue / quantity : 0;
      const quantityShare = totalQuantity > 0 ? (quantity / totalQuantity) * 100 : 0;
      const profitShare = totalProfit > 0 ? (profit / totalProfit) * 100 : 0;
      const normalizedMargin = Math.max(0, Math.min(margin, 100));
      const efficiencyScore = quantityShare * 0.35 + Math.max(0, profitShare) * 0.45 + normalizedMargin * 0.2;

      let inefficiencyReason: string | null = null;
      if (profit <= 0) {
        inefficiencyReason = 'Убыточный товар: продажи есть, но прибыль не формируется.';
      } else if (margin < 8 && quantity >= averageQuantity) {
        inefficiencyReason = 'Продаётся часто, но маржа слишком низкая для такого оборота.';
      } else if (quantityShare > profitShare * 1.8 && quantity >= averageQuantity) {
        inefficiencyReason = 'Объём продаж высокий, но вклад в прибыль заметно ниже доли продаж.';
      } else if (revenue >= averageRevenue && profit < averageProfit * 0.5) {
        inefficiencyReason = 'Выручка нормальная, но чистый доход остаётся слабым.';
      }

      return {
        name: row.name,
        quantity,
        revenue,
        profit,
        margin,
        profitPerUnit,
        revenuePerUnit,
        quantityShare,
        profitShare,
        efficiencyScore,
        inefficiencyReason,
      };
    });

    const topByQuantity = [...insights].sort((a, b) => b.quantity - a.quantity).slice(0, 8);
    const topByProfit = [...insights].sort((a, b) => b.profit - a.profit).slice(0, 8);
    const topByMargin = [...insights]
      .filter((row) => row.revenue > 0 && row.profit > 0)
      .sort((a, b) => {
        if (b.margin === a.margin) {
          return b.profit - a.profit;
        }
        return b.margin - a.margin;
      })
      .slice(0, 8);
    const topByEfficiency = [...insights].sort((a, b) => b.efficiencyScore - a.efficiencyScore).slice(0, 8);
    const inefficient = [...insights]
      .filter((row) => row.inefficiencyReason)
      .sort((a, b) => {
        if (a.profit <= 0 && b.profit > 0) return -1;
        if (b.profit <= 0 && a.profit > 0) return 1;
        return a.margin - b.margin;
      })
      .slice(0, 8);

    const weightedMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const demandLeader = topByQuantity[0] || null;
    const profitLeader = topByProfit[0] || null;
    const marginLeader = topByMargin[0] || null;

    return {
      totalQuantity,
      totalRevenue,
      totalProfit,
      weightedMargin,
      averageQuantity,
      averageRevenue,
      averageProfit,
      demandLeader,
      profitLeader,
      marginLeader,
      topByQuantity,
      topByProfit,
      topByMargin,
      topByEfficiency,
      inefficient,
    };
  }, [productProfitData, reportType]);
  const writeoffAnalytics = useMemo(() => {
    if (reportType !== 'writeoffs' || !reportData.length) {
      return null;
    }

    const totalQuantity = reportData.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const totalValue = reportData.reduce((sum, row) => sum + Number(row.total_value || 0), 0);

    const aggregateRows = (getKey: (row: ReportRow) => string, getLabel?: (row: ReportRow) => string) =>
      reportData
        .reduce((acc: Array<{ name: string; quantity: number; value: number; count: number }>, row) => {
          const key = getKey(row);
          const existing = acc.find((item) => item.name === key);
          const quantity = Number(row.quantity || 0);
          const value = Number(row.total_value || 0);

          if (existing) {
            existing.quantity += quantity;
            existing.value += value;
            existing.count += 1;
          } else {
            acc.push({
              name: getLabel ? getLabel(row) : key,
              quantity,
              value,
              count: 1,
            });
          }

          return acc;
        }, [])
        .sort((a, b) => b.value - a.value);

    const topProducts = aggregateRows(
      (row) => formatProductName(row.product_name),
      (row) => formatProductName(row.product_name),
    ).slice(0, 10);
    const topReasons = aggregateRows(
      (row) => String(row.reason || 'Без причины').trim() || 'Без причины',
    ).slice(0, 10);
    const topStaff = aggregateRows(
      (row) => String(row.staff_name || 'Не указан').trim() || 'Не указан',
    ).slice(0, 10);
    const topWarehouses = aggregateRows(
      (row) => String(row.warehouse_name || 'Без склада').trim() || 'Без склада',
    ).slice(0, 10);

    return {
      totalQuantity,
      totalValue,
      topProducts,
      topReasons,
      topStaff,
      topWarehouses,
      mainProduct: topProducts[0] || null,
      mainReason: topReasons[0] || null,
      mainStaff: topStaff[0] || null,
      mainWarehouse: topWarehouses[0] || null,
    };
  }, [reportData, reportType]);

  const buildReportRows = (rows: ReportRow[]) => {
    const detailHeaders =
      reportType === 'sales'
        ? ['Дата', 'Накладная', 'Склад', 'Клиент', 'Товар', 'Ед.', 'Кол-во', 'Себестоимость за 1 шт', 'Цена продажи за 1 шт', 'Прибыль за 1 шт', 'Выручка', 'Общая прибыль']
        : reportType === 'profit'
          ? ['Дата', 'Накладная', 'Склад', 'Клиент', 'Товар', 'Ед.', 'Кол-во', 'Себестоимость за 1 шт', 'Цена продажи за 1 шт', 'Прибыль за 1 шт', 'Чистая выручка', 'Общая прибыль']
          : reportType === 'returns'
            ? ['Дата', 'Возврат', 'Склад', 'Сотрудник', 'Товар', 'Ед.', 'Кол-во', 'Цена продажи', 'Сумма возврата', 'Причина']
            : ['Дата', 'Склад', 'Сотрудник', 'Товар', 'Ед.', 'Кол-во', 'Себестоимость', 'Сумма списания', 'Причина'];

    const detailRows = rows.map((row) => {
      if (reportType === 'sales') {
        const quantity = Number(row.quantity || 0);
        const totalProfit = Number(row.profit || 0);
        const profitPerUnit = quantity > 0 ? totalProfit / quantity : 0;

        return [
          new Date(row.date).toLocaleDateString('ru-RU'),
          row.invoice_id ? '#' + row.invoice_id : '',
          row.warehouse_name || '',
          row.customer_name || '',
          formatProductName(row.product_name),
          normalizeDisplayBaseUnit(row.unit),
          formatCount(row.quantity),
          toFixedNumber(row.cost_price || 0),
          toFixedNumber(row.selling_price || 0),
          toFixedNumber(profitPerUnit),
          toFixedNumber(row.total_sales || 0),
          toFixedNumber(totalProfit),
        ];
      }

      if (reportType === 'profit') {
        const quantity = Number(row.quantity || 0);
        const totalProfit = Number(row.profit || 0);
        const profitPerUnit = quantity > 0 ? totalProfit / quantity : 0;

        return [
          new Date(row.date).toLocaleDateString('ru-RU'),
          row.invoice_id ? '#' + row.invoice_id : '',
          row.warehouse_name || '',
          row.customer_name || '',
          formatProductName(row.product_name),
          normalizeDisplayBaseUnit(row.unit),
          formatCount(row.quantity),
          toFixedNumber(row.cost_price || 0),
          toFixedNumber(row.selling_price || 0),
          toFixedNumber(profitPerUnit),
          toFixedNumber(row.net_sales || 0),
          toFixedNumber(totalProfit),
        ];
      }

      if (reportType === 'writeoffs') {
        return [
          new Date(row.date).toLocaleDateString('ru-RU'),
          row.warehouse_name || '',
          row.staff_name || '',
          formatProductName(row.product_name),
          normalizeDisplayBaseUnit(row.unit),
          formatCount(row.quantity),
          toFixedNumber(row.cost_price || 0),
          toFixedNumber(row.total_value || 0),
          row.reason || '',
        ];
      }

      return [
        new Date(row.date).toLocaleDateString('ru-RU'),
        row.return_id ? '#' + row.return_id : '',
        row.warehouse_name || '',
        row.staff_name || '',
        formatProductName(row.product_name),
        normalizeDisplayBaseUnit(row.unit),
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

      if (reportType === 'writeoffs') {
        return sum + Number(row.total_value || 0);
      }

      return sum + Number(row.quantity || 0);
    }, 0);
    const totalProfit = rows.reduce((sum, row) => sum + Number(row.profit || 0), 0);

    const baseRows = [
      ['Отчёт', currentMeta.title],
      ['Период с', dateRange.start],
      ['Период по', dateRange.end],
      ['Склад', warehouseName],
      ['Строк в отчёте', String(rows.length)],
      ['Общее количество', formatCount(totalQuantity)],
      ['Сумма периода', reportType === 'returns' ? formatCount(totalQuantity) : toFixedNumber(totalValue)],
    ];

    if (reportType === 'sales' || reportType === 'profit') {
      baseRows.push(['Общая прибыль', toFixedNumber(totalProfit)]);
    }

    return baseRows;
  };

  const buildDetailTotalRow = (rows: ReportRow[]) => {
    const totalRevenue = rows.reduce((sum, row) => {
      if (reportType === 'sales') {
        return sum + Number(row.total_sales || 0);
      }

      if (reportType === 'profit') {
        return sum + Number(row.net_sales || 0);
      }

      return sum + Number(row.total_value || 0);
    }, 0);
    const totalProfit = rows.reduce((sum, row) => sum + Number(row.profit || 0), 0);

    if (reportType === 'sales' || reportType === 'profit') {
      return [
        'ИТОГО',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        toFixedNumber(totalRevenue),
        toFixedNumber(totalProfit),
      ];
    }

    if (reportType === 'writeoffs') {
      return [
        'ИТОГО',
        '',
        '',
        '',
        '',
        '',
        '',
        toFixedNumber(totalRevenue),
        '',
      ];
    }

    return [
      'ИТОГО',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      toFixedNumber(totalRevenue),
      '',
    ];
  };

  const buildProductSalesSummaryData = (rows: ReportRow[]) =>
    rows
      .reduce((acc: ProductSalesSummaryRow[], row) => {
        const name = formatProductName(row.product_name);
        const existing = acc.find((item) => item.name === name);
        const quantity = Number(row.quantity || 0);
        const costTotal = Number(row.cost_price || 0) * quantity;
        const revenue = reportType === 'profit' ? Number(row.net_sales || 0) : Number(row.total_sales || row.net_sales || 0);
        const profit = Number(row.profit || 0);

        if (existing) {
          existing.quantity += quantity;
          existing.salesCount += 1;
          existing.costTotal += costTotal;
          existing.revenue += revenue;
          existing.profit += profit;
        } else {
          acc.push({
            name,
            quantity,
            salesCount: 1,
            costTotal,
            revenue,
            profit,
          });
        }

        return acc;
      }, [])
      .sort((a, b) => b.revenue - a.revenue);

  const buildProductSalesSummaryRows = (rows: ProductSalesSummaryRow[]): Array<Array<string | number>> => {
    const totalQuantity = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const totalSalesCount = rows.reduce((sum, row) => sum + Number(row.salesCount || 0), 0);
    const totalCost = rows.reduce((sum, row) => sum + Number(row.costTotal || 0), 0);
    const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
    const totalProfit = rows.reduce((sum, row) => sum + Number(row.profit || 0), 0);
    const averageCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;
    const averagePrice = totalQuantity > 0 ? totalRevenue / totalQuantity : 0;
    const averageProfit = totalQuantity > 0 ? totalProfit / totalQuantity : 0;

    return [
      ...rows.map((row) => {
        const quantity = Number(row.quantity || 0);
        return [
          row.name,
          formatCount(quantity),
          formatCount(row.salesCount),
          toFixedNumber(quantity > 0 ? row.costTotal / quantity : 0),
          toFixedNumber(quantity > 0 ? row.revenue / quantity : 0),
          toFixedNumber(quantity > 0 ? row.profit / quantity : 0),
          toFixedNumber(row.revenue),
          toFixedNumber(row.profit),
        ];
      }),
      [
        'ИТОГО',
        formatCount(totalQuantity),
        formatCount(totalSalesCount),
        toFixedNumber(averageCost),
        toFixedNumber(averagePrice),
        toFixedNumber(averageProfit),
        toFixedNumber(totalRevenue),
        toFixedNumber(totalProfit),
      ],
    ];
  };

  const escapeExcelXml = (value: unknown) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const buildExcelCell = (
    value: unknown,
    options: { style?: string; type?: 'String' | 'Number'; mergeAcross?: number } = {},
  ) => {
    const isNumber = options.type === 'Number' || (typeof value === 'number' && Number.isFinite(value));
    const attributes = [
      options.style ? `ss:StyleID="${options.style}"` : '',
      options.mergeAcross ? `ss:MergeAcross="${options.mergeAcross}"` : '',
    ].filter(Boolean).join(' ');

    return `<Cell${attributes ? ` ${attributes}` : ''}><Data ss:Type="${isNumber ? 'Number' : 'String'}">${escapeExcelXml(isNumber ? Number(value || 0) : value)}</Data></Cell>`;
  };

  const buildExcelRow = (
    cells: unknown[],
    options: { style?: string; numericColumns?: number[]; firstCellStyle?: string } = {},
  ) =>
    `<Row>${cells.map((cell, index) => buildExcelCell(cell, {
      style: index === 0 && options.firstCellStyle ? options.firstCellStyle : options.style,
      type: options.numericColumns?.includes(index) ? 'Number' : undefined,
    })).join('')}</Row>`;

  const sanitizeWorksheetName = (name: string) =>
    String(name || 'Лист')
      .replace(/[\\/?*[\]:]/g, ' ')
      .trim()
      .slice(0, 31) || 'Лист';

  const buildExcelWorksheet = (
    name: string,
    rows: string[],
    widths: number[],
    freezeHeader = false,
  ) => `
    <Worksheet ss:Name="${escapeExcelXml(sanitizeWorksheetName(name))}">
      <Table>
        ${widths.map((width) => `<Column ss:Width="${width}"/>`).join('')}
        ${rows.join('')}
      </Table>
      ${freezeHeader ? `
      <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
        <FreezePanes/>
        <FrozenNoSplit/>
        <SplitHorizontal>5</SplitHorizontal>
        <TopRowBottomPane>5</TopRowBottomPane>
        <ActivePane>2</ActivePane>
      </WorksheetOptions>` : ''}
    </Worksheet>`;

  const getExcelMoneyFormatStyle = (value: number) => value < 0 ? 'MoneyNegative' : 'Money';

  const buildProductSummaryExcelRows = (rows: ProductSalesSummaryRow[]) => {
    const totalQuantity = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const totalSalesCount = rows.reduce((sum, row) => sum + Number(row.salesCount || 0), 0);
    const totalCost = rows.reduce((sum, row) => sum + Number(row.costTotal || 0), 0);
    const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
    const totalProfit = rows.reduce((sum, row) => sum + Number(row.profit || 0), 0);

    return [
      buildExcelRow(['№', 'Товар', 'Кол-во продано', 'Кол-во продаж', 'Себестоимость за 1 шт', 'Цена продажи за 1 шт', 'Прибыль за 1 шт', 'Сумма себестоимости', 'Сумма продаж', 'Общая прибыль', 'Рентабельность %'], { style: 'Header' }),
      ...rows.map((row, index) => {
        const quantity = Number(row.quantity || 0);
        const costPerUnit = quantity > 0 ? row.costTotal / quantity : 0;
        const salePerUnit = quantity > 0 ? row.revenue / quantity : 0;
        const profitPerUnit = quantity > 0 ? row.profit / quantity : 0;
        const margin = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0;

        return `<Row>
          ${buildExcelCell(index + 1, { type: 'Number', style: 'Center' })}
          ${buildExcelCell(row.name, { style: 'Text' })}
          ${buildExcelCell(quantity, { type: 'Number', style: 'Qty' })}
          ${buildExcelCell(row.salesCount, { type: 'Number', style: 'Qty' })}
          ${buildExcelCell(costPerUnit, { type: 'Number', style: 'Money' })}
          ${buildExcelCell(salePerUnit, { type: 'Number', style: 'Money' })}
          ${buildExcelCell(profitPerUnit, { type: 'Number', style: getExcelMoneyFormatStyle(profitPerUnit) })}
          ${buildExcelCell(row.costTotal, { type: 'Number', style: 'Money' })}
          ${buildExcelCell(row.revenue, { type: 'Number', style: 'Money' })}
          ${buildExcelCell(row.profit, { type: 'Number', style: getExcelMoneyFormatStyle(row.profit) })}
          ${buildExcelCell(margin / 100, { type: 'Number', style: 'Percent' })}
        </Row>`;
      }),
      `<Row>
        ${buildExcelCell('ИТОГО', { style: 'Total', mergeAcross: 1 })}
        ${buildExcelCell(totalQuantity, { type: 'Number', style: 'TotalQty' })}
        ${buildExcelCell(totalSalesCount, { type: 'Number', style: 'TotalQty' })}
        ${buildExcelCell(totalQuantity > 0 ? totalCost / totalQuantity : 0, { type: 'Number', style: 'TotalMoney' })}
        ${buildExcelCell(totalQuantity > 0 ? totalRevenue / totalQuantity : 0, { type: 'Number', style: 'TotalMoney' })}
        ${buildExcelCell(totalQuantity > 0 ? totalProfit / totalQuantity : 0, { type: 'Number', style: 'TotalMoney' })}
        ${buildExcelCell(totalCost, { type: 'Number', style: 'TotalMoney' })}
        ${buildExcelCell(totalRevenue, { type: 'Number', style: 'TotalMoney' })}
        ${buildExcelCell(totalProfit, { type: 'Number', style: 'TotalMoney' })}
        ${buildExcelCell(totalRevenue > 0 ? totalProfit / totalRevenue : 0, { type: 'Number', style: 'TotalPercent' })}
      </Row>`,
    ];
  };

  const buildExcelWorkbookXml = () => {
    const generatedAt = new Date();
    const productSummaryData =
      reportType === 'sales' || reportType === 'profit'
        ? buildProductSalesSummaryData(reportData)
        : [];
    const { detailHeaders, detailRows } = buildReportRows(reportData);
    const totalQuantity = reportData.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const totalRevenue = reportData.reduce((sum, row) => {
      if (reportType === 'profit') return sum + Number(row.net_sales || 0);
      if (reportType === 'sales') return sum + Number(row.total_sales || 0);
      return sum + Number(row.total_value || 0);
    }, 0);
    const totalProfit = reportData.reduce((sum, row) => sum + Number(row.profit || 0), 0);

    const summaryRows = [
      buildExcelRow([`Отчет: ${currentMeta.title}`, '', '', '', '', '', '', '', '', '', ''], { style: 'Title' }),
      buildExcelRow([`Период: ${dateRange.start} - ${dateRange.end}`], { style: 'Subtitle' }),
      buildExcelRow([`Склад: ${selectedWarehouseName}`], { style: 'Subtitle' }),
      buildExcelRow([`Сформировано: ${generatedAt.toLocaleString('ru-RU')}`], { style: 'Subtitle' }),
      buildExcelRow(['']),
      ...(productSummaryData.length
        ? buildProductSummaryExcelRows(productSummaryData)
        : [
            buildExcelRow(['№', ...detailHeaders], { style: 'Header' }),
            ...detailRows.map((row, index) => buildExcelRow([index + 1, ...row], { numericColumns: [0] })),
            buildExcelRow(['ИТОГО', ...buildDetailTotalRow(reportData)], { style: 'Total' }),
          ]),
    ];

    const detailSheetRows = [
      buildExcelRow([`Детализация: ${currentMeta.title}`], { style: 'Title' }),
      buildExcelRow([`Период: ${dateRange.start} - ${dateRange.end}`], { style: 'Subtitle' }),
      buildExcelRow([`Склад: ${selectedWarehouseName}`], { style: 'Subtitle' }),
      buildExcelRow(['']),
      buildExcelRow(['№', ...detailHeaders], { style: 'Header' }),
      ...detailRows.map((row, index) => buildExcelRow([index + 1, ...row], { numericColumns: [0] })),
      buildExcelRow(['ИТОГО', ...buildDetailTotalRow(reportData)], { style: 'Total' }),
    ];

    const totalsRows = [
      buildExcelRow(['Итоги отчета'], { style: 'Title' }),
      buildExcelRow(['Показатель', 'Значение'], { style: 'Header' }),
      buildExcelRow(['Тип отчета', currentMeta.title]),
      buildExcelRow(['Период', `${dateRange.start} - ${dateRange.end}`]),
      buildExcelRow(['Склад', selectedWarehouseName]),
      buildExcelRow(['Строк в отчете', reportData.length], { numericColumns: [1] }),
      buildExcelRow(['Общее количество', totalQuantity], { numericColumns: [1] }),
      buildExcelRow(['Сумма продаж / сумма периода', totalRevenue], { numericColumns: [1] }),
      buildExcelRow(['Общая прибыль', totalProfit], { numericColumns: [1] }),
      buildExcelRow(['Рентабельность', totalRevenue > 0 ? totalProfit / totalRevenue : 0], { numericColumns: [1] }),
    ];

    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style>
    <Style ss:ID="Title"><Font ss:FontName="Arial" ss:Size="16" ss:Bold="1" ss:Color="#0F172A"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Subtitle"><Font ss:FontName="Arial" ss:Size="10" ss:Color="#475569"/></Style>
    <Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1E293B" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Text"><Alignment ss:WrapText="1" ss:Vertical="Center"/></Style>
    <Style ss:ID="Center"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
    <Style ss:ID="Qty"><NumberFormat ss:Format="#,##0.###"/></Style>
    <Style ss:ID="Money"><NumberFormat ss:Format="#,##0.00"/></Style>
    <Style ss:ID="MoneyNegative"><Font ss:Color="#DC2626"/><NumberFormat ss:Format="#,##0.00;[Red](#,##0.00)"/></Style>
    <Style ss:ID="Percent"><NumberFormat ss:Format="0.0%"/></Style>
    <Style ss:ID="Total"><Font ss:Bold="1"/><Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/></Style>
    <Style ss:ID="TotalQty"><Font ss:Bold="1"/><Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.###"/></Style>
    <Style ss:ID="TotalMoney"><Font ss:Bold="1"/><Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00"/></Style>
    <Style ss:ID="TotalPercent"><Font ss:Bold="1"/><Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/><NumberFormat ss:Format="0.0%"/></Style>
  </Styles>
  ${buildExcelWorksheet('Сводка по товарам', summaryRows, [36, 260, 82, 82, 92, 92, 92, 108, 108, 108, 92], true)}
  ${buildExcelWorksheet('Детализация', detailSheetRows, [42, 82, 82, 115, 140, 240, 60, 78, 92, 92, 92, 110, 110], true)}
  ${buildExcelWorksheet('Итоги', totalsRows, [210, 140], false)}
</Workbook>`;
  };

  const exportToPdf = async () => {
    const summaryRows = buildSummaryRows(reportData, selectedWarehouseName);
    const { detailHeaders, detailRows } = buildReportRows(reportData);
    const productSalesSummaryData =
      reportType === 'sales' || reportType === 'profit'
        ? buildProductSalesSummaryData(reportData)
        : [];
    const sections = [{
      title: 'Общий отчёт',
      summaryRows,
      productSummaryHeaders: ['Товар', 'Продано', 'Продаж', 'Себест./шт', 'Цена/шт', 'Прибыль/шт', 'Общая сумма', 'Общая прибыль'],
      productSummaryRows: productSalesSummaryData.length ? buildProductSalesSummaryRows(productSalesSummaryData) : undefined,
      detailHeaders,
      detailRows,
      detailTotalRow: buildDetailTotalRow(reportData),
    }];

    const groupedByWarehouse = reportData.reduce((acc, row) => {
      const key = row.warehouse_name || 'Без склада';
      if (!acc.has(key)) {
        acc.set(key, []);
      }
      acc.get(key)!.push(row);
      return acc;
    }, new Map<string, ReportRow[]>());

    groupedByWarehouse.forEach((rows, name) => {
      const warehouseSummaryRows = buildSummaryRows(rows, name);
      const { detailRows: warehouseDetailRows } = buildReportRows(rows);
      const warehouseProductSummaryData =
        reportType === 'sales' || reportType === 'profit'
          ? buildProductSalesSummaryData(rows)
          : [];

      sections.push({
        title: name,
        summaryRows: warehouseSummaryRows,
        productSummaryHeaders: ['Товар', 'Продано', 'Продаж', 'Себест./шт', 'Цена/шт', 'Прибыль/шт', 'Общая сумма', 'Общая прибыль'],
        productSummaryRows: warehouseProductSummaryData.length ? buildProductSalesSummaryRows(warehouseProductSummaryData) : undefined,
        detailHeaders,
        detailRows: warehouseDetailRows,
        detailTotalRow: buildDetailTotalRow(rows),
      });
    });

    const { downloadReportPdf } = await import('../utils/print/reportPdf');
    await downloadReportPdf({
      reportTitle: `Отчёт: ${currentMeta.title}`,
      reportType: `${reportType}_${getReportMonthKey(dateRange.start)}`,
      dateRangeLabel: `${dateRange.start} - ${dateRange.end}`,
      generatedAt: new Date(),
      sections,
    });
  };

  const handleExportReport = async () => {
    if (!reportData.length) {
      toast.error('Сначала загрузите данные отчёта');
      return;
    }
    try {
      setIsExporting(true);
      await exportToPdf();
    } catch (err) {
      console.error(err);
      toast.error('Не удалось скачать отчёт');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!reportData.length) {
      toast.error('Сначала загрузите данные отчёта');
      return;
    }

    try {
      setIsExcelExporting(true);
      const xml = buildExcelWorkbookXml();
      const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `otchet_${reportType}_${getReportMonthKey(dateRange.start)}.xls`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.error('Не удалось скачать Excel-отчёт');
    } finally {
      setIsExcelExporting(false);
    }
  };

  const productSalesSummaryForView = useMemo(() => {
    const raw = reportType === 'sales' || reportType === 'profit'
      ? buildProductSalesSummaryData(reportData)
      : [];
    if (!summarySearchTerm.trim()) {
      return raw;
    }
    const term = summarySearchTerm.trim().toLowerCase();
    return raw.filter((row) => row.name.toLowerCase().includes(term));
  }, [reportData, reportType, summarySearchTerm]);
  const productSalesSummaryTotals = productSalesSummaryForView.reduce(
    (totals, row) => ({
      quantity: totals.quantity + Number(row.quantity || 0),
      salesCount: totals.salesCount + Number(row.salesCount || 0),
      costTotal: totals.costTotal + Number(row.costTotal || 0),
      revenue: totals.revenue + Number(row.revenue || 0),
      profit: totals.profit + Number(row.profit || 0),
    }),
    { quantity: 0, salesCount: 0, costTotal: 0, revenue: 0, profit: 0 },
  );

  return (
    <div className="app-page-shell min-h-full font-sans">
      <div className="space-y-5 rounded-[28px] bg-[#f4f5fb] p-5 min-h-screen">
        {/* Top Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md shadow-slate-900/10">
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Отчёты и Аналитика</h1>
              <p className="text-xs text-slate-500">{currentMeta.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={isExcelExporting || !reportData.length}
              className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700 shadow-xs transition-all hover:bg-emerald-100 hover:shadow-sm active:scale-98 disabled:opacity-50"
            >
              <FileSpreadsheet size={15} />
              <span>{isExcelExporting ? 'Скачивание...' : 'Экспорт Excel'}</span>
            </button>
            <button
              onClick={handleExportReport}
              disabled={isExporting || !reportData.length}
              className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-slate-800 hover:shadow-sm active:scale-98 disabled:opacity-50"
            >
              <FileText size={15} />
              <span>{isExporting ? 'Скачивание...' : 'Скачать PDF'}</span>
            </button>
          </div>
        </div>

        {/* Report Tabs & Filter Toolbar */}
        <div className="rounded-[28px] border border-slate-200/70 bg-white p-4 shadow-xs space-y-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-slate-200/70 bg-[#f4f5fb] p-1.5 shadow-xs">
              {[
                { key: 'sales', label: 'Продажи', icon: ShoppingBag },
                ...(isAdmin ? [{ key: 'profit', label: 'Прибыль', icon: TrendingUp }] : []),
                { key: 'returns', label: 'Возвраты', icon: RotateCcw },
                { key: 'writeoffs', label: 'Списания', icon: Trash2 },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = reportType === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setReportType(tab.key as ReportType)}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={14} className={isActive ? 'text-sky-300' : 'text-slate-400'} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              {/* Quick Presets */}
              <div className="flex items-center gap-1 rounded-2xl border border-slate-200/70 bg-[#f4f5fb] p-1">
                {[
                  { key: 'currentMonth', label: 'Этот месяц' },
                  { key: 'prevMonth', label: 'Прошлый' },
                  { key: 'quarter', label: 'Квартал' },
                  { key: 'year', label: 'Год' },
                ].map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => setDateRange(getPresetRange(preset.key as any))}
                    className="rounded-xl px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-900 hover:shadow-xs"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {warehouses.length > 1 && (
                <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3.5 py-2">
                  <Warehouse size={14} className="text-slate-400" />
                  <select
                    value={selectedWarehouseId}
                    onChange={(event) => setSelectedWarehouseId(event.target.value)}
                    className="bg-transparent text-xs font-medium text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="">Все склады</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3.5 py-2">
                <Calendar size={14} className="text-slate-400" />
                <input
                  type="month"
                  value={dateRange.start.slice(0, 7)}
                  onChange={handleMonthChange}
                  className="bg-transparent text-xs font-medium text-slate-700 outline-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => {
            const CardIcon = card.icon;
            return (
              <div
                key={card.label}
                className="group rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{card.label}</p>
                    <p className="mt-2 text-xl font-bold tracking-tight text-slate-900 tabular-nums">{card.value}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{card.subtext}</p>
                  </div>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${card.iconBg} ${card.iconColor} transition-transform group-hover:scale-105`}>
                    <CardIcon size={20} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {(reportType === 'sales' || reportType === 'profit') && (
          <Panel
            title="Сводка по товарам"
            headerActions={
              <div className="flex items-center gap-2.5">
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Поиск товара в сводке..."
                    value={summarySearchTerm}
                    onChange={(e) => setSummarySearchTerm(e.target.value)}
                    className="w-48 rounded-full border border-slate-200/70 bg-[#f4f5fb] pl-8 pr-8 py-1.5 text-xs font-medium text-slate-700 outline-none transition-all focus:w-64 focus:border-slate-300 focus:bg-white"
                  />
                  {summarySearchTerm && (
                    <button onClick={() => setSummarySearchTerm('')} className="absolute right-2.5 text-slate-400 hover:text-slate-600">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={isExcelExporting || !reportData.length}
                  className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                >
                  <FileSpreadsheet size={14} />
                  <span>Excel</span>
                </button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-[#f4f5fb] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="rounded-l-2xl py-3 px-3 text-center">№</th>
                    <th className="py-3 px-3">Товар</th>
                    <th className="py-3 px-3 text-right">Продано</th>
                    <th className="py-3 px-3 text-right">Продаж</th>
                    <th className="py-3 px-3 text-right">Себест./шт</th>
                    <th className="py-3 px-3 text-right">Цена/шт</th>
                    <th className="py-3 px-3 text-right">Прибыль/шт</th>
                    <th className="py-3 px-3 text-right">Сумма себест.</th>
                    <th className="py-3 px-3 text-right">Сумма продаж</th>
                    <th className="py-3 px-3 text-right">Общая прибыль</th>
                    <th className="rounded-r-2xl py-3 px-3 text-right">Рентаб.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {productSalesSummaryForView.map((row, index) => {
                    const quantity = Number(row.quantity || 0);
                    const costPerUnit = quantity > 0 ? row.costTotal / quantity : 0;
                    const salePerUnit = quantity > 0 ? row.revenue / quantity : 0;
                    const profitPerUnit = quantity > 0 ? row.profit / quantity : 0;
                    const margin = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0;

                    const marginBadgeClass =
                      margin >= 20
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : margin >= 10
                          ? 'bg-sky-50 text-sky-700 border border-sky-200/60'
                          : margin >= 0
                            ? 'bg-slate-100 text-slate-700 border border-slate-200/60'
                            : 'bg-rose-50 text-rose-700 border border-rose-200/60';

                    return (
                      <tr key={`${row.name}-${index}`} className="transition-colors hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 text-center font-medium text-slate-400">{index + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{row.name}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-900 tabular-nums">{formatCount(quantity)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500 tabular-nums">{formatCount(row.salesCount)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500 tabular-nums">{formatMoney(costPerUnit)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500 tabular-nums">{formatMoney(salePerUnit)}</td>
                        <td className={`py-2.5 px-3 text-right font-semibold tabular-nums ${profitPerUnit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {formatMoney(profitPerUnit)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500 tabular-nums">{formatMoney(row.costTotal)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-900 tabular-nums">{formatMoney(row.revenue)}</td>
                        <td className={`py-2.5 px-3 text-right font-semibold tabular-nums ${row.profit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {formatMoney(row.profit)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${marginBadgeClass}`}>
                            {formatPercent(margin, 1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-amber-50/80 font-bold text-slate-900 border-t-2 border-amber-200/80">
                    <td className="py-3 px-3 text-center rounded-l-2xl" colSpan={2}>ИТОГО</td>
                    <td className="py-3 px-3 text-right tabular-nums">{formatCount(productSalesSummaryTotals.quantity)}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{formatCount(productSalesSummaryTotals.salesCount)}</td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {formatMoney(productSalesSummaryTotals.quantity > 0 ? productSalesSummaryTotals.costTotal / productSalesSummaryTotals.quantity : 0)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {formatMoney(productSalesSummaryTotals.quantity > 0 ? productSalesSummaryTotals.revenue / productSalesSummaryTotals.quantity : 0)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {formatMoney(productSalesSummaryTotals.quantity > 0 ? productSalesSummaryTotals.profit / productSalesSummaryTotals.quantity : 0)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">{formatMoney(productSalesSummaryTotals.costTotal)}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{formatMoney(productSalesSummaryTotals.revenue)}</td>
                    <td className="py-3 px-3 text-right text-emerald-700 tabular-nums">{formatMoney(productSalesSummaryTotals.profit)}</td>
                    <td className="py-3 px-3 text-right rounded-r-2xl tabular-nums">
                      {formatPercent(productSalesSummaryTotals.revenue > 0 ? (productSalesSummaryTotals.profit / productSalesSummaryTotals.revenue) * 100 : 0, 1)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {reportType !== 'writeoffs' && reportType !== 'returns' && (
          <React.Suspense
            fallback={
              <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
                <ChartSkeleton variant="bar" heightClassName="h-[392px]" />
                <ChartSkeleton variant="pie" heightClassName="h-[392px]" />
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
        )}

        <Panel
          title="Детализация транзакций"
          headerActions={
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Поиск по деталям..."
                  value={detailSearchTerm}
                  onChange={(e) => {
                    setDetailSearchTerm(e.target.value);
                    setDetailPage(1);
                  }}
                  className="w-48 rounded-full border border-slate-200/70 bg-[#f4f5fb] pl-8 pr-8 py-1.5 text-xs font-medium text-slate-700 outline-none transition-all focus:w-64 focus:border-slate-300 focus:bg-white"
                />
                {detailSearchTerm && (
                  <button onClick={() => { setDetailSearchTerm(''); setDetailPage(1); }} className="absolute right-2.5 text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>
              <button
                onClick={handleExportReport}
                disabled={isExporting || !reportData.length}
                className="flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                <FileText size={14} />
                <span>PDF</span>
              </button>
            </div>
          }
        >
          <div className="max-h-160 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-[#f4f5fb] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="rounded-l-2xl py-3 px-4">Дата</th>
                  <th className="py-3 px-4">Товар</th>
                  <th className="py-3 px-4">Кол-во</th>
                  {reportType === 'sales' && (
                    <>
                      <th className="py-3 px-4">Цена прод.</th>
                      <th className="py-3 px-4">Итого</th>
                    </>
                  )}
                  {reportType === 'profit' && (
                    <>
                      <th className="py-3 px-4">Цена прод.</th>
                      <th className="py-3 px-4">Себест.</th>
                      <th className="py-3 px-4">Прибыль</th>
                    </>
                  )}
                  {reportType === 'returns' && <th className="py-3 px-4">Причина</th>}
                  {reportType === 'writeoffs' && (
                    <>
                      <th className="py-3 px-4">Сумма</th>
                      <th className="py-3 px-4">Статус</th>
                      <th className="py-3 px-4">Причина</th>
                      <th className="py-3 px-4">Сотрудник</th>
                      <th className="py-3 px-4">Склад</th>
                      <th className="py-3 px-4">Себест.</th>
                      <th className="rounded-r-2xl py-3 px-4 text-right">Действия</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedDetailRows.map((row, index) => (
                  <tr key={`${row.date}-${row.product_name}-${index}`} className="transition-colors hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums">{new Date(row.date).toLocaleDateString('ru-RU')}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{formatProductName(row.product_name)}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-900 tabular-nums">{row.quantity}</td>
                    {reportType === 'sales' && (
                      <>
                        <td className="py-2.5 px-4 text-slate-500 tabular-nums">{toFixedNumber(row.selling_price || 0)}</td>
                        <td className="py-2.5 px-4 font-semibold text-sky-700 tabular-nums">{formatMoney(row.total_sales || 0)}</td>
                      </>
                    )}
                    {reportType === 'profit' && (
                      <>
                        <td className="py-2.5 px-4 text-slate-500 tabular-nums">{toFixedNumber(row.selling_price || 0)}</td>
                        <td className="py-2.5 px-4 text-slate-500 tabular-nums">{toFixedNumber(row.cost_price || 0)}</td>
                        <td className="py-2.5 px-4 font-semibold text-emerald-600 tabular-nums">{formatMoney(row.profit || 0)}</td>
                      </>
                    )}
                    {reportType === 'returns' && <td className="py-2.5 px-4 italic text-rose-600">{row.reason || '-'}</td>}
                    {reportType === 'writeoffs' && (
                      <>
                        <td className="py-2.5 px-4 font-semibold text-amber-700 tabular-nums">{formatMoney(row.total_value || 0)}</td>
                        <td className="py-2.5 px-4">
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getWriteoffStatusClassName(row.status)}`}>
                            {getWriteoffStatusLabel(row.status)}
                          </span>
                          {Number(row.returned_qty || 0) > 0 && (
                            <div className="mt-0.5 text-[10px] font-semibold text-emerald-700">Возвращено: {Number(row.returned_qty || 0)}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 italic text-amber-700">{row.reason || '-'}</td>
                        <td className="py-2.5 px-4 text-slate-500">{row.staff_name || '-'}</td>
                        <td className="py-2.5 px-4 text-slate-500">{row.warehouse_name || '-'}</td>
                        <td className="py-2.5 px-4 text-slate-500 tabular-nums">{toFixedNumber(row.cost_price || 0)}</td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            {row.can_return ? (
                              <button
                                type="button"
                                onClick={() => openReturnWriteoffModal(row)}
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                              >
                                Возврат
                              </button>
                            ) : null}
                            {row.can_delete ? (
                              <button
                                type="button"
                                onClick={() => openDeleteWriteoffModal(row)}
                                className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700 transition-colors hover:bg-rose-100"
                              >
                                Удалить
                              </button>
                            ) : null}
                            {!row.can_return && !row.can_delete ? <span className="text-xs text-slate-300">-</span> : null}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}

                {!filteredReportData.length && (
                  <tr>
                    <td
                      colSpan={reportType === 'profit' ? 6 : reportType === 'sales' ? 5 : reportType === 'returns' ? 4 : 10}
                      className="py-12 text-center text-xs font-medium text-slate-400"
                    >
                      Нет данных за выбранный период
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredReportData.length > detailPageSize && (
            <PaginationControls
              currentPage={detailPage}
              totalPages={detailTotalPages}
              totalItems={filteredReportData.length}
              pageSize={detailPageSize}
              onPageChange={setDetailPage}
              className="border-t-0"
            />
          )}
        </Panel>

        {returnWriteoffRow && (
          <div
            className="fixed inset-0 z-90 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
            onClick={closeReturnWriteoffModal}
          >
            <div
              className="w-full max-w-lg overflow-hidden rounded-[28px] bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-[#f4f5fb] px-6 py-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Возврат списания в склад</h3>
                  <p className="text-xs text-slate-500">{formatProductName(returnWriteoffRow.product_name)}</p>
                </div>
                <button
                  type="button"
                  onClick={closeReturnWriteoffModal}
                  className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4 p-6">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3.5 text-xs font-medium text-emerald-800">
                  Доступно к возврату: {Math.max(0, Number(returnWriteoffRow.quantity || 0) - Number(returnWriteoffRow.returned_qty || 0))}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Количество</label>
                  <input
                    type="number"
                    min="1"
                    value={returnWriteoffQuantity}
                    onChange={(event) => setReturnWriteoffQuantity(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium outline-none transition-colors focus:border-slate-300 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Причина возврата</label>
                  <input
                    type="text"
                    value={returnWriteoffReason}
                    onChange={(event) => setReturnWriteoffReason(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-4 py-2.5 text-xs font-medium outline-none transition-colors focus:border-slate-300 focus:bg-white"
                    placeholder="Напр: ошибка ввода"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={closeReturnWriteoffModal}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => void submitReturnWriteoffFromReport()}
                  disabled={isSubmittingWriteoffAction}
                  className="rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSubmittingWriteoffAction ? 'Сохранение...' : 'Вернуть в склад'}
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteWriteoffRow && (
          <div
            className="fixed inset-0 z-90 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
            onClick={closeDeleteWriteoffModal}
          >
            <div
              className="w-full max-w-lg overflow-hidden rounded-[28px] bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-[#f4f5fb] px-6 py-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Удалить списание</h3>
                  <p className="text-xs text-slate-500">{formatProductName(deleteWriteoffRow.product_name)}</p>
                </div>
                <button
                  type="button"
                  onClick={closeDeleteWriteoffModal}
                  className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3 p-6">
                <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-3.5 text-xs font-medium text-rose-800">
                  Удаление необратимо. Остаток и приход будут восстановлены, но запись списания вернуть потом нельзя.
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-[#f4f5fb] p-3.5 text-xs text-slate-600">
                  Количество: {Number(deleteWriteoffRow.quantity || 0)} • Склад: {deleteWriteoffRow.warehouse_name || '-'}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={closeDeleteWriteoffModal}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => void submitDeleteWriteoffFromReport()}
                  disabled={isSubmittingWriteoffAction}
                  className="rounded-full bg-rose-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-rose-700 disabled:opacity-50"
                >
                  {isSubmittingWriteoffAction ? 'Удаление...' : 'Удалить навсегда'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfitAnalyticsModal({
  isOpen,
  analytics,
  selectedWarehouseName,
  dateRangeLabel,
  inline = false,
}: {
  isOpen: boolean;
  analytics: {
    totalQuantity: number;
    totalRevenue: number;
    totalProfit: number;
    weightedMargin: number;
    demandLeader: ProductProfitInsight | null;
    profitLeader: ProductProfitInsight | null;
    marginLeader: ProductProfitInsight | null;
    topByQuantity: ProductProfitInsight[];
    topByProfit: ProductProfitInsight[];
    topByMargin: ProductProfitInsight[];
    topByEfficiency: ProductProfitInsight[];
    inefficient: ProductProfitInsight[];
  };
  selectedWarehouseName: string;
  dateRangeLabel: string;
  inline?: boolean;
}) {
  const [activeSection, setActiveSection] = useState<
    'leaders' | 'quantity' | 'profit' | 'margin' | 'efficiency' | 'inefficient'
  >('leaders');

  useEffect(() => {
    if (!isOpen || inline) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inline, isOpen]);

  if (!isOpen) {
    return null;
  }

  const content = (
      <div
        className={`flex flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] ${inline ? '' : 'max-h-[92vh] w-full max-w-7xl'}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/90 px-5 py-4 backdrop-blur">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              <TrendingUp size={14} />
              Превью аналитики
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Эффективность товаров по прибыли</h2>
            <p className="text-sm text-slate-500">
              {selectedWarehouseName} · {dateRangeLabel}
            </p>
          </div>
          {!inline && (
            <div className="rounded-2xl p-2 text-slate-400">
              <X size={20} />
            </div>
          )}
        </div>

        <div className="space-y-6 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <section className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-900">Общая информация</h3>
              <p className="text-sm text-slate-500">
                Здесь показана сводка по периоду. Ниже выберите раздел и откройте только ту часть аналитики, которую хотите посмотреть.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <AnalyticsMetricCard
                icon={<BarChart3 size={18} />}
                label="Продано единиц"
                value={formatCount(analytics.totalQuantity)}
                hint="Общий объём проданных товаров за период"
                tone="sky"
              />
              <AnalyticsMetricCard
                icon={<TrendingUp size={18} />}
                label="Чистая выручка"
                value={formatMoney(analytics.totalRevenue)}
                hint="Доход после скидок по выбранному периоду"
                tone="emerald"
              />
              <AnalyticsMetricCard
                icon={<Target size={18} />}
                label="Общая прибыль"
                value={formatMoney(analytics.totalProfit)}
                hint="Итоговая прибыль по всем проданным товарам"
                tone="emerald"
              />
              <AnalyticsMetricCard
                icon={<Target size={18} />}
                label="Средняя рентабельность"
                value={formatPercent(analytics.weightedMargin, 1)}
                hint="Прибыль как доля от чистой выручки"
                tone="violet"
              />
            </div>
          </section>

          <section className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-900">Меню аналитики</h3>
              <p className="text-sm text-slate-500">
                Нажмите на нужный раздел: лидеры, количество продаж, доход, рентабельность, эффективность или слабые товары.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <AnalyticsMenuButton active={activeSection === 'leaders'} onClick={() => setActiveSection('leaders')} label="Лидеры" />
              <AnalyticsMenuButton active={activeSection === 'quantity'} onClick={() => setActiveSection('quantity')} label="По количеству" />
              <AnalyticsMenuButton active={activeSection === 'profit'} onClick={() => setActiveSection('profit')} label="По доходу" />
              <AnalyticsMenuButton active={activeSection === 'margin'} onClick={() => setActiveSection('margin')} label="По рентабельности" />
              <AnalyticsMenuButton active={activeSection === 'efficiency'} onClick={() => setActiveSection('efficiency')} label="По эффективности" />
              <AnalyticsMenuButton active={activeSection === 'inefficient'} onClick={() => setActiveSection('inefficient')} label="Неэффективные" />
            </div>
          </section>

          {activeSection === 'leaders' && (
            <div className="grid gap-3 xl:grid-cols-3">
              <AnalyticsLeaderCard
                title="Чаще всего продаётся"
                description="Лидер по количеству продаж"
                row={analytics.demandLeader}
                tone="sky"
                metricLabel="Доля продаж"
                metricValue={analytics.demandLeader ? formatPercent(analytics.demandLeader.quantityShare, 1) : '-'}
              />
              <AnalyticsLeaderCard
                title="Приносит больше дохода"
                description="Лидер по абсолютной прибыли"
                row={analytics.profitLeader}
                tone="emerald"
                metricLabel="Доля прибыли"
                metricValue={analytics.profitLeader ? formatPercent(analytics.profitLeader.profitShare, 1) : '-'}
              />
              <AnalyticsLeaderCard
                title="Самый рентабельный"
                description="Лидер по рентабельности продаж"
                row={analytics.marginLeader}
                tone="violet"
                metricLabel="Рентабельность"
                metricValue={analytics.marginLeader ? formatPercent(analytics.marginLeader.margin, 1) : '-'}
              />
            </div>
          )}

          {activeSection === 'quantity' && (
            <AnalyticsTableCard
              title="Что продаётся чаще"
              subtitle="Товары с самым высоким количеством продаж"
              rows={analytics.topByQuantity}
              metricLabel="Количество"
              metricValue={(row) => formatCount(row.quantity)}
              tone="sky"
            />
          )}

          {activeSection === 'profit' && (
            <AnalyticsTableCard
              title="Что приносит больше дохода"
              subtitle="Товары с максимальной прибылью"
              rows={analytics.topByProfit}
              metricLabel="Прибыль"
              metricValue={(row) => formatMoney(row.profit)}
              tone="emerald"
            />
          )}

          {activeSection === 'margin' && (
            <AnalyticsTableCard
              title="Рентабельные товары"
              subtitle="Лучшие позиции по маржинальности"
              rows={analytics.topByMargin}
              metricLabel="Рентабельность"
              metricValue={(row) => formatPercent(row.margin, 1)}
              tone="violet"
            />
          )}

          {activeSection === 'efficiency' && (
            <AnalyticsTableCard
              title="Самые эффективные"
              subtitle="Баланс спроса, прибыли и маржи"
              rows={analytics.topByEfficiency}
              metricLabel="Эффективность"
              metricValue={(row) => formatPercent(row.efficiencyScore, 1)}
              tone="slate"
            />
          )}

          {activeSection === 'inefficient' && (
            <section className="overflow-hidden rounded-3xl border border-rose-100 bg-rose-50/70">
              <div className="border-b border-rose-100 px-5 py-4">
                <div className="flex items-center gap-2 text-rose-700">
                  <AlertTriangle size={18} />
                  <h3 className="text-lg font-semibold">Неэффективные товары</h3>
                </div>
                <p className="mt-1 text-sm text-rose-600">
                  Здесь видно товары, которые занимают продажи, но дают слабую прибыль или работают в минус.
                </p>
              </div>

              <div className="space-y-3 p-4 sm:p-5">
                {analytics.inefficient.length ? (
                  analytics.inefficient.map((row) => (
                    <article key={`inefficient-${row.name}`} className="rounded-2xl border border-rose-100 bg-white px-4 py-3 shadow-sm">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">{row.name}</h4>
                          <p className="mt-1 text-sm text-slate-500">{row.inefficiencyReason}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm md:min-w-[320px]">
                          <AnalyticsMiniStat label="Продано" value={formatCount(row.quantity)} />
                          <AnalyticsMiniStat label="Прибыль" value={formatMoney(row.profit)} />
                          <AnalyticsMiniStat label="Рентабельность" value={formatPercent(row.margin, 1)} />
                          <AnalyticsMiniStat label="Прибыль / шт" value={formatMoney(row.profitPerUnit)} />
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-rose-200 bg-white px-4 py-10 text-center text-sm text-rose-500">
                    За выбранный период явных неэффективных товаров не найдено.
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
  );

  if (inline) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-90 flex items-end justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:items-center sm:p-4">
      {content}
    </div>
  );
}

function AnalyticsMenuButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
        active
          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

function WriteoffAnalyticsModal({
  isOpen,
  analytics,
  selectedWarehouseName,
  dateRangeLabel,
  inline = false,
}: {
  isOpen: boolean;
  analytics: {
    totalQuantity: number;
    totalValue: number;
    topProducts: Array<{ name: string; quantity: number; value: number; count: number }>;
    topReasons: Array<{ name: string; quantity: number; value: number; count: number }>;
    topStaff: Array<{ name: string; quantity: number; value: number; count: number }>;
    topWarehouses: Array<{ name: string; quantity: number; value: number; count: number }>;
    mainProduct: { name: string; quantity: number; value: number; count: number } | null;
    mainReason: { name: string; quantity: number; value: number; count: number } | null;
    mainStaff: { name: string; quantity: number; value: number; count: number } | null;
    mainWarehouse: { name: string; quantity: number; value: number; count: number } | null;
  };
  selectedWarehouseName: string;
  dateRangeLabel: string;
  inline?: boolean;
}) {
  const [activeSection, setActiveSection] = useState<'leaders' | 'products' | 'reasons' | 'staff' | 'warehouses'>('leaders');

  useEffect(() => {
    if (!isOpen || inline) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inline, isOpen]);

  if (!isOpen) {
    return null;
  }

  const content = (
      <div
        className={`flex flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] ${inline ? '' : 'max-h-[92vh] w-full max-w-6xl'}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/90 px-5 py-4 backdrop-blur">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              <AlertTriangle size={14} />
              Аналитика списаний
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Разбор списаний</h2>
            <p className="text-sm text-slate-500">
              {selectedWarehouseName} · {dateRangeLabel}
            </p>
          </div>
          {!inline && (
            <div className="rounded-2xl p-2 text-slate-400">
              <X size={20} />
            </div>
          )}
        </div>

        <div className="space-y-6 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <section className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-900">Общая информация</h3>
              <p className="text-sm text-slate-500">
                Сводка по объёму и сумме списаний за выбранный период.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <AnalyticsMetricCard
                icon={<BarChart3 size={18} />}
                label="Списано единиц"
                value={formatCount(analytics.totalQuantity)}
                hint="Общий объём списанного товара"
                tone="sky"
              />
              <AnalyticsMetricCard
                icon={<AlertTriangle size={18} />}
                label="Сумма списания"
                value={formatMoney(analytics.totalValue)}
                hint="Общая стоимость списанных позиций"
                tone="violet"
              />
              <AnalyticsMetricCard
                icon={<Target size={18} />}
                label="Главный товар"
                value={analytics.mainProduct?.name || '-'}
                hint={analytics.mainProduct ? `Списано: ${formatCount(analytics.mainProduct.quantity)}` : 'Нет данных'}
                tone="emerald"
              />
              <AnalyticsMetricCard
                icon={<Target size={18} />}
                label="Главная причина"
                value={analytics.mainReason?.name || '-'}
                hint={analytics.mainReason ? `Операций: ${formatCount(analytics.mainReason.count)}` : 'Нет данных'}
                tone="violet"
              />
            </div>
          </section>

          <section className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-900">Меню аналитики</h3>
              <p className="text-sm text-slate-500">
                Выберите нужный разрез: лидеры, товары, причины, сотрудники или склады.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <AnalyticsMenuButton active={activeSection === 'leaders'} onClick={() => setActiveSection('leaders')} label="Лидеры" />
              <AnalyticsMenuButton active={activeSection === 'products'} onClick={() => setActiveSection('products')} label="Товары" />
              <AnalyticsMenuButton active={activeSection === 'reasons'} onClick={() => setActiveSection('reasons')} label="Причины" />
              <AnalyticsMenuButton active={activeSection === 'staff'} onClick={() => setActiveSection('staff')} label="Сотрудники" />
              <AnalyticsMenuButton active={activeSection === 'warehouses'} onClick={() => setActiveSection('warehouses')} label="Склады" />
            </div>
          </section>

          {activeSection === 'leaders' && (
            <div className="grid gap-3 xl:grid-cols-3">
              <WriteoffLeaderCard
                title="Чаще всего списывают"
                description="Товар с самым большим объёмом списания"
                row={analytics.mainProduct}
              />
              <WriteoffLeaderCard
                title="Основная причина"
                description="Причина, которая даёт самую большую сумму списаний"
                row={analytics.mainReason}
              />
              <WriteoffLeaderCard
                title="Главный источник"
                description="Сотрудник с самой большой суммой списаний"
                row={analytics.mainStaff}
              />
            </div>
          )}

          {activeSection === 'products' && (
            <WriteoffAnalyticsTableCard
              title="Списания по товарам"
              subtitle="Какие товары списываются больше всего"
              rows={analytics.topProducts}
            />
          )}

          {activeSection === 'reasons' && (
            <WriteoffAnalyticsTableCard
              title="Списания по причинам"
              subtitle="Почему чаще всего происходит списание"
              rows={analytics.topReasons}
            />
          )}

          {activeSection === 'staff' && (
            <WriteoffAnalyticsTableCard
              title="Списания по сотрудникам"
              subtitle="Кто чаще оформляет списания"
              rows={analytics.topStaff}
            />
          )}

          {activeSection === 'warehouses' && (
            <WriteoffAnalyticsTableCard
              title="Списания по складам"
              subtitle="На каких складах больше всего потерь"
              rows={analytics.topWarehouses}
            />
          )}
        </div>
      </div>
  );

  if (inline) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-90 flex items-end justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:items-center sm:p-4">
      {content}
    </div>
  );
}

function WriteoffLeaderCard({
  title,
  description,
  row,
}: {
  title: string;
  description: string;
  row: { name: string; quantity: number; value: number; count: number } | null;
}) {
  return (
    <section className="rounded-3xl border border-amber-100 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      {row ? (
        <div className="mt-4 space-y-2">
          <h4 className="text-base font-semibold text-slate-900">{row.name}</h4>
          <div className="grid gap-2 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <span>Количество</span>
              <span className="font-medium text-slate-900">{formatCount(row.quantity)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Сумма</span>
              <span className="font-medium text-slate-900">{formatMoney(row.value)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Операций</span>
              <span className="font-medium text-slate-900">{formatCount(row.count)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
          Нет данных для анализа
        </div>
      )}
    </section>
  );
}

function WriteoffAnalyticsTableCard({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: Array<{ name: string; quantity: number; value: number; count: number }>;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-amber-100 bg-amber-50/60">
      <div className="border-b border-white/70 px-5 py-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      <div className="max-h-90 overflow-auto px-3 py-3 sm:px-4">
        <div className="space-y-2">
          {rows.length ? (
            rows.map((row, index) => (
              <article key={`${title}-${row.name}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/80 bg-white px-3 py-3 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Кол-во: {formatCount(row.quantity)} · Операций: {formatCount(row.count)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Сумма</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatMoney(row.value)}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
              Нет данных для отображения
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AnalyticsMetricCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: 'sky' | 'emerald' | 'violet';
}) {
  const toneClass =
    tone === 'sky'
      ? 'border-sky-100 bg-sky-50 text-sky-700'
      : tone === 'emerald'
        ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
        : 'border-violet-100 bg-violet-50 text-violet-700';

  return (
    <section className={`rounded-3xl border px-4 py-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-2xl bg-white/80 p-2.5 shadow-sm">{icon}</div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{label}</p>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{hint}</p>
    </section>
  );
}

function AnalyticsLeaderCard({
  title,
  description,
  row,
  metricLabel,
  metricValue,
  tone,
}: {
  title: string;
  description: string;
  row: ProductProfitInsight | null;
  metricLabel: string;
  metricValue: string;
  tone: 'sky' | 'emerald' | 'violet';
}) {
  const toneClass =
    tone === 'sky'
      ? 'border-sky-100 bg-sky-50'
      : tone === 'emerald'
        ? 'border-emerald-100 bg-emerald-50'
        : 'border-violet-100 bg-violet-50';

  return (
    <section className={`rounded-3xl border p-4 ${toneClass}`}>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      {row ? (
        <div className="mt-4 space-y-2">
          <h4 className="text-base font-semibold text-slate-900">{row.name}</h4>
          <div className="grid gap-2 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <span>Продано</span>
              <span className="font-medium text-slate-900">{formatCount(row.quantity)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Чистая выручка</span>
              <span className="font-medium text-slate-900">{formatMoney(row.revenue)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>{metricLabel}</span>
              <span className="font-medium text-slate-900">{metricValue}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
          Нет данных для анализа
        </div>
      )}
    </section>
  );
}

function AnalyticsTableCard({
  title,
  subtitle,
  rows,
  metricLabel,
  metricValue,
  tone,
}: {
  title: string;
  subtitle: string;
  rows: ProductProfitInsight[];
  metricLabel: string;
  metricValue: (row: ProductProfitInsight) => string;
  tone: 'sky' | 'emerald' | 'violet' | 'slate';
}) {
  const toneClass =
    tone === 'sky'
      ? 'border-sky-100 bg-sky-50/60'
      : tone === 'emerald'
        ? 'border-emerald-100 bg-emerald-50/60'
        : tone === 'violet'
          ? 'border-violet-100 bg-violet-50/60'
          : 'border-slate-200 bg-slate-50/80';

  return (
    <section className={`overflow-hidden rounded-3xl border ${toneClass}`}>
      <div className="border-b border-white/70 px-5 py-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      <div className="max-h-80 overflow-auto px-3 py-3 sm:px-4">
        <div className="space-y-2">
          {rows.length ? (
            rows.map((row, index) => (
              <article key={`${title}-${row.name}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/80 bg-white px-3 py-3 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Продано: {formatCount(row.quantity)} · Прибыль: {formatMoney(row.profit)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{metricLabel}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{metricValue(row)}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
              Нет данных для отображения
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AnalyticsMiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
