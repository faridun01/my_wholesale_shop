import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, FileText, Phone, MapPin, X, ChevronRight, User, RotateCcw } from 'lucide-react';
import { Card, Badge } from '../components/UI';
import client from '../api/client';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  notes: string;
  total_invoiced: number;
  total_paid: number;
  balance: number;
}

export default function CustomerView() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isInvoiceDetailsOpen, setIsInvoiceDetailsOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [statementData, setStatementData] = useState<any[]>([]);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', notes: '' });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await client.get('/customers');
      setCustomers(res.data);
    } catch (err) {
      toast.error('Ошибка при загрузке клиентов');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedCustomer) {
        await client.put(`/customers/${selectedCustomer.id}`, formData);
        toast.success('Клиент обновлен');
      } else {
        await client.post('/customers', formData);
        toast.success('Клиент добавлен');
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err) {
      toast.error('Ошибка при сохранении');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Вы уверены?')) return;
    try {
      await client.delete(`/customers/${id}`);
      toast.success('Клиент удален');
      fetchCustomers();
    } catch (err) {
      toast.error('Ошибка при удалении');
    }
  };

  const openStatement = async (customer: Customer) => {
    setSelectedCustomer(customer);
    try {
      const [invRes, payRes, retRes] = await Promise.all([
        client.get(`/customers/${customer.id}/invoices`),
        client.get(`/customers/${customer.id}/payments`),
        client.get(`/customers/${customer.id}/returns`)
      ]);
      const combined = [
        ...invRes.data.map((i: any) => ({ ...i, type: 'invoice', date: i.createdAt })),
        ...payRes.data.map((p: any) => ({ ...p, type: 'payment', date: p.createdAt })),
        ...retRes.data.map((r: any) => ({ ...r, type: 'return', date: r.createdAt }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setStatementData(combined);
      setIsStatementOpen(true);
    } catch (err) {
      toast.error('Ошибка при загрузке выписки');
    }
  };

  const openInvoiceDetails = (invoice: any) => {
    setSelectedInvoice(invoice);
    setIsInvoiceDetailsOpen(true);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Клиенты</h1>
          <p className="text-slate-500 mt-1 font-medium">Управление базой клиентов и их балансами.</p>
        </div>
        <button
          onClick={() => { setSelectedCustomer(null); setFormData({ name: '', phone: '', address: '', notes: '' }); setIsModalOpen(true); }}
          className="flex items-center justify-center space-x-3 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
        >
          <Plus size={20} strokeWidth={3} />
          <span>Новый клиент</span>
        </button>
      </div>

      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
        <input
          type="text"
          placeholder="Поиск по имени или телефону..."
          className="w-full pl-16 pr-8 py-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-bold text-slate-700"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map(customer => (
          <motion.div layout key={customer.id}>
            <Card className="hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 group">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-500">
                  <User size={28} strokeWidth={2.5} />
                </div>
                <div className="flex space-x-1">
                  <button onClick={() => { 
                    setSelectedCustomer(customer); 
                    setFormData({
                      name: customer.name || '',
                      phone: customer.phone || '',
                      address: customer.address || '',
                      notes: customer.notes || ''
                    }); 
                    setIsModalOpen(true); 
                  }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(customer.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              <h3 className="text-xl font-black text-slate-900 mb-2">{customer.name}</h3>
              <div className="space-y-2 mb-6">
                <div className="flex items-center text-sm font-bold text-slate-500">
                  <Phone size={14} className="mr-2" /> {customer.phone || 'Нет телефона'}
                </div>
                <div className="flex items-center text-sm font-bold text-slate-500">
                  <MapPin size={14} className="mr-2" /> {customer.address || 'Нет адреса'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl mb-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Оплачено</p>
                  <p className="text-sm font-black text-emerald-600">{customer.total_paid?.toFixed(2) || '0.00'} TJS</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Долг</p>
                  <p className={`text-sm font-black ${customer.balance > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{customer.balance?.toFixed(2) || '0.00'} TJS</p>
                </div>
              </div>

              <button
                onClick={() => openStatement(customer)}
                className="w-full flex items-center justify-center space-x-2 py-4 bg-white border-2 border-slate-100 rounded-xl font-black text-xs uppercase tracking-widest text-slate-600 hover:border-indigo-600 hover:text-indigo-600 transition-all"
              >
                <FileText size={16} />
                <span>История чеков</span>
              </button>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Modal for Add/Edit */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedCustomer ? 'Редактировать' : 'Новый клиент'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors"><X /></button>
              </div>
              <form onSubmit={handleSave} className="p-10 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Имя клиента</label>
                  <input required className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Телефон</label>
                  <input className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Адрес</label>
                  <input className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold" value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Заметки</label>
                  <textarea className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold min-h-[100px]" value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                </div>
                <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95">
                  Сохранить
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Statement */}
      <AnimatePresence>
        {isStatementOpen && selectedCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsStatementOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="relative w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="px-10 py-10 border-b border-slate-100 bg-slate-50/50">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedCustomer.name}</h2>
                    <p className="text-slate-500 font-bold mt-1">История операций и баланс</p>
                  </div>
                  <button onClick={() => setIsStatementOpen(false)} className="p-3 hover:bg-white rounded-2xl transition-colors shadow-sm"><X /></button>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Всего выставлено</p>
                    <p className="text-xl font-black text-slate-900">{selectedCustomer.total_invoiced?.toFixed(2)} TJS</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Всего оплачено</p>
                    <p className="text-xl font-black text-emerald-600">{selectedCustomer.total_paid?.toFixed(2)} TJS</p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Текущий долг</p>
                    <p className="text-xl font-black text-rose-600">{selectedCustomer.balance?.toFixed(2)} TJS</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-10">
                <div className="space-y-4">
                  {statementData.map((item, i) => (
                    <div 
                      key={i} 
                      onClick={() => item.type === 'invoice' && openInvoiceDetails(item)}
                      className={`flex items-center justify-between p-6 bg-slate-50 rounded-3xl hover:bg-slate-100 transition-colors group ${item.type === 'invoice' ? 'cursor-pointer' : ''}`}
                    >
                      <div className="flex items-center space-x-6">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                          item.type === 'invoice' ? 'bg-indigo-100 text-indigo-600' : 
                          item.type === 'payment' ? 'bg-emerald-100 text-emerald-600' : 
                          'bg-amber-100 text-amber-600'
                        }`}>
                          {item.type === 'invoice' ? <FileText size={24} /> : 
                           item.type === 'payment' ? <ChevronRight size={24} /> : 
                           <RotateCcw size={24} />}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-lg">
                            {item.type === 'invoice' ? `Накладная #${item.id}` : 
                             item.type === 'payment' ? 'Оплата наличными' : 
                             `Возврат товара (#${item.invoiceId})`}
                          </p>
                          <p className="text-sm font-bold text-slate-400">
                            {new Date(item.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-black ${
                          item.type === 'invoice' ? 'text-slate-900' : 
                          item.type === 'payment' ? 'text-emerald-600' : 
                          'text-amber-600'
                        }`}>
                          {item.type === 'invoice' ? `+${item.netAmount?.toFixed(2)}` : 
                           item.type === 'payment' ? `-${item.amount?.toFixed(2)}` : 
                           `-${item.totalValue?.toFixed(2)}`} TJS
                        </p>
                        <Badge variant={
                          item.type === 'invoice' ? (item.status === 'paid' ? 'success' : 'warning') : 
                          item.type === 'payment' ? 'success' : 
                          'warning'
                        }>
                          {item.type === 'invoice' ? (item.status === 'paid' ? 'Оплачено' : 'Ожидает') : 
                           item.type === 'payment' ? 'Принято' : 
                           'Возврат'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invoice Details Modal */}
      <AnimatePresence>
        {isInvoiceDetailsOpen && selectedInvoice && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsInvoiceDetailsOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-2xl font-black text-slate-900">Накладная #{selectedInvoice.id}</h3>
                <button onClick={() => setIsInvoiceDetailsOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors"><X /></button>
              </div>
              <div className="p-8 space-y-6">
                <div className="flex justify-between text-sm font-bold text-slate-500">
                  <span>Дата: {new Date(selectedInvoice.createdAt).toLocaleString()}</span>
                  <span>Склад: {selectedInvoice.warehouse?.name}</span>
                </div>
                <div className="space-y-4">
                  {selectedInvoice.items?.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                      <div>
                        <p className="font-bold text-slate-900">{item.product?.name}</p>
                        <p className="text-xs text-slate-400">{item.quantity} x {item.sellingPrice.toFixed(2)} TJS</p>
                      </div>
                      <p className="font-black text-slate-900">{(item.quantity * item.sellingPrice).toFixed(2)} TJS</p>
                    </div>
                  ))}
                </div>
                <div className="pt-6 border-t border-slate-100 space-y-2">
                  <div className="flex justify-between text-sm font-bold text-slate-500">
                    <span>Сумма</span>
                    <span>{selectedInvoice.totalAmount?.toFixed(2)} TJS</span>
                  </div>
                  {selectedInvoice.discount > 0 && (
                    <div className="flex justify-between text-sm font-bold text-rose-500">
                      <span>Скидка ({selectedInvoice.discount}%)</span>
                      <span>-{(selectedInvoice.totalAmount * selectedInvoice.discount / 100).toFixed(2)} TJS</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-black text-slate-900 pt-2">
                    <span>Итого</span>
                    <span>{selectedInvoice.netAmount?.toFixed(2)} TJS</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
