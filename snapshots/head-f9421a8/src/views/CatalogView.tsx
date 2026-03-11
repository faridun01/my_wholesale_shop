import React, { useState } from 'react';
import { Search, Package } from 'lucide-react';
import { Card } from '../components/UI';

interface CatalogViewProps {
  products: any[];
  settings: any;
}

export const CatalogView = ({ products, settings }: CatalogViewProps) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categories = Array.from(new Set(products.map(p => p.category_name))).filter(Boolean);
  
  const filteredProducts = products.filter(p => 
    p.active &&
    (p.name.toLowerCase().includes(search.toLowerCase())) &&
    (categoryFilter === 'all' || p.category_name === categoryFilter)
  );

  const showPrice = (product: any) => {
    if (settings.catalog_show_prices === 'all') return true;
    if (settings.catalog_show_prices === 'in_stock' && product.stock > 0) return true;
    return false;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Поиск в каталоге..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select 
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="all">Все категории</option>
          {categories.map((c, i) => (
            <option key={`${c}-${i}`} value={String(c)}>
              {String(c)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((product, index) => (
          <Card key={product.id} className="group hover:shadow-xl transition-all duration-300 border-none bg-white/80 backdrop-blur-sm relative">
            <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-sm text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm border border-slate-100">
              {index + 1}
            </div>
            <div className="aspect-square bg-slate-100 rounded-xl mb-4 overflow-hidden relative">
              {product.photo_url ? (
                <img src={product.photo_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Package size={48} />
                </div>
              )}
              {product.stock <= 0 && (
                <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center backdrop-blur-[2px]">
                  <span className="bg-white text-slate-900 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">Нет в наличии</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{product.category_name}</p>
              <h4 className="font-bold text-slate-900 line-clamp-1">{product.name}</h4>
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-slate-500">{product.unit}</span>
                {showPrice(product) ? (
                  <span className="text-xl font-bold text-slate-900">{product.selling_price.toFixed(2)} сомони</span>
                ) : (
                  <span className="text-sm font-medium text-slate-400 italic">Уточняйте цену</span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {filteredProducts.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
            <Package size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Ничего не найдено</h3>
          <p className="text-slate-500">Попробуйте изменить параметры поиска или фильтры</p>
        </div>
      )}
    </div>
  );
};
