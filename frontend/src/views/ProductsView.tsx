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
import { formatMoney, toFixedNumber } from '../utils/format';
import { getProductBatches } from '../api/products.api';
import { filterWarehousesForUser, getCurrentUser, getUserWarehouseId, isAdminUser } from '../utils/userAccess';

export default function ProductsView() {
  const user = getCurrentUser();
  const isAdmin = isAdminUser(user);
  const userWarehouseId = getUserWarehouseId(user);
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
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(userWarehouseId ? String(userWarehouseId) : '');
  const [transferData, setTransferData] = useState({ fromWarehouseId: '', toWarehouseId: '', quantity: '' });
  const [restockData, setRestockData] = useState({ warehouseId: '', quantity: '', costPrice: '', reason: '' });
  const [ocrResults, setOcrResults] = useState<any[] | null>(null);
  const [usdRate, setUsdRate] = useState<string>('10.95'); // Default rate
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'name', direction: 'asc' });
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);

  const availableTransferStock = selectedProduct && transferData.fromWarehouseId
    ? String(selectedProduct.warehouseId || '') === transferData.fromWarehouseId || selectedWarehouseId === transferData.fromWarehouseId
      ? Number(selectedProduct.stock || 0)
      : null
    : selectedProduct
      ? Number(selectedProduct.stock || 0)
      : null;

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

  useEffect(() => {
    fetchInitialData();
  }, [selectedWarehouseId, isAdmin, userWarehouseId]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [productsData, warehousesData, categoriesData] = await Promise.all([
        getProducts(selectedWarehouseId ? Number(selectedWarehouseId) : undefined),
        client.get('/warehouses').then(res => res.data),
        client.get('/settings/categories').then(res => res.data)
      ]);
      setProducts(Array.isArray(productsData) ? productsData : []);
      const filteredWarehouses = filterWarehousesForUser(Array.isArray(warehousesData) ? warehousesData : [], user);
      setWarehouses(filteredWarehouses);
      if (!isAdmin && filteredWarehouses[0]) {
        setSelectedWarehouseId(String(filteredWarehouses[0].id));
      }
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
      toast.success('Товар успешно перенесён!');
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
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при загрузке истории');
    }
  };

  const handleShowBatches = async (product: any) => {
    setSelectedProduct(product);
    try {
      const batches = await getProductBatches(product.id);
      setProductBatches(batches);
      setShowBatchesModal(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при загрузке партий');
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

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Поддерживаются JPG, PNG, WEBP или PDF файлы');
      e.target.value = '';
      return;
    }

    setIsScanning(true);
    const formData = new FormData();
    formData.append('invoice', file);

    try {
      const res = await client.post('/ocr/parse-invoice', formData);
      const rawItems = Array.isArray(res.data) ? res.data : [];
      const items = rawItems.map((item: any) => ({
        ...item,
        sellingPrice: item.sellingPrice || ''
      }));
      if (!items.length) {
        toast.error('Сканирование завершено, но товары не были распознаны');
        setOcrResults([]);
        return;
      }
      setOcrResults(items);
      toast.success('Накладная успешно отсканирована!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при сканировании накладной');
    } finally {
      setIsScanning(false);
      e.target.value = '';
    }
  };

  const handleAddOcrToStock = async () => {
    if (!ocrResults || !selectedWarehouseId) return;
    if (!categories.length) {
      toast.error('Сначала создайте хотя бы одну категорию товаров');
      return;
    }
    const rate = parseFloat(usdRate) || 1;
    try {
      setIsLoading(true);
      const normalizedResults = new Map<string, any>();
      for (const item of ocrResults) {
        const normalizedName = String(item.name || '').trim();
        const normalizedSku = String(item.sku || '').trim();
        const key = normalizedSku || normalizedName.toLowerCase();
        const quantity = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        const sellingPrice = item.sellingPrice ? Number(item.sellingPrice) : 0;
        if (!key || !normalizedName || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) {
          continue;
        }
        const existing = normalizedResults.get(key);
        if (existing) {
          existing.quantity += quantity;
          existing.price = price || existing.price;
          existing.sellingPrice = sellingPrice || existing.sellingPrice;
        } else {
          normalizedResults.set(key, {
            name: normalizedName,
            sku: normalizedSku || null,
            quantity,
            price,
            sellingPrice,
          });
        }
      }
      if (!normalizedResults.size) {
        toast.error('После сканирования не осталось корректных товаров для добавления');
        return;
      }
      const currentProducts = [...products];
      for (const item of normalizedResults.values()) {
        const costPriceTJS = item.price * rate;
        const normalizedItemName = item.name.trim().toLowerCase();
        const product = currentProducts.find((p) => {
          const productName = String(p.name || '').trim().toLowerCase();
          return (item.sku && p.sku === item.sku) || productName === normalizedItemName;
        });
        if (product) {
          await restockProduct(product.id, {
            warehouseId: Number(selectedWarehouseId),
            quantity: Number(item.quantity),
            costPrice: costPriceTJS,
            reason: 'OCR Restock'
          });
          if (item.sellingPrice) {
            await updateProduct(product.id, {
              sellingPrice: Number(item.sellingPrice)
            });
          }
          continue;
        }
        const createdProduct = await createProduct({
          name: item.name,
          sku: item.sku || undefined,
          unit: 'шт',
          categoryId: Number(categories[0].id),
          warehouseId: Number(selectedWarehouseId),
          costPrice: costPriceTJS,
          sellingPrice: Number(item.sellingPrice) || costPriceTJS * 1.2,
          initialStock: Number(item.quantity),
          minStock: 0,
        });
        currentProducts.push(createdProduct);
      }
      toast.success('Все товары успешно добавлены на склад');
      setOcrResults(null);
      fetchInitialData();
    } catch (err: any) {
      toast.error('Ошибка при добавлении товаров: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Для фото поддерживаются JPG, PNG и WEBP');
      e.target.value = '';
      return;
    }

    try {
      setIsPhotoUploading(true);
      const uploadFormData = new FormData();
      uploadFormData.append('photo', file);
      const res = await client.post('/ocr/upload', uploadFormData);

      if (res.data?.photoUrl) {
        setFormData((prev) => ({ ...prev, photoUrl: res.data.photoUrl }));
        toast.success('Фото успешно загружено');
      } else {
        toast.error('Не удалось получить ссылку на фото');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при загрузке фото');
    } finally {
      setIsPhotoUploading(false);
      e.target.value = '';
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
      toast.success('Товар успешно обновлён!');
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
      toast.success('Товар успешно удалён!');
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
    <div className="rounded-[30px] border border-white/70 bg-[#f4f5fb] p-4 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] sm:p-6">
      <div className="space-y-6">
      <div className="rounded-[28px] border border-white bg-white px-5 py-5 shadow-sm sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Товары</h1>
          <p className="text-slate-500 mt-0.5 font-medium text-sm">Управление ассортиментом, ценами и остатками.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select 
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            disabled={!isAdmin}
            className="min-w-[190px] rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-violet-300 focus:bg-white"
          >
            <option value="">Все склады</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>

          {isAdmin && <label className={clsx(
            "flex items-center space-x-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-all",
            selectedWarehouseId
              ? "cursor-pointer border-sky-100 bg-sky-50 text-slate-700 hover:bg-white"
              : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
          )}>
            {isScanning ? <Loader2 size={16} className="animate-spin text-sky-600" /> : <Camera size={16} className={selectedWarehouseId ? "text-sky-600" : "text-slate-400"} />}
            <span>{isScanning ? 'Сканирование...' : 'Сканировать'}</span>
            <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleScanInvoice} disabled={isScanning || !selectedWarehouseId} />
          </label>}
          {isAdmin && <button 
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
              "flex items-center space-x-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all active:scale-95",
              selectedWarehouseId 
                ? "bg-violet-500 text-white shadow-sm hover:bg-violet-600" 
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            )}
          >
            <Plus size={18} />
            <span>Добавить</span>
          </button>}
        </div>
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
                  <div className="p-2 bg-violet-500 text-white rounded-xl">
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
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-sm" 
                      placeholder="Напр: iPhone 15 Pro Max"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Артикул (SKU)</label>
                    <input 
                      type="text" 
                      value={formData.sku}
                      onChange={e => setFormData({...formData, sku: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-sm" 
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
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-sm" 
                      placeholder="шт, кг, литр..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Категория</label>
                    <select 
                      required
                      value={formData.categoryId}
                      onChange={e => setFormData({...formData, categoryId: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-sm appearance-none bg-white"
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
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-sm appearance-none bg-white"
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
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-sm" 
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
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-sm" 
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
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-sm" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Мин. остаток</label>
                        <input 
                          type="number" 
                          required
                          value={formData.minStock}
                          onChange={e => setFormData({...formData, minStock: e.target.value})}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-sm" 
                        />
                      </div>
                    </>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Фото товара</label>
                    <div className="flex flex-col gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-sky-600">
                        {isPhotoUploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                        <span>{isPhotoUploading ? 'Загрузка...' : 'Выбрать фото'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handlePhotoUpload}
                          disabled={isPhotoUploading}
                        />
                      </label>
                      {formData.photoUrl && (
                        <div className="flex items-center gap-3">
                          <div className="h-14 w-14 overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <img src={formData.photoUrl} alt="Фото товара" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, photoUrl: '' }))}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 transition-all hover:bg-white"
                          >
                            Убрать фото
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <button type="button" onClick={() => { setShowAddModal(false); setShowEditModal(false); }} className="px-6 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all text-sm">Отмена</button>
                  <button type="submit" className="px-8 py-2 bg-violet-500 text-white rounded-xl font-bold shadow-xl shadow-violet-500/20 hover:bg-violet-600 transition-all active:scale-95 text-sm">
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
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-bold text-sm appearance-none bg-white"
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
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-bold text-sm appearance-none bg-white"
                    >
                      <option value="">Выберите склад</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Количество</label>
                    {availableTransferStock !== null && (
                      <p className="mb-2 text-xs font-bold text-slate-500">Доступно: {availableTransferStock} {selectedProduct?.unit || 'шт'}</p>
                    )}
                    <input 
                      type="number" 
                      required
                      min="1"
                      placeholder="Введите количество"
                      value={transferData.quantity}
                      onChange={e => setTransferData({ ...transferData, quantity: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-bold text-sm" 
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
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold appearance-none bg-white"
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
                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold" 
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
                          className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold" 
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
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold" 
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
                <div className="flex items-center space-x-4 bg-sky-50 p-4 rounded-2xl border border-sky-100 shadow-sm">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Курс USD ($)</p>
                    <input 
                      type="number" 
                      step="0.01"
                      value={usdRate}
                      onChange={(e) => setUsdRate(e.target.value)}
                      className="w-24 text-right font-black text-sky-600 outline-none"
                    />
                  </div>
                  <DollarSign className="text-sky-300" size={20} />
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
                  <div key={i} className="grid grid-cols-12 gap-4 items-center p-4 bg-sky-50 rounded-2xl group hover:bg-sky-100/50 transition-colors">
                    <div className="col-span-5">
                      <p className="font-bold text-slate-900 line-clamp-2">{item.name}</p>
                      <p className="text-[10px] text-slate-400 font-black uppercase">Артикул: {item.sku || '---'}</p>
                    </div>
                    <div className="col-span-2 text-center">
                      <p className="font-black text-sky-600">{item.quantity} шт.</p>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="font-black text-slate-900">{item.price} $</p>
                      <p className="text-[10px] font-bold text-slate-400">≈ {formatMoney(item.price * parseFloat(usdRate || '0'))}</p>
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
                        className="w-full text-right bg-white px-4 py-2 rounded-xl border border-sky-200 focus:border-sky-500 outline-none font-black text-emerald-600"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-8 bg-sky-50/60 flex justify-end space-x-3 border-t border-slate-100">
                <button onClick={() => setOcrResults(null)} className="px-8 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-200 transition-all">Отмена</button>
                <button 
                  onClick={handleAddOcrToStock}
                  disabled={isLoading}
                  className="px-10 py-4 bg-sky-500 text-white rounded-2xl font-bold shadow-xl shadow-sky-500/20 hover:bg-sky-600 transition-all disabled:opacity-50 flex items-center space-x-2"
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
                  <div className="p-3 bg-sky-500 text-white rounded-2xl">
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
                            t.type === 'price_change' || t.type === 'adjustment' ? "bg-sky-50 text-sky-600" :
                            "bg-amber-50 text-amber-600"
                          )}>
                            {t.type === 'incoming'
                              ? 'Приход'
                              : t.type === 'outgoing'
                                ? 'Расход'
                                : t.type === 'price_change' || t.type === 'adjustment'
                                  ? 'Изменение цены'
                                  : 'Перенос'}
                          </span>
                        </td>
                        <td className="py-4 font-black">{Number(t.qtyChange || 0) > 0 ? `+${t.qtyChange}` : (t.qtyChange ?? 0)}</td>
                        <td className="py-4 text-slate-600">{t.warehouseName || t.warehouse?.name || '---'}</td>
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
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-violet-50/50">
                <h3 className="text-2xl font-black text-slate-900 flex items-center space-x-3">
                  <div className="p-3 bg-violet-500 text-white rounded-2xl">
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
                      <tr key={b.id} className={clsx("text-sm", i === 0 && "bg-violet-50/40")}>
                        <td className="py-4 text-slate-500 font-bold">
                          {new Date(b.createdAt).toLocaleDateString('ru-RU')}
                          {i === 0 && <span className="ml-2 px-2 py-0.5 bg-violet-500 text-white text-[8px] rounded-md uppercase">След. на списание</span>}
                        </td>
                        <td className="py-4 text-slate-600 font-bold">{b.warehouse?.name}</td>
                        <td className="py-4 text-right text-slate-400 font-bold">{b.quantity} {selectedProduct.unit}</td>
                        <td className="py-4 text-right font-black text-slate-900">{b.remainingQuantity} {selectedProduct.unit}</td>
                        <td className="py-4 text-right font-black text-emerald-600">{formatMoney(b.costPrice)}</td>
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

      <div className="overflow-hidden rounded-[28px] border border-white bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col md:flex-row gap-3 flex-1 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-500" size={16} />
              <input 
                type="text" 
                placeholder="Поиск по названию или SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-sky-100 bg-sky-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition-all focus:border-sky-300 focus:bg-white"
              />
            </div>
            <div className="relative min-w-[180px]">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-500" size={16} />
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                disabled={!isAdmin}
                className="w-full appearance-none rounded-2xl border border-violet-100 bg-violet-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition-all focus:border-violet-300 focus:bg-white"
              >
                <option value="">Все склады</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="rounded-full bg-emerald-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Товаров: {filteredProducts.length}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f4f5fb] text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
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
                    <span>Остаток</span>
                    {sortConfig.key === 'stock' && (sortConfig.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </div>
                </th>
                <th className="px-5 py-3">Приход</th>
                <th className="px-5 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((product, index) => (
                <tr key={product.id} className="group transition-all duration-300 hover:bg-slate-50/70">
                  <td className="px-5 py-4 text-xs font-medium text-slate-400">{index + 1}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 transition-transform duration-500 group-hover:scale-105">
                        {product.photoUrl ? (
                          <img src={product.photoUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <ImageIcon className="text-slate-300" size={16} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-tight text-slate-900">{product.name}</p>
                        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">SKU: {product.sku || '---'}</p>
                      </div>
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3">
                      <p className="text-xs font-medium text-slate-500">{toFixedNumber(product.costPrice)} <span className="text-[10px] uppercase">TJS</span></p>
                    </td>
                  )}
                  <td className="px-5 py-3">
                    <p className="text-sm font-semibold text-slate-900">{toFixedNumber(product.sellingPrice)} <span className="text-[10px] font-medium uppercase text-slate-400">TJS</span></p>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center space-x-2">
                      <div className={clsx(
                        "w-1.5 h-1.5 rounded-full",
                        product.stock <= product.minStock ? "bg-rose-600 animate-pulse" : "bg-emerald-500"
                      )} />
                      <span className={clsx(
                        "text-sm font-semibold",
                        product.stock <= product.minStock ? "text-rose-600" : "text-slate-900"
                      )}>
                        {product.stock} <span className="text-[10px] font-medium uppercase text-slate-400">{product.unit}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-xs font-medium text-slate-500">{product.totalIncoming} <span className="text-[10px] font-medium text-slate-400 uppercase">{product.unit}</span></p>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex flex-col items-end space-y-1.5">
                      <div className="flex items-center space-x-1.5">
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
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600" 
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
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600" 
                          title="Пополнить"
                        >
                          <PlusCircle size={14} />
                        </button>
                        <button 
                          onClick={() => handleShowBatches(product)}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600" 
                          title="Партии (FIFO)"
                        >
                          <Layers size={14} />
                        </button>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <button 
                          onClick={() => handleShowHistory(product)}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600" 
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
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600" 
                          title="Перенос"
                        >
                          <ArrowRightLeft size={14} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedProduct(product);
                            setShowDeleteConfirm(true);
                          }}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" 
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
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f4f5fb] text-slate-300">
                        <Package size={32} />
                      </div>
                      <div>
                        <p className="text-xl font-black text-slate-900">Товары не найдены</p>
                        <p className="text-slate-500 font-medium text-sm">Измените параметры поиска или выберите другой склад.</p>
                      </div>
                      <button 
                        onClick={() => { resetForm(); setShowAddModal(true); }}
                        className="rounded-2xl bg-violet-500 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-violet-600"
                      >
                        Добавить товар
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
    </div>
  );
}


