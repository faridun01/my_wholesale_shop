import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card } from '../components/UI';

interface ReportsViewProps {
  warehouseId: number | null;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const ReportsView = ({ warehouseId }: ReportsViewProps) => {
  const [reportType, setReportType] = useState<'sales' | 'profit' | 'returns'>('sales');
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

  useEffect(() => {
    const fetchReport = async () => {
      const query = warehouseId ? `&warehouse_id=${warehouseId}` : '';
      const res = await fetch(`/api/reports/${reportType}?start=${dateRange.start}&end=${dateRange.end}${query}`);
      const data = await res.json();
      setReportData(data);
    };
    fetchReport();
  }, [reportType, dateRange, warehouseId]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [year, month] = e.target.value.split('-');
    const start = new Date(parseInt(year), parseInt(month) - 1, 1);
    const end = new Date(parseInt(year), parseInt(month), 0);
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-white p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setReportType('sales')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${reportType === 'sales' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Продажи
          </button>
          <button
            onClick={() => setReportType('profit')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${reportType === 'profit' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Прибыль
          </button>
          <button
            onClick={() => setReportType('returns')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${reportType === 'returns' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Возвраты
          </button>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-xs font-bold text-slate-400 uppercase">Месяц:</span>
            <input
              type="month"
              onChange={handleMonthChange}
              className="text-sm outline-none font-medium text-slate-700"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      <Card title="Детализация">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-3 font-semibold text-slate-600">Дата</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Товар</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Кол-во</th>
                {reportType === 'sales' ? (
                  <>
                    <th className="px-4 py-3 font-semibold text-slate-600">Цена прод.</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Цена зак.</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Итого</th>
                  </>
                ) : reportType === 'profit' ? (
                  <>
                    <th className="px-4 py-3 font-semibold text-slate-600">Прибыль</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 font-semibold text-slate-600">Цена</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Причина</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reportData.map((d, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 text-slate-500">{new Date(d.date).toLocaleDateString('ru-RU')}</td>
                  <td className="px-4 py-4 font-medium text-slate-900">{d.product_name}</td>
                  <td className="px-4 py-4 text-slate-600">{d.quantity}</td>
                  {reportType === 'sales' ? (
                    <>
                      <td className="px-4 py-4 text-sm text-slate-600">{d.selling_price?.toFixed(2)}</td>
                      <td className="px-4 py-4 text-sm text-slate-400">{d.cost_price?.toFixed(2)}</td>
                      <td className="px-4 py-4 text-sm font-bold text-slate-900">{d.total_sales?.toFixed(2)}</td>
                    </>
                  ) : reportType === 'profit' ? (
                    <>
                      <td className="px-4 py-4 text-sm font-bold text-emerald-600">{d.profit?.toFixed(2)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-4 text-sm text-slate-600">{d.selling_price?.toFixed(2)}</td>
                      <td className="px-4 py-4 text-sm text-slate-500 italic">{d.reason}</td>
                    </>
                  )}
                </tr>
              ))}
              {reportData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Нет данных за выбранный период</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={reportType === 'sales' ? 'График продаж' : 'График прибыли'}>
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 h-[300px] min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={(val) => val.split('-').slice(1).join('/')}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={(val) => `${val}`}
                  />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: number) => [`${val.toFixed(2)} сомони`, reportType === 'sales' ? 'Продажи' : 'Прибыль']}
                  />
                  <Bar 
                    dataKey="value" 
                    fill={reportType === 'sales' ? '#6366f1' : '#10b981'} 
                    radius={[4, 4, 0, 0]} 
                    barSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-[300px] min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: number) => [`${val.toFixed(2)} сомони`, 'Сумма']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
