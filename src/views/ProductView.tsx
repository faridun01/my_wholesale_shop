import React, { useState, useMemo } from 'react';
import { Search, Plus, Package, History, Trash2, X, Edit, Camera, ArrowUpDown, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, Badge } from '../components/UI';
import { GoogleGenAI as OCRProviderClient } from "@google/genai";

interface Product {
  id: number;
  name: string;
  cost_price: number;
  selling_price: number;
  stock: number;
  min_stock: number;
  unit: string;
  photo_url?: string;
  active: boolean;
  initial_stock: number;
  total_incoming: number;
  warehouse_id: number;
}

interface InventoryTransaction {
  id: number;
  type: string;
  quantity_change: number;
  reason: string;
  created_at: string;
  username: string;
}

interface ProductViewProps {
  products: Product[];
  fetchData: () => void;
  user: any;
  warehouseId: number | null;
  warehouses: any[];
}

export const ProductView = ({ products, fetchData, user, warehouseId, warehouses }: ProductViewProps) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [restockingProduct, setRestockingProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [productHistory, setProductHistory] = useState<InventoryTransaction[]>([]);
  const [restockAmount, setRestockAmount] = useState<string>('');
  const [restockReason, setRestockReason] = useState<string>('Пополнение запаса');
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product, direction: 'asc' | 'desc' } | null>(null);
  
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<any[] | null>(null);
  const [exchangeRate, setExchangeRate] = useState<string>('1');

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase())
    );

    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [products, search, sortConfig]);

  const handleSort = (key: keyof Product) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const fetchHistory = async (id: number) => {
    const res = await fetch(`/api/products/${id}/history`);
    const data = await res.json();
    setProductHistory(data);
  };

  const handleRestock = async () => {
    if (!restockingProduct || !restockAmount || !warehouseId) return;
    
    await fetch('/api/inventory/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: restockingProduct.id,
        warehouse_id: warehouseId,
        quantity_change: parseFloat(restockAmount),
        type: 'purchase',
        reason: restockReason,
        user_id: user?.id,
        cost_at_time: restockingProduct.cost_price
      })
    });
    
    fetchData();
    setRestockingProduct(null);
  };

  const handleOcr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const ocrClient = new OCRProviderClient({ apiKey: process.env.OCR_API_KEY! });
        const response = await ocrClient.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            {
              parts: [
                { text: "Прочитай накладную на фото и верни список товаров в формате JSON: [{ name: string, quantity: number, cost_price: number }]. Верни только JSON." },
                { inlineData: { mimeType: file.type, data: base64Data } }
              ]
            }
          ]
        });

        const text = response.text || "";
        const jsonMatch = text.match(/\[.*\]/s);
        if (jsonMatch) {
          setOcrResult(JSON.parse(jsonMatch[0]));
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("OCR failed", error);
      alert("Не удалось прочитать накладную");
    } finally {
      setIsOcrLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-1 gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Поиск товаров..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {user?.role === 'admin' && (
            <>
              <button 
                onClick={() => setShowOcrModal(true)}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 hover:bg-emerald-700 transition-colors"
              >
                <Camera size={18} />
                <span>С накладной</span>
              </button>
              <button 
                onClick={() => setShowAddModal(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 hover:bg-indigo-700 transition-colors"
              >
                <Plus size={18} />
                <span>Добавить товар</span>
              </button>
            </>
          )}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-3 text-sm font-semibold text-slate-600">№</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-50" onClick={() => handleSort('name')}>
                  <div className="flex items-center space-x-1">
                    <span>Товар</span>
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                {user?.role === 'admin' && (
                  <th className="px-4 py-3 text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-50" onClick={() => handleSort('cost_price')}>
                    <div className="flex items-center space-x-1">
                      <span>Цена закупки</span>
                      <ArrowUpDown size={14} />
                    </div>
                  </th>
                )}
                <th className="px-4 py-3 text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-50" onClick={() => handleSort('selling_price')}>
                  <div className="flex items-center space-x-1">
                    <span>Цена продажи</span>
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-50" onClick={() => handleSort('stock')}>
                  <div className="flex items-center space-x-1">
                    <span>Запас</span>
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-600">Всего пришло</th>
                <th className="px-4 py-3 text-sm font-semibold text-slate-600 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProducts.map((product, idx) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 text-xs text-slate-400 font-mono">{idx + 1}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 overflow-hidden">
                        {product.photo_url ? <img src={product.photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Package size={20} />}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.unit}</p>
                      </div>
                    </div>
                  </td>
                  {user?.role === 'admin' && (
                    <td className="px-4 py-4 text-sm text-slate-600 font-medium">{product.cost_price.toFixed(2)}</td>
                  )}
                  <td className="px-4 py-4 text-sm font-bold text-slate-900">{product.selling_price.toFixed(2)}</td>
                  <td className="px-4 py-4">
                    <Badge variant={product.stock <= product.min_stock ? 'danger' : 'success'}>
                      {product.stock} {product.unit}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600">
                    {product.total_incoming} {product.unit}
                  </td>
                  <td className="px-4 py-4 text-right space-x-2">
                    <button 
                      onClick={() => {
                        setRestockingProduct(product);
                        setRestockAmount('');
                      }}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Пополнить"
                    >
                      <Plus size={18} />
                    </button>
                    <button 
                      onClick={() => {
                        setHistoryProduct(product);
                        fetchHistory(product.id);
                      }}
                      className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                      title="История"
                    >
                      <History size={18} />
                    </button>
                    <button 
                      onClick={() => setEditingProduct(product)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Изменить"
                    >
                      <Edit size={18} />
                    </button>
                    {(user?.role === 'admin' || user?.can_delete) && (
                      <button 
                        onClick={async () => {
                          if (confirm(`Вы уверены, что хотите удалить ${product.name}?`)) {
                            await fetch(`/api/products/${product.id}?hard_delete=true&user_role=${user.role}`, { method: 'DELETE' });
                            fetchData();
                          }
                        }}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Удалить"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredProducts.map(product => (
            <div key={product.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 overflow-hidden">
                    {product.photo_url ? <img src={product.photo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Package size={24} />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.unit}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Цена прод.</p>
                  <p className="text-lg font-black text-indigo-600">{product.selling_price.toFixed(2)} сомони</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Остаток</p>
                  <p className={`font-bold ${product.stock <= product.min_stock ? 'text-rose-600' : 'text-slate-900'}`}>
                    {product.stock} {product.unit}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Закупочная</p>
                  <p className="font-bold text-slate-700">{product.cost_price.toFixed(2)} сомони</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex space-x-2">
                  <button 
                    onClick={() => {
                      setRestockingProduct(product);
                      setRestockAmount('');
                    }}
                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"
                  >
                    <Plus size={20} />
                  </button>
                  <button 
                    onClick={() => {
                      setHistoryProduct(product);
                      fetchHistory(product.id);
                    }}
                    className="p-2 bg-slate-100 text-slate-600 rounded-lg"
                  >
                    <History size={20} />
                  </button>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setEditingProduct(product)}
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-bold"
                  >
                    Изменить
                  </button>
                  {(user?.role === 'admin' || user?.can_delete) && (
                    <button 
                      onClick={async () => {
                        if (confirm(`Вы уверены, что хотите удалить ${product.name}?`)) {
                          await fetch(`/api/products/${product.id}?hard_delete=true&user_role=${user.role}`, { method: 'DELETE' });
                          fetchData();
                        }
                      }}
                      className="p-2 text-rose-600"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {(showAddModal || editingProduct) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">
                {editingProduct ? 'Изменить товар' : 'Добавить новый товар'}
              </h3>
              <button onClick={() => { setShowAddModal(false); setEditingProduct(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <form className="p-6 space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = Object.fromEntries(formData.entries());
              
              if (editingProduct) {
                await fetch(`/api/products/${editingProduct.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    ...data, 
                    active: data.active === 'on',
                    user_id: user.id 
                  })
                });
              } else {
                await fetch('/api/products', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    ...data, 
                    active: data.active === 'on',
                    user_id: user.id 
                  })
                });
              }
              
              fetchData();
              setShowAddModal(false);
              setEditingProduct(null);
            }}>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Склад</label>
                  <select name="warehouse_id" defaultValue={editingProduct?.warehouse_id || warehouseId || ''} required className="w-full px-4 py-2 rounded-lg border border-slate-200">
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_address}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Название товара</label>
                  <input name="name" defaultValue={editingProduct?.name} required className="w-full px-4 py-2 rounded-lg border border-slate-200" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ед. измерения</label>
                  <input name="unit" defaultValue={editingProduct?.unit || 'шт'} required className="w-full px-4 py-2 rounded-lg border border-slate-200" />
                </div>
                {user?.role === 'admin' ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Закупочная цена</label>
                    <input name="cost_price" type="number" step="0.01" defaultValue={editingProduct?.cost_price} required className="w-full px-4 py-2 rounded-lg border border-slate-200" />
                  </div>
                ) : (
                  <input type="hidden" name="cost_price" value={editingProduct?.cost_price || 0} />
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Цена продажи</label>
                  <input name="selling_price" type="number" step="0.01" defaultValue={editingProduct?.selling_price} required className="w-full px-4 py-2 rounded-lg border border-slate-200" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Мин. запас</label>
                  <input name="min_stock" type="number" defaultValue={editingProduct?.min_stock || 5} required className="w-full px-4 py-2 rounded-lg border border-slate-200" />
                </div>
                {!editingProduct && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Начальный запас</label>
                    <input name="initial_stock" type="number" defaultValue="0" className="w-full px-4 py-2 rounded-lg border border-slate-200" />
                  </div>
                )}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Фото товара</label>
                  <div className="flex items-center space-x-4">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const formData = new FormData();
                          formData.append('photo', file);
                          const res = await fetch('/api/upload', {
                            method: 'POST',
                            body: formData
                          });
                          const data = await res.json();
                          const input = document.querySelector('input[name="photo_url"]') as HTMLInputElement;
                          if (input) input.value = data.photoUrl;
                        }
                      }}
                      className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                    <input name="photo_url" defaultValue={editingProduct?.photo_url} className="flex-1 px-4 py-2 rounded-lg border border-slate-200" placeholder="Или вставьте URL" />
                  </div>
                </div>
                <div className="col-span-2 flex items-center space-x-2">
                  <input name="active" type="checkbox" defaultChecked={editingProduct ? editingProduct.active : true} className="w-4 h-4 text-indigo-600" />
                  <label className="text-sm font-medium text-slate-700">Активный товар</label>
                </div>
              </div>
              <div className="pt-4 flex space-x-3">
                <button type="button" onClick={() => { setShowAddModal(false); setEditingProduct(null); }} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50">Отмена</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Сохранить</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {restockingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Пополнение: {restockingProduct.name}</h3>
              <button onClick={() => setRestockingProduct(null)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Количество ({restockingProduct.unit})</label>
                <input 
                  type="number" 
                  className="w-full px-4 py-2 rounded-lg border border-slate-200" 
                  value={restockAmount}
                  onChange={e => setRestockAmount(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Причина</label>
                <input 
                  className="w-full px-4 py-2 rounded-lg border border-slate-200" 
                  value={restockReason}
                  onChange={e => setRestockReason(e.target.value)}
                />
              </div>
              <div className="pt-4 flex space-x-3">
                <button onClick={() => setRestockingProduct(null)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50">Отмена</button>
                <button onClick={handleRestock} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">Пополнить</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {historyProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900">История: {historyProduct.name}</h3>
              <button onClick={() => setHistoryProduct(null)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {productHistory.map((t, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        t.type === 'purchase' || t.type === 'return' || t.type === 'cancellation' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                      }`}>
                        {t.type === 'purchase' || t.type === 'return' || t.type === 'cancellation' ? <Plus size={20} /> : <Trash2 size={20} />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 capitalize">
                          {t.type === 'purchase' ? 'Закупка' : t.type === 'sale' ? 'Продажа' : t.type === 'return' ? 'Возврат' : t.type === 'cancellation' ? 'Отмена' : t.type}
                        </p>
                        <p className="text-xs text-slate-500">{new Date(t.created_at).toLocaleString()} • {t.username}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-black ${t.quantity_change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.quantity_change > 0 ? '+' : ''}{t.quantity_change} {historyProduct.unit}
                      </p>
                      <p className="text-xs text-slate-400">{t.reason}</p>
                    </div>
                  </div>
                ))}
                {productHistory.length === 0 && <p className="text-center text-slate-400 py-8">История пуста</p>}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showOcrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Добавление с накладной</h3>
              <button onClick={() => setShowOcrModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            
            {isOcrLoading ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-slate-600 font-medium animate-pulse">Идет чтение накладной...</p>
                <p className="text-xs text-slate-400">Это может занять до 10-15 секунд</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center hover:border-indigo-400 transition-colors relative group">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={async (e) => {
                      await handleOcr(e);
                      if (!isOcrLoading) setShowOcrModal(false);
                    }} 
                  />
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Camera size={32} />
                  </div>
                  <p className="font-bold text-slate-900">Выберите фото накладной</p>
                  <p className="text-sm text-slate-500 mt-1">Нажмите или перетащите файл</p>
                </div>
                <button 
                  onClick={() => setShowOcrModal(false)}
                  className="w-full py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Отмена
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {ocrResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
              <h3 className="text-xl font-bold text-emerald-900">Товары из накладной</h3>
              <button onClick={() => setOcrResult(null)} className="text-emerald-400 hover:text-emerald-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="flex items-center space-x-4 bg-slate-50 p-4 rounded-xl">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Курс доллара (TJS)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200"
                    value={exchangeRate}
                    onChange={e => setExchangeRate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Склад</label>
                  <select id="ocr-warehouse" defaultValue={warehouseId || ''} className="w-full px-4 py-2 rounded-lg border border-slate-200">
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_address}</option>)}
                  </select>
                </div>
              </div>

              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">№</th>
                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Название</th>
                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Кол-во</th>
                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Закупка ($)</th>
                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Закупка (TJS)</th>
                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Продажа (TJS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {ocrResult.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-3 text-sm text-slate-600">{idx + 1}</td>
                      <td className="px-2 py-3">
                        <input className="w-full px-2 py-1 text-sm border border-slate-100 rounded" defaultValue={item.name} id={`ocr-name-${idx}`} />
                      </td>
                      <td className="px-2 py-3">
                        <input type="number" className="w-20 px-2 py-1 text-sm border border-slate-100 rounded" defaultValue={item.quantity} id={`ocr-qty-${idx}`} />
                      </td>
                      <td className="px-2 py-3">
                        <input type="number" step="0.01" className="w-24 px-2 py-1 text-sm border border-slate-100 rounded" defaultValue={item.cost_price} id={`ocr-cost-usd-${idx}`} />
                      </td>
                      <td className="px-2 py-3 text-sm font-medium text-slate-600">
                        {(item.cost_price * parseFloat(exchangeRate)).toFixed(2)}
                      </td>
                      <td className="px-2 py-3">
                        <input type="number" step="0.01" className="w-24 px-2 py-1 text-sm border border-slate-100 rounded placeholder:text-slate-300" placeholder="Пусто" id={`ocr-sale-${idx}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-slate-100 flex space-x-3 bg-slate-50">
              <button onClick={() => setOcrResult(null)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50">Отмена</button>
              <button onClick={async () => {
                const warehouse_id = (document.getElementById('ocr-warehouse') as HTMLSelectElement).value;
                const rate = parseFloat(exchangeRate);
                
                for (let i = 0; i < ocrResult.length; i++) {
                  const name = (document.getElementById(`ocr-name-${i}`) as HTMLInputElement).value.trim();
                  const quantity = parseFloat((document.getElementById(`ocr-qty-${i}`) as HTMLInputElement).value);
                  const cost_usd = parseFloat((document.getElementById(`ocr-cost-usd-${i}`) as HTMLInputElement).value);
                  const selling_price = parseFloat((document.getElementById(`ocr-sale-${i}`) as HTMLInputElement).value) || 0;
                  const cost_tjs = cost_usd * rate;

                  // Find if product exists (case-insensitive and trimmed)
                  const existing = products.find(p => p.name.trim().toLowerCase() === name.toLowerCase());
                  if (existing) {
                    // Update prices and restock
                    await fetch(`/api/products/${existing.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...existing,
                        cost_price: cost_tjs,
                        selling_price: selling_price || existing.selling_price,
                        warehouse_id: warehouse_id,
                        user_id: user.id
                      })
                    });

                    await fetch('/api/inventory/transaction', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        product_id: existing.id,
                        warehouse_id,
                        quantity_change: quantity,
                        type: 'purchase',
                        reason: `OCR Import (Rate: ${rate})`,
                        user_id: user.id,
                        cost_at_time: cost_tjs
                      })
                    });
                  } else {
                    // Create new
                    await fetch('/api/products', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name,
                        unit: 'шт',
                        cost_price: cost_tjs,
                        selling_price,
                        min_stock: 5,
                        initial_stock: quantity,
                        warehouse_id,
                        user_id: user.id
                      })
                    });
                  }
                }
                fetchData();
                setOcrResult(null);
              }} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700">Импортировать</button>
            </div>
          </motion.div>
        </div>
      )}
      {isOcrLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-60">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-bold text-slate-900">Чтение накладной...</p>
            <p className="text-sm text-slate-500">Пожалуйста, подождите, OCR анализирует фото</p>
          </div>
        </div>
      )}
    </div>
  );
};
