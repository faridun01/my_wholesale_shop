import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card } from '../components/UI';
import client from '../api/client';
import { Download, FileSpreadsheet, FileText, Warehouse } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

interface ReportsViewProps {
  warehouseId?: number | null;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function ReportsView({ warehouseId: initialWarehouseId = null }: ReportsViewProps) {
  const [reportType, setReportType] = useState<'sales' | 'profit' | 'returns'>('sales');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(initialWarehouseId?.toString() || '');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({ 
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });
  const [reportData, setReportData] = useState<{ 
    date: string, 
    product_name: string, 
    quantity: number, 
    selling_price?: number, 
    cost_price?: number, 
    total_sales?: number, 
    profit?: number,
    reason?: string
  }[]>([]);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin' || user.role === 'ADMIN' || user.role === 'MANAGER';

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await client.get('/warehouses');
        setWarehouses(res.data || []);
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
      const query = selectedWarehouseId ? `&warehouse_id=${selectedWarehouseId}` : '';
      try {
        const res = await client.get(`/reports/${reportType}?start=${dateRange.start}&end=${dateRange.end}${query}`);
        setReportData(res.data || []);
      } catch (err) {
        console.error(err);
        toast.error('Ошибка при загрузке отчета');
      }
    };
    fetchReport();
  }, [reportType, dateRange, selectedWarehouseId]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [year, month] = e.target.value.split('-');
    const start = new Date(parseInt(year), parseInt(month) - 1, 1);
    const end = new Date(parseInt(year), parseInt(month), 0);
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });
  };

  const exportToCSV = () => {
    const headers = reportType === 'sales' 
      ? ['Дата', 'Товар', 'Кол-во', 'Цена прод.', 'Итого']
      : reportType === 'profit'
      ? ['Дата', 'Товар', 'Кол-во', 'Цена прод.', 'Себестоимость', 'Прибыль']
      : ['Дата', 'Товар', 'Кол-во', 'Причина'];

    const rows = reportData.map(d => {
      if (reportType === 'sales') return [d.date, d.product_name, d.quantity, d.selling_price, d.total_sales];
      if (reportType === 'profit') return [d.date, d.product_name, d.quantity, d.selling_price, d.cost_price, d.profit];
      return [d.date, d.product_name, d.quantity, d.reason];
    });

    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `report_${reportType}_${dateRange.start}_${dateRange.end}.csv`;
    link.click();
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text(`Отчет: ${reportType === 'sales' ? 'Продажи' : reportType === 'profit' ? 'Прибыль' : 'Возвраты'}`, 14, 15);
    doc.text(`Период: ${dateRange.start} - ${dateRange.end}`, 14, 25);

    const headers = reportType === 'sales' 
      ? [['Дата', 'Товар', 'Кол-во', 'Цена прод.', 'Итого']]
      : reportType === 'profit'
      ? [['Дата', 'Товар', 'Кол-во', 'Цена прод.', 'Себест.', 'Прибыль']]
      : [['Дата', 'Товар', 'Кол-во', 'Причина']];

    const rows = reportData.map(d => {
      if (reportType === 'sales') return [d.date, d.product_name, d.quantity, d.selling_price?.toFixed(2) ?? '0.00', d.total_sales?.toFixed(2) ?? '0.00'];
      if (reportType === 'profit') return [d.date, d.product_name, d.quantity, d.selling_price?.toFixed(2) ?? '0.00', d.cost_price?.toFixed(2) ?? '0.00', d.profit?.toFixed(2) ?? '0.00'];
      return [d.date, d.product_name, d.quantity, d.reason ?? ''];
    });

    autoTable(doc, {
      head: headers,
      body: rows,
      startY: 35,
      theme: 'grid',
      styles: { fontSize: 8 }
    });

    doc.save(`report_${reportType}_${dateRange.start}_${dateRange.end}.pdf`);
  };

  const chartData = reportData.reduce((acc: any, curr) => {
    const existing = acc.find((d: any) => d.date === curr.date);
    const val = reportType === 'sales' ? curr.total_sales || 0 : curr.profit || 0;
    if (existing) {
      existing.value += val;
    } else {
      acc.push({ date: curr.date, value: val });
    }
    return acc;
  }, []);

  const pieData = reportData.reduce((acc: any, curr) => {
    const existing = acc.find((d: any) => d.name === curr.product_name);
    const val = reportType === 'sales' ? curr.total_sales || 0 : curr.profit || 0;
    if (existing) {
      existing.value += val;
    } else {
      acc.push({ name: curr.product_name, value: val });
    }
    return acc;
  }, []).sort((a: any, b: any) => b.value - a.value).slice(0, 5);

  return (
    <div className="space-y-6 max-w-7xl mx-auto relative">
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-indigo-50/50 to-transparent -z-10 pointer-events-none" />
      
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Отчёты</h1>
        <p className="text-slate-500 mt-1 font-medium text-sm">Аналитика продаж, прибыли и возвратов.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
          <button
            onClick={() => setReportType('sales')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${reportType === 'sales' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            Продажи
          </button>
          {isAdmin && (
            <button
              onClick={() => setReportType('profit')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${reportType === 'profit' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              Прибыль
            </button>
          )}
          <button
            onClick={() => setReportType('returns')}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${reportType === 'returns' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            Возвраты
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
            <Warehouse size={16} className="text-slate-400" />
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="text-xs outline-none font-bold text-slate-700 bg-transparent appearance-none"
            >
              <option value="">Все склады</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Месяц:</span>
            <input
              type="month"
              onChange={handleMonthChange}
              className="text-xs outline-none font-bold text-slate-700 bg-transparent"
            />
          </div>
          <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
            <input
              type="date"
              value={dateRange.start}
              onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
              className="text-xs outline-none font-bold text-slate-700 bg-transparent"
            />
            <span className="text-slate-300 font-black">→</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
              className="text-xs outline-none font-bold text-slate-700 bg-transparent"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={reportType === 'sales' ? 'График продаж' : 'График прибыли'} className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }}
                  tickFormatter={(val) => val.split('-').slice(1).join('/')}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }}
                  tickFormatter={(val) => `${val}`}
                />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                  formatter={(val: number) => [`${val.toFixed(2)} TJS`, reportType === 'sales' ? 'Продажи' : 'Прибыль']}
                />
                <Bar 
                  dataKey="value" 
                  fill={reportType === 'sales' ? '#6366f1' : '#10b981'} 
                  radius={[8, 8, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Топ товаров">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {pieData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '10px' }}
                  formatter={(val: number) => [`${val.toFixed(2)} TJS`, 'Сумма']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1.5">
            {pieData.map((d: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-[10px] font-bold">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-slate-600 truncate max-w-[120px]">{d.name}</span>
                </div>
                <span className="text-slate-900">{d.value.toFixed(2)} TJS</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card 
        title="Детализация" 
        headerActions={
          <div className="flex items-center space-x-1.5">
            <button 
              onClick={exportToCSV}
              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
              title="Экспорт в CSV"
            >
              <FileSpreadsheet size={18} />
            </button>
            <button 
              onClick={exportToPDF}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
              title="Экспорт в PDF"
            >
              <FileText size={18} />
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">
                <th className="px-5 py-3">Дата</th>
                <th className="px-5 py-3">Товар</th>
                <th className="px-5 py-3">Кол-во</th>
                {reportType === 'sales' ? (
                  <>
                    <th className="px-5 py-3">Цена прод.</th>
                    <th className="px-5 py-3">Итого</th>
                  </>
                ) : reportType === 'profit' ? (
                  <>
                    <th className="px-5 py-3">Цена прод.</th>
                    <th className="px-5 py-3">Себест.</th>
                    <th className="px-5 py-3">Прибыль</th>
                  </>
                ) : (
                  <>
                    <th className="px-5 py-3">Причина</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reportData.map((d, i) => (
                <tr key={i} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-5 py-3 text-slate-500 font-bold whitespace-nowrap text-xs">{new Date(d.date).toLocaleDateString('ru-RU')}</td>
                  <td className="px-5 py-3 font-black text-slate-900 text-xs">{d.product_name}</td>
                  <td className="px-5 py-3 text-slate-600 font-bold text-xs">{d.quantity}</td>
                  {reportType === 'sales' ? (
                    <>
                      <td className="px-5 py-3 text-slate-600 font-bold text-xs">{d.selling_price?.toFixed(2)}</td>
                      <td className="px-5 py-3 font-black text-slate-900 text-xs">{d.total_sales?.toFixed(2)}</td>
                    </>
                  ) : reportType === 'profit' ? (
                    <>
                      <td className="px-5 py-3 text-slate-600 font-bold text-xs">{d.selling_price?.toFixed(2)}</td>
                      <td className="px-5 py-3 text-slate-400 font-bold text-xs">{d.cost_price?.toFixed(2)}</td>
                      <td className="px-5 py-3 font-black text-emerald-600 text-xs">{d.profit?.toFixed(2)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 py-3 text-slate-500 italic font-bold text-xs">{d.reason}</td>
                    </>
                  )}
                </tr>
              ))}
              {reportData.length === 0 && (
                <tr>
                  <td colSpan={reportType === 'profit' ? 6 : 5} className="px-5 py-10 text-center text-slate-400 font-bold text-xs">Нет данных за выбранный период</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
