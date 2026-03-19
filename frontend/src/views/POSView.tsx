import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  ChevronRight,
  Minus,
  Package,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Trash2,
  User,
  Warehouse,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { getProducts } from '../api/products.api';
import { createInvoice } from '../api/invoices.api';
import { getCustomers } from '../api/customers.api';
import { getWarehouses } from '../api/warehouses.api';
import { filterWarehousesForUser, getCurrentUser, getUserWarehouseId, isAdminUser } from '../utils/userAccess';
import { formatMoney, toFixedNumber } from '../utils/format';
import { handleBrokenImage, resolveMediaUrl } from '../utils/media';
import { formatProductName } from '../utils/productName';
import { getDefaultWarehouseId } from '../utils/warehouse';

type PaymentMethod = 'cash' | 'card' | 'transfer';

function tone(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

function getStoredWarehouseId() {
  if (typeof window === 'undefined') {
    return '';
  }

  return sessionStorage.getItem('pos_warehouse_session') || localStorage.getItem('pos_warehouse_session') || '';
}

const posTheme = {
  products: {
    soft: 'bg-sky-50',
    icon: 'bg-sky-100 text-sky-600',
    accent: 'bg-sky-500 text-white hover:bg-sky-600',
    tab: 'bg-sky-500 text-white',
    pill: 'bg-sky-100 text-sky-700',
  },
  cart: {
    soft: 'bg-emerald-50',
    icon: 'bg-emerald-100 text-emerald-600',
    accent: 'bg-emerald-500 text-white hover:bg-emerald-600',
    tab: 'bg-emerald-500 text-white',
    pill: 'bg-emerald-100 text-emerald-700',
  },
  payment: {
    active: 'border-amber-500 bg-amber-500 text-white',
    idle: 'border-amber-100 bg-amber-50 text-amber-700',
    summary: 'bg-amber-50',
  },
};

type CartItem = {
  id: number;
  name: string;
  quantity: number;
  quantityInput?: string;
  stock: number;
  unit: string;
  sellingPrice: number;
  photoUrl?: string | null;
  [key: string]: any;
};

export default function POSView() {
  const cartStorageKey = 'pos_cart_session';
  const pendingCartStorageKey = 'pending_cart';
  const warehouseStorageKey = 'pos_warehouse_session';
  const navigate = useNavigate();
  const user = getCurrentUser();
  const isAdmin = isAdminUser(user);
  const userWarehouseId = getUserWarehouseId(user);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState(() => {
    return getStoredWarehouseId() || (userWarehouseId ? String(userWarehouseId) : '');
  });
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discount, setDiscount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'cart'>('products');
  const [productSearch, setProductSearch] = useState('');
  const [isStorageHydrated, setIsStorageHydrated] = useState(false);
  const productListRef = useRef<HTMLDivElement | null>(null);
  const lastProductScrollRef = useRef(0);

  useEffect(() => {
    const savedCart =
      sessionStorage.getItem(cartStorageKey) ||
      localStorage.getItem(cartStorageKey);
    const pendingCart =
      sessionStorage.getItem(pendingCartStorageKey) ||
      localStorage.getItem(pendingCartStorageKey);

    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }

    if (pendingCart) {
      const parsedPendingCart = JSON.parse(pendingCart);
      setCart(parsedPendingCart);
      sessionStorage.setItem(cartStorageKey, JSON.stringify(parsedPendingCart));
      localStorage.setItem(cartStorageKey, JSON.stringify(parsedPendingCart));
      sessionStorage.removeItem(pendingCartStorageKey);
      localStorage.removeItem(pendingCartStorageKey);
    }

    setIsStorageHydrated(true);
  }, []);

  useEffect(() => {
    const effectiveWarehouseId = warehouseId || (userWarehouseId ? String(userWarehouseId) : '');

    getProducts(effectiveWarehouseId ? Number(effectiveWarehouseId) : undefined)
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(console.error);
    getCustomers()
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch(console.error);
    getWarehouses()
      .then((data) => {
        const filteredWarehouses = filterWarehousesForUser(Array.isArray(data) ? data : [], user);
        setWarehouses(filteredWarehouses);
        const defaultWarehouseId = getDefaultWarehouseId(filteredWarehouses);
        if (isAdmin && !warehouseId && defaultWarehouseId) {
          setWarehouseId(String(defaultWarehouseId));
        } else if (!isAdmin && filteredWarehouses[0]) {
          setWarehouseId(String(filteredWarehouses[0].id));
        }
      })
      .catch(console.error);
  }, [warehouseId, isAdmin, userWarehouseId]);

  useEffect(() => {
    if (!isStorageHydrated) {
      return;
    }

    sessionStorage.setItem(cartStorageKey, JSON.stringify(cart));
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, isStorageHydrated]);

  useEffect(() => {
    if (!customerId) {
      setCustomerSearch('');
      return;
    }

    const selectedCustomer = customers.find((customer) => customer.id === customerId);
    if (selectedCustomer) {
      setCustomerSearch(selectedCustomer.name || '');
    }
  }, [customerId, customers]);

  useEffect(() => {
    if (warehouseId) {
      sessionStorage.setItem(warehouseStorageKey, warehouseId);
      localStorage.setItem(warehouseStorageKey, warehouseId);
    }
  }, [warehouseId]);

  const addToCart = (product: any) => {
    if (productListRef.current) {
      lastProductScrollRef.current = productListRef.current.scrollTop;
    }

    if (isAdmin && !warehouseId) {
      toast.error('Сначала выберите склад');
      return;
    }

    const existing = cart.find((item) => item.id === product.id);
    const currentQty = existing ? existing.quantity : 0;

    if (currentQty + 1 > product.stock) {
      toast.error(`Недостаточно товара. Доступно: ${product.stock} ${product.unit}`);
      return;
    }

    if (existing) {
      setCart(cart.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1, quantityInput: undefined } : item)));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (id: number) => {
    if (productListRef.current) {
      lastProductScrollRef.current = productListRef.current.scrollTop;
    }

    setCart(cart.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: number, quantity: number) => {
    if (productListRef.current) {
      lastProductScrollRef.current = productListRef.current.scrollTop;
    }

    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }

    const product = products.find((item) => item.id === id);
    if (product && quantity > product.stock) {
      toast.error(`Недостаточно товара. Доступно: ${product.stock} ${product.unit}`);
      return;
    }

    setCart(cart.map((item) => (item.id === id ? { ...item, quantity } : item)));
  };

  const updateQuantityInput = (id: number, value: string) => {
    if (productListRef.current) {
      lastProductScrollRef.current = productListRef.current.scrollTop;
    }

    setCart((currentCart) =>
      currentCart.map((item) => {
        if (item.id !== id) {
          return item;
        }

        if (value === '') {
          return { ...item, quantityInput: '' };
        }

        const parsedQuantity = Number(value);
        if (Number.isNaN(parsedQuantity)) {
          return item;
        }

        const product = products.find((productItem) => productItem.id === id);
        const maxStock = product?.stock ?? item.stock;
        const nextQuantity = Math.max(1, Math.min(parsedQuantity, maxStock));
        return {
          ...item,
          quantity: nextQuantity,
          quantityInput: String(nextQuantity),
        };
      }),
    );
  };

  const commitQuantityInput = (id: number) => {
    setCart((currentCart) =>
      currentCart.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const product = products.find((productItem) => productItem.id === id);
        const maxStock = product?.stock ?? item.stock;
        const normalizedQuantity = Math.max(1, Math.min(item.quantity, maxStock));
        return {
          ...item,
          quantity: normalizedQuantity,
          quantityInput: undefined,
        };
      }),
    );
  };

  useLayoutEffect(() => {
    if (productListRef.current) {
      productListRef.current.scrollTop = lastProductScrollRef.current;
    }
  }, [cart]);

  const subtotal = cart.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
  const normalizedDiscount = Math.max(0, discount);
  const discountAmount = subtotal * (normalizedDiscount / 100);
  const total = subtotal - discountAmount;
  const paid = parseFloat(paidAmount) || 0;
  const balance = paid - total;

  const handleCheckout = async () => {
    if (!cart.length) return;
    if (!warehouseId) {
      toast.error('Выберите склад');
      return;
    }

    setIsSubmitting(true);
    try {


      await createInvoice({
        customerId: customerId || undefined,
        warehouseId: Number(warehouseId),
        items: cart.map((item) => ({
          productId: item.id,
          quantity: Number(item.quantity),
          sellingPrice: Number(item.sellingPrice),
        })),
        discount: Number(normalizedDiscount),
        paidAmount: paid,
        paymentMethod,
      });

      toast.success('Продажа оформлена');
      setCart([]);
      sessionStorage.removeItem(cartStorageKey);
      sessionStorage.removeItem(pendingCartStorageKey);
      setPaidAmount('');
      setCustomerId(null);
      setDiscount(0);
      navigate('/sales');
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Ошибка при создании продажи';
      toast.error(message === 'Network Error' ? 'Ошибка сети. Проверьте подключение.' : message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    if (product.stock <= 0) return false;

    const query = productSearch.trim().toLowerCase();
    if (!query) return true;

    return [product.name, String(product.id)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const filteredCustomers = [...customers]
    .map((customer) => {
      const query = customerSearch.trim().toLowerCase();
      const name = String(customer.name || '').toLowerCase();
      const startsWith = query ? name.startsWith(query) : false;
      const includes = query ? name.includes(query) : true;
      const index = query ? name.indexOf(query) : 0;

      return {
        customer,
        visible: query ? includes : true,
        score: startsWith ? 0 : index >= 0 ? index + 1 : Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((entry) => entry.visible)
    .sort((a, b) => a.score - b.score || String(a.customer.name || '').localeCompare(String(b.customer.name || ''), 'ru'))
    .map((entry) => entry.customer);

  return (
    <div className="app-page-shell app-page-pad min-h-full">
      <div className="overflow-hidden rounded-[28px] bg-[#f4f5fb]">
        <div className="space-y-5 px-5 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900">{'POS Терминал'}</h1>
              <p className="mt-1 text-sm text-slate-500">{'Оформление продаж, выбор клиента и создание накладной.'}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>{'Главная'}</span>
              <span>/</span>
              <span className="text-slate-600">{'POS Терминал'}</span>
            </div>
          </div>

          <div className="flex gap-4 border-b border-slate-200 bg-white px-4 py-3 rounded-[24px] lg:hidden">
            <button
              onClick={() => setActiveTab('products')}
              className={clsx(
                'flex-1 rounded-2xl px-4 py-3 text-xs uppercase tracking-wide transition-all',
                activeTab === 'products' ? posTheme.products.tab : 'bg-sky-50 text-sky-700'
              )}
            >
              {'Товары'}
            </button>
            <button
              onClick={() => setActiveTab('cart')}
              className={clsx(
                'flex-1 rounded-2xl px-4 py-3 text-xs uppercase tracking-wide transition-all',
                activeTab === 'cart' ? posTheme.cart.tab : 'bg-emerald-50 text-emerald-700'
              )}
            >
              {'Корзина'} {cart.length ? `(${cart.length})` : ''}
            </button>
          </div>

          <div className="grid items-stretch gap-4 lg:grid-cols-[1.55fr_0.95fr]">
            <section className={clsx(activeTab === 'products' ? 'block lg:h-full' : 'hidden lg:block lg:h-full')}>
              <div className="flex h-full flex-col overflow-hidden rounded-[24px] border border-white bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-2xl font-semibold text-slate-900">{'Товары'}</h2>
                      <p className="mt-1 text-sm text-slate-500">{filteredProducts.length} {'доступных позиций'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 shadow-sm">
                        <Warehouse size={16} className="text-sky-500" />
                        <select
                          value={warehouseId}
                          onChange={(e) => {
                            setWarehouseId(e.target.value);
                            setCart([]);
                          }}
                          disabled={!isAdmin}
                          className="min-w-[170px] appearance-none bg-transparent text-sm text-slate-700 outline-none"
                        >
                          <option value="">{'Выберите склад'}</option>
                          {warehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => navigate('/sales')}
                        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 text-sky-600 transition-colors hover:bg-sky-100"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder={'Поиск товара или ID...'}
                        className="w-full rounded-[24px] border border-sky-100 bg-sky-50 py-4 pl-12 pr-5 text-sm text-slate-700 outline-none transition-colors focus:border-sky-300"
                      />
                    </div>
                  </div>

                  {isAdmin && !warehouseId && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      {'Перед добавлением товара выберите склад.'}
                    </div>
                  )}
                  <div className="hidden">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-500" size={16} />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder={'Поиск товара или ID...'}
                      className="w-full rounded-2xl border border-sky-100 bg-sky-50 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition-all focus:border-sky-300 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="hidden grid-cols-[minmax(0,1.7fr)_90px_110px_110px] bg-sky-50 px-5 py-4 text-sm text-slate-500 md:grid">
                  <div>{'Товар'}</div>
                  <div className="text-center">{'Остаток'}</div>
                  <div className="text-center">{'Цена'}</div>
                  <div className="text-right">{'Действие'}</div>
                </div>

                <div ref={productListRef} className="h-[560px] overflow-y-auto">
                  <div className="space-y-3 p-3 md:hidden">
                    {filteredProducts.map((product) => (
                      <div key={`mobile-pos-${product.id}`} className="rounded-2xl border border-sky-100 bg-white p-3 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-sky-100 text-sky-600">
                            {product.photoUrl ? (
                              <img
                                src={resolveMediaUrl(product.photoUrl, product.id)}
                                alt={product.name}
                                className="h-full w-full rounded-2xl object-cover"
                                referrerPolicy="no-referrer"
                                onError={(event) => handleBrokenImage(event, product.id)}
                              />
                            ) : (
                              <Package size={18} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-[12px] leading-4 text-slate-900">{formatProductName(product.name)}</p>
                            <p className="mt-1 text-[11px] text-slate-400">ID {product.id}</p>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-sky-50 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{'Остаток'}</p>
                            <p className="mt-1 text-sm text-slate-900">{product.stock}</p>
                          </div>
                          <div className="rounded-xl bg-sky-50 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{'Цена'}</p>
                            <p className="mt-1 break-words text-sm text-slate-900">{formatMoney(product.sellingPrice)}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => addToCart(product)}
                          disabled={isAdmin && !warehouseId}
                          className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-sky-500 px-3 py-2.5 text-sm text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus size={15} />
                          <span>{'Добавить'}</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="hidden grid-cols-[minmax(0,1.7fr)_90px_110px_110px] items-center border-b border-slate-100 px-5 py-3 last:border-b-0 md:grid"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                          {product.photoUrl ? (
                            <img
                              src={resolveMediaUrl(product.photoUrl, product.id)}
                              alt={product.name}
                              className="h-full w-full rounded-2xl object-cover"
                              referrerPolicy="no-referrer"
                              onError={(event) => handleBrokenImage(event, product.id)}
                            />
                          ) : (
                            <Package size={18} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="break-words text-[13px] leading-5 text-slate-900">{formatProductName(product.name)}</p>
                          <p className="text-xs text-slate-400">ID {product.id}</p>
                        </div>
                      </div>

                      <div className="text-center">
                        <span className="rounded-xl bg-sky-100 px-3 py-1.5 text-sm text-sky-700">{product.stock}</span>
                      </div>

                      <div className="text-center text-sm text-slate-900">{formatMoney(product.sellingPrice)}</div>

                      <div className="text-right">
                        <button
                          onClick={() => addToCart(product)}
                          disabled={isAdmin && !warehouseId}
                          className="inline-flex items-center gap-1 rounded-xl bg-sky-500 px-3 py-2 text-sm text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus size={15} />
                          <span>{'Добавить'}</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {!filteredProducts.length && (
                    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-300">
                        <Search size={28} />
                      </div>
                      <p className="text-sm text-slate-500">{'Товары не найдены'}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <aside className={clsx(activeTab === 'cart' ? 'block lg:h-full' : 'hidden lg:block lg:h-full')}>
              <div className="flex h-full flex-col overflow-hidden rounded-[24px] border border-white bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">{'Корзина'}</h2>
                    <p className="mt-1 text-sm text-slate-500">{'Выбрано позиций:'} {cart.length}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-emerald-700">
                    <ShoppingCart size={18} />
                    <span className="text-sm font-semibold">{cart.length}</span>
                  </div>
                </div>

                <div className="space-y-3 border-b border-slate-200 px-4 py-4 md:px-5">
                  <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 md:hidden">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{'Сумма корзины'}</span>
                      <span className="text-base font-semibold text-slate-900">{formatMoney(total)}</span>
                    </div>
                  </div>

                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                    <input
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setCustomerId(null);
                        setIsCustomerDropdownOpen(true);
                      }}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      onBlur={() => {
                        window.setTimeout(() => {
                          setIsCustomerDropdownOpen(false);
                        }, 150);
                      }}
                      placeholder="Поиск клиента по имени"
                      className="w-full rounded-2xl border border-emerald-100 bg-emerald-50 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition-all focus:border-emerald-300 focus:bg-white"
                    />
                    {isCustomerDropdownOpen && (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-60 overflow-y-auto rounded-2xl border border-emerald-100 bg-white p-2 shadow-xl">
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setCustomerId(null);
                            setCustomerSearch('');
                            setIsCustomerDropdownOpen(false);
                          }}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-emerald-50"
                        >
                          <span>Без названия</span>
                          <span className="text-xs text-slate-400">по умолчанию</span>
                        </button>
                        {filteredCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setCustomerId(customer.id);
                              setCustomerSearch(customer.name || '');
                              setIsCustomerDropdownOpen(false);
                            }}
                            className={clsx(
                              'flex w-full rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-emerald-50',
                              customerId === customer.id ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700',
                            )}
                          >
                            {customer.name}
                          </button>
                        ))}
                        {!filteredCustomers.length && (
                          <div className="px-3 py-2 text-sm text-slate-400">Клиенты не найдены</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="max-h-[38vh] overflow-y-auto px-4 md:max-h-[320px] md:px-5">
                  {cart.map((item) => (
                    <div key={item.id} className="border-b border-slate-100 py-4 last:border-b-0">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                          {item.photoUrl ? (
                            <img
                              src={resolveMediaUrl(item.photoUrl, item.id)}
                              alt={item.name}
                              className="h-full w-full rounded-2xl object-cover"
                              referrerPolicy="no-referrer"
                              onError={(event) => handleBrokenImage(event, item.id)}
                            />
                          ) : (
                            <Package size={16} />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className="overflow-hidden break-words text-[12px] leading-[16px] text-slate-900"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {formatProductName(item.name)}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-between">
                            <p className="text-[13px] font-medium text-slate-900 md:min-w-[78px]">
                              {formatMoney(item.sellingPrice * item.quantity)}
                            </p>

                            <div className="flex items-center overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="flex h-8 w-8 items-center justify-center text-slate-500 transition-colors hover:bg-white"
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={products.find((product) => product.id === item.id)?.stock || undefined}
                                value={item.quantityInput ?? String(item.quantity)}
                                onChange={(e) => updateQuantityInput(item.id, e.target.value)}
                                onBlur={() => commitQuantityInput(item.id)}
                                className="h-8 w-14 min-w-[56px] border-x border-slate-200 bg-white px-2 text-center text-sm text-slate-900 outline-none md:w-20 md:min-w-[80px]"
                              />
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="flex h-8 w-8 items-center justify-center text-slate-500 transition-colors hover:bg-white"
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500 md:ml-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {!cart.length && (
                    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-300">
                        <ShoppingCart size={28} />
                      </div>
                      <p className="text-sm text-slate-500">{'Корзина пуста'}</p>
                    </div>
                  )}
                </div>

                <div className="sticky bottom-0 z-10 space-y-4 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:bg-white md:px-5 md:py-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="number"
                      min={0}
                      value={discount === 0 ? '' : discount}
                      onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                      placeholder={'Скидка %'}
                      className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-amber-300 focus:bg-white"
                    />
                    <input
                      type="number"
                      value={paidAmount}
                      min={0}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPaidAmount(value === '' ? '' : String(Math.max(0, Number(value) || 0)));
                      }}
                      placeholder={'Оплачено'}
                      className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-emerald-300 focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      { id: 'cash', label: 'Наличные', icon: Banknote },
                      { id: 'transfer', label: 'Перевод', icon: Receipt },
                    ].map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                        className={clsx(
                          'flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm transition-all',
                          paymentMethod === method.id
                            ? posTheme.payment.active
                            : posTheme.payment.idle
                        )}
                      >
                        <method.icon size={14} />
                        <span>{method.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3 rounded-[20px] bg-amber-50 px-4 py-4 text-sm shadow-[0_12px_28px_rgba(245,158,11,0.08)]">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>{'Подытог'}</span>
                      <span className="text-slate-900">{formatMoney(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                      <span>{'Скидка'}</span>
                      <span className="text-slate-900">-{toFixedNumber(discountAmount)} TJS</span>
                    </div>
                    {paidAmount && (
                      <div className="flex items-center justify-between text-slate-500">
                        <span>{balance >= 0 ? 'Сдача' : 'Долг'}</span>
                        <span className={balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {formatMoney(Math.abs(balance))}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-medium text-slate-900">
                      <span>Итого</span>
                      <span>{formatMoney(total)}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={isSubmitting || cart.length === 0}
                    className="flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-4 py-4 text-base font-medium text-white shadow-[0_18px_35px_rgba(16,185,129,0.25)] transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? 'Обработка...' : 'Оформить'}
                    {!isSubmitting && <ChevronRight className="ml-2" size={18} />}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
