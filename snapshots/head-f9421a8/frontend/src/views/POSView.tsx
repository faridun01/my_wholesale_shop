import React, { useState, useEffect } from 'react';
import { getProducts } from '../api/products.api';
import { createInvoice } from '../api/invoices.api';
import { getCustomers } from '../api/customers.api';
import { getWarehouses } from '../api/warehouses.api';
import { 
  Plus, 
  Trash2, 
  ShoppingCart, 
  User, 
  Search, 
  ChevronRight,
  CreditCard,
  Banknote,
  Receipt,
  Calendar,
  Warehouse,
  X,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

export default function POSView() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [paymentDueDate, setPaymentDueDate] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'cart'>('products');

  useEffect(() => {
    getProducts(warehouseId ? Number(warehouseId) : undefined).then(data => setProducts(Array.isArray(data) ? data : [])).catch(console.error);
    getCustomers().then(data => setCustomers(Array.isArray(data) ? data : [])).catch(console.error);
    getWarehouses().then(data => setWarehouses(Array.isArray(data) ? data : [])).catch(console.error);
    
    const pending = localStorage.getItem('pending_cart');
    if (pending) {
      setCart(JSON.parse(pending));
      localStorage.removeItem('pending_cart');
    }
  }, [warehouseId]);

  const addToCart = (product: any) => {
    const existing = cart.find(item => item.id === product.id);
    const currentQty = existing ? existing.quantity : 0;

    if (currentQty + 1 > product.stock) {
      toast.error(`Недостаточно товара на складе. Доступно: ${product.stock} ${product.unit}`);
      return;
    }

    if (existing) {
      setCart(cart.map(item => 
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    toast.success(`${product.name} добавлен в корзину`, { duration: 1000 });
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const updateQuantity = (id: number, qty: number) => {
    if (qty <= 0) return removeFromCart(id);
    
    const product = products.find(p => p.id === id);
    if (product && qty > product.stock) {
      toast.error(`Недостаточно товара на складе. Доступно: ${product.stock} ${product.unit}`);
      return;
    }

    setCart(cart.map(item => item.id === id ? { ...item, quantity: qty } : item));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);
  const total = subtotal - (subtotal * discount / 100);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      let targetCustomerId = customerId;
      if (!targetCustomerId) {
        const defaultCustomer = customers.find(c => c.name === 'Обычный клиент') || customers[0];
        if (defaultCustomer) {
          targetCustomerId = defaultCustomer.id;
        } else {
          toast.error('Пожалуйста, выберите клиента');
          setIsSubmitting(false);
          return;
        }
      }

      if (!warehouseId) {
        toast.error('Пожалуйста, выберите склад');
        setIsSubmitting(false);
        return;
      }

      await createInvoice({
        customerId: targetCustomerId,
        warehouseId: Number(warehouseId),
        items: cart.map(item => ({
          productId: item.id,
          quantity: Number(item.quantity),
          sellingPrice: Number(item.sellingPrice)
        })),
        discount: Number(discount),
        paidAmount: parseFloat(paidAmount) || 0,
        paymentMethod,
        paymentDueDate: paymentDueDate || undefined
      });
      toast.success('Заказ успешно оформлен!');
      setCart([]);
      setPaidAmount('');
      setPaymentDueDate('');
      setCustomerId(null);
      setDiscount(0);
      navigate('/sales');
    } catch (err: any) {
      console.error('Checkout error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Ошибка при создании заказа';
      toast.error(errorMessage === 'Network Error' ? 'Ошибка сети. Проверьте соединение или попробуйте позже.' : errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    // We rely on the backend to provide the correct stock for the selected warehouseId
    return matchesSearch && p.stock > 0;
  });

  return (
    <div className="flex flex-col h-full lg:h-[calc(100vh-5rem)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 shrink-0">
        <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">Продажи</h1>
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <select 
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setCart([]);
            }}
            className="flex-1 md:w-64 px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none"
          >
            <option value="">Выберите склад</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <button onClick={() => navigate('/sales')} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-600 transition-colors">
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="flex lg:hidden bg-white p-1 rounded-2xl border border-slate-100 mb-6 shadow-sm shrink-0">
        <button 
          onClick={() => setActiveTab('products')}
          className={clsx(
            "flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center space-x-2",
            activeTab === 'products' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400"
          )}
        >
          <Package size={18} />
          <span>Товары</span>
        </button>
        <button 
          onClick={() => setActiveTab('cart')}
          className={clsx(
            "flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center space-x-2 relative",
            activeTab === 'cart' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400"
          )}
        >
          <ShoppingCart size={18} />
          <span>Корзина</span>
          {cart.length > 0 && (
            <span className="absolute top-2 right-4 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] flex items-center justify-center border-2 border-white">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8 min-h-0">
        {/* Left Side: Product Selection */}
        <div className={clsx(
          "lg:col-span-3 bg-white rounded-[2rem] lg:rounded-[2.5rem] border border-slate-100 flex flex-col overflow-hidden shadow-sm transition-all min-h-0",
          activeTab === 'products' ? "flex" : "hidden lg:flex"
        )}>
          <div className="p-6 md:p-8 border-b border-slate-50 bg-slate-50/30 shrink-0">
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Поиск товара по названию или SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold transition-all text-lg"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="flex flex-col p-5 bg-white border border-slate-100 rounded-3xl hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/5 transition-all text-left group relative overflow-hidden"
              >
                <div className="flex items-center mb-4">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mr-4 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors shrink-0">
                    <Package size={28} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-slate-900 text-sm line-clamp-2 leading-tight">{product.name}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">SKU: {product.sku || '---'}</p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-50">
                  <p className="text-lg font-black text-indigo-600">{product.sellingPrice.toFixed(2)} <span className="text-[10px] uppercase">TJS</span></p>
                  <span className={clsx(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    product.stock <= 5 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                  )}>
                    {product.stock} {product.unit}
                  </span>
                </div>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
                    <Plus size={16} />
                  </div>
                </div>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                  <Search size={40} />
                </div>
                <p className="text-slate-400 font-bold">Товары не найдены</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Order Summary */}
        <div className={clsx(
          "lg:col-span-2 bg-white rounded-[1.5rem] lg:rounded-[2rem] border border-slate-100 flex flex-col overflow-hidden shadow-sm transition-all min-h-0",
          activeTab === 'cart' ? "flex" : "hidden lg:flex"
        )}>
          <div className="p-3 lg:p-4 border-b border-slate-50 bg-slate-50/30 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                <ShoppingCart className="text-indigo-600" size={16} />
                <span>Корзина</span>
              </h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cart.length} поз.</span>
            </div>
            <select 
              value={customerId || ''}
              onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold appearance-none bg-white transition-all text-xs"
            >
              <option value="">Выберите клиента</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto p-2 lg:p-3 space-y-1.5">
            {cart.map(item => (
              <div key={item.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl group border border-transparent hover:border-slate-200 transition-all">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-[11px] font-black text-slate-900 truncate leading-tight">{item.name}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.sellingPrice.toFixed(2)} TJS</p>
                </div>
                
                <div className="flex items-center space-x-1.5">
                  <div className="flex items-center bg-white rounded-md border border-slate-200">
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-rose-500"
                    >
                      <X size={8} />
                    </button>
                    <span className="w-5 text-center text-[10px] font-black text-slate-900">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-indigo-600"
                    >
                      <Plus size={8} />
                    </button>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} className="p-1 text-slate-300 hover:text-rose-500">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 opacity-50">
                  <ShoppingCart size={32} />
                </div>
                <p className="text-sm font-black tracking-tight">Корзина пуста</p>
              </div>
            )}
          </div>

          <div className="p-3 lg:p-4 bg-slate-900 text-white space-y-2 lg:space-y-3 relative overflow-hidden shrink-0">
            {/* Decorative background element */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/10 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />
            
            <div className="space-y-1.5 lg:space-y-2 relative z-10">
              <div className="flex justify-between items-center text-[9px] font-black">
                <span className="text-slate-400 uppercase tracking-widest">Сумма: {subtotal.toFixed(2)}</span>
                <span className="text-rose-400 uppercase tracking-widest">Скидка: -{(subtotal * discount / 100).toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[7px] font-black text-slate-500 uppercase">Скидка %</span>
                  <input 
                    type="number" 
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-full pl-12 pr-2 py-1.5 bg-white/5 border border-white/10 rounded-lg font-black text-white outline-none focus:border-indigo-500 text-right text-[10px]"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[7px] font-black text-slate-500 uppercase">Оплата</span>
                  <input 
                    type="number" 
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-10 pr-2 py-1.5 bg-white/5 border border-white/10 rounded-lg font-black text-white outline-none focus:border-indigo-500 text-right text-[10px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'cash', label: 'Нал', icon: Banknote },
                  { id: 'card', label: 'Карт', icon: CreditCard },
                  { id: 'transfer', label: 'Пер', icon: Receipt }
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id as any)}
                    className={clsx(
                      "flex items-center justify-center py-1 rounded-lg border transition-all space-x-1",
                      paymentMethod === method.id 
                        ? "bg-indigo-600 border-indigo-600 text-white" 
                        : "bg-white/5 border-white/10 text-slate-400"
                    )}
                  >
                    <method.icon size={8} />
                    <span className="text-[7px] font-black uppercase tracking-tighter">{method.label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="pt-1.5 lg:pt-2 border-t border-white/10 relative z-10">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Итого</p>
                  <span className="text-xl lg:text-2xl font-black tracking-tighter text-white">{total.toFixed(2)}</span>
                </div>
                
                {paidAmount && (
                  <div className="text-right">
                    <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">
                      {parseFloat(paidAmount) >= total ? "Сдача" : "Долг"}
                    </p>
                    <div className={clsx(
                      "text-base font-black tracking-tight",
                      parseFloat(paidAmount) >= total ? "text-emerald-400" : "text-rose-400"
                    )}>
                      {Math.abs(parseFloat(paidAmount) - total).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={handleCheckout}
                disabled={isSubmitting || cart.length === 0}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-[0.1em] shadow-lg hover:bg-indigo-500 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Receipt size={12} />
                    <span className="text-[10px]">Завершить продажу</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
