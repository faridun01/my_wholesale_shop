import React, { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import {
  Filter,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Tag,
  Warehouse,
  Layers,
  X,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getProducts } from '../api/products.api';
import { useNavigate } from 'react-router-dom';
import { filterWarehousesForUser, getCurrentUser, getUserWarehouseId, isAdminUser } from '../utils/userAccess';
import { formatMoney } from '../utils/format';
import { handleBrokenImage, resolveMediaUrl } from '../utils/media';
import { formatProductName } from '../utils/productName';

function shell(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

function getStoredWarehouseId() {
  if (typeof window === 'undefined') {
    return '';
  }

  return sessionStorage.getItem('pos_warehouse_session') || localStorage.getItem('pos_warehouse_session') || '';
}

export default function CatalogView() {
  const warehouseStorageKey = 'pos_warehouse_session';
  const user = getCurrentUser();
  const isAdmin = isAdminUser(user);
  const userWarehouseId = getUserWarehouseId(user);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [search, setSearch] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
    return getStoredWarehouseId() || (userWarehouseId ? String(userWarehouseId) : '');
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [cartNotice, setCartNotice] = useState<{ productName: string; count: number } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);

    Promise.all([
      getProducts(selectedWarehouseId ? Number(selectedWarehouseId) : undefined),
      client.get('/warehouses').then((res) => res.data),
      client.get('/settings/public').then((res) => res.data),
    ])
      .then(([productsData, warehousesData, settingsData]) => {
        setProducts(Array.isArray(productsData) ? productsData : []);
        const filteredWarehouses = filterWarehousesForUser(Array.isArray(warehousesData) ? warehousesData : [], user);
        setWarehouses(filteredWarehouses);
        if (!isAdmin && filteredWarehouses[0]) {
          setSelectedWarehouseId(String(filteredWarehouses[0].id));
        }
        setSettings(settingsData || {});
      })
      .finally(() => setLoading(false));
  }, [selectedWarehouseId, isAdmin, userWarehouseId]);

  useEffect(() => {
    if (selectedWarehouseId) {
      sessionStorage.setItem(warehouseStorageKey, selectedWarehouseId);
      localStorage.setItem(warehouseStorageKey, selectedWarehouseId);
    }
  }, [selectedWarehouseId]);

  const shouldShowPrice = (product: any) => {
    const visibility = settings.priceVisibility || 'everyone';
    if (visibility === 'everyone') return true;
    if (visibility === 'nobody') return false;
    if (visibility === 'in_stock') return product.stock > 0;
    return true;
  };

  const categories = useMemo(
    () =>
      Array.from(
        new Set(products.map((product) => product.category?.name).filter(Boolean))
      ),
    [products]
  );

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = !selectedCategory || (product.category?.name || '') === selectedCategory;
    const matchesStock =
      stockFilter === 'all' ||
      (stockFilter === 'in_stock' && product.stock > 0) ||
      (stockFilter === 'out_of_stock' && product.stock <= 0);

    return matchesSearch && matchesCategory && matchesStock;
  });

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setShowDetails(true);
  };

  const handleAddToSale = (product: any) => {
    if (!selectedWarehouseId) {
      setCartNotice({ productName: 'Сначала выберите склад', count: 0 });
      return;
    }

    const currentCart = JSON.parse(sessionStorage.getItem('pending_cart') || '[]');
    const existing = currentCart.find((item: any) => item.id === product.id);

    let newCart;
    if (existing) {
      newCart = currentCart.map((item: any) =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      newCart = [...currentCart, { ...product, quantity: 1 }];
    }

    sessionStorage.setItem('pending_cart', JSON.stringify(newCart));
    sessionStorage.setItem('pos_cart_session', JSON.stringify(newCart));
    sessionStorage.setItem('pos_warehouse_session', selectedWarehouseId);
    localStorage.setItem('pending_cart', JSON.stringify(newCart));
    localStorage.setItem('pos_cart_session', JSON.stringify(newCart));
    localStorage.setItem('pos_warehouse_session', selectedWarehouseId);
    const updatedItem = newCart.find((item: any) => item.id === product.id);
    setCartNotice({
      productName: formatProductName(product.name),
      count: updatedItem?.quantity || 1,
    });
  };

  return (
    <div className="app-page-shell app-page-pad min-h-full">
      <div className="overflow-hidden rounded-[28px] bg-[#f4f5fb]">
        <div className="space-y-4 px-3 py-4 sm:px-5 sm:py-5 lg:space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">Каталог</h1>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Просмотр товаров и добавление позиций в корзину продаж.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 sm:text-sm">
              <span>Главная</span>
              <span>/</span>
              <span className="text-slate-600">Каталог</span>
            </div>
          </div>

          <section className="rounded-[24px] border border-white bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-2">
                <p className="text-sm text-slate-500">Каталог товаров</p>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  Быстрый поиск товаров
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-slate-500">
                  Ищите по названию, фильтруйте по остатку и категории, затем сразу добавляйте товар в продажу.
                </p>
              </div>

              {isAdmin && (
                <button
                  onClick={() => navigate('/products')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-600"
                >
                  <Plus size={16} />
                  <span>Добавить товар</span>
                </button>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Поиск по названию товара..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-2xl border border-sky-100 bg-sky-50 py-3.5 pl-11 pr-4 text-sm text-slate-700 outline-none transition-colors focus:border-sky-300"
                />
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3.5">
                <Warehouse size={18} className="shrink-0 text-violet-500" />
                <select
                  value={selectedWarehouseId}
                  onChange={(event) => setSelectedWarehouseId(event.target.value)}
                  disabled={!isAdmin}
                  className="w-full appearance-none bg-transparent text-sm text-slate-700 outline-none"
                >
                  <option value="">Все склады</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3.5">
                <Filter size={18} className="shrink-0 text-amber-500" />
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="w-full appearance-none bg-transparent text-sm text-slate-700 outline-none"
                >
                  <option value="">Все категории</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-1 shadow-sm">
                {[
                  { id: 'all', label: 'Все' },
                  { id: 'in_stock', label: 'В наличии' },
                  { id: 'out_of_stock', label: 'Нет' },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setStockFilter(option.id as typeof stockFilter)}
                    className={shell(
                      'rounded-xl px-2 py-2.5 text-xs font-medium transition-all sm:text-sm',
                      stockFilter === option.id
                        ? 'bg-emerald-500 text-white'
                        : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="h-[420px] animate-pulse rounded-[28px] border border-white bg-white" />
              ))}
            </div>
          ) : (
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => handleProductClick(product)}
                  className="group flex min-h-[440px] cursor-pointer flex-col overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="flex h-[220px] shrink-0 items-center justify-center overflow-hidden rounded-t-[28px] bg-slate-100 p-4 sm:h-[250px] lg:h-[280px]">
                    {product.photoUrl ? (
                      <img
                        src={resolveMediaUrl(product.photoUrl, product.id)}
                        alt={product.name}
                        className="max-h-full max-w-full rounded-2xl object-contain"
                        referrerPolicy="no-referrer"
                        onError={(event) => handleBrokenImage(event, product.id)}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-300">
                        <Package size={46} />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <div className="flex-1">
                      <div className="min-w-0">
                        <h3
                          title={formatProductName(product.name)}
                          className="line-clamp-4 break-words text-base font-semibold leading-7 text-slate-900 sm:text-[1.05rem]"
                        >
                          {formatProductName(product.name)}
                        </h3>
                      </div>

                      <div className="mt-3">
                        <span className="inline-flex rounded-full bg-violet-100 px-3 py-1.5 text-xs font-medium text-violet-700">
                          {product.category?.name || 'Без категории'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        {shouldShowPrice(product) ? (
                          <span className="block text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                            {formatMoney(product.sellingPrice)}
                          </span>
                        ) : (
                          <span className="block text-base italic text-slate-400">Цена скрыта</span>
                        )}
                      </div>

                      <span
                        className={shell(
                          'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium sm:text-sm',
                          product.stock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        )}
                      >
                        {product.stock > 0 ? `${product.stock} ${product.unit}` : 'Нет'}
                      </span>
                    </div>

                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleAddToSale(product);
                      }}
                      disabled={product.stock <= 0 || !selectedWarehouseId}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      <ShoppingCart size={16} />
                      <span>В продажу</span>
                    </button>
                  </div>
                </motion.div>
              ))}

              {!filteredProducts.length && (
                <div className="col-span-full flex flex-col items-center justify-center rounded-[28px] border border-white bg-white px-6 py-20 text-center shadow-sm">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f4f5fb] text-slate-300">
                    <Package size={28} />
                  </div>
                  <p className="text-base text-slate-500">Товары не найдены</p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <AnimatePresence>
        {cartNotice && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-4 right-4 left-4 z-50 rounded-[24px] border border-emerald-100 bg-white p-4 shadow-2xl sm:left-auto sm:w-[min(92vw,420px)] sm:p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {cartNotice.count > 0 ? 'Товар добавлен' : 'Нужно выбрать склад'}
                </p>
                <p className="mt-1 break-words text-sm leading-6 text-slate-500">{cartNotice.productName}</p>
                {cartNotice.count > 0 && <p className="mt-2 text-xs text-slate-400">В корзине: {cartNotice.count}</p>}
              </div>
              <button
                onClick={() => setCartNotice(null)}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={() => setCartNotice(null)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                Остаться
              </button>
              {cartNotice.count > 0 ? (
                <button
                  onClick={() => {
                    setCartNotice(null);
                    navigate('/pos');
                  }}
                  className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm text-white transition-colors hover:bg-emerald-600"
                >
                  Перейти в корзину
                </button>
              ) : (
                <button
                  onClick={() => setCartNotice(null)}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white transition-colors hover:bg-slate-800"
                >
                  Понятно
                </button>
              )}
            </div>
          </motion.div>
        )}

        {showDetails && selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 lg:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetails(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
            >
              <div className="grid max-h-[94vh] overflow-y-auto lg:grid-cols-[1.05fr_0.95fr]">
                <div className="flex items-center justify-center bg-slate-50 p-4 sm:p-5 lg:p-6">
                  <div className="flex w-full items-center justify-center overflow-hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                    {selectedProduct.photoUrl ? (
                      <img
                        src={resolveMediaUrl(selectedProduct.photoUrl, selectedProduct.id)}
                        alt={selectedProduct.name}
                        className="max-h-[300px] max-w-full rounded-2xl object-contain sm:max-h-[380px] lg:max-h-[600px]"
                        referrerPolicy="no-referrer"
                        onError={(event) => handleBrokenImage(event, selectedProduct.id)}
                      />
                    ) : (
                      <div className="flex h-[280px] w-full items-center justify-center rounded-2xl bg-slate-100 text-slate-300 sm:h-[340px] lg:h-[600px]">
                        <Package size={72} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col p-4 sm:p-5 lg:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 sm:px-4 sm:py-2">
                      {selectedProduct.category?.name || 'Без категории'}
                    </span>
                    <button
                      onClick={() => setShowDetails(false)}
                      className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <h2 className="mt-4 break-words text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl lg:mt-6 lg:text-4xl">
                    {formatProductName(selectedProduct.name)}
                  </h2>

                  <div className="mt-5 grid gap-3 sm:mt-6 lg:mt-8 lg:gap-4">
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-white p-3 text-slate-500 shadow-sm">
                          <Tag size={18} />
                        </div>
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                            Цена продажи
                          </p>
                          <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
                            {shouldShowPrice(selectedProduct) ? formatMoney(selectedProduct.sellingPrice) : 'Цена скрыта'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:gap-4">
                      <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl bg-white p-3 text-slate-500 shadow-sm">
                            <Layers size={18} />
                          </div>
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                              Остаток
                            </p>
                            <p
                              className={shell(
                                'mt-1 text-lg font-semibold tracking-tight sm:text-xl lg:text-2xl',
                                selectedProduct.stock > 0 ? 'text-emerald-600' : 'text-rose-600'
                              )}
                            >
                              {selectedProduct.stock} {selectedProduct.unit}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl bg-white p-3 text-slate-500 shadow-sm">
                            <Warehouse size={18} />
                          </div>
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                              Склад
                            </p>
                            <p className="mt-1 break-words text-sm text-slate-900 sm:text-base lg:text-lg">
                              {selectedProduct.warehouse?.name || 'Основной склад'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      handleAddToSale(selectedProduct);
                      if (selectedWarehouseId) {
                        setShowDetails(false);
                      }
                    }}
                    disabled={selectedProduct.stock <= 0 || !selectedWarehouseId}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 sm:text-base lg:mt-auto lg:py-4"
                  >
                    <ShoppingCart size={18} />
                    <span>В продажу</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
