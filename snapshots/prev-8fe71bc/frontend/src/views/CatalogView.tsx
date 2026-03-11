import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { Package, Search, Filter, Plus, Grid, List, ShoppingCart, X, Info, Tag, Warehouse, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getProducts } from '../api/products.api';
import { useNavigate } from 'react-router-dom';

export default function CatalogView() {
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [search, setSearch] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getProducts(selectedWarehouseId ? Number(selectedWarehouseId) : undefined),
      client.get('/warehouses').then(res => res.data),
      client.get('/settings').then(res => res.data)
    ]).then(([productsData, warehousesData, settingsData]) => {
      setProducts(Array.isArray(productsData) ? productsData : []);
      setWarehouses(Array.isArray(warehousesData) ? warehousesData : []);
      setSettings(settingsData || {});
    }).finally(() => setLoading(false));
  }, [selectedWarehouseId]);

  const shouldShowPrice = (product: any) => {
    const visibility = settings.priceVisibility || 'everyone';
    if (visibility === 'everyone') return true;
    if (visibility === 'nobody') return false;
    if (visibility === 'in_stock') return product.stock > 0;
    return true;
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );

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
    navigate('/pos');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Каталог</h1>
          <p className="text-slate-500 mt-1 font-bold">Просмотр и быстрый поиск товаров для продажи.</p>
        </div>
        <button 
          onClick={() => navigate('/products')}
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center justify-center space-x-3 active:scale-95"
        >
          <Plus size={20} />
          <span>Добавить товар</span>
        </button>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="w-full md:flex-1 relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Поиск по названию, артикулу (SKU)..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold"
          />
        </div>
        <div className="w-full md:w-72 relative">
          <Warehouse className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="w-full pl-14 pr-10 py-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none font-black text-slate-700"
          >
            <option value="">Все склады</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-3xl border border-slate-100 h-80 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product, i) => (
            <motion.div 
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleProductClick(product)}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all group cursor-pointer"
            >
              <div className="aspect-square bg-slate-100 relative overflow-hidden">
                <img 
                  src={product.photoUrl || `https://picsum.photos/seed/product-${product.id}/400/400`} 
                  alt={product.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur rounded-full text-[10px] font-black text-indigo-600 shadow-sm uppercase tracking-widest">
                  {product.category?.name || 'Без категории'}
                </div>
              </div>
              <div className="p-6">
                <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{product.name}</h3>
                <p className="text-xs text-slate-500 mt-1">SKU: {product.sku || '---'}</p>
                <div className="mt-4 flex items-center justify-between">
                  {shouldShowPrice(product) ? (
                    <span className="text-lg font-black text-slate-900">{product.sellingPrice.toFixed(2)} TJS</span>
                  ) : (
                    <span className="text-sm font-bold text-slate-400 italic">Цена скрыта</span>
                  )}
                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${product.stock > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                    {product.stock > 0 ? `${product.stock} ${product.unit}` : 'Нет'}
                  </span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleAddToSale(product); }}
                  disabled={product.stock <= 0}
                  className="w-full mt-6 flex items-center justify-center space-x-2 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-indigo-600 transition-all disabled:opacity-50 disabled:bg-slate-200"
                >
                  <ShoppingCart size={18} />
                  <span>В продажу</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
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
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-1/2 aspect-square bg-slate-100">
                  <img 
                    src={selectedProduct.photoUrl || `https://picsum.photos/seed/product-${selectedProduct.id}/600/600`} 
                    alt={selectedProduct.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="w-full md:w-1/2 p-10 flex flex-col">
                  <div className="flex justify-between items-start mb-6">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {selectedProduct.category?.name || 'Без категории'}
                    </span>
                    <button onClick={() => setShowDetails(false)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400">
                      <X size={20} />
                    </button>
                  </div>
                  
                  <h2 className="text-2xl font-black text-slate-900 mb-2 leading-tight">{selectedProduct.name}</h2>
                  <p className="text-slate-400 font-bold text-sm mb-6">Артикул: {selectedProduct.sku || '---'}</p>
                  
                  <div className="space-y-6 flex-1">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-slate-50 rounded-2xl text-slate-400">
                        <Tag size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Цена продажи</p>
                        <p className="text-xl font-black text-slate-900">{selectedProduct.sellingPrice.toFixed(2)} TJS</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-slate-50 rounded-2xl text-slate-400">
                        <Layers size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">В наличии</p>
                        <p className={`text-xl font-black ${selectedProduct.stock > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {selectedProduct.stock} {selectedProduct.unit}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-slate-50 rounded-2xl text-slate-400">
                        <Warehouse size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Склад</p>
                        <p className="text-lg font-bold text-slate-700">{selectedProduct.warehouse?.name || 'Основной склад'}</p>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => { handleAddToSale(selectedProduct); setShowDetails(false); }}
                    disabled={selectedProduct.stock <= 0}
                    className="w-full mt-10 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    Добавить в корзину
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
