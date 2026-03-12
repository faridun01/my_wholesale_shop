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

function shell(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

export default function CatalogView() {
  const user = getCurrentUser();
  const isAdmin = isAdminUser(user);
  const userWarehouseId = getUserWarehouseId(user);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [search, setSearch] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(userWarehouseId ? String(userWarehouseId) : '');
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
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(search.toLowerCase()));

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
    const currentCart = JSON.parse(localStorage.getItem('pending_cart') || '[]');
    const existing = currentCart.find((item: any) => item.id === product.id);

    let newCart;
    if (existing) {
      newCart = currentCart.map((item: any) =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      newCart = [...currentCart, { ...product, quantity: 1 }];
    }

    localStorage.setItem('pending_cart', JSON.stringify(newCart));
    const updatedItem = newCart.find((item: any) => item.id === product.id);
    setCartNotice({
      productName: product.name,
      count: updatedItem?.quantity || 1,
    });
  };

  return (
    <div className="min-h-full rounded-[32px] bg-[#f4f5fb] p-4 md:p-6">
      <div className="overflow-hidden rounded-[30px] border border-white/70 bg-[#f4f5fb] shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="space-y-5 px-5 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Catalog</h1>
              <p className="mt-1 text-sm text-slate-500">Browse products and add positions to the sales cart.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span>Home</span>
              <span>/</span>
              <span className="text-slate-600">Catalog</span>
            </div>
          </div>

          <section className="rounded-[24px] border border-white bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-2">
                <p className="text-sm text-slate-500">Product Catalog</p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Find products fast</h2>
                <p className="max-w-2xl text-sm leading-6 text-slate-500">
                  Search by name or SKU, filter by stock and category, then add items straight into the sale queue.
                </p>
              </div>

              {isAdmin && (
                <button
                  onClick={() => navigate('/products')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-500 px-4 py-3 text-sm text-white transition-colors hover:bg-violet-600"
                >
                  <Plus size={16} />
                  <span>Add Product</span>
                </button>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_220px_220px_260px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by product name or SKU..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-[24px] border border-sky-100 bg-sky-50 py-4 pl-12 pr-5 text-sm text-slate-700 outline-none transition-colors focus:border-sky-300"
                />
              </div>

              <div className="flex items-center gap-2 rounded-[24px] border border-violet-100 bg-violet-50 px-4 py-4">
                <Warehouse size={18} className="text-violet-500" />
                <select
                  value={selectedWarehouseId}
                  onChange={(event) => setSelectedWarehouseId(event.target.value)}
                  disabled={!isAdmin}
                  className="w-full appearance-none bg-transparent text-sm text-slate-700 outline-none"
                >
                  <option value="">All warehouses</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 rounded-[24px] border border-amber-100 bg-amber-50 px-4 py-4">
                <Filter size={18} className="text-amber-500" />
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="w-full appearance-none bg-transparent text-sm text-slate-700 outline-none"
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 rounded-[24px] border border-emerald-100 bg-emerald-50/60 p-1 shadow-sm">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'in_stock', label: 'In stock' },
                  { id: 'out_of_stock', label: 'Out' },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setStockFilter(option.id as typeof stockFilter)}
                    className={shell(
                      'rounded-[18px] px-3 py-3 text-sm transition-all',
                      stockFilter === option.id ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-[360px] rounded-[24px] border border-white bg-white animate-pulse" />
              ))}
            </div>
          ) : (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {filteredProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => handleProductClick(product)}
                  className="overflow-hidden rounded-[24px] border border-white bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer"
                >
                  <div className="aspect-square bg-slate-100">
                    <img
                      src={product.photoUrl || `https://picsum.photos/seed/product-${product.id}/500/500`}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="line-clamp-2 text-base text-slate-900">{product.name}</h3>
                        <p className="mt-1 text-xs text-slate-400">SKU: {product.sku || '---'}</p>
                      </div>
                      <span className="rounded-xl bg-violet-100 px-3 py-1.5 text-xs text-violet-700">
                        {product.category?.name || 'General'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      {shouldShowPrice(product) ? (
                        <span className="text-2xl font-semibold tracking-tight text-slate-900">
                          {formatMoney(product.sellingPrice)}
                        </span>
                      ) : (
                        <span className="text-sm italic text-slate-400">Price hidden</span>
                      )}
                      <span
                        className={shell(
                          'rounded-xl px-3 py-1.5 text-xs',
                          product.stock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        )}
                      >
                        {product.stock > 0 ? `${product.stock} ${product.unit}` : 'Out'}
                      </span>
                    </div>

                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleAddToSale(product);
                      }}
                      disabled={product.stock <= 0}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-sm text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      <ShoppingCart size={16} />
                      <span>Add to Sale</span>
                    </button>
                  </div>
                </motion.div>
              ))}

              {!filteredProducts.length && (
                <div className="col-span-full flex flex-col items-center justify-center rounded-[24px] border border-white bg-white px-6 py-24 text-center shadow-sm">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f4f5fb] text-slate-300">
                    <Package size={28} />
                  </div>
                  <p className="text-base text-slate-500">No products found</p>
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
            className="fixed bottom-6 right-6 z-50 w-[min(92vw,420px)] rounded-[24px] border border-emerald-100 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">Product added</p>
                <p className="mt-1 break-words text-sm text-slate-500">{cartNotice.productName}</p>
                <p className="mt-2 text-xs text-slate-400">In cart: {cartNotice.count}</p>
              </div>
              <button
                onClick={() => setCartNotice(null)}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setCartNotice(null)}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                Stay
              </button>
              <button
                onClick={() => {
                  setCartNotice(null);
                  navigate('/pos');
                }}
                className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 text-sm text-white transition-colors hover:bg-emerald-600"
              >
                Go to Cart
              </button>
            </div>
          </motion.div>
        )}

        {showDetails && selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetails(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl md:block"
            >
              <div className="grid max-h-[90vh] md:grid-cols-[0.95fr_1.05fr]">
                <div className="h-[260px] bg-slate-100 md:h-full md:max-h-[90vh]">
                  <img
                    src={selectedProduct.photoUrl || `https://picsum.photos/seed/product-${selectedProduct.id}/700/700`}
                    alt={selectedProduct.name}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="flex max-h-[90vh] flex-col overflow-y-auto p-8">
                  <div className="flex items-start justify-between">
                    <span className="rounded-2xl bg-[#f4f5fb] px-3 py-1.5 text-xs text-slate-600">
                      {selectedProduct.category?.name || 'General'}
                    </span>
                    <button
                      onClick={() => setShowDetails(false)}
                      className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <h2 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900">{selectedProduct.name}</h2>
                  <p className="mt-2 text-sm text-slate-400">SKU: {selectedProduct.sku || '---'}</p>

                  <div className="mt-8 space-y-5">
                    <div className="flex items-center gap-4">
                      <div className="rounded-2xl bg-[#f4f5fb] p-3 text-slate-500">
                        <Tag size={18} />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Selling Price</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                          {formatMoney(selectedProduct.sellingPrice)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="rounded-2xl bg-[#f4f5fb] p-3 text-slate-500">
                        <Layers size={18} />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Stock</p>
                        <p className={shell('mt-1 text-2xl font-semibold tracking-tight', selectedProduct.stock > 0 ? 'text-emerald-600' : 'text-rose-600')}>
                          {selectedProduct.stock} {selectedProduct.unit}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="rounded-2xl bg-[#f4f5fb] p-3 text-slate-500">
                        <Warehouse size={18} />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Warehouse</p>
                        <p className="mt-1 text-lg text-slate-900">{selectedProduct.warehouse?.name || 'Main warehouse'}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      handleAddToSale(selectedProduct);
                      setShowDetails(false);
                    }}
                    disabled={selectedProduct.stock <= 0}
                    className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 text-base text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    <ShoppingCart size={18} />
                    <span>Add to Sale</span>
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
