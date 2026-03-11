import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { getProducts, createProduct, updateProduct, deleteProduct, restockProduct, getProductHistory } from '../api/products.api';
import { 
  Plus, 
  PlusCircle,
  Search, 
  Filter, 
  Package, 
  ArrowRightLeft,
  Edit,
  Trash2,
  Camera,
  Loader2,
  ChevronUp,
  ChevronDown,
  X,
  History,
  DollarSign,
  Layers,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { getProductBatches } from '../api/products.api';

export default function ProductsView() {
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showBatchesModal, setShowBatchesModal] = useState(false);
  const [productHistory, setProductHistory] = useState<any[]>([]);
  const [productBatches, setProductBatches] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [transferData, setTransferData] = useState({ fromWarehouseId: '', toWarehouseId: '', quantity: '' });
  const [restockData, setRestockData] = useState({ warehouseId: '', quantity: '', costPrice: '', reason: '' });
  const [ocrResults, setOcrResults] = useState<any[] | null>(null);
  const [usdRate, setUsdRate] = useState<string>('10.95'); // Default rate
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'name', direction: 'asc' });

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    unit: 'шт',
    categoryId: '',
    warehouseId: '',
    costPrice: '',
    sellingPrice: '',
    minStock: '0',
    initialStock: '0',
    photoUrl: ''
  });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin' || user.role === 'ADMIN' || user.role === 'MANAGER';

  useEffect(() => {
    fetchInitialData();
  }, [selectedWarehouseId]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [productsData, warehousesData, categoriesData] = await Promise.all([
        getProducts(selectedWarehouseId ? Number(selectedWarehouseId) : undefined),
        client.get('/warehouses').then(res => res.data),
        client.get('/settings/categories').then(res => res.data)
      ]);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setWarehouses(Array.isArray(warehousesData) ? warehousesData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (err) {
      console.error(err);
      toast.error('Ошибка при загрузке данных');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      await client.post(`/products/${selectedProduct.id}/transfer`, {
        fromWarehouseId: Number(transferData.fromWarehouseId),
        toWarehouseId: Number(transferData.toWarehouseId),
        quantity: Number(transferData.quantity)
      });
      toast.success('Товар успешно перенесен!');
      setShowTransferModal(false);
      setTransferData({ fromWarehouseId: '', toWarehouseId: '', quantity: '' });
      fetchInitialData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при переносе товара');
    }
  };

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      await restockProduct(selectedProduct.id, {
        warehouseId: Number(restockData.warehouseId),
        quantity: Number(restockData.quantity),
        costPrice: Number(restockData.costPrice),
        reason: restockData.reason
      });
      toast.success('Товар успешно пополнен!');
      setShowRestockModal(false);
      setRestockData({ warehouseId: '', quantity: '', costPrice: '', reason: '' });
      fetchInitialData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при пополнении товара');
    }
  };

  const handleShowHistory = async (product: any) => {
    setSelectedProduct(product);
    try {
      const history = await getProductHistory(product.id);
      setProductHistory(history);
      setShowHistoryModal(true);
    } catch (err) {
      toast.error('Ошибка при загрузке истории');
    }
  };

  const handleShowBatches = async (product: any) => {
    setSelectedProduct(product);
    try {
      const batches = await getProductBatches(product.id);
      setProductBatches(batches);
      setShowBatchesModal(true);
    } catch (err) {
      toast.error('Ошибка при загрузке партий');
    }
  };

  const handleScanInvoice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedWarehouseId) {
      toast.error('Пожалуйста, сначала выберите склад!');
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const formData = new FormData();
    formData.append('invoice', file);

    try {
      const res = await client.post('/ocr/parse-invoice', formData);
      // Initialize sellingPrice for each item if not present
      const items = res.data.map((item: any) => ({
        ...item,
        sellingPrice: item.sellingPrice || ''
      }));
      setOcrResults(items);
      toast.success('Накладная успешно отсканирована!');
    } catch (err) {
      toast.error('Ошибка при сканировании накладной');
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddOcrToStock = async () => {
    if (!ocrResults || !selectedWarehouseId) return;

    const rate = parseFloat(usdRate) || 1;
    
    try {
      setIsLoading(true);
      for (const item of ocrResults) {
        const costPriceTJS = item.price * rate;
        
        // Try to find existing product by SKU or Name
        let product = products.find(p => (item.sku && p.sku === item.sku) || p.name === item.name);
        
        if (product) {
          // Restock existing product
          await restockProduct(product.id, {
            warehouseId: Number(selectedWarehouseId),
            quantity: Number(item.quantity),
            costPrice: costPriceTJS,
            reason: 'OCR Restock'
          });
          
          // Update selling price if provided
          if (item.sellingPrice) {
            await updateProduct(product.id, {
              sellingPrice: parseFloat(item.sellingPrice)
            });
          }
        } else {
          // Create new product
          // We need a category, let's use the first one or a default
          const categoryId = categories[0]?.id || 1;
          await createProduct({
            name: item.name,
            sku: item.sku,
            unit: 'шт',
            categoryId: Number(categoryId),
            warehouseId: Number(selectedWarehouseId),
            costPrice: costPriceTJS,
            sellingPrice: parseFloat(item.sellingPrice) || costPriceTJS * 1.2, // Default 20% margin
            initialStock: Number(item.quantity)
          });
        }
      }
      
      toast.success('Все товары успешно добавлены на склад! 📦');
      setOcrResults(null);
      fetchInitialData();
    } catch (err: any) {
      toast.error('Ошибка при добавлении товаров: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProduct({
        ...formData,
        categoryId: Number(formData.categoryId),
        warehouseId: Number(formData.warehouseId),
        costPrice: parseFloat(formData.costPrice),
        sellingPrice: parseFloat(formData.sellingPrice),
        minStock: parseFloat(formData.minStock),
        initialStock: parseFloat(formData.initialStock)
      });
      toast.success('Товар успешно добавлен!');
      setShowAddModal(false);
      resetForm();
      fetchInitialData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при добавлении товара');
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      await updateProduct(selectedProduct.id, {
        ...formData,
        categoryId: Number(formData.categoryId),
        warehouseId: Number(formData.warehouseId),
        costPrice: parseFloat(formData.costPrice),
        sellingPrice: parseFloat(formData.sellingPrice),
        minStock: parseFloat(formData.minStock),
        initialStock: parseFloat(formData.initialStock)
      });
      toast.success('Товар успешно обновлен!');
      setShowEditModal(false);
      resetForm();
      fetchInitialData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при обновлении товара');
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    try {
      await deleteProduct(selectedProduct.id);
      toast.success('Товар успешно удален!');
      fetchInitialData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при удалении товара');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      unit: 'шт',
      categoryId: '',
      warehouseId: '',
      costPrice: '',
      sellingPrice: '',
      minStock: '0',
      initialStock: '0',
      photoUrl: ''
    });
    setSelectedProduct(null);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const sortedProducts = [...products].sort((a, b) => {
    if (!sortConfig.direction) return 0;
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredProducts = sortedProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
    
    // If a warehouse is selected, we only show products that have stock in that warehouse
    // OR are assigned to that warehouse as their default warehouse.
    const matchesWarehouse = !selectedWarehouseId || p.stock > 0 || p.warehouseId === Number(selectedWarehouseId);
    
    return matchesSearch && matchesWarehouse;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Товары</h1>
          <p className="text-slate-500 mt-0.5 font-medium text-sm">Управление ассортиментом, ценами и остатками.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select 
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm min-w-[180px]"
          >
            <option value="">Все склады</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>

          <label className="flex items-center space-x-2 px-3 py-2 bg-white border border-slate-100 rounded-xl text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all cursor-pointer shadow-sm">
            {isScanning ? <Loader2 size={16} className="animate-spin text-indigo-600" /> : <Camera size={16} className="text-indigo-600" />}
            <span>{isScanning ? 'Сканирование...' : 'Сканировать'}</span>
            <input type="file" className="hidden" accept="image/*" onChange={handleScanInvoice} disabled={isScanning} />
          </label>
          <button 
            onClick={() => {
              if (!selectedWarehouseId) {
                toast.error('Пожалуйста, выберите склад перед добавлением товара');
                return;
              }
              resetForm();
              setFormData(prev => ({ ...prev, warehouseId: selectedWarehouseId }));
              setShowAddModal(true);
            }}
            className={clsx(
              "flex items-center space-x-2 px-4 py-2 rounded-xl font-bold text-sm shadow-xl transition-all active:scale-95",
              selectedWarehouseId 
                ? "bg-indigo-600 text-white shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-0.5" 
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            )}
          >
            <Plus size={18} />
            <span>Добавить</span>
          </button>
        </div>
      </div>
      
      <AnimatePresence>
        {(showAddModal || showEditModal) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-lg font-black text-slate-900 flex items-center space-x-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl">
                    <Package size={20} />
                  </div>
                  <span>{showEditModal ? 'Редактировать товар' : 'Новый товар'}</span>
                </h3>
                <button onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={showEditModal ? handleEditProduct : handleAddProduct} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Название товара</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm" 
                      placeholder="Напр: iPhone 15 Pro Max"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Артикул (SKU)</label>
                    <input 
                      type="text" 
                      value={formData.sku}
                      onChange={e => setFormData({...formData, sku: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm" 
                      placeholder="SKU-12345"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Ед. измерения</label>
                    <input 
                      type="text" 
                      required
                      value={formData.unit}
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm" 
                      placeholder="шт, кг, литр..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Категория</label>
                    <select 
                      required
                      value={formData.categoryId}
                      onChange={e => setFormData({...formData, categoryId: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm appearance-none bg-white"
                    >
                      <option value="">Выберите категорию</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Склад по умолчанию</label>
                    <select 
                      required
                      value={formData.warehouseId}
                      onChange={e => setFormData({...formData, warehouseId: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm appearance-none bg-white"
                    >
                      <option value="">Выберите склад</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Себестоимость (TJS)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        value={formData.costPrice}
                        onChange={e => setFormData({...formData, costPrice: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm" 
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Цена продажи (TJS)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      value={formData.sellingPrice}
                      onChange={e => setFormData({...formData, sellingPrice: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm" 
                    />
                  </div>
                  {!showEditModal && (
                    <>
                      <div>
                        <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Начальный остаток</label>
                        <input 
                          type="number" 
                          required
                          value={formData.initialStock}
                          onChange={e => setFormData({...formData, initialStock: e.target.value})}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Миним. остаток</label>
                        <input 
                          type="number" 
                          required
                          value={formData.minStock}
                          onChange={e => setFormData({...formData, minStock: e.target.value})}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm" 
                        />
                      </div>
                    </>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Ссылка на фото (URL)</label>
                    <input 
                      type="url" 
                      value={formData.photoUrl}
                      onChange={e => setFormData({...formData, photoUrl: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm" 
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <button type="button" onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="px-6 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all text-sm">Отмена</button>
                  <button type="submit" className="px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 text-sm">
                    {showEditModal ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTransferModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 bg-amber-50/50">
                <h3 className="text-lg font-black text-slate-900 flex items-center space-x-3">
                  <div className="p-2 bg-amber-600 text-white rounded-xl">
                    <ArrowRightLeft size={20} />
                  </div>
                  <span>Перенос товара</span>
                </h3>
                <p className="text-slate-500 mt-1 font-bold text-sm">{selectedProduct?.name}</p>
              </div>
              <form onSubmit={handleTransfer} className="p-5 space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Из склада</label>
                    <select 
                      required
                      value={transferData.fromWarehouseId}
                      onChange={e => setTransferData({ ...transferData, fromWarehouseId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm appearance-none bg-white"
                    >
                      <option value="">Выберите склад</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">В склад</label>
                    <select 
                      required
                      value={transferData.toWarehouseId}
                      onChange={e => setTransferData({ ...transferData, toWarehouseId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm appearance-none bg-white"
                    >
                      <option value="">Выберите склад</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Количество</label>
                    <input 
                      type="number" 
                      required
                      min="1"
                      placeholder="Введите количество"
                      value={transferData.quantity}
                      onChange={e => setTransferData({ ...transferData, quantity: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm" 
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <button type="button" onClick={() => setShowTransferModal(false)} className="px-6 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all text-sm">Отмена</button>
                  <button type="submit" className="px-8 py-2 bg-amber-600 text-white rounded-xl font-bold shadow-xl shadow-amber-600/20 hover:bg-amber-700 transition-all active:scale-95 text-sm">Перенести</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRestockModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 bg-emerald-50/50">
                <h3 className="text-2xl font-black text-slate-900 flex items-center space-x-3">
                  <div className="p-3 bg-emerald-600 text-white rounded-2xl">
                    <PlusCircle size={24} />
                  </div>
                  <span>Пополнение товара</span>
                </h3>
                <p className="text-slate-500 mt-2 font-bold">{selectedProduct?.name}</p>
              </div>
              <form onSubmit={handleRestock} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Склад</label>
                    <select 
                      required
                      value={restockData.warehouseId}
                      onChange={e => setRestockData({ ...restockData, warehouseId: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold appearance-none bg-white"
                    >
                      <option value="">Выберите склад</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Количество</label>
                      <input 
                        type="number" 
                        required
                        value={restockData.quantity}
                        onChange={e => setRestockData({ ...restockData, quantity: e.target.value })}
                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold" 
                      />
                    </div>
                    {isAdmin && (
                      <div>
                        <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Цена закупки</label>
                        <input 
                          type="number" 
                          step="0.01"
                          required
                          value={restockData.costPrice}
                          onChange={e => setRestockData({ ...restockData, costPrice: e.target.value })}
                          className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold" 
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Причина / Комментарий</label>
                    <input 
                      type="text" 
                      value={restockData.reason}
                      onChange={e => setRestockData({ ...restockData, reason: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold" 
                      placeholder="Напр: Новая поставка"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-6">
                  <button type="button" onClick={() => setShowRestockModal(false)} className="px-8 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all">Отмена</button>
                  <button type="submit" className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-95">Пополнить</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ocrResults && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Результаты сканирования</h3>
                  <p className="text-slate-500 font-bold">Проверьте данные и установите цены.</p>
                </div>
                <div className="flex items-center space-x-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Курс USD ($)</p>
                    <input 
                      type="number" 
                      step="0.01"
                      value={usdRate}
                      onChange={(e) => setUsdRate(e.target.value)}
                      className="w-24 text-right font-black text-indigo-600 outline-none"
                    />
                  </div>
                  <DollarSign className="text-slate-300" size={20} />
                </div>
              </div>
              <div className="p-8 overflow-y-auto flex-1 space-y-4">
                <div className="grid grid-cols-12 gap-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <div className="col-span-5">Товар</div>
                  <div className="col-span-2 text-center">Кол-во</div>
                  <div className="col-span-2 text-right">Закупка ($)</div>
                  <div className="col-span-3 text-right">Цена продажи (TJS)</div>
                </div>
                {ocrResults.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-4 items-center p-4 bg-slate-50 rounded-2xl group hover:bg-indigo-50/30 transition-colors">
                    <div className="col-span-5">
                      <p className="font-bold text-slate-900 line-clamp-2">{item.name}</p>
                      <p className="text-[10px] text-slate-400 font-black uppercase">Артикул: {item.sku || '---'}</p>
                    </div>
                    <div className="col-span-2 text-center">
                      <p className="font-black text-indigo-600">{item.quantity} шт.</p>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="font-black text-slate-900">{item.price} $</p>
                      <p className="text-[10px] font-bold text-slate-400">≈ {(item.price * parseFloat(usdRate || '0')).toFixed(2)} TJS</p>
                    </div>
                    <div className="col-span-3 text-right">
                      <input 
                        type="number"
                        placeholder="Укажите цену"
                        value={item.sellingPrice}
                        onChange={(e) => {
                          const newResults = [...ocrResults];
                          newResults[i].sellingPrice = e.target.value;
                          setOcrResults(newResults);
                        }}
                        className="w-full text-right bg-white px-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none font-black text-emerald-600"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-8 bg-slate-50 flex justify-end space-x-3 border-t border-slate-100">
                <button onClick={() => setOcrResults(null)} className="px-8 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-200 transition-all">Отмена</button>
                <button 
                  onClick={handleAddOcrToStock}
                  disabled={isLoading}
                  className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center space-x-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Package size={20} />}
                  <span>Добавить всё на склад</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistoryModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-2xl font-black text-slate-900 flex items-center space-x-3">
                  <div className="p-3 bg-slate-900 text-white rounded-2xl">
                    <History size={24} />
                  </div>
                  <span>История товара: {selectedProduct?.name}</span>
                </h3>
                <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-4">Дата</th>
                      <th className="pb-4">Тип</th>
                      <th className="pb-4">Кол-во</th>
                      <th className="pb-4">Склад</th>
                      <th className="pb-4">Причина</th>
                      <th className="pb-4">Пользователь</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {productHistory.map((t, i) => (
                      <tr key={i} className="text-sm">
                        <td className="py-4 text-slate-500">{new Date(t.createdAt).toLocaleString()}</td>
                        <td className="py-4">
                          <span className={clsx(
                            "px-2 py-1 rounded-lg text-[10px] font-black uppercase",
                            t.type === 'incoming' ? "bg-emerald-50 text-emerald-600" :
                            t.type === 'outgoing' ? "bg-rose-50 text-rose-600" :
                            "bg-amber-50 text-amber-600"
                          )}>
                            {t.type === 'incoming' ? 'Приход' : t.type === 'outgoing' ? 'Расход' : 'Перенос'}
                          </span>
                        </td>
                        <td className="py-4 font-black">{t.quantityChange > 0 ? `+${t.quantityChange}` : t.quantityChange}</td>
                        <td className="py-4 text-slate-600">{t.warehouse?.name || '---'}</td>
                        <td className="py-4 text-slate-500 italic">{t.reason || '---'}</td>
                        <td className="py-4 text-slate-500">{t.username}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBatchesModal && selectedProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
                <h3 className="text-2xl font-black text-slate-900 flex items-center space-x-3">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                    <Layers size={24} />
                  </div>
                  <span>Партии товара (FIFO): {selectedProduct.name}</span>
                </h3>
                <button onClick={() => setShowBatchesModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto">
                <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800 text-sm font-medium">
                  Система списывает товар из самых старых партий в первую очередь (FIFO).
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-4">Дата закупки</th>
                      <th className="pb-4">Склад</th>
                      <th className="pb-4 text-right">Начальное кол-во</th>
                      <th className="pb-4 text-right">Остаток</th>
                      <th className="pb-4 text-right">Цена закупки</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {productBatches.map((b, i) => (
                      <tr key={b.id} className={clsx("text-sm", i === 0 && "bg-indigo-50/30")}>
                        <td className="py-4 text-slate-500 font-bold">
                          {new Date(b.createdAt).toLocaleDateString('ru-RU')}
                          {i === 0 && <span className="ml-2 px-2 py-0.5 bg-indigo-600 text-white text-[8px] rounded-md uppercase">След. на списание</span>}
                        </td>
                        <td className="py-4 text-slate-600 font-bold">{b.warehouse?.name}</td>
                        <td className="py-4 text-right text-slate-400 font-bold">{b.quantity} {selectedProduct.unit}</td>
                        <td className="py-4 text-right font-black text-slate-900">{b.remainingQuantity} {selectedProduct.unit}</td>
                        <td className="py-4 text-right font-black text-emerald-600">{b.costPrice.toFixed(2)} TJS</td>
                      </tr>
                    ))}
                    {productBatches.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-20 text-center text-slate-400 font-bold">Активных партий не найдено</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setShowBatchesModal(false)}
                  className="px-10 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal 
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteProduct}
        title="Удалить товар?"
        message={`Вы уверены, что хотите удалить товар "${selectedProduct?.name}"? Это действие нельзя отменить.`}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/30">
          <div className="flex flex-col md:flex-row gap-3 flex-1 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Поиск по названию или SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 text-sm shadow-sm"
              />
            </div>
            <div className="relative min-w-[180px]">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="w-full pl-11 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 text-sm shadow-sm appearance-none bg-white"
              >
                <option value="">Все склады</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-100 shadow-sm text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Всего: {filteredProducts.length}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">
                <th className="px-5 py-3">№</th>
                <th className="px-5 py-3 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('name')}>
                  <div className="flex items-center space-x-1.5">
                    <span>Товар</span>
                    {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
                {isAdmin && (
                  <th className="px-5 py-3 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('costPrice')}>
                    <div className="flex items-center space-x-1.5">
                      <span>Закупка</span>
                      {sortConfig.key === 'costPrice' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                )}
                <th className="px-5 py-3 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('sellingPrice')}>
                  <div className="flex items-center space-x-1.5">
                    <span>Продажа</span>
                    {sortConfig.key === 'sellingPrice' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
                <th className="px-5 py-3 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('stock')}>
                  <div className="flex items-center space-x-1.5">
                    <span>Запас</span>
                    {sortConfig.key === 'stock' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
                <th className="px-5 py-3">Приход</th>
                <th className="px-5 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProducts.map((product, index) => (
                <tr key={product.id} className="hover:bg-slate-50/50 transition-all duration-300 group">
                  <td className="px-5 py-3 font-bold text-slate-400 text-xs">{index + 1}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-110 transition-transform duration-500 border border-slate-200">
                        {product.photoUrl ? (
                          <img src={product.photoUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <ImageIcon className="text-slate-300" size={16} />
                        )}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 leading-tight text-xs">{product.name}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">SKU: {product.sku || '---'}</p>
                      </div>
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3">
                      <p className="font-bold text-slate-500 text-xs">{product.costPrice.toFixed(2)} <span className="text-[9px] uppercase">TJS</span></p>
                    </td>
                  )}
                  <td className="px-5 py-3">
                    <p className="font-black text-indigo-600 text-sm">{product.sellingPrice.toFixed(2)} <span className="text-[10px] font-bold uppercase">TJS</span></p>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center space-x-2">
                      <div className={clsx(
                        "w-1.5 h-1.5 rounded-full",
                        product.stock <= product.minStock ? "bg-rose-600 animate-pulse" : "bg-emerald-500"
                      )} />
                      <span className={clsx(
                        "font-black text-sm",
                        product.stock <= product.minStock ? "text-rose-600" : "text-slate-900"
                      )}>
                        {product.stock} <span className="text-[10px] font-bold text-slate-400 uppercase">{product.unit}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-bold text-slate-500 text-xs">{product.totalIncoming} <span className="text-[10px] font-bold text-slate-400 uppercase">{product.unit}</span></p>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex flex-col items-end space-y-1 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300">
                      <div className="flex items-center space-x-1">
                        <button 
                          onClick={() => {
                            setSelectedProduct(product);
                            setFormData({
                              name: product.name || '',
                              sku: product.sku || '',
                              unit: product.unit || '',
                              categoryId: product.categoryId?.toString() || '',
                              warehouseId: product.warehouseId?.toString() || '',
                              costPrice: product.costPrice?.toString() || '0',
                              sellingPrice: product.sellingPrice?.toString() || '0',
                              minStock: product.minStock?.toString() || '0',
                              initialStock: product.initialStock?.toString() || '0',
                              photoUrl: product.photoUrl || ''
                            });
                            setShowEditModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" 
                          title="Редактировать"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedProduct(product);
                            setRestockData({ ...restockData, warehouseId: product.warehouseId?.toString() || '' });
                            setShowRestockModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" 
                          title="Пополнить"
                        >
                          <PlusCircle size={14} />
                        </button>
                        <button 
                          onClick={() => handleShowBatches(product)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" 
                          title="Партии (FIFO)"
                        >
                          <Layers size={14} />
                        </button>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button 
                          onClick={() => handleShowHistory(product)}
                          className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all" 
                          title="История"
                        >
                          <History size={14} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedProduct(product);
                            setTransferData({ ...transferData, fromWarehouseId: product.warehouseId?.toString() || '' });
                            setShowTransferModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" 
                          title="Перенос"
                        >
                          <ArrowRightLeft size={14} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedProduct(product);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" 
                          title="Удалить"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                        <Package size={32} />
                      </div>
                      <div>
                        <p className="text-xl font-black text-slate-900">Товары не найдены</p>
                        <p className="text-slate-500 font-medium text-sm">Попробуйте изменить параметры поиска или добавьте новый товар.</p>
                      </div>
                      <button 
                        onClick={() => { resetForm(); setShowAddModal(true); }}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all text-sm"
                      >
                        Добавить первый товар
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
