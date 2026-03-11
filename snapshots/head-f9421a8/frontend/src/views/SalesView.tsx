import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { 
  Plus, 
  Search, 
  Filter, 
  Receipt, 
  ChevronRight, 
  Eye, 
  Trash2, 
  X,
  Calendar,
  Banknote,
  User as UserIcon,
  Warehouse as WarehouseIcon,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

export default function SalesView() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [isPaying, setIsPaying] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin' || user.role === 'ADMIN' || user.role === 'MANAGER';

  useEffect(() => {
    fetchInvoices();
    fetchWarehouses();
  }, [selectedWarehouseId]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const query = selectedWarehouseId ? `?warehouseId=${selectedWarehouseId}` : '';
      const res = await client.get(`/invoices${query}`);
      setInvoices(res.data);
    } catch (err) {
      toast.error('Ошибка при загрузке накладных');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await client.get('/warehouses');
      setWarehouses(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInvoiceDetails = async (id: number) => {
    try {
      const res = await client.get(`/invoices/${id}`);
      setSelectedInvoice(res.data);
      setShowDetailsModal(true);
    } catch (err) {
      toast.error('Ошибка при загрузке деталей накладной');
    }
  };

  const handleDeleteInvoice = async (id: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту накладную? Это действие нельзя отменить.')) return;
    try {
      await client.delete(`/invoices/${id}`);
      toast.success('Накладная удалена');
      fetchInvoices();
    } catch (err) {
      toast.error('Ошибка при удалении накладной');
    }
  };

  const handlePayment = async () => {
    if (!selectedInvoice || !paymentAmount) return;
    setIsPaying(true);
    try {
      await client.post('/payments', {
        customer_id: selectedInvoice.customerId,
        invoice_id: selectedInvoice.id,
        amount: parseFloat(paymentAmount),
        method: 'cash'
      });
      toast.success('Оплата принята');
      setShowPaymentModal(false);
      setPaymentAmount('');
      fetchInvoices();
    } catch (err) {
      toast.error('Ошибка при приеме оплаты');
    } finally {
      setIsPaying(false);
    }
  };

  const handleReturn = async () => {
    if (!selectedInvoice || returnItems.length === 0) return;
    setIsReturning(true);
    try {
      const itemsToReturn = returnItems
        .filter(item => item.returnQty > 0)
        .map(item => ({
          productId: item.productId,
          quantity: parseFloat(item.returnQty)
        }));

      if (itemsToReturn.length === 0) {
        toast.error('Выберите товары для возврата');
        setIsReturning(false);
        return;
      }

      await client.post(`/invoices/${selectedInvoice.id}/return`, {
        items: itemsToReturn,
        reason: returnReason
      });
      toast.success('Возврат оформлен');
      setShowReturnModal(false);
      setReturnReason('');
      setReturnItems([]);
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при оформлении возврата');
    } finally {
      setIsReturning(false);
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.id.toString().includes(search) || 
    inv.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string, cancelled: boolean) => {
    if (cancelled) return <span className="px-3 py-1 bg-rose-100 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest">Отменена</span>;
    switch (status) {
      case 'paid': return <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">Оплачено</span>;
      case 'partial': return <span className="px-3 py-1 bg-amber-100 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest">Частично</span>;
      default: return <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">Не оплачено</span>;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Продажи</h1>
          <p className="text-slate-500 mt-1 font-medium">Управление накладными и заказами клиентов.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-4 mr-4">
             <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-slate-900 leading-none">{user.username}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{user.role}</p>
             </div>
          </div>
          <select 
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-700 font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm min-w-[200px]"
          >
            <option value="">Все склады</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <button 
            onClick={() => navigate('/pos')}
            className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all active:scale-95"
          >
            <Plus size={20} />
            <span>Новая продажа</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-slate-50/30">
          <h2 className="text-2xl font-black text-slate-900">Накладные</h2>
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Поиск по ID или клиенту..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-14 pr-6 py-4 rounded-[1.25rem] border border-slate-200 focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-8 py-6">ID</th>
                <th className="px-8 py-6">Дата</th>
                <th className="px-8 py-6">Клиент</th>
                <th className="px-8 py-6">Сумма</th>
                <th className="px-8 py-6">Оплачено</th>
                <th className="px-8 py-6">Остаток</th>
                <th className="px-8 py-6">Статус</th>
                <th className="px-8 py-6">Сотрудник</th>
                <th className="px-8 py-6 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/50 transition-all duration-300 group">
                  <td className="px-8 py-6 font-black text-slate-400">#{inv.id}</td>
                  <td className="px-8 py-6 text-slate-500 font-bold">
                    {new Date(inv.createdAt).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-8 py-6 font-black text-slate-900">{inv.customer_name}</td>
                  <td className="px-8 py-6 font-black text-slate-900">{inv.netAmount.toFixed(2)} TJS</td>
                  <td className="px-8 py-6 font-bold text-emerald-600">{inv.paidAmount.toFixed(2)} TJS</td>
                  <td className="px-8 py-6 font-bold text-rose-600">{(inv.netAmount - inv.paidAmount).toFixed(2)} TJS</td>
                  <td className="px-8 py-6">{getStatusBadge(inv.status, inv.cancelled)}</td>
                  <td className="px-8 py-6 text-slate-500 font-bold">{inv.staff_name}</td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end space-x-2 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300">
                      {inv.netAmount > inv.paidAmount && !inv.cancelled && (
                        <button 
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setPaymentAmount((inv.netAmount - inv.paidAmount).toFixed(2));
                            setShowPaymentModal(true);
                          }}
                          className="p-3 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" 
                          title="Принять оплату"
                        >
                          <Banknote size={20} />
                        </button>
                      )}
                      {!inv.cancelled && inv.status !== 'paid' && (
                        <button 
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setReturnItems(inv.items?.map((item: any) => ({ ...item, returnQty: 0 })) || []);
                            setShowReturnModal(true);
                          }}
                          className="p-3 text-amber-600 hover:bg-amber-50 rounded-xl transition-all" 
                          title="Возврат"
                        >
                          <RotateCcw size={20} />
                        </button>
                      )}
                      <button 
                        onClick={() => fetchInvoiceDetails(inv.id)}
                        className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" 
                        title="Просмотр"
                      >
                        <Eye size={20} />
                      </button>
                      <button 
                        onClick={() => handleDeleteInvoice(inv.id)}
                        className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" 
                        title="Удалить"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={9} className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center justify-center space-y-6">
                      <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                        <Receipt size={48} />
                      </div>
                      <p className="text-slate-400 font-bold">Накладные не найдены</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showDetailsModal && selectedInvoice && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                    <Receipt size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Накладная #{selectedInvoice.id}</h3>
                    <p className="text-slate-500 font-bold">{new Date(selectedInvoice.createdAt).toLocaleString('ru-RU')}</p>
                  </div>
                </div>
                <button onClick={() => setShowDetailsModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-slate-50 rounded-3xl">
                    <div className="flex items-center space-x-3 text-slate-400 mb-4">
                      <UserIcon size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Клиент</span>
                    </div>
                    <p className="text-lg font-black text-slate-900">{selectedInvoice.customer_name}</p>
                    <p className="text-sm font-bold text-slate-500 mt-1">{selectedInvoice.customer_phone || 'Нет телефона'}</p>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-3xl">
                    <div className="flex items-center space-x-3 text-slate-400 mb-4">
                      <WarehouseIcon size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Склад</span>
                    </div>
                    <p className="text-lg font-black text-slate-900">{selectedInvoice.warehouse?.name}</p>
                    <p className="text-sm font-bold text-slate-500 mt-1">{selectedInvoice.warehouse?.address || '---'}</p>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-3xl">
                    <div className="flex items-center space-x-3 text-slate-400 mb-4">
                      <Clock size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Статус</span>
                    </div>
                    <div>{getStatusBadge(selectedInvoice.status, selectedInvoice.cancelled)}</div>
                    <p className="text-sm font-bold text-slate-500 mt-2">Сотрудник: {selectedInvoice.staff_name}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-2">Товары</h4>
                  <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                          <th className="px-6 py-4">Товар</th>
                          <th className="px-6 py-4">Кол-во</th>
                          <th className="px-6 py-4">Цена</th>
                          <th className="px-6 py-4 text-right">Итого</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {selectedInvoice.items.map((item: any) => {
                          return (
                            <tr key={item.id}>
                              <td className="px-6 py-4">
                                <p className="font-black text-slate-900">{item.product_name}</p>
                                {item.saleAllocations && item.saleAllocations.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {item.saleAllocations.map((sa: any) => (
                                      <span key={sa.id} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] rounded font-black uppercase tracking-tighter">
                                        Партия #{sa.batchId} ({sa.quantity} {item.unit})
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-500">{item.quantity} {item.unit}</td>
                              <td className="px-6 py-4 font-bold text-slate-500">{item.sellingPrice.toFixed(2)} TJS</td>
                              <td className="px-6 py-4 text-right font-black text-slate-900">{item.totalPrice.toFixed(2)} TJS</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="w-full max-w-xs space-y-3">
                    <div className="flex justify-between items-center text-slate-500">
                      <span className="font-bold">Подытог:</span>
                      <span className="font-black">{selectedInvoice.totalAmount.toFixed(2)} TJS</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span className="font-bold">Скидка ({selectedInvoice.discount}%):</span>
                      <span className="font-black">-{((selectedInvoice.totalAmount * selectedInvoice.discount) / 100).toFixed(2)} TJS</span>
                    </div>
                    {selectedInvoice.returnedAmount > 0 && (
                      <div className="flex justify-between items-center text-rose-500">
                        <span className="font-bold">Возвращено:</span>
                        <span className="font-black">-{selectedInvoice.returnedAmount.toFixed(2)} TJS</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-2xl font-black text-slate-900 pt-3 border-t border-slate-100">
                      <span>Итого:</span>
                      <span>{selectedInvoice.netAmount.toFixed(2)} TJS</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500 pt-3 border-t border-slate-100">
                      <span className="font-bold">Оплачено:</span>
                      <span className="font-black text-emerald-600">{selectedInvoice.paidAmount.toFixed(2)} TJS</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span className="font-bold">Остаток (Долг):</span>
                      <span className="font-black text-rose-600">{(selectedInvoice.netAmount - selectedInvoice.paidAmount).toFixed(2)} TJS</span>
                    </div>
                  </div>
                </div>

                {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-2">История платежей</h4>
                    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                            <th className="px-6 py-4">Дата</th>
                            <th className="px-6 py-4">Сумма</th>
                            <th className="px-6 py-4">Сотрудник</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {selectedInvoice.payments.map((p: any) => (
                            <tr key={p.id}>
                              <td className="px-6 py-4 font-bold text-slate-500">{new Date(p.createdAt).toLocaleString('ru-RU')}</td>
                              <td className="px-6 py-4 font-black text-emerald-600">{p.amount.toFixed(2)} TJS</td>
                              <td className="px-6 py-4 text-slate-500">{p.staff_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedInvoice.returns && selectedInvoice.returns.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-2">История возвратов</h4>
                    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                            <th className="px-6 py-4">Дата</th>
                            <th className="px-6 py-4">Сумма</th>
                            <th className="px-6 py-4">Причина</th>
                            <th className="px-6 py-4">Сотрудник</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {selectedInvoice.returns.map((r: any) => (
                            <tr key={r.id}>
                              <td className="px-6 py-4 font-bold text-slate-500">{new Date(r.createdAt).toLocaleString('ru-RU')}</td>
                              <td className="px-6 py-4 font-black text-rose-600">-{r.totalValue.toFixed(2)} TJS</td>
                              <td className="px-6 py-4 text-slate-500 italic">{r.reason}</td>
                              <td className="px-6 py-4 text-slate-500">{r.staff_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setShowDetailsModal(false)}
                  className="px-10 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPaymentModal && selectedInvoice && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-emerald-600 text-white rounded-2xl">
                    <Banknote size={24} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">Принять оплату</h3>
                </div>
                <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div>
                  <p className="text-sm font-bold text-slate-500 mb-1">Накладная #{selectedInvoice.id}</p>
                  <p className="text-lg font-black text-slate-900">{selectedInvoice.customer_name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Итого</p>
                    <p className="text-lg font-black text-slate-900">{selectedInvoice.netAmount.toFixed(2)} TJS</p>
                  </div>
                  <div className="p-4 bg-rose-50 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Долг</p>
                    <p className="text-lg font-black text-rose-600">{(selectedInvoice.netAmount - selectedInvoice.paidAmount).toFixed(2)} TJS</p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Сумма оплаты</label>
                  <input 
                    type="number" 
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full mt-1 px-5 py-4 rounded-2xl border border-slate-200 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all font-black text-2xl text-slate-900 shadow-sm"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
              </div>
              
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  Отмена
                </button>
                <button 
                  onClick={handlePayment}
                  disabled={isPaying || !paymentAmount}
                  className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isPaying ? 'Сохранение...' : 'Внести'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReturnModal && selectedInvoice && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-amber-600 text-white rounded-2xl">
                    <RotateCcw size={24} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">Оформить возврат</h3>
                </div>
                <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto flex-1 space-y-6">
                <div>
                  <p className="text-sm font-bold text-slate-500 mb-1">Накладная #{selectedInvoice.id}</p>
                  <p className="text-lg font-black text-slate-900">{selectedInvoice.customer_name}</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Выберите товары для возврата</h4>
                  <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                          <th className="px-6 py-4">Товар</th>
                          <th className="px-6 py-4">Продано</th>
                          <th className="px-6 py-4">Возврат</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {returnItems.map((item: any, idx: number) => (
                          <tr key={item.id}>
                            <td className="px-6 py-4 font-black text-slate-900">{item.product_name}</td>
                            <td className="px-6 py-4 font-bold text-slate-500">{item.quantity} {item.unit}</td>
                            <td className="px-6 py-4">
                              <input 
                                type="number" 
                                min="0"
                                max={item.quantity - (item.returnedQty || 0)}
                                value={item.returnQty}
                                onChange={(e) => {
                                  const newItems = [...returnItems];
                                  newItems[idx].returnQty = e.target.value;
                                  setReturnItems(newItems);
                                }}
                                className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-black text-center outline-none focus:ring-2 focus:ring-amber-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Причина возврата</label>
                  <textarea 
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full mt-1 px-5 py-4 rounded-2xl border border-slate-200 focus:ring-8 focus:ring-amber-500/5 focus:border-amber-500 outline-none transition-all font-bold text-slate-900 shadow-sm min-h-[100px]"
                    placeholder="Укажите причину возврата..."
                  />
                </div>
              </div>
              
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setShowReturnModal(false)}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  Отмена
                </button>
                <button 
                  onClick={handleReturn}
                  disabled={isReturning || returnItems.every(item => !item.returnQty || parseFloat(item.returnQty) === 0)}
                  className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-amber-600/20 hover:bg-amber-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isReturning ? 'Оформление...' : 'Оформить возврат'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
