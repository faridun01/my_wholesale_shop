import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { getProducts, createProduct, updateProduct, deleteProduct, restockProduct, getProductHistory, mergeProduct } from '../api/products.api';
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
  GitMerge,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { formatMoney, toFixedNumber } from '../utils/format';
import { getProductBatches } from '../api/products.api';
import { filterWarehousesForUser, getCurrentUser, getUserWarehouseId, isAdminUser } from '../utils/userAccess';
import { handleBrokenImage, resolveMediaUrl } from '../utils/media';
import { formatProductName } from '../utils/productName';
import { getDefaultWarehouseId } from '../utils/warehouse';

const normalizeOcrProductName = (name: string) => {
  const trimmed = String(name || '').trim();
  const bracketIndex = trimmed.indexOf('(');
  const slashIndex = trimmed.indexOf('/');
  const cutIndex =
    bracketIndex >= 0 && slashIndex >= 0
      ? Math.min(bracketIndex, slashIndex)
      : bracketIndex >= 0
        ? bracketIndex
        : slashIndex;

  return (cutIndex >= 0 ? trimmed.slice(0, cutIndex) : trimmed)
    .replace(/[«»“”„‟"]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeVolumeSpacing = (value: string) =>
  value
    .replace(/(\d)\s*[.,]\s*(\d)/gu, '$1.$2')
    .replace(/(\d)\s+(\d)(?=\s*(?:гр|г|кг|л|мл)\b)/giu, '$1.$2')
    .replace(/(\d(?:\.\d+)?)\s*(гр|г|кг|л|мл|шт)\b/giu, '$1 $2');

const normalizeCatalogName = (name: string) =>
  normalizeVolumeSpacing(String(name || ''))
    .replace(/\s*\[[^\]]*\]\s*$/u, '')
    .replace(/[«»“”„‟"']/gu, '')
    .replace(/[(),]/gu, ' ')
    .replace(/[ёЁ]/g, 'е')
    .replace(/plasticковых/gi, 'пластиковых')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeProductFamilyName = (name: string) =>
  normalizeCatalogName(name)
    .replace(/\bмассой\s+\d+(?:\.\d+)?\s*(?:гр|г|кг|л|мл|шт)\b/giu, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:гр|г|кг|л|мл|шт)\b/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractMassKey = (name: string) => {
  const match = normalizeVolumeSpacing(String(name || '').toLowerCase()).match(/(\d+(?:\.\d+)?)\s*(гр|г|кг|л|мл|шт)\b/u);
  return match ? `${match[1]} ${match[2]}` : '';
};

const detectCategoryName = (name: string) => {
  const normalized = String(name || '').toLowerCase().replace(/[ё]/g, 'е');

  if (normalized.includes('порошок') && normalized.includes('автомат')) return 'Стиральные порошки';
  if (normalized.includes('порошок')) return 'Стиральные средства';
  if (normalized.includes('жидк') && normalized.includes('стира')) return 'Жидкие средства для стирки';
  if (normalized.includes('гель') && normalized.includes('посуд')) return 'Гели для посуды';
  if (normalized.includes('капля') && normalized.includes('посуд')) return 'Средства для мытья посуды';
  if (normalized.includes('посуд')) return 'Средства для мытья посуды';
  if (normalized.includes('чистящее средство')) return 'Чистящие средства';

  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).join(' ') || 'Прочее';
};

const normalizeOcrBaseUnit = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'шт';
  if (['шт', 'штук', 'штука', 'штуки', 'pcs', 'piece', 'pieces'].includes(normalized)) return 'шт';
  if (['пачка', 'пачки', 'пачек'].includes(normalized)) return 'пачка';
  if (['флакон', 'флакона', 'флаконов'].includes(normalized)) return 'флакон';
  if (['емкость', 'ёмкость', 'емкости', 'ёмкости', 'емкостей', 'ёмкостей'].includes(normalized)) return 'ёмкость';
  if (['бутылка', 'бутылки', 'бутылок'].includes(normalized)) return 'бутылка';
  return normalized;
};

const normalizeOcrPackageName = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (['мешок', 'мешка', 'мешков', 'bag'].includes(normalized)) return 'мешок';
  if (['коробка', 'коробки', 'коробок', 'box'].includes(normalized)) return 'коробка';
  if (['упаковка', 'упаковки', 'упаковок', 'pack'].includes(normalized)) return 'упаковка';
  if (['пачка', 'пачки', 'пачек'].includes(normalized)) return 'пачка';
  return normalized;
};

const formatPriceInput = (value: unknown) => {
  if (value === '' || value === null || value === undefined) {
    return '';
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? toFixedNumber(numeric) : '';
};

export default function ProductsView() {
  const ConfirmationModal = React.lazy(() => import('../components/common/ConfirmationModal'));
  const ProductHistoryModal = React.lazy(() => import('../components/products/ProductHistoryModal'));
  const ProductBatchesModal = React.lazy(() => import('../components/products/ProductBatchesModal'));
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
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showBatchesModal, setShowBatchesModal] = useState(false);
  const [productHistory, setProductHistory] = useState<any[]>([]);
  const [productBatches, setProductBatches] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(userWarehouseId ? String(userWarehouseId) : '');
  const [transferData, setTransferData] = useState({ fromWarehouseId: '', toWarehouseId: '', quantity: '' });
  const [restockData, setRestockData] = useState({ warehouseId: '', quantity: '', costPrice: '', expensePercent: '0', reason: '' });
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
    unit: 'шт',
    categoryId: '',
    warehouseId: '',
    costPrice: '',
    expensePercent: '0',
    sellingPrice: '',
    minStock: '0',
    initialStock: '0',
    photoUrl: ''
  });
  const effectiveFormCostPrice = (() => {
    const purchaseCost = Number(formData.costPrice || 0);
    const expensePercent = Number(formData.expensePercent || 0);
    if (!Number.isFinite(purchaseCost) || purchaseCost < 0) return 0;
    if (!Number.isFinite(expensePercent) || expensePercent < 0) return purchaseCost;
    return purchaseCost + (purchaseCost * expensePercent / 100);
  })();
  const effectiveRestockCostPrice = (() => {
    const purchaseCost = Number(restockData.costPrice || 0);
    const expensePercent = Number(restockData.expensePercent || 0);
    if (!Number.isFinite(purchaseCost) || purchaseCost < 0) return 0;
    if (!Number.isFinite(expensePercent) || expensePercent < 0) return purchaseCost;
    return purchaseCost + (purchaseCost * expensePercent / 100);
  })();

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
      const defaultWarehouseId = getDefaultWarehouseId(filteredWarehouses);
      if (isAdmin && !selectedWarehouseId && defaultWarehouseId) {
        setSelectedWarehouseId(String(defaultWarehouseId));
      } else if (!isAdmin && filteredWarehouses[0]) {
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
        purchaseCostPrice: Number(restockData.costPrice),
        expensePercent: Number(restockData.expensePercent || 0),
        reason: restockData.reason
      });
      toast.success('Товар успешно пополнен!');
      setShowRestockModal(false);
      setRestockData({ warehouseId: '', quantity: '', costPrice: '', expensePercent: '0', reason: '' });
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
      const res = await client.post('/ocr/parse-invoice', formData, {
        timeout: 120000,
      });
      const rawItems = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.items)
          ? res.data.items
          : [];
      const items = rawItems
        .map((item: any, index: number) => ({
          enabled: true,
          lineIndex: Number(item.lineIndex || index + 1),
          rawName: String(item.rawName || item.name || '').trim(),
          name: normalizeOcrProductName(item.name || item.rawName || ''),
          brand: String(item.brand || '').trim(),
          packageName: normalizeOcrPackageName(item.packageName || ''),
          baseUnitName: normalizeOcrBaseUnit(item.baseUnitName || item.unit || 'шт'),
          packageCount: Number(item.packageCount || 0),
          unitsPerPackage: Number(item.unitsPerPackage || 0),
          quantity: Number(
            item.quantity
            || (Number(item.packageCount || 0) > 0 && Number(item.unitsPerPackage || 0) > 0
              ? Number(item.packageCount || 0) * Number(item.unitsPerPackage || 0)
              : 0)
          ),
          price: Number(item.price || 0),
          rawQuantity: item.rawQuantity || '',
          unit: normalizeOcrBaseUnit(item.baseUnitName || item.unit || 'шт'),
          lineTotal: Number(item.lineTotal || 0),
          note: item.note || '',
          sellingPrice: item.sellingPrice || '',
        }))
        .filter((item: any) => item.rawName || item.name)
        .sort((a: any, b: any) => a.lineIndex - b.lineIndex);
      if (!items.length) {
        toast.error('Сканирование завершено, но товары не были распознаны');
        setOcrResults([]);
        return;
      }
      setOcrResults(items);
      toast.success('Накладная успешно отсканирована!');
    } catch (err: any) {
      const isTimeout =
        err?.code === 'ECONNABORTED'
        || String(err?.message || '').toLowerCase().includes('timeout');

      toast.error(
        isTimeout
          ? 'Сканирование заняло слишком много времени. Попробуйте ещё раз или используйте файл поменьше.'
          : err.response?.data?.error || 'Ошибка при сканировании накладной'
      );
    } finally {
      setIsScanning(false);
      e.target.value = '';
    }
  };

  const handleAddOcrToStock = async () => {
    if (!ocrResults || !selectedWarehouseId) return;
    const rate = parseFloat(usdRate) || 1;
    try {
      setIsLoading(true);
      const categoryCache = new Map(
        categories.map((category) => [String(category.name || '').trim().toLowerCase(), category])
      );

      const ensureCategoryId = async (productName: string) => {
        const categoryName = detectCategoryName(productName);
        const categoryKey = categoryName.trim().toLowerCase();
        const existingCategory = categoryCache.get(categoryKey);
        if (existingCategory?.id) {
          return Number(existingCategory.id);
        }

        const createdCategory = await client.post('/settings/categories', { name: categoryName }).then((res) => res.data);
        categoryCache.set(categoryKey, createdCategory);
        setCategories((prev) => {
          const hasSame = prev.some((item) => String(item.name || '').trim().toLowerCase() === categoryKey);
          return hasSame ? prev : [...prev, createdCategory].sort((a, b) => String(a.name).localeCompare(String(b.name)));
        });
        return Number(createdCategory.id);
      };

      const preparedResults = ocrResults
        .map((item) => {
          if (item.enabled === false) {
            return null;
          }
          const normalizedName = normalizeOcrProductName(item.name || '');
          const rawName = String(item.rawName || item.name || '').trim();
          const brand = String(item.brand || '').trim();
          const packageName = normalizeOcrPackageName(item.packageName || '');
          const baseUnitName = normalizeOcrBaseUnit(item.baseUnitName || item.unit || 'шт');
          const packageCount = Number(item.packageCount || 0);
          const unitsPerPackage = Number(item.unitsPerPackage || 0);
          const normalizedQuantity = Number(item.quantity || 0);
          const quantity =
            packageCount > 0 && unitsPerPackage > 0
              ? packageCount * unitsPerPackage
              : normalizedQuantity;
          const price = Number(item.price || 0);
          const lineTotal = Number(item.lineTotal || 0);
          const sellingPrice = item.sellingPrice ? Number(item.sellingPrice) : 0;
          const costPricePerPieceTJS =
            lineTotal > 0 && quantity > 0
              ? (lineTotal * rate) / quantity
              : unitsPerPackage > 0
              ? (price * rate) / unitsPerPackage
              : quantity > 0
                ? (price * rate) / quantity
                : 0;

          if (
            !normalizedName ||
            !Number.isFinite(quantity) ||
            quantity <= 0 ||
            !Number.isFinite(price) ||
            price < 0 ||
            !Number.isFinite(costPricePerPieceTJS) ||
            costPricePerPieceTJS < 0
          ) {
            return null;
          }

          return {
            lineIndex: Number(item.lineIndex || 0),
            name: normalizedName,
            rawName,
            brand,
            packageName,
            baseUnitName,
            packageCount,
            unitsPerPackage,
            quantity,
            price,
            lineTotal,
            costPricePerPieceTJS,
            sellingPrice,
            rawQuantity: String(item.rawQuantity || '').trim(),
            note: String(item.note || '').trim(),
          };
        })
        .filter(Boolean) as Array<{
          lineIndex: number;
          name: string;
          rawName: string;
          brand: string;
          packageName: string;
          baseUnitName: string;
          packageCount: number;
          unitsPerPackage: number;
          quantity: number;
          price: number;
          lineTotal: number;
          costPricePerPieceTJS: number;
          sellingPrice: number;
          rawQuantity: string;
          note: string;
        }>;

      const mergedPreparedResults = Array.from(
        preparedResults.reduce((acc, item) => {
          const key = normalizeCatalogName(item.name);
          const existing = acc.get(key);

          if (!existing) {
            acc.set(key, { ...item });
            return acc;
          }

          existing.quantity += Number(item.quantity || 0);
          existing.price += Number(item.price || 0);
          existing.lineTotal += Number(item.lineTotal || 0);
          existing.packageCount += Number(item.packageCount || 0);
          existing.unitsPerPackage = Math.max(Number(existing.unitsPerPackage || 0), Number(item.unitsPerPackage || 0));
          existing.costPricePerPieceTJS = existing.quantity > 0
            ? ((existing.lineTotal > 0 ? existing.lineTotal * rate : existing.price * rate) / existing.quantity)
            : existing.costPricePerPieceTJS;
          if (Number(item.sellingPrice || 0) > 0) {
            existing.sellingPrice = Number(item.sellingPrice);
          }
          if (!existing.rawQuantity && item.rawQuantity) {
            existing.rawQuantity = item.rawQuantity;
          }
          if (!existing.rawName && item.rawName) {
            existing.rawName = item.rawName;
          }
          if (!existing.brand && item.brand) {
            existing.brand = item.brand;
          }
          if (!existing.packageName && item.packageName) {
            existing.packageName = item.packageName;
          }
          if (!existing.baseUnitName && item.baseUnitName) {
            existing.baseUnitName = item.baseUnitName;
          }
          if (!existing.note && item.note) {
            existing.note = item.note;
          }

          return acc;
        }, new Map<string, any>()).values(),
      );

      if (!mergedPreparedResults.length) {
        toast.error('После сканирования не осталось корректных товаров для добавления');
        return;
      }
      const currentProducts = [...products];
      for (const item of mergedPreparedResults) {
        const costPriceTJS = item.costPricePerPieceTJS;
        const normalizedItemName = normalizeCatalogName(item.name);
        const familyKey = normalizeProductFamilyName(item.name);
        const massKey = extractMassKey(item.name);
        const categoryId = await ensureCategoryId(item.name);
        const product = currentProducts.find((p) => {
          const productName = normalizeCatalogName(String(p.name || ''));
          const productFamilyKey = normalizeProductFamilyName(String(p.name || ''));
          const productMassKey = extractMassKey(String(p.name || ''));
          const productWarehouseId = Number(p.warehouseId || 0);
          const targetWarehouseId = Number(selectedWarehouseId);

          if (productWarehouseId && productWarehouseId !== targetWarehouseId) {
            return false;
          }

          return productName === normalizedItemName || (productFamilyKey === familyKey && productMassKey === massKey);
        });
        if (product) {
          await restockProduct(product.id, {
            warehouseId: Number(selectedWarehouseId),
            quantity: Number(item.quantity),
            costPrice: costPriceTJS,
            reason: 'OCR Restock'
          });
          if (item.sellingPrice || item.rawName || item.brand || item.packageName) {
            const productUpdatePayload: Record<string, unknown> = {
              rawName: item.rawName,
              brand: item.brand || undefined,
              baseUnitName: item.baseUnitName,
              unit: item.baseUnitName,
              packaging: item.packageName && Number(item.unitsPerPackage || 0) > 0
                ? {
                    packageName: item.packageName,
                    baseUnitName: item.baseUnitName,
                    unitsPerPackage: Number(item.unitsPerPackage || 0),
                    isDefault: true,
                  }
                : undefined,
            };
            if (Number(item.sellingPrice || 0) > 0) {
              productUpdatePayload.sellingPrice = Number(item.sellingPrice);
            }
            await updateProduct(product.id, {
              ...productUpdatePayload,
            });
          }
          continue;
        }
        try {
          const createdProduct = await createProduct({
            name: item.name,
            rawName: item.rawName,
            brand: item.brand || undefined,
            baseUnitName: item.baseUnitName,
            unit: item.baseUnitName,
            categoryId,
            warehouseId: Number(selectedWarehouseId),
            costPrice: costPriceTJS,
            sellingPrice: Number(item.sellingPrice) || costPriceTJS * 1.2,
            initialStock: Number(item.quantity),
            minStock: 0,
            packaging: item.packageName && Number(item.unitsPerPackage || 0) > 0
              ? {
                  packageName: item.packageName,
                  baseUnitName: item.baseUnitName,
                  unitsPerPackage: Number(item.unitsPerPackage || 0),
                  isDefault: true,
                }
              : undefined,
          });
          currentProducts.push(createdProduct);
        } catch (createErr: any) {
          const duplicateByName = currentProducts.find((p) => {
            const productName = normalizeCatalogName(String(p.name || ''));
            const sameWarehouse = Number(p.warehouseId || 0) === Number(selectedWarehouseId);
            return sameWarehouse && productName === normalizedItemName;
          });

          if (!duplicateByName) {
            throw createErr;
          }

          await restockProduct(duplicateByName.id, {
            warehouseId: Number(selectedWarehouseId),
            quantity: Number(item.quantity),
            costPrice: costPriceTJS,
            reason: 'OCR Restock'
          });

          if (item.sellingPrice || item.rawName || item.brand || item.packageName) {
            const duplicateUpdatePayload: Record<string, unknown> = {
              rawName: item.rawName,
              brand: item.brand || undefined,
              baseUnitName: item.baseUnitName,
              unit: item.baseUnitName,
              packaging: item.packageName && Number(item.unitsPerPackage || 0) > 0
                ? {
                    packageName: item.packageName,
                    baseUnitName: item.baseUnitName,
                    unitsPerPackage: Number(item.unitsPerPackage || 0),
                    isDefault: true,
                  }
                : undefined,
            };
            if (Number(item.sellingPrice || 0) > 0) {
              duplicateUpdatePayload.sellingPrice = Number(item.sellingPrice);
            }
            await updateProduct(duplicateByName.id, {
              ...duplicateUpdatePayload,
            });
          }
        }
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
        purchaseCostPrice: parseFloat(formData.costPrice),
        expensePercent: parseFloat(formData.expensePercent || '0'),
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
        purchaseCostPrice: parseFloat(formData.costPrice),
        expensePercent: parseFloat(formData.expensePercent || '0'),
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

  const getMergeCandidates = (product: any) => {
    const sourceFamily = normalizeProductFamilyName(String(product?.name || ''));
    const sourceWarehouseId = Number(product?.warehouseId || selectedWarehouseId || 0);
    const sourceCategoryId = Number(product?.categoryId || 0);
    const sourceMassKey = extractMassKey(String(product?.name || ''));

    return products.filter((candidate) => {
      if (!candidate || candidate.id === product?.id) {
        return false;
      }

      const candidateWarehouseId = Number(candidate.warehouseId || 0);
      if (sourceWarehouseId && candidateWarehouseId && candidateWarehouseId !== sourceWarehouseId) {
        return false;
      }

      const candidateFamily = normalizeProductFamilyName(String(candidate.name || ''));
      const candidateMassKey = extractMassKey(String(candidate.name || ''));
      const candidateCategoryId = Number(candidate.categoryId || 0);

      return candidateFamily === sourceFamily || (sourceCategoryId > 0 && candidateCategoryId === sourceCategoryId && sourceMassKey && candidateMassKey === sourceMassKey);
    });
  };

  const getDuplicateHintCount = (product: any) => {
    const sourceWarehouseId = Number(product?.warehouseId || selectedWarehouseId || 0);
    const sourceCategoryId = Number(product?.categoryId || 0);
    const sourceMassKey = extractMassKey(String(product?.name || ''));

    if (!sourceCategoryId || !sourceMassKey) {
      return 0;
    }

    return products.filter((candidate) => {
      if (!candidate || candidate.id === product?.id) {
        return false;
      }

      const candidateWarehouseId = Number(candidate.warehouseId || 0);
      const candidateCategoryId = Number(candidate.categoryId || 0);
      const candidateMassKey = extractMassKey(String(candidate.name || ''));

      if (sourceWarehouseId && candidateWarehouseId && candidateWarehouseId !== sourceWarehouseId) {
        return false;
      }

      return candidateCategoryId === sourceCategoryId && candidateMassKey === sourceMassKey;
    }).length;
  };

  const handleOpenMergeModal = (product: any) => {
    const candidates = getMergeCandidates(product);
    if (!candidates.length) {
      toast.error('Похожих товаров для объединения не найдено');
      return;
    }

    setSelectedProduct(product);
    setMergeTargetId(String(candidates[0].id));
    setShowMergeModal(true);
  };

  const handleMergeProduct = async () => {
    if (!selectedProduct || !mergeTargetId) {
      return;
    }

    try {
      await mergeProduct(selectedProduct.id, Number(mergeTargetId));
      toast.success('Товары объединены');
      setShowMergeModal(false);
      setMergeTargetId('');
      setSelectedProduct(null);
      fetchInitialData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при объединении товаров');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      unit: 'шт',
      categoryId: '',
      warehouseId: '',
      costPrice: '',
      expensePercent: '0',
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

  const aggregatedProducts: any[] = Object.values(
    products.reduce((acc, product) => {
      const key = normalizeCatalogName(product.name);
      if (!acc[key]) {
        acc[key] = {
          ...product,
          name: String(product.name || '').replace(/\s*\[[^\]]*\]\s*$/u, '').trim(),
          stock: Number(product.stock || 0),
          totalIncoming: Number(product.totalIncoming || 0),
          isAggregateRow: true,
        };
      } else {
        acc[key].stock += Number(product.stock || 0);
        acc[key].totalIncoming += Number(product.totalIncoming || 0);
        if (!acc[key].photoUrl && product.photoUrl) {
          acc[key].photoUrl = product.photoUrl;
        }
      }
      return acc;
    }, {} as Record<string, any>)
  );

  const sortedAggregatedProducts = [...aggregatedProducts].sort((a, b) => {
    if (!sortConfig.direction) return 0;
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const baseProducts = selectedWarehouseId ? sortedProducts : sortedAggregatedProducts;
  const isAggregateMode = !selectedWarehouseId;
  const normalizedSearch = normalizeCatalogName(search);

  const filteredProducts = baseProducts.filter(p => {
    const productSearchValue = normalizeCatalogName(String(p.name || ''));
    const matchesSearch = !normalizedSearch || productSearchValue.includes(normalizedSearch);
    
    // If a warehouse is selected, we only show products that have stock in that warehouse
    // OR are assigned to that warehouse as their default warehouse.
    const matchesWarehouse = !selectedWarehouseId || p.stock > 0 || p.warehouseId === Number(selectedWarehouseId);
    
    return matchesSearch && matchesWarehouse;
  });

  return (
    <div className="app-page-shell app-page-pad">
      <div className="space-y-6">
      <div className="app-surface px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight sm:text-2xl">Товары</h1>
          <p className="mt-1 max-w-xl text-sm font-medium text-slate-500">Управление ассортиментом, ценами и остатками.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
          {isAdmin && <label className={clsx(
            "flex w-full items-center justify-center space-x-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-all sm:w-auto",
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
              "flex w-full items-center justify-center space-x-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all active:scale-95 sm:w-auto",
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
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                  <Loader2 size={30} className="animate-spin" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Идёт чтение накладной</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Пожалуйста, подождите. OCR распознаёт все позиции, количество, цену и детали строки.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}

        {(showAddModal || showEditModal) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowAddModal(false);
              setShowEditModal(false);
            }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
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
                        onBlur={e => setFormData({...formData, costPrice: formatPriceInput(e.target.value)})}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-sm" 
                      />
                    </div>
                  )}
                  {isAdmin && (
                    <div>
                      <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Расходы %</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.expensePercent}
                        onChange={e => setFormData({...formData, expensePercent: e.target.value})}
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
                      onBlur={e => setFormData({...formData, sellingPrice: formatPriceInput(e.target.value)})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-sm" 
                    />
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Итог за штуку</label>
                      <input
                        type="text"
                        readOnly
                        value={formatPriceInput(effectiveFormCostPrice)}
                        className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 outline-none transition-all font-bold text-sm"
                      />
                    </div>
                  )}
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
                            <img
                              src={resolveMediaUrl(formData.photoUrl, formData.name || 'preview')}
                              alt="Фото товара"
                              className="h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(event) => handleBrokenImage(event, formData.name || 'preview')}
                            />
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
            onClick={() => setShowTransferModal(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
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
            onClick={() => setShowRestockModal(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-[28rem] rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="border-b border-slate-100 bg-emerald-50/50 p-6">
                <h3 className="flex items-center space-x-3 text-xl font-black text-slate-900">
                  <div className="rounded-2xl bg-emerald-600 p-2.5 text-white">
                    <PlusCircle size={20} />
                  </div>
                  <span>Пополнение товара</span>
                </h3>
                <p className="mt-2 text-sm font-bold text-slate-500">{selectedProduct?.name}</p>
              </div>
              <form onSubmit={handleRestock} className="space-y-5 p-6">
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-700">Склад</label>
                    <select 
                      required
                      value={restockData.warehouseId}
                      onChange={e => setRestockData({ ...restockData, warehouseId: e.target.value })}
                      className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-bold outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    >
                      <option value="">Выберите склад</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-700">Количество</label>
                      <input 
                        type="number" 
                        required
                        value={restockData.quantity}
                        onChange={e => setRestockData({ ...restockData, quantity: e.target.value })}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 font-bold outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" 
                      />
                    </div>
                    {isAdmin && (
                      <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-700">Цена закупки</label>
                        <input 
                          type="number" 
                          step="0.01"
                          required
                          value={restockData.costPrice}
                          onChange={e => setRestockData({ ...restockData, costPrice: e.target.value })}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 font-bold outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" 
                        />
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-700">Расходы %</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={restockData.expensePercent}
                          onChange={e => setRestockData({ ...restockData, expensePercent: e.target.value })}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 font-bold outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-700">Итог за штуку</label>
                        <input
                          type="text"
                          readOnly
                          value={formatPriceInput(effectiveRestockCostPrice)}
                          className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 font-bold text-emerald-700 outline-none"
                        />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-700">Причина / Комментарий</label>
                    <input 
                      type="text" 
                      value={restockData.reason}
                      onChange={e => setRestockData({ ...restockData, reason: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 font-bold outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" 
                      placeholder="Напр: Новая поставка"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={() => setShowRestockModal(false)} className="rounded-2xl px-6 py-3 text-sm font-bold text-slate-500 transition-all hover:bg-slate-50">Отмена</button>
                  <button type="submit" className="rounded-2xl bg-emerald-600 px-8 py-3 text-sm font-bold text-white shadow-xl shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-95">Пополнить</button>
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
            onClick={() => setOcrResults(null)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Результаты сканирования</h3>
                  <p className="text-slate-500 font-bold">Показываем все распознанные детали. На склад добавятся только нужные поля.</p>
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
                <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-sky-600">Авторасчёт по накладной</p>
                  <p className="mt-2 text-sm font-medium text-slate-600">
                    Считываем все данные из накладной, автоматически считаем количество в штуках, цену мешка в сомони и закупку за 1 шт.
                    На склад добавляются только нужные поля: название, артикул, количество в шт, себестоимость за 1 шт и цена продажи.
                  </p>
                </div>
                <div className="grid grid-cols-12 gap-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <div className="col-span-4">Товар</div>
                  <div className="col-span-2 text-center">Кол-во</div>
                  <div className="col-span-2 text-right">Закупка</div>
                  <div className="col-span-2 text-right">За 1 шт</div>
                  <div className="col-span-2 text-right">Цена продажи</div>
                </div>
                {ocrResults.map((item, i) => (
                  <div key={i} className={clsx(
                    "grid grid-cols-12 gap-4 items-center p-4 rounded-2xl group transition-colors",
                    item.enabled === false ? "bg-slate-100 opacity-65" : "bg-sky-50 hover:bg-sky-100/50"
                  )}>
                    <div className="col-span-4">
                      <label className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-sky-500">
                        <input
                          type="checkbox"
                          checked={item.enabled !== false}
                          onChange={(e) => {
                            const newResults = [...ocrResults];
                            newResults[i].enabled = e.target.checked;
                            setOcrResults(newResults);
                          }}
                          className="h-4 w-4 rounded border-sky-300 text-sky-600 focus:ring-sky-500"
                        />
                        Добавить строку #{item.lineIndex || i + 1}
                      </label>
                      <p className="font-bold text-slate-900 break-words whitespace-normal">{formatProductName(item.name || item.rawName)}</p>
                      {item.rawQuantity && (
                        <p className="mt-1 text-[10px] font-bold text-slate-400">Из накладной: {item.rawQuantity}</p>
                      )}
                      {item.lineTotal > 0 && (
                        <p className="mt-1 text-[10px] font-bold text-slate-400">
                          Сумма строки: {item.lineTotal} $ / ≈ {formatMoney(item.lineTotal * parseFloat(usdRate || '0'))}
                        </p>
                      )}
                      {item.note && <p className="mt-1 text-[10px] text-slate-500">{item.note}</p>}
                    </div>
                    <div className="col-span-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={item.packageCount || ''}
                          onChange={(e) => {
                            const newResults = [...ocrResults];
                            newResults[i].packageCount = Number(e.target.value || 0);
                            setOcrResults(newResults);
                          }}
                          className="w-16 rounded-lg border border-sky-200 bg-white px-2 py-1 text-center text-xs font-black text-sky-700 outline-none focus:border-sky-500"
                        />
                        <span className="text-xs font-black text-slate-400">x</span>
                        <input
                          type="number"
                          min="0"
                          value={item.unitsPerPackage || ''}
                          onChange={(e) => {
                            const newResults = [...ocrResults];
                            newResults[i].unitsPerPackage = Number(e.target.value || 0);
                            setOcrResults(newResults);
                          }}
                          className="w-16 rounded-lg border border-sky-200 bg-white px-2 py-1 text-center text-xs font-black text-sky-700 outline-none focus:border-sky-500"
                        />
                      </div>
                      <p className="text-[10px] font-bold text-slate-500">
                        = {item.packageCount > 0 && item.unitsPerPackage > 0 ? item.packageCount * item.unitsPerPackage : item.quantity} шт
                      </p>
                      <p className="text-[10px] font-bold text-slate-400">итог для склада</p>
                    </div>
                    <div className="col-span-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price || ''}
                        onChange={(e) => {
                          const newResults = [...ocrResults];
                          newResults[i].price = Number(e.target.value || 0);
                          setOcrResults(newResults);
                        }}
                        className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-right text-sm font-black text-slate-900 outline-none focus:border-sky-500"
                      />
                      <p className="text-[10px] font-bold text-slate-400">≈ {formatMoney(item.price * parseFloat(usdRate || '0'))} / мешок</p>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="font-black text-slate-900">
                        {formatMoney(
                          item.unitsPerPackage > 0
                            ? (item.price * parseFloat(usdRate || '0')) / item.unitsPerPackage
                            : item.quantity > 0
                              ? (item.price * parseFloat(usdRate || '0')) / item.quantity
                              : 0
                        )}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400">за 1 шт</p>
                    </div>
                    <div className="col-span-2 text-right">
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

      <React.Suspense fallback={null}>
        <ProductHistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          productName={selectedProduct?.name}
          productHistory={productHistory}
        />
        <ProductBatchesModal
          isOpen={showBatchesModal}
          onClose={() => setShowBatchesModal(false)}
          selectedProduct={selectedProduct}
          productBatches={productBatches}
        />
      </React.Suspense>

      <AnimatePresence>
        {showMergeModal && selectedProduct && (
          <motion.div
            onClick={() => setShowMergeModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-fuchsia-50/50 p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-fuchsia-600 p-3 text-white">
                    <GitMerge size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Объединить дубликаты</h3>
                    <p className="text-sm text-slate-500">Выберите основной товар, в который нужно перенести остатки и историю.</p>
                  </div>
                </div>
                <button onClick={() => setShowMergeModal(false)} className="text-slate-400 transition-colors hover:text-slate-600">
                  <X size={22} />
                </button>
              </div>

              <div className="space-y-5 p-6">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Объединяемый товар</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{formatProductName(selectedProduct.name)}</p>
                  <p className="mt-1 text-sm text-slate-500">Остаток: {selectedProduct.stock} {selectedProduct.unit}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Основной товар</label>
                  <select
                    value={mergeTargetId}
                    onChange={(e) => setMergeTargetId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-fuchsia-300 focus:bg-white"
                  >
                    {getMergeCandidates(selectedProduct).map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {formatProductName(candidate.name)} • {candidate.stock} {candidate.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-sm text-slate-500">
                  Партии, остатки, история движения, цены и позиции продаж будут перенесены в выбранный основной товар.
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 p-6">
                <button
                  onClick={() => setShowMergeModal(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50"
                >
                  Отмена
                </button>
                <button
                  onClick={handleMergeProduct}
                  className="rounded-2xl bg-fuchsia-600 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-fuchsia-700"
                >
                  Объединить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <React.Suspense fallback={null}>
        <ConfirmationModal 
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteProduct}
          title="Удалить товар?"
          message={`Вы уверены, что хотите удалить товар "${formatProductName(selectedProduct?.name)}"? Это действие нельзя отменить.`}
        />
      </React.Suspense>

      <div className="overflow-hidden rounded-[28px] border border-white bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-white p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 md:flex-row flex-1 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-500" size={16} />
              <input 
                type="text" 
                placeholder="Поиск по названию..."
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

        <div className="space-y-3 p-3 md:hidden">
          {filteredProducts.map((product, index) => (
            <div key={`mobile-${product.id ?? product.name}-${index}`} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                  {product.photoUrl ? (
                    <img
                      src={resolveMediaUrl(product.photoUrl, product.id)}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(event) => handleBrokenImage(event, product.id)}
                    />
                  ) : (
                    <ImageIcon className="text-slate-300" size={18} />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words text-[15px] leading-5 text-slate-900">{formatProductName(product.name)}</p>
                    <span className="shrink-0 rounded-xl bg-slate-100 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      #{index + 1}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-xl bg-violet-50 px-2.5 py-1 text-[11px] text-violet-700">
                      {product.category?.name || 'Без категории'}
                    </span>
                    {getDuplicateHintCount(product) > 0 && (
                      <button
                        onClick={() => handleOpenMergeModal(product)}
                        className="rounded-xl bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700"
                      >
                        Дубликат
                      </button>
                    )}
                    <span className="rounded-xl bg-slate-50 px-2.5 py-1 text-[11px] text-slate-500">
                      {selectedWarehouseId ? product.warehouse?.name || 'Склад' : 'Все склады'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Остаток</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                    {product.stock} <span className="text-[10px] uppercase text-slate-400">{product.unit}</span>
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Приход</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                    {product.totalIncoming} <span className="text-[10px] uppercase text-slate-400">{product.unit}</span>
                  </p>
                </div>
                {isAdmin && (
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Закупка</p>
                    <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                      {isAggregateMode ? '-' : `${toFixedNumber(product.costPrice)} TJS`}
                    </p>
                  </div>
                )}
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Продажа</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                    {isAggregateMode ? '-' : `${toFixedNumber(product.sellingPrice)} TJS`}
                  </p>
                </div>
              </div>

              {isAdmin && !isAggregateMode && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setSelectedProduct(product);
                      setFormData({
                        name: product.name || '',
                        unit: product.unit || '',
                        categoryId: product.categoryId?.toString() || '',
                        warehouseId: product.warehouseId?.toString() || '',
                        costPrice: formatPriceInput(product.purchaseCostPrice ?? product.costPrice),
                        expensePercent: String(product.expensePercent ?? 0),
                        sellingPrice: formatPriceInput(product.sellingPrice),
                        minStock: product.minStock?.toString() || '0',
                        initialStock: product.initialStock?.toString() || '0',
                        photoUrl: product.photoUrl || ''
                      });
                      setShowEditModal(true);
                    }}
                    className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-3 text-xs font-semibold text-violet-700"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProduct(product);
                      setRestockData({
                        ...restockData,
                        warehouseId: product.warehouseId?.toString() || '',
                        costPrice: formatPriceInput(product.purchaseCostPrice ?? product.costPrice),
                        expensePercent: String(product.expensePercent ?? 0),
                      });
                      setShowRestockModal(true);
                    }}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs font-semibold text-emerald-700"
                  >
                    Приход
                  </button>
                  <button
                    onClick={() => handleShowHistory(product)}
                    className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3 text-xs font-semibold text-sky-700"
                  >
                    История
                  </button>
                  <button
                    onClick={() => handleShowBatches(product)}
                    className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-3 text-xs font-semibold text-violet-700"
                  >
                    Партии
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProduct(product);
                      setTransferData({ ...transferData, fromWarehouseId: product.warehouseId?.toString() || '' });
                      setShowTransferModal(true);
                    }}
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-semibold text-amber-700"
                  >
                    Перенос
                  </button>
                  <button
                    onClick={() => {
                      if (Number(product.stock || 0) > 0) {
                        toast.error('Нельзя удалить товар, пока на складе есть запас');
                        return;
                      }
                      setSelectedProduct(product);
                      setShowDeleteConfirm(true);
                    }}
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs font-semibold text-rose-700"
                  >
                    Удалить
                  </button>
                </div>
              )}
            </div>
          ))}
          {filteredProducts.length === 0 && !isLoading && (
            <div className="rounded-[22px] border border-slate-200 bg-white px-5 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f4f5fb] text-slate-300">
                <Package size={28} />
              </div>
              <p className="mt-4 text-lg font-black text-slate-900">Товары не найдены</p>
              <p className="mt-1 text-sm text-slate-500">Измените поиск или выберите другой склад.</p>
            </div>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
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
                {isAdmin && <th className="px-5 py-3 text-right">Действия</th>}
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
                          <img
                            src={resolveMediaUrl(product.photoUrl, product.id)}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(event) => handleBrokenImage(event, product.id)}
                          />
                        ) : (
                          <ImageIcon className="text-slate-300" size={16} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-tight text-slate-900">{formatProductName(product.name)}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-xs font-medium text-slate-400">
                          {product.category?.name || 'Без категории'}
                          </p>
                          {getDuplicateHintCount(product) > 0 && (
                            <button
                              onClick={() => handleOpenMergeModal(product)}
                              className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700"
                            >
                              Дубликат
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3">
                      {selectedWarehouseId ? (
                        <p className="text-xs font-medium text-slate-500">{toFixedNumber(product.costPrice)} <span className="text-[10px] uppercase">TJS</span></p>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>
                  )}
                  <td className="px-5 py-3">
                    {selectedWarehouseId ? (
                      <p className="text-sm font-semibold text-slate-900">{toFixedNumber(product.sellingPrice)} <span className="text-[10px] font-medium uppercase text-slate-400">TJS</span></p>
                    ) : (
                      <span className="text-xs text-slate-300">-</span>
                    )}
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
                  {isAdmin && <td className="px-5 py-3 text-right">
                    {selectedWarehouseId ? (
                    <div className="flex flex-col items-end space-y-1.5">
                      <div className="flex items-center space-x-1.5">
                        {isAdmin && (
                          <button 
                            onClick={() => {
                              setSelectedProduct(product);
                              setFormData({
                                name: product.name || '',
                                unit: product.unit || '',
                                categoryId: product.categoryId?.toString() || '',
                                warehouseId: product.warehouseId?.toString() || '',
                                costPrice: formatPriceInput(product.purchaseCostPrice ?? product.costPrice),
                                expensePercent: String(product.expensePercent ?? 0),
                                sellingPrice: formatPriceInput(product.sellingPrice),
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
                        )}
                        {isAdmin && (
                          <button 
                            onClick={() => {
                              setSelectedProduct(product);
                              setRestockData({
                                ...restockData,
                                warehouseId: product.warehouseId?.toString() || '',
                                costPrice: formatPriceInput(product.purchaseCostPrice ?? product.costPrice),
                                expensePercent: String(product.expensePercent ?? 0),
                              });
                              setShowRestockModal(true);
                            }}
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600" 
                            title="Пополнить"
                          >
                            <PlusCircle size={14} />
                          </button>
                        )}
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
                        {isAdmin && (
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
                        )}
                        {isAdmin && (
                          <button 
                            onClick={() => {
                              if (Number(product.stock || 0) > 0) {
                                toast.error('Нельзя удалить товар, пока на складе есть запас');
                                return;
                              }
                              setSelectedProduct(product);
                              setShowDeleteConfirm(true);
                            }}
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" 
                            title="Удалить"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    ) : (
                      <span className="text-xs text-slate-300">-</span>
                    )}
                  </td>}
                </tr>
              ))}
              {filteredProducts.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 5} className="px-5 py-20 text-center">
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


