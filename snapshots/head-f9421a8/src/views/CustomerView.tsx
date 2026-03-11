import React, { useState } from 'react';
import { Search, Plus, Edit, Trash2, X, ShoppingCart, DollarSign, Printer, Eye } from 'lucide-react';
import { motion } from 'motion/react';
import { Card, Badge } from '../components/UI';

interface Customer {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  total_invoiced: number;
  total_paid: number;
}

interface CustomerViewProps {
  customers: Customer[];
  fetchData: () => void;
  user: any;
  onViewInvoice: (id: number) => void;
}

export const CustomerView = ({ customers, fetchData, user, onViewInvoice }: CustomerViewProps) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerForStatement, setSelectedCustomerForStatement] = useState<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<any[]>([]);
  const [customerPayments, setCustomerPayments] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone?.includes(search)
  );

  const fetchCustomerStatement = async (customer: Customer) => {
    setSelectedCustomerForStatement(customer);
    const [invRes, payRes] = await Promise.all([
      fetch(`/api/customers/${customer.id}/invoices`),
      fetch(`/api/customers/${customer.id}/payments`)
    ]);
    setCustomerInvoices(await invRes.json());
    setCustomerPayments(await payRes.json());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Поиск клиентов..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} />
          <span>Добавить клиента</span>
        </button>
      </div>

      <Card>
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-3 text-sm font-semibold text-slate-600">Клиент</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-600">Контакты</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-600">Сумма накладных</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-600">Оплачено</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-600">Баланс (Долг)</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-600 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredCustomers.map(customer => {
                const balance = customer.total_invoiced - customer.total_paid;
                return (
                  <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-900">{customer.name}</p>
                      <p className="text-xs text-slate-500">{customer.address || 'Нет адреса'}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{customer.phone || '-'}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{customer.total_invoiced.toFixed(2)} сомони</td>
                    <td className="px-4 py-4 text-sm text-emerald-600">{customer.total_paid.toFixed(2)} сомони</td>
                    <td className="px-4 py-4">
                      <span className={`font-bold ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {balance.toFixed(2)} сомони
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right space-x-2">
                      <button 
                        onClick={() => fetchCustomerStatement(customer)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                      >
                        Выписка
                      </button>
                      <button 
                        onClick={() => setEditingCustomer(customer)}
                        className="text-slate-600 hover:text-slate-800 font-medium text-sm"
                      >
                        Изменить
                      </button>
                      {(user?.role === 'admin' || user?.can_delete) && (
                        <button 
                          onClick={async () => {
                            if (confirm(`Вы уверены, что хотите удалить клиента ${customer.name}?`)) {
                              const res = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
                              if (!res.ok) {
                                const err = await res.json();
                                alert(err.error || 'Ошибка удаления');
                              } else {
                                fetchData();
                              }
                            }
                          }}
                          className="text-rose-600 hover:text-rose-800 font-medium text-sm"
                        >
                          Удалить
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredCustomers.map(customer => {
            const balance = customer.total_invoiced - customer.total_paid;
            return (
              <div key={customer.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-900 text-lg">{customer.name}</p>
                    <p className="text-sm text-slate-500">{customer.phone || 'Нет телефона'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase font-bold">Долг</p>
                    <p className={`text-xl font-black ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {balance.toFixed(2)} сомони
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl text-sm">
                  <div>
                    <p className="text-slate-500">Накладные</p>
                    <p className="font-bold text-slate-900">{customer.total_invoiced.toFixed(2)} сомони</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Оплачено</p>
                    <p className="font-bold text-emerald-600">{customer.total_paid.toFixed(2)} сомони</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button 
                    onClick={() => fetchCustomerStatement(customer)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex-1 mr-2"
                  >
                    Выписка
                  </button>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => setEditingCustomer(customer)}
                      className="p-2 bg-slate-100 text-slate-600 rounded-lg"
                    >
                      <Edit size={20} />
                    </button>
                    {(user?.role === 'admin' || user?.can_delete) && (
                      <button 
                        onClick={async () => {
                          if (confirm(`Вы уверены, что хотите удалить клиента ${customer.name}?`)) {
                            const res = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
                            if (!res.ok) {
                              const err = await res.json();
                              alert(err.error || 'Ошибка удаления');
                            } else {
                              fetchData();
                            }
                          }
                        }}
                        className="p-2 text-rose-600"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {(showAddModal || editingCustomer) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">
                {editingCustomer ? 'Изменить клиента' : 'Добавить клиента'}
              </h3>
              <button onClick={() => { setShowAddModal(false); setEditingCustomer(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <form className="p-6 space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = Object.fromEntries(formData.entries());
              
              if (editingCustomer) {
                await fetch(`/api/customers/${editingCustomer.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(data)
                });
              } else {
                await fetch('/api/customers', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(data)
                });
              }
              
              fetchData();
              setShowAddModal(false);
              setEditingCustomer(null);
            }}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Имя / Компания</label>
                <input name="name" defaultValue={editingCustomer?.name} required className="w-full px-4 py-2 rounded-lg border border-slate-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Телефон</label>
                <input name="phone" defaultValue={editingCustomer?.phone} className="w-full px-4 py-2 rounded-lg border border-slate-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Адрес</label>
                <input name="address" defaultValue={editingCustomer?.address} className="w-full px-4 py-2 rounded-lg border border-slate-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Примечание</label>
                <textarea name="notes" defaultValue={editingCustomer?.notes} className="w-full px-4 py-2 rounded-lg border border-slate-200" rows={3}></textarea>
              </div>
              <div className="pt-4 flex space-x-3">
                <button type="button" onClick={() => { setShowAddModal(false); setEditingCustomer(null); }} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50">Отмена</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Сохранить</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {selectedCustomerForStatement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Выписка: {selectedCustomerForStatement.name}</h3>
                <p className="text-sm text-slate-500">История накладных и платежей</p>
              </div>
              <button onClick={() => setSelectedCustomerForStatement(null)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Всего на сумму</p>
                  <p className="text-2xl font-black text-slate-900">{selectedCustomerForStatement.total_invoiced.toFixed(2)} сомони</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Всего оплачено</p>
                  <p className="text-2xl font-black text-slate-900">{selectedCustomerForStatement.total_paid.toFixed(2)} сомони</p>
                </div>
                <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                  <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Текущий долг</p>
                  <p className="text-2xl font-black text-slate-900">{(selectedCustomerForStatement.total_invoiced - selectedCustomerForStatement.total_paid).toFixed(2)} сомони</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 flex items-center space-x-2">
                  <ShoppingCart size={18} className="text-indigo-500" />
                  <span>История накладных</span>
                </h4>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-4 py-2 font-semibold text-slate-600">ID</th>
                        <th className="px-4 py-2 font-semibold text-slate-600">Дата</th>
                        <th className="px-4 py-2 font-semibold text-slate-600">Сумма</th>
                        <th className="px-4 py-2 font-semibold text-slate-600">Оплачено</th>
                        <th className="px-4 py-2 font-semibold text-slate-600">Статус</th>
                        <th className="px-4 py-2 font-semibold text-slate-600 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {customerInvoices.map(inv => {
                        const net_total = (inv.total_amount - (inv.total_amount * inv.discount / 100) + inv.tax) - (inv.returned_amount || 0);
                        return (
                          <tr key={inv.id}>
                            <td className="px-4 py-2 text-slate-500">#{inv.id}</td>
                            <td className="px-4 py-2">{new Date(inv.created_at).toLocaleDateString('ru-RU')}</td>
                            <td className="px-4 py-2 font-medium">{net_total.toFixed(2)} сомони</td>
                            <td className="px-4 py-2 text-emerald-600">{(inv.total_paid || 0).toFixed(2)} сомони</td>
                            <td className="px-4 py-2">
                              <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'partial' ? 'warning' : 'danger'}>
                                {inv.status === 'paid' ? 'ОПЛАЧЕНО' : inv.status === 'partial' ? 'ЧАСТИЧНО' : 'ДОЛГ'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button 
                                onClick={() => onViewInvoice(inv.id)}
                                className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                title="Посмотреть чек"
                              >
                                <Eye size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {customerInvoices.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Нет накладных</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 flex items-center space-x-2">
                  <DollarSign size={18} className="text-emerald-500" />
                  <span>История платежей</span>
                </h4>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-4 py-2 font-semibold text-slate-600">Дата</th>
                        <th className="px-4 py-2 font-semibold text-slate-600">Сумма</th>
                        <th className="px-4 py-2 font-semibold text-slate-600">Метод</th>
                        <th className="px-4 py-2 font-semibold text-slate-600">Накладная</th>
                        <th className="px-4 py-2 font-semibold text-slate-600">Сотрудник</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {customerPayments.map(pay => (
                        <tr key={pay.id}>
                          <td className="px-4 py-2">{new Date(pay.created_at).toLocaleDateString('ru-RU')}</td>
                          <td className="px-4 py-2 font-bold text-emerald-600">{pay.amount.toFixed(2)} сомони</td>
                          <td className="px-4 py-2 capitalize">{pay.method === 'cash' ? 'Наличные' : pay.method === 'card' ? 'Карта' : 'Перевод'}</td>
                          <td className="px-4 py-2 text-slate-500">#{pay.invoice_id || '-'}</td>
                          <td className="px-4 py-2">{pay.staff_name}</td>
                        </tr>
                      ))}
                      {customerPayments.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Нет платежей</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setSelectedCustomerForStatement(null)} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors">
                Закрыть
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
