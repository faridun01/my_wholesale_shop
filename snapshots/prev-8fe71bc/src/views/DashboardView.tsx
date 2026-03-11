import React from 'react';
import { ArrowUpRight, DollarSign, AlertTriangle, Package } from 'lucide-react';
import { Card, Badge } from '../components/UI';

interface DashboardProps {
  stats: any;
}

export const DashboardView = ({ stats }: DashboardProps) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Продажи сегодня</p>
            <h3 className="text-2xl font-bold text-slate-900">{stats?.today_sales.toFixed(2)} сомони</h3>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
            <ArrowUpRight size={24} />
          </div>
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Прибыль сегодня</p>
            <h3 className="text-2xl font-bold text-slate-900">{stats?.today_profit.toFixed(2)} сомони</h3>
          </div>
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
            <DollarSign size={24} />
          </div>
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Долг сегодня</p>
            <h3 className="text-2xl font-bold text-rose-600">{stats?.today_debt.toFixed(2)} сомони</h3>
          </div>
          <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
            <AlertTriangle size={24} />
          </div>
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Мало запаса</p>
            <h3 className="text-2xl font-bold text-slate-900">{stats?.low_stock.length}</h3>
          </div>
          <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
            <Package size={24} />
          </div>
        </div>
      </Card>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="Топ должников" subtitle="Клиенты с наибольшей задолженностью">
        <div className="space-y-4 max-h-75 overflow-y-auto pr-2">
          {stats?.top_debtors.map((debtor: any, i: number) => (
            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="font-medium text-slate-700">{debtor.name}</span>
              <span className="font-bold text-rose-600">{debtor.balance.toFixed(2)} сомони</span>
            </div>
          ))}
          {stats?.top_debtors.length === 0 && <p className="text-center text-slate-400 py-4">Нет задолженностей</p>}
        </div>
      </Card>
      <Card title="Критические остатки" subtitle="Товары ниже минимального порога">
        <div className="space-y-4 max-h-75 overflow-y-auto pr-2">
          {stats?.low_stock.map((item: any, i: number) => (
            <div key={i} className="flex flex-col p-3 bg-slate-50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">{item.name}</span>
                <div className="flex items-center space-x-2">
                  <Badge variant="danger">{item.stock} в наличии</Badge>
                  <span className="text-xs text-slate-400">Мин: {item.min_stock}</span>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <span className="bg-slate-200 px-1.5 py-0.5 rounded">{item.warehouse_name}</span>
                <span>•</span>
                <span>{item.city}</span>
              </div>
            </div>
          ))}
          {stats?.low_stock.length === 0 && <p className="text-center text-slate-400 py-4">Все запасы в норме</p>}
        </div>
      </Card>
    </div>
  </div>
);
