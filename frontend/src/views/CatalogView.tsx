import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import {
  ChevronRight,
  Filter,
  Layers,
  LayoutGrid,
  List,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Tag,
  Warehouse,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';
import { getCatalogProducts } from '../api/products.api';
import { getPublicSettings } from '../api/settings-reference.api';
import { getWarehouses } from '../api/warehouses.api';
import PaginationControls from '../components/common/PaginationControls';
import { formatMoney } from '../utils/format';
import { handleBrokenImage, resolveMediaUrl } from '../utils/media';
import { formatProductName } from '../utils/productName';
import { filterWarehousesForUser, getCurrentUser, getUserWarehouseId, isAdminUser } from '../utils/userAccess';

const shell = (...classNames: Array<string | false | null | undefined>) => classNames.filter(Boolean).join(' ');
const getStoredWarehouseId = () =>
  typeof window === 'undefined'
    ? ''
    : sessionStorage.getItem('pos_warehouse_session') || localStorage.getItem('pos_warehouse_session') || '';

type PackagingOption = { id: number; packageName: string; baseUnitName: string; unitsPerPackage: number; isDefault?: boolean };

const normalizeDisplayBaseUnit = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'шт';
  if (['пачка', 'пачки', 'пачек', 'шт', 'штук', 'штука', 'штуки', 'pcs', 'piece', 'pieces'].includes(normalized)) return 'шт';
  return normalized;
};

const normalizePackagings = (product: any): PackagingOption[] =>
  Array.isArray(product?.packagings)
    ? product.packagings
        .map((entry: any) => ({
          id: Number(entry.id),
          packageName: String(entry.packageName || '').trim(),
          baseUnitName: normalizeDisplayBaseUnit(entry.baseUnitName || product?.baseUnitName || product?.unit || 'шт'),
          unitsPerPackage: Number(entry.unitsPerPackage || 0),
          isDefault: Boolean(entry.isDefault),
        }))
        .filter((entry: PackagingOption) => entry.id > 0 && entry.packageName && entry.unitsPerPackage > 0)
    : [];

const getDefaultPackaging = (packagings: PackagingOption[]) => packagings.find((entry) => entry.isDefault) || packagings[0] || null;

const getProductStockParts = (product: any) => {
  const packagings = normalizePackagings(product);
  const defaultPackaging = getDefaultPackaging(packagings);
  const baseUnitName = normalizeDisplayBaseUnit(product?.baseUnitName || product?.unit || defaultPackaging?.baseUnitName || 'шт');
  const stock = Math.max(0, Math.floor(Number(product?.stock || 0)));
  if (!defaultPackaging || Number(defaultPackaging.unitsPerPackage || 0) <= 1) return { primary: `${stock} ${baseUnitName}`, secondary: '', isOutOfStock: stock <= 0 };
  const unitsPerPackage = Number(defaultPackaging.unitsPerPackage || 0);
  const packageQuantity = Math.floor(stock / unitsPerPackage);
  const extraUnits = stock % unitsPerPackage;
  if (stock <= 0) return { primary: 'Нет', secondary: '', isOutOfStock: true };
  if (packageQuantity > 0 && extraUnits > 0) return { primary: `${packageQuantity} ${defaultPackaging.packageName}`, secondary: `+ ${extraUnits} ${baseUnitName}`, isOutOfStock: false };
  if (packageQuantity > 0) return { primary: `${packageQuantity} ${defaultPackaging.packageName}`, secondary: '', isOutOfStock: false };
  return { primary: `${extraUnits} ${baseUnitName}`, secondary: '', isOutOfStock: false };
};

const getProductCommercialStats = (product: any) => {
  const salePrice = Number(product?.sellingPrice || 0);
  const purchasePrice = Number(product?.costPrice || 0);
  const profitPerUnit = salePrice - purchasePrice;
  const marginPercent = salePrice > 0 ? (profitPerUnit / salePrice) * 100 : 0;
  return { salePrice, purchasePrice, profitPerUnit, marginPercent };
};

export default function CatalogView() {
  const pageSize = 12;
  const user = React.useMemo(() => getCurrentUser(), []);
  const isAdmin = isAdminUser(user);
  const userWarehouseId = getUserWarehouseId(user);
  const hasLoadedReferenceDataRef = React.useRef(false);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [search, setSearch] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(() => getStoredWarehouseId() || (userWarehouseId ? String(userWarehouseId) : ''));
  const [selectedCategory, setSelectedCategory] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [cartNotice, setCartNotice] = useState<{ productName: string; count: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    getCatalogProducts(selectedWarehouseId ? Number(selectedWarehouseId) : undefined)
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [selectedWarehouseId]);

  useEffect(() => {
    if (hasLoadedReferenceDataRef.current) return;
    hasLoadedReferenceDataRef.current = true;
    Promise.all([getWarehouses(), getPublicSettings()])
      .then(([warehousesData, settingsData]) => {
        const filtered = filterWarehousesForUser(Array.isArray(warehousesData) ? warehousesData : [], user);
        setWarehouses(filtered);
        if (filtered.length === 1) {
          setSelectedWarehouseId(String(filtered[0].id));
        } else if (!isAdmin && filtered[0]) {
          setSelectedWarehouseId(String(filtered[0].id));
        }
        setSettings(settingsData || {});
      })
      .catch((error) => {
        hasLoadedReferenceDataRef.current = false;
        console.error(error);
      });
  }, [isAdmin, user]);

  useEffect(() => {
    if (!selectedWarehouseId) return;
    sessionStorage.setItem('pos_warehouse_session', selectedWarehouseId);
    localStorage.setItem('pos_warehouse_session', selectedWarehouseId);
  }, [selectedWarehouseId]);

  const shouldShowPrice = (product: any) => {
    const visibility = settings.priceVisibility || 'everyone';
    if (visibility === 'everyone') return true;
    if (visibility === 'nobody') return false;
    if (visibility === 'in_stock') return product.stock > 0;
    return true;
  };

  const categories = useMemo(() => Array.from(new Set(products.map((product) => product.category?.name).filter(Boolean))), [products]);

  const stockCounts = useMemo(() => {
    let inStock = 0;
    let outOfStock = 0;
    products.forEach((p) => {
      if (Number(p.stock || 0) > 0) inStock++;
      else outOfStock++;
    });
    return { all: products.length, in_stock: inStock, out_of_stock: outOfStock };
  }, [products]);

  const filteredProducts = products.filter((product) => {
    const matchesSearch = String(product.name || '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || (product.category?.name || '') === selectedCategory;
    const matchesStock = stockFilter === 'all' || (stockFilter === 'in_stock' && product.stock > 0) || (stockFilter === 'out_of_stock' && product.stock <= 0);
    return matchesSearch && matchesCategory && matchesStock;
  });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => setCurrentPage(1), [search, selectedWarehouseId, selectedCategory, stockFilter]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setMobileActionsOpen(false);
    setShowDetails(true);
  };

  const handleAddToSale = (product: any) => {
    if (!selectedWarehouseId) return setCartNotice({ productName: 'Сначала выберите склад', count: 0 });
    const currentCart = JSON.parse(sessionStorage.getItem('pending_cart') || '[]');
    const existing = currentCart.find((item: any) => item.id === product.id);
    const newCart = existing
      ? currentCart.map((item: any) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
      : [...currentCart, { ...product, quantity: 1 }];
    sessionStorage.setItem('pending_cart', JSON.stringify(newCart));
    sessionStorage.setItem('pos_cart_session', JSON.stringify(newCart));
    sessionStorage.setItem('pos_warehouse_session', selectedWarehouseId);
    localStorage.setItem('pending_cart', JSON.stringify(newCart));
    localStorage.setItem('pos_cart_session', JSON.stringify(newCart));
    localStorage.setItem('pos_warehouse_session', selectedWarehouseId);
    const updatedItem = newCart.find((item: any) => item.id === product.id);
    setCartNotice({ productName: formatProductName(product.name), count: updatedItem?.quantity || 1 });
  };

  return (
    <div className="app-page-shell min-h-full font-sans">
      <div className="space-y-3 sm:space-y-4 lg:rounded-[28px] lg:bg-[#f4f5fb] lg:p-5">
        {/* Desktop Header */}
        <div className="hidden lg:flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Каталог</h1>
            <p className="mt-0.5 text-xs text-slate-500">Просмотр товаров и быстрое добавление позиций в продажу.</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => navigate('/products')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-slate-800"
            >
              <Plus size={16} />
              <span>Добавить товар</span>
            </button>
          )}
        </div>

        {/* Search & Filters Toolbar */}
        <div className="rounded-2xl lg:rounded-[28px] border border-slate-200/70 bg-white p-2.5 sm:p-4 shadow-xs space-y-2.5 sm:space-y-3">
          {/* Top Row: Search + Warehouse + Category + View Toggle */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Поиск по названию товара..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl sm:rounded-2xl border border-slate-200/70 bg-[#f4f5fb] py-2 sm:py-2.5 pl-10 pr-8 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  title="Очистить"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdowns & View Mode Toggle */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {warehouses.length > 1 && (
                <div className="relative flex-1 sm:flex-initial">
                  <select
                    value={selectedWarehouseId}
                    onChange={(event) => setSelectedWarehouseId(event.target.value)}
                    disabled={!isAdmin}
                    className="w-full sm:w-40 rounded-xl sm:rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3 py-2 sm:py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white cursor-pointer"
                  >
                    <option value="">Все склады</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="relative flex-1 sm:flex-initial">
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="w-full sm:w-40 rounded-xl sm:rounded-2xl border border-slate-200/70 bg-[#f4f5fb] px-3 py-2 sm:py-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-300 focus:bg-white cursor-pointer"
                >
                  <option value="">Все категории</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* View Toggle */}
              <div className="flex items-center rounded-xl border border-slate-200/80 bg-[#f4f5fb] p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={clsx(
                    'flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-all',
                    viewMode === 'grid'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-400 hover:text-slate-700'
                  )}
                  title="Сетка"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={clsx(
                    'flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-all',
                    viewMode === 'list'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-400 hover:text-slate-700'
                  )}
                  title="Список"
                >
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Row: Stock Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            {[
              { id: 'all', label: 'Все', count: stockCounts.all },
              { id: 'in_stock', label: 'В наличии', count: stockCounts.in_stock },
              { id: 'out_of_stock', label: 'Нет на складе', count: stockCounts.out_of_stock },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStockFilter(tab.id as typeof stockFilter)}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 sm:px-3.5 sm:py-1.5 text-xs font-semibold shrink-0 transition-all',
                  stockFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'border border-slate-200/70 bg-[#f4f5fb] text-slate-700 hover:bg-slate-100'
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={clsx(
                    'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                    stockFilter === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/60 text-slate-600'
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Loading Skeletons */}
        {loading ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="h-56 animate-pulse rounded-2xl border border-slate-100 bg-white" />
            ))}
          </div>
        ) : paginatedProducts.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-slate-200/70 bg-white px-6 py-16 text-center shadow-xs">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#f4f5fb] text-slate-300">
              <Package size={26} />
            </div>
            <p className="text-sm font-semibold text-slate-700">Товары не найдены</p>
            <p className="mt-1 text-xs text-slate-400">Попробуйте изменить поисковый запрос или фильтры</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View: 2-column on mobile, responsive grid */
          <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {paginatedProducts.map((product, index) => {
              const stockParts = getProductStockParts(product);
              const commerce = getProductCommercialStats(product);
              const isOutOfStock = stockParts.isOutOfStock;

              return (
                <m.div
                  key={product.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => handleProductClick(product)}
                  className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
                >
                  {/* Photo Container */}
                  <div className="relative flex h-28 sm:h-40 w-full shrink-0 items-center justify-center overflow-hidden bg-linear-to-br from-slate-50 to-slate-100 p-2 sm:p-3">
                    {product.photoUrl ? (
                      <img
                        src={resolveMediaUrl(product.photoUrl, product.id)}
                        alt={product.name}
                        className="max-h-full max-w-full rounded-xl object-contain transition-transform duration-300 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        onError={(event) => handleBrokenImage(event, product.id)}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <Package size={28} />
                      </div>
                    )}

                    {/* Stock status overlay badge */}
                    <span
                      className={clsx(
                        'absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold shadow-xs backdrop-blur-xs',
                        isOutOfStock
                          ? 'bg-rose-500/90 text-white'
                          : 'bg-emerald-600/90 text-white'
                      )}
                    >
                      <span className="h-1 w-1 rounded-full bg-white" />
                      <span>{isOutOfStock ? 'Нет' : stockParts.primary}</span>
                    </span>

                    {/* Profit margin badge (Admin only) */}
                    {isAdmin && commerce.marginPercent > 0 && (
                      <span className="absolute top-2 right-2 rounded-full bg-slate-900/75 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 backdrop-blur-xs">
                        +{commerce.marginPercent.toFixed(0)}%
                      </span>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="flex flex-1 flex-col p-2.5 sm:p-3.5 justify-between">
                    <div>
                      <h3
                        title={formatProductName(product.name)}
                        className="text-xs sm:text-sm font-bold leading-snug text-slate-900 wrap-break-word"
                      >
                        {formatProductName(product.name)}
                      </h3>

                      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 truncate">
                        <span>{product.category?.name || 'Без категории'}</span>
                        {product.warehouse?.name && (
                          <>
                            <span>•</span>
                            <span className="truncate">{product.warehouse.name}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-100">
                      <div className="flex items-baseline justify-between gap-1">
                        <div className="min-w-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
                            Цена
                          </span>
                          <span className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 block mt-0.5">
                            {shouldShowPrice(product) ? formatMoney(commerce.salePrice) : 'Скрыта'}
                          </span>
                        </div>
                        {stockParts.secondary && (
                          <span className="text-[10px] text-slate-400 truncate text-right">
                            {stockParts.secondary}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleAddToSale(product);
                        }}
                        disabled={product.stock <= 0 || !selectedWarehouseId}
                        className={clsx(
                          'mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-1.5 sm:py-2 px-3 text-xs font-semibold transition-all active:scale-95',
                          product.stock <= 0 || !selectedWarehouseId
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-slate-900 text-white hover:bg-slate-800 shadow-xs'
                        )}
                      >
                        <ShoppingCart size={13} />
                        <span>В продажу</span>
                      </button>
                    </div>
                  </div>
                </m.div>
              );
            })}
          </div>
        ) : (
          /* List View: Ultra-compact horizontal rows */
          <div className="space-y-2">
            {paginatedProducts.map((product, index) => {
              const stockParts = getProductStockParts(product);
              const commerce = getProductCommercialStats(product);
              const isOutOfStock = stockParts.isOutOfStock;

              return (
                <m.div
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => handleProductClick(product)}
                  className="group flex cursor-pointer items-center justify-between gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-xs transition-all hover:border-slate-300 hover:shadow-xs active:scale-[0.99]"
                >
                  {/* Photo */}
                  <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 border border-slate-100 p-1">
                    {product.photoUrl ? (
                      <img
                        src={resolveMediaUrl(product.photoUrl, product.id)}
                        alt={product.name}
                        className="max-h-full max-w-full rounded-lg object-contain"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        onError={(event) => handleBrokenImage(event, product.id)}
                      />
                    ) : (
                      <Package size={22} className="text-slate-300" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <h3
                      title={formatProductName(product.name)}
                      className="text-xs sm:text-sm font-bold text-slate-900 leading-snug wrap-break-word"
                    >
                      {formatProductName(product.name)}
                    </h3>

                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400 truncate">
                      <span>{product.category?.name || 'Без категории'}</span>
                      <span>•</span>
                      <span className={clsx('font-semibold', isOutOfStock ? 'text-rose-600' : 'text-emerald-600')}>
                        {isOutOfStock ? 'Нет на складе' : `Остаток: ${stockParts.primary}`}
                      </span>
                      {isAdmin && commerce.marginPercent > 0 && (
                        <>
                          <span>•</span>
                          <span className="font-bold text-emerald-600">+{commerce.marginPercent.toFixed(0)}%</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Price and Cart Button */}
                  <div className="flex shrink-0 items-center gap-2.5">
                    <div className="text-right">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-none">
                        Цена
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-slate-900 block mt-0.5">
                        {shouldShowPrice(product) ? formatMoney(commerce.salePrice) : 'Скрыта'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleAddToSale(product);
                      }}
                      disabled={product.stock <= 0 || !selectedWarehouseId}
                      className={clsx(
                        'flex items-center gap-1 rounded-xl py-2 px-3 text-xs font-semibold transition-all active:scale-95',
                        product.stock <= 0 || !selectedWarehouseId
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-slate-900 text-white hover:bg-slate-800 shadow-xs'
                      )}
                      title="Добавить в продажу"
                    >
                      <ShoppingCart size={13} />
                      <span className="hidden sm:inline">В продажу</span>
                    </button>
                  </div>
                </m.div>
              );
            })}
          </div>
        )}

        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredProducts.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      <AnimatePresence>{cartNotice && <m.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="fixed bottom-4 left-4 right-4 z-50 rounded-3xl border border-emerald-100 bg-white p-4 shadow-2xl sm:left-auto sm:w-[min(92vw,420px)] sm:p-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-medium text-slate-900">{cartNotice.count > 0 ? 'Товар добавлен' : 'Нужно выбрать склад'}</p><p className="mt-1 wrap-break-word text-sm leading-6 text-slate-500">{cartNotice.productName}</p>{cartNotice.count > 0 && <p className="mt-2 text-xs text-slate-400">В корзине: {cartNotice.count}</p>}</div><button onClick={() => setCartNotice(null)} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"><X size={16} /></button></div><div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"><button onClick={() => setCartNotice(null)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-50">Остаться</button>{cartNotice.count > 0 ? <button onClick={() => { setCartNotice(null); navigate('/pos'); }} className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm text-white transition-colors hover:bg-emerald-600">Перейти в корзину</button> : <button onClick={() => setCartNotice(null)} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white transition-colors hover:bg-slate-800">Понятно</button>}</div></m.div>}</AnimatePresence>

      <AnimatePresence>
        {showDetails && selectedProduct && (() => {
          const stockParts = getProductStockParts(selectedProduct);
          const commerce = getProductCommercialStats(selectedProduct);
          const showPrice = shouldShowPrice(selectedProduct);
          const isOutOfStock = stockParts.isOutOfStock || Number(selectedProduct.stock || 0) <= 0;

          return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowDetails(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />

              <m.div
                initial={{ y: 20, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 20, opacity: 0, scale: 0.98 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative flex w-full max-w-lg max-h-[90vh] flex-col overflow-hidden rounded-t-[28px] sm:rounded-3xl bg-white shadow-2xl"
              >
                <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

                <div className="flex items-center justify-between gap-3 px-4 pt-3 sm:px-6 sm:pt-5">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {selectedProduct.category?.name || 'Без категории'}
                    </span>
                    {selectedProduct.warehouse?.name && (
                      <span className="rounded-lg bg-slate-100/70 px-2 py-1 text-[11px] font-medium text-slate-500">
                        {selectedProduct.warehouse.name}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="Закрыть"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="overflow-y-auto px-4 py-3 sm:px-6 sm:py-4 space-y-3.5">
                  {selectedProduct.photoUrl ? (
                    <div className="flex h-44 sm:h-52 w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/70 p-2">
                      <img
                        src={resolveMediaUrl(selectedProduct.photoUrl, selectedProduct.id)}
                        alt={selectedProduct.name}
                        className="h-full w-full rounded-xl object-contain"
                        referrerPolicy="no-referrer"
                        onError={(event) => handleBrokenImage(event, selectedProduct.id)}
                      />
                    </div>
                  ) : null}

                  <div>
                    <h2 className="text-base sm:text-lg font-bold leading-snug text-slate-900 wrap-break-word">
                      {formatProductName(selectedProduct.name)}
                    </h2>
                  </div>

                  <div className="flex items-baseline justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Цена продажи
                      </span>
                      <div className="mt-0.5 flex items-baseline gap-1.5">
                        <span className="font-mono text-2xl font-black tracking-tight text-slate-900 tabular-nums">
                          {showPrice ? formatMoney(commerce.salePrice) : 'Скрыта'}
                        </span>
                        {showPrice && <span className="text-xs font-bold text-slate-400">TJS</span>}
                      </div>
                    </div>

                    {isAdmin && commerce.marginPercent > 0 && (
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Рентабельность
                        </span>
                        <span className="mt-0.5 inline-flex items-center rounded-lg bg-emerald-100/90 px-2 py-0.5 font-mono text-xs font-bold text-emerald-700">
                          +{commerce.marginPercent.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-2xs">
                      <div className="flex items-center gap-1.5">
                        <Layers size={13} className="text-slate-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Остаток
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span
                          className={clsx(
                            'h-2 w-2 shrink-0 rounded-full',
                            isOutOfStock ? 'bg-rose-500' : 'bg-emerald-500'
                          )}
                        />
                        <span
                          className={clsx(
                            'font-mono text-sm font-bold',
                            isOutOfStock ? 'text-rose-600' : 'text-slate-800'
                          )}
                        >
                          {stockParts.primary}
                        </span>
                      </div>
                      {stockParts.secondary && (
                        <p className="mt-0.5 text-[10px] text-slate-400">{stockParts.secondary}</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-2xs">
                      <div className="flex items-center gap-1.5">
                        <Warehouse size={13} className="text-slate-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Склад
                        </span>
                      </div>
                      <p className="mt-1.5 truncate text-sm font-bold text-slate-800">
                        {selectedProduct.warehouse?.name || 'Основной склад'}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">Локация остатка</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:px-6">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => {
                        handleAddToSale(selectedProduct);
                        if (selectedWarehouseId) {
                          setShowDetails(false);
                        }
                      }}
                      disabled={isOutOfStock || !selectedWarehouseId}
                      className={clsx(
                        'flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all active:scale-[0.99]',
                        isOutOfStock || !selectedWarehouseId
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-slate-900 text-white hover:bg-slate-800 shadow-xs'
                      )}
                    >
                      <ShoppingCart size={16} />
                      <span>{isOutOfStock ? 'Нет в наличии' : 'В продажу'}</span>
                    </button>

                    <button
                      onClick={() => setShowDetails(false)}
                      className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      Закрыть
                    </button>
                  </div>
                </div>
              </m.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
