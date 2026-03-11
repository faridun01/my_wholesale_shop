import React, { useState } from 'react';
import { Plus, Printer, RefreshCw, DollarSign, Undo2, Trash2, X, ShoppingCart, Package, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { Card, Badge } from '../components/UI';

interface Product {
  id: number;
  name: string;
  selling_price: number;
  unit: string;
  photo_url?: string;
  stock: number;
  active: boolean;
}

interface Invoice {
  id: number;
  customer_id: number;
  customer_name?: string;
  total_amount: number;
  discount: number;
  tax: number;
  total_paid: number;
  returned_amount: number;
  status: string;
  cancelled: boolean;
  created_at: string;
  staff_name: string;
}

interface SalesViewProps {
  invoices: Invoice[];
  products: Product[];
  customers: any[];
  fetchData: () => void;
  user: any;
  warehouseId: number | null;
}

export const SalesView = ({ invoices, products, customers, fetchData, user, warehouseId }: SalesViewProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [cart, setCart] = useState<{ product_id: number, name: string, quantity: number, selling_price: number, unit: string }[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<number | ''>('');
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [searchProduct, setSearchProduct] = useState('');

  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.selling_price), 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount;

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert("Товара нет в наличии!");
      return;
    }
    if (!product.selling_price || product.selling_price <= 0) {
      alert("Цена продажи не указана! Нельзя продавать товар без цены.");
      return;
    }
    const existing = cart.find(item => item.product_id === product.id);
    if (existing) {
      if (existing.quantity + 1 > product.stock) {
        alert("Недостаточно товара на складе!");
        return;
      }
      setCart(cart.map(item => item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { product_id: product.id, name: product.name, quantity: 1, selling_price: product.selling_price, unit: product.unit }]);
    }
  };

  const handleCreateInvoice = async () => {
    if (!selectedCustomer || cart.length === 0 || !warehouseId) return;
    
    // Final stock and price check
    for (const item of cart) {
      const product = products.find(p => p.id === item.product_id);
      if (product && item.quantity > product.stock) {
        alert(`Недостаточно товара ${item.name} на складе!`);
        return;
      }
      if (!item.selling_price || item.selling_price <= 0) {
        alert(`Цена для товара ${item.name} не указана!`);
        return;
      }
    }

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: selectedCustomer,
        warehouse_id: warehouseId,
        items: cart,
        discount,
        user_id: user?.id,
        payment_amount: paymentAmount || 0,
        payment_method: paymentMethod
      })
    });
    
    if (res.ok) {
      fetchData();
      setIsCreating(false);
      setCart([]);
      setSelectedCustomer('');
      setPaymentAmount('');
      setDiscount(0);
    }
  };

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = useState<any>(null);
  const [selectedInvoiceForReturn, setSelectedInvoiceForReturn] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<{product_id: number, name: string, quantity: number, max_quantity: number}[]>([]);

  const fetchInvoiceDetails = async (id: number, forReturn = false) => {
    const res = await fetch(`/api/invoices/${id}`);
    const data = await res.json();
    if (forReturn) {
      setSelectedInvoiceForReturn(data);
      setReturnItems(data.items.map((item: any) => ({
        product_id: item.product_id,
        name: item.product_name,
        quantity: 0,
        max_quantity: item.quantity - (item.returned_quantity || 0)
      })));
    } else {
      setSelectedInvoiceDetails(data);
      setShowDetailsModal(true);
    }
  };

  const handleReturn = async () => {
    const itemsToReturn = returnItems.filter(i => i.quantity > 0);
    if (itemsToReturn.length === 0 || !warehouseId) return;

    await fetch(`/api/invoices/${selectedInvoiceForReturn.id}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: itemsToReturn,
        user_id: user?.id,
        reason: 'Возврат товара',
        warehouse_id: warehouseId
      })
    });

    fetchData();
    setShowReturnModal(false);
  };

  if (isCreating) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Выбор товаров">
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Поиск товара..." 
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchProduct}
                onChange={e => setSearchProduct(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-150 overflow-y-auto pr-2">
              {products.filter(p => p.active && p.name.toLowerCase().includes(searchProduct.toLowerCase())).map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className={`flex items-center p-3 border rounded-xl transition-all text-left group ${
                    product.stock <= 0 ? 'opacity-50 grayscale cursor-not-allowed border-slate-100' : 'border-slate-200 hover:border-indigo-500 hover:bg-indigo-50'
                  }`}
                  disabled={product.stock <= 0}
                >
                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 mr-3 overflow-hidden">
                    {product.photo_url ? <img src={product.photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Package size={24} />}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 group-hover:text-indigo-700">{product.name}</p>
                    <p className="text-sm text-slate-500">{product.selling_price.toFixed(2)} сомони / {product.unit}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={product.stock > 10 ? 'success' : (product.stock > 0 ? 'warning' : 'danger')}>
                      {product.stock} {product.unit}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Итог заказа">
            <div className="space-y-4 mb-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Клиент</label>
                <select 
                  className="w-full px-4 py-2 rounded-lg border border-slate-200"
                  value={selectedCustomer}
                  onChange={e => setSelectedCustomer(parseInt(e.target.value))}
                >
                  <option value="">Выберите клиента</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="border-t border-slate-100 pt-4 max-h-75 overflow-y-auto">
                {cart.map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-2">
                    <div>
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="number" 
                          className="w-16 px-2 py-0.5 border border-slate-200 rounded text-sm"
                          value={item.quantity}
                          onChange={e => {
                            const val = parseInt(e.target.value);
                            setCart(cart.map(c => c.product_id === item.product_id ? { ...c, quantity: val } : c));
                          }}
                        />
                        <span className="text-xs text-slate-500">x {item.selling_price.toFixed(2)} сомони</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setCart(cart.filter(c => c.product_id !== item.product_id))}
                      className="text-rose-500 hover:text-rose-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {cart.length === 0 && <p className="text-center text-slate-400 py-4">Корзина пуста</p>}
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Подытог</span>
                  <span>{subtotal.toFixed(2)} сомони</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Скидка (%)</span>
                  <input 
                    type="number" 
                    className="w-20 px-2 py-0.5 border border-slate-200 rounded text-right"
                    value={discount}
                    onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                  />
                </div>
                {/* Total hidden as per user request */}
                <div className="hidden justify-between text-lg font-bold text-slate-900 pt-2">
                  <span>Итого</span>
                  <span>{total.toFixed(2)} сомони</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Получено оплаты</label>
                  <div className="flex space-x-2">
                    <input 
                      type="number" 
                      className="flex-1 px-4 py-2 rounded-lg border border-slate-200"
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    />
                    <button 
                      onClick={() => setPaymentAmount(total)}
                      className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200"
                    >
                      Всё
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Способ</label>
                  <select 
                    className="w-full px-4 py-2 rounded-lg border border-slate-200"
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                  >
                    <option value="cash">Наличные</option>
                    <option value="card">Карта</option>
                    <option value="transfer">Перевод</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button 
                onClick={() => setIsCreating(false)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50"
              >
                Отмена
              </button>
              <button 
                onClick={handleCreateInvoice}
                disabled={!selectedCustomer || cart.length === 0}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-100"
              >
                Создать накладную
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">Накладные</h2>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} />
          <span>Новая продажа</span>
        </button>
      </div>

      <Card>
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-3 text-sm font-semibold text-slate-600">ID</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-600">Дата</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-600">Клиент</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-600">Сумма</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-600">Оплачено</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-600">Остаток</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-600">Статус</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-600">Сотрудник</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-600 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoices.map(invoice => (
                <tr key={invoice.id} className={`hover:bg-slate-50 transition-colors ${invoice.cancelled ? 'opacity-50 grayscale' : ''}`}>
                  <td className="px-4 py-4 text-sm font-medium text-slate-900 cursor-pointer hover:text-indigo-600" onClick={() => fetchInvoiceDetails(invoice.id)}>#{invoice.id}</td>
                  <td className="px-4 py-4 text-sm text-slate-600">{new Date(invoice.created_at).toLocaleDateString('ru-RU')}</td>
                  <td className="px-4 py-4 text-sm text-slate-600">{invoice.customer_name}</td>
                  <td className="px-4 py-4 text-sm font-bold text-slate-900">
                    {((invoice.total_amount - (invoice.total_amount * invoice.discount / 100) + invoice.tax) - (invoice.returned_amount || 0)).toFixed(2)} сомони
                    {invoice.returned_amount > 0 && (
                      <p className="text-[10px] text-rose-500 font-normal">Возврат: -{invoice.returned_amount.toFixed(2)}</p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-emerald-600 font-medium">{(invoice.total_paid || 0).toFixed(2)} сомони</td>
                  <td className="px-4 py-4 text-sm font-medium">
                    {(() => {
                      const currentTotal = (invoice.total_amount - (invoice.total_amount * invoice.discount / 100) + invoice.tax) - (invoice.returned_amount || 0);
                      const balance = currentTotal - (invoice.total_paid || 0);
                      if (balance <= 0) return <span className="text-emerald-600">0.00 сомони</span>;
                      return <span className="text-rose-600">{balance.toFixed(2)} сомони</span>;
                    })()}
                  </td>
                  <td className="px-4 py-4">
                    {invoice.cancelled ? (
                      <Badge variant="danger">Отменено</Badge>
                    ) : (
                      <Badge variant={(() => {
                        const currentTotal = (invoice.total_amount - (invoice.total_amount * invoice.discount / 100) + invoice.tax) - (invoice.returned_amount || 0);
                        const paid = invoice.total_paid || 0;
                        if (paid >= currentTotal) return 'success';
                        if (paid > 0) return 'warning';
                        return 'danger';
                      })()}>
                        {(() => {
                          const currentTotal = (invoice.total_amount - (invoice.total_amount * invoice.discount / 100) + invoice.tax) - (invoice.returned_amount || 0);
                          const paid = invoice.total_paid || 0;
                          if (paid >= currentTotal) return 'ОПЛАЧЕНО';
                          if (paid > 0) return 'ЧАСТИЧНО';
                          return 'ДОЛГ';
                        })()}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600">{invoice.staff_name}</td>
                  <td className="px-4 py-4 text-right space-x-2">
                    <button 
                      onClick={() => fetchInvoiceDetails(invoice.id)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Просмотр"
                    >
                      <Printer size={18} />
                    </button>
                    {!invoice.cancelled && (
                      <>
                        <button 
                          onClick={() => {
                            fetchInvoiceDetails(invoice.id, true);
                            setShowReturnModal(true);
                          }}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Возврат"
                        >
                          <RefreshCw size={18} />
                        </button>
                        {user?.role === 'admin' && (
                          <>
                            {invoice.status !== 'paid' && (
                              <button 
                                onClick={() => {
                                  setSelectedInvoiceForPayment(invoice);
                                  setShowPaymentModal(true);
                                }}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Оплатить"
                              >
                                <DollarSign size={18} />
                              </button>
                            )}
                            <button 
                              onClick={async () => {
                                if (confirm("Вы уверены, что хотите удалить эту накладную?")) {
                                  await fetch(`/api/invoices/${invoice.id}?warehouse_id=${warehouseId}`, {
                                    method: 'DELETE'
                                  });
                                  fetchData();
                                }
                              }}
                              className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Удалить"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {invoices.map(invoice => (
            <div key={invoice.id} className={`p-4 space-y-3 ${invoice.cancelled ? 'opacity-50 grayscale' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase">#{invoice.id} • {new Date(invoice.created_at).toLocaleDateString('ru-RU')}</p>
                  <p className="font-bold text-slate-900 text-lg">{invoice.customer_name}</p>
                </div>
                <div className="text-right">
                  {invoice.cancelled ? (
                    <Badge variant="danger">Отменено</Badge>
                  ) : (
                    <Badge variant={invoice.status === 'paid' ? 'success' : (invoice.status === 'partial' ? 'warning' : 'danger')}>
                      {invoice.status === 'paid' ? 'ОПЛАЧЕНО' : (invoice.status === 'partial' ? 'ЧАСТИЧНО' : 'ДОЛГ')}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl text-center">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Сумма</p>
                  <p className="font-bold text-slate-900">{(invoice.total_amount - (invoice.total_amount * invoice.discount / 100) + invoice.tax - (invoice.returned_amount || 0)).toFixed(2)} сомони</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Оплачено</p>
                  <p className="font-bold text-emerald-600">{(invoice.total_paid || 0).toFixed(2)} сомони</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Долг</p>
                  <p className="font-bold text-rose-600">
                    {(() => {
                      const currentTotal = (invoice.total_amount - (invoice.total_amount * invoice.discount / 100) + invoice.tax - (invoice.returned_amount || 0));
                      const balance = currentTotal - (invoice.total_paid || 0);
                      return Math.max(0, balance).toFixed(2);
                    })()} сомони
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-500">Сотрудник: {invoice.staff_name}</p>
                <div className="flex space-x-3">
                  <button className="p-2 bg-slate-100 text-slate-600 rounded-lg"><Printer size={20} /></button>
                  {!invoice.cancelled && (
                    <>
                      {invoice.status !== 'paid' && (
                        <button 
                          onClick={() => {
                            setSelectedInvoiceForPayment(invoice);
                            setPaymentAmount((invoice.total_amount - (invoice.total_amount * invoice.discount / 100) + invoice.tax) - (invoice.total_paid || 0));
                            setShowPaymentModal(true);
                          }}
                          className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"
                        >
                          <DollarSign size={20} />
                        </button>
                      )}
                      {(user?.role === 'admin' || user?.can_cancel) && (
                        <button 
                          onClick={async () => {
                            const reason = prompt("Причина отмены?");
                            if (reason) {
                              await fetch(`/api/invoices/${invoice.id}/cancel`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ reason, user_id: user?.id })
                              });
                              fetchData();
                            }
                          }}
                          className="p-2 bg-amber-50 text-amber-600 rounded-lg"
                        >
                          <Undo2 size={20} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {showPaymentModal && selectedInvoiceForPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Оплата накладной #{selectedInvoiceForPayment.id}</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <form className="p-6 space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = Object.fromEntries(formData.entries());
              
              await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  customer_id: selectedInvoiceForPayment.customer_id,
                  invoice_id: selectedInvoiceForPayment.id,
                  amount: parseFloat(data.amount as string),
                  method: data.method,
                  note: data.note,
                  user_id: user?.id
                })
              });
              
              fetchData();
              setShowPaymentModal(false);
            }}>
              <div className="p-4 bg-slate-50 rounded-xl mb-4">
                <p className="text-sm text-slate-500">Клиент: <span className="font-bold text-slate-900">{selectedInvoiceForPayment.customer_name}</span></p>
                <p className="text-sm text-slate-500">Сумма накладной: <span className="font-bold text-slate-900">{(selectedInvoiceForPayment.total_amount - (selectedInvoiceForPayment.total_amount * selectedInvoiceForPayment.discount / 100) + selectedInvoiceForPayment.tax).toFixed(2)} сомони</span></p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Сумма оплаты</label>
                <input name="amount" type="number" step="0.01" required className="w-full px-4 py-2 rounded-lg border border-slate-200" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Способ оплаты</label>
                <select name="method" className="w-full px-4 py-2 rounded-lg border border-slate-200">
                  <option value="cash">Наличные</option>
                  <option value="card">Карта</option>
                  <option value="transfer">Перевод</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Примечание</label>
                <textarea name="note" className="w-full px-4 py-2 rounded-lg border border-slate-200" rows={2}></textarea>
              </div>
              <div className="pt-4 flex space-x-3">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50">Отмена</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">Сохранить</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showReturnModal && selectedInvoiceForReturn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Возврат: Накладная #{selectedInvoiceForReturn.id}</h3>
              <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="max-h-100 overflow-y-auto space-y-4">
                {returnItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-bold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">Доступно для возврата: {item.max_quantity}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input 
                        type="number" 
                        className="w-20 px-2 py-1 border border-slate-200 rounded text-center"
                        value={item.quantity}
                        max={item.max_quantity}
                        min={0}
                        onChange={e => {
                          const val = Math.min(item.max_quantity, Math.max(0, parseInt(e.target.value) || 0));
                          setReturnItems(returnItems.map((ri, idx) => idx === i ? { ...ri, quantity: val } : ri));
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-4 flex space-x-3">
                <button onClick={() => setShowReturnModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50">Отмена</button>
                <button onClick={handleReturn} className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700">Подтвердить возврат</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showDetailsModal && selectedInvoiceDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <h3 className="text-xl font-bold text-slate-900">Накладная #{selectedInvoiceDetails.id}</h3>
              <div className="flex items-center space-x-2">
                <button onClick={() => window.print()} className="p-2 text-slate-400 hover:text-indigo-600"><Printer size={20} /></button>
                <button onClick={() => setShowDetailsModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6" id="printable-invoice">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Клиент</h4>
                  <p className="text-lg font-bold text-slate-900">{selectedInvoiceDetails.customer_name}</p>
                  <p className="text-slate-500">{selectedInvoiceDetails.customer_phone}</p>
                  <p className="text-slate-500">{selectedInvoiceDetails.customer_address}</p>
                </div>
                <div className="text-right">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Статус</h4>
                  <Badge variant={selectedInvoiceDetails.status === 'paid' ? 'success' : (selectedInvoiceDetails.status === 'partial' ? 'warning' : 'danger')}>
                    {selectedInvoiceDetails.status === 'paid' ? 'ОПЛАЧЕНО' : (selectedInvoiceDetails.status === 'partial' ? 'ЧАСТИЧНО' : 'ДОЛГ')}
                  </Badge>
                  <p className="text-sm text-slate-500 mt-2">{new Date(selectedInvoiceDetails.created_at).toLocaleString('ru-RU')}</p>
                </div>
              </div>

              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-xs font-bold text-slate-500 uppercase">Товар</th>
                      <th className="px-4 py-2 text-xs font-bold text-slate-500 uppercase text-center">Кол-во</th>
                      <th className="px-4 py-2 text-xs font-bold text-slate-500 uppercase text-right">Цена</th>
                      <th className="px-4 py-2 text-xs font-bold text-slate-500 uppercase text-right">Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {selectedInvoiceDetails.items.map((item: any, i: number) => (
                      <tr key={i}>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.product_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 text-center">{item.quantity} {item.unit}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 text-right">{item.selling_price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">{(item.quantity * item.selling_price).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Подытог:</span>
                    <span>{selectedInvoiceDetails.total_amount.toFixed(2)} сомони</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Скидка ({selectedInvoiceDetails.discount}%):</span>
                    <span>-{(selectedInvoiceDetails.total_amount * selectedInvoiceDetails.discount / 100).toFixed(2)} сомони</span>
                  </div>
                  <div className="flex justify-between text-xl font-black text-slate-900 pt-2 border-t border-slate-100">
                    <span>Итого:</span>
                    <span>{(selectedInvoiceDetails.total_amount - (selectedInvoiceDetails.total_amount * selectedInvoiceDetails.discount / 100) + selectedInvoiceDetails.tax - (selectedInvoiceDetails.returned_amount || 0)).toFixed(2)} сомони</span>
                  </div>
                  <div className="pt-4 space-y-1 border-t border-slate-100 mt-4">
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Первоначально оплачено:</span>
                      <span className="font-bold text-emerald-600">{(selectedInvoiceDetails.payments.filter((p: any) => p.amount > 0)[0]?.amount || 0).toFixed(2)} сомони</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Всего оплачено:</span>
                      <span className="font-bold text-emerald-600">{(selectedInvoiceDetails.total_paid || 0).toFixed(2)} сомони</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Остаток долга:</span>
                      <span className="font-bold text-rose-600">
                        {(() => {
                          const net = (selectedInvoiceDetails.total_amount - (selectedInvoiceDetails.total_amount * selectedInvoiceDetails.discount / 100) + selectedInvoiceDetails.tax - (selectedInvoiceDetails.returned_amount || 0));
                          const balance = net - (selectedInvoiceDetails.total_paid || 0);
                          return Math.max(0, balance).toFixed(2);
                        })()} сомони
                      </span>
                    </div>
                  </div>
                  {selectedInvoiceDetails.returned_amount > 0 && (
                    <div className="flex justify-between text-sm text-rose-600 italic">
                      <span>В т.ч. возврат:</span>
                      <span>-{selectedInvoiceDetails.returned_amount.toFixed(2)} сомони</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">История оплат и возвратов</h4>
                <div className="space-y-2">
                  {selectedInvoiceDetails.payments.map((p: any, i: number) => (
                    <div key={`pay-${i}`} className={`flex justify-between items-center p-3 rounded-lg ${p.amount < 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      <div className="flex items-center space-x-3">
                        {p.amount < 0 ? <Undo2 size={16} /> : <DollarSign size={16} />}
                        <div>
                          <p className="text-sm font-bold">{p.amount.toFixed(2)} сомони</p>
                          <p className="text-[10px] opacity-70">{new Date(p.created_at).toLocaleString('ru-RU')} • {p.method === 'return' ? 'Возврат' : p.method}</p>
                        </div>
                      </div>
                      {p.note && <p className="text-xs italic opacity-70">{p.note}</p>}
                    </div>
                  ))}
                  {selectedInvoiceDetails.returns?.map((r: any, i: number) => (
                    <div key={`ret-${i}`} className="flex justify-between items-center p-3 bg-rose-50 rounded-lg text-rose-700">
                      <div className="flex items-center space-x-3">
                        <Undo2 size={16} />
                        <div>
                          <p className="text-sm font-bold">Возврат: {r.product_name}</p>
                          <p className="text-[10px] opacity-70">{new Date(r.created_at).toLocaleString('ru-RU')} • {r.quantity_change} {r.unit || 'шт'}</p>
                        </div>
                      </div>
                      <p className="text-xs font-bold">-{((r.selling_price_at_time || 0) * r.quantity_change).toFixed(2)}</p>
                    </div>
                  ))}
                  {selectedInvoiceDetails.payments.length === 0 && (!selectedInvoiceDetails.returns || selectedInvoiceDetails.returns.length === 0) && (
                    <p className="text-center text-slate-400 py-4 text-sm">Истории нет</p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowDetailsModal(false)} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold">Закрыть</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
