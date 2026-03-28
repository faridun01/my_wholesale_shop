import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { getProducts, createProduct, updateProduct, deleteProduct, restockProduct, getProductHistory, mergeProduct, reverseIncomingTransaction, deleteProductBatch } from '../api/products.api';
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
import { formatDollar, formatMoney, roundMoney, toFixedNumber } from '../utils/format';
import {
  calculateEffectiveCost,
  calculateLineTotal,
  calculateUnitCostFromLineTotal,
  calculateUnitCostFromPackage,
} from '../utils/money';
import { getProductBatches } from '../api/products.api';
import { getWarehouses } from '../api/warehouses.api';
import { getSettingsCategories } from '../api/settings-reference.api';
import { filterWarehousesForUser, getCurrentUser, getUserWarehouseId, isAdminUser } from '../utils/userAccess';
import { handleBrokenImage, resolveMediaUrl } from '../utils/media';
import { formatProductName } from '../utils/productName';
import { getDefaultWarehouseId } from '../utils/warehouse';
import ConfirmationModal from '../components/common/ConfirmationModal';

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

const normalizeDisplayBaseUnit = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'шт';
  if (['пачка', 'пачки', 'пачек', 'шт', 'штук', 'штука', 'штуки', 'pcs', 'piece', 'pieces'].includes(normalized)) {
    return 'шт';
  }
  return normalized;
};

const formatPriceInput = (value: unknown) => {
  if (value === '' || value === null || value === undefined) {
    return '';
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? toFixedNumber(numeric) : '';
};

type PackagingOption = {
  id: number;
  packageName: string;
  baseUnitName: string;
  unitsPerPackage: number;
  isDefault?: boolean;
};

const normalizePackagings = (product: any): PackagingOption[] =>
  Array.isArray(product?.packagings)
    ? product.packagings
        .map((entry: any) => ({
          id: Number(entry.id),
          packageName: String(entry.packageName || '').trim(),
          baseUnitName: String(entry.baseUnitName || product?.unit || 'шт').trim() || 'шт',
          unitsPerPackage: Number(entry.unitsPerPackage || 0),
          isDefault: Boolean(entry.isDefault),
        }))
        .filter((entry: PackagingOption) => entry.id > 0 && entry.packageName && entry.unitsPerPackage > 0)
    : [];

const getDefaultPackaging = (packagings: PackagingOption[]) =>
  packagings.find((entry) => entry.isDefault) || packagings[0] || null;

const getPreferredPackaging = (product: any) => {
  const packagings = Array.isArray(product?.packagings) ? product.packagings : [];
  return (
    packagings.find((packaging: any) => packaging?.isDefault && Number(packaging?.unitsPerPackage || 0) > 1) ||
    packagings.find((packaging: any) => Number(packaging?.unitsPerPackage || 0) > 1) ||
    null
  );
};

const pluralizeRu = (count: number, forms: [string, string, string]) => {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;

  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
};

const formatCountWithUnit = (count: number, unit: string) => {
  const normalized = String(unit || '').trim().toLowerCase();
  const formsMap: Record<string, [string, string, string]> = {
    'шт': ['шт', 'шт', 'шт'],
    'штука': ['штука', 'штуки', 'штук'],
    'пачка': ['пачка', 'пачки', 'пачек'],
    'мешок': ['мешок', 'мешка', 'мешков'],
    'коробка': ['коробка', 'коробки', 'коробок'],
    'упаковка': ['упаковка', 'упаковки', 'упаковок'],
    'флакон': ['флакон', 'флакона', 'флаконов'],
    'ёмкость': ['ёмкость', 'ёмкости', 'ёмкостей'],
    'емкость': ['ёмкость', 'ёмкости', 'ёмкостей'],
    'бутылка': ['бутылка', 'бутылки', 'бутылок'],
  };

  const forms = formsMap[normalized] || [unit, unit, unit];
  return `${count} ${pluralizeRu(count, forms)}`;
};

const getStockBreakdown = (product: any) => {
  const totalUnits = Number(product?.stock || 0);
  const preferredPackaging = getPreferredPackaging(product);
  const unitsPerPackage = Number(preferredPackaging?.unitsPerPackage || 0);
  const packageName = preferredPackaging?.packageName || preferredPackaging?.name || '';
  const displayBaseUnit = normalizeDisplayBaseUnit(product?.unit || 'шт');

  if (!preferredPackaging || unitsPerPackage <= 1 || totalUnits <= 0) {
    return {
      primary: formatCountWithUnit(totalUnits, displayBaseUnit),
      secondary: null,
    };
  }

  const packageCount = Math.floor(totalUnits / unitsPerPackage);
  const remainderUnits = totalUnits % unitsPerPackage;
  const piecesLabel = displayBaseUnit;
  const normalizedPackageName = normalizeOcrPackageName(packageName || 'упаковка');

  return {
    primary:
      remainderUnits > 0
        ? `${formatCountWithUnit(packageCount, normalizedPackageName)}\n${formatCountWithUnit(remainderUnits, piecesLabel)}`
        : formatCountWithUnit(packageCount, normalizedPackageName),
    secondary: `${formatCountWithUnit(totalUnits, piecesLabel)} всего`,
  };
};

const getOcrResolvedQuantity = (item: any) => {
  const packageCount = Number(item?.packageCount || 0);
  const unitsPerPackage = Number(item?.unitsPerPackage || 0);
  const fallbackQuantity = Number(item?.quantity || 0);

  if (packageCount > 0 && unitsPerPackage > 0) {
    return packageCount * unitsPerPackage;
  }

  return fallbackQuantity;
};

const getOcrValidationReason = (item: any, rateValue: unknown, expensePercentValue: unknown) => {
  const rate = Number(rateValue || 0);
  const expensePercent = Math.max(0, Number(expensePercentValue || 0));
  const normalizedName = normalizeOcrProductName(item?.name || '');
  const quantity = getOcrResolvedQuantity(item);
  const price = Number(item?.price || 0);
  const lineTotal = Number(item?.lineTotal || 0);
  const unitsPerPackage = Number(item?.unitsPerPackage || 0);

  if (!normalizedName) {
    return 'Укажите или исправьте название товара';
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 'Проверьте количество';
  }

  if (!Number.isFinite(price) || price < 0) {
    return 'Проверьте цену закупки';
  }

  const baseCostPerPiece =
    lineTotal > 0 && quantity > 0
      ? calculateUnitCostFromLineTotal(lineTotal * rate, quantity)
      : unitsPerPackage > 0
        ? calculateUnitCostFromPackage(price * rate, unitsPerPackage)
        : calculateUnitCostFromLineTotal(price * rate, quantity);

  if (!Number.isFinite(baseCostPerPiece) || baseCostPerPiece < 0) {
    return 'Не удалось посчитать закупку за 1 шт';
  }

  const effectiveCostPerPiece = calculateEffectiveCost(baseCostPerPiece, expensePercent);

  if (!Number.isFinite(effectiveCostPerPiece) || effectiveCostPerPiece < 0) {
    return 'Не удалось посчитать итоговую закупку';
  }

  return null;
};

const getOcrProblemReason = (item: any, rateValue: unknown, expensePercentValue: unknown) => {
  const serverError = String(item?.serverError || '').trim();
  if (serverError) {
    return serverError;
  }

  return getOcrValidationReason(item, rateValue, expensePercentValue);
};

export default function ProductsView() {
  const ProductHistoryModal = React.lazy(() => import('../components/products/ProductHistoryModal'));
  const ProductBatchesModal = React.lazy(() => import('../components/products/ProductBatchesModal'));
  const hasLoadedReferenceDataRef = React.useRef(false);
  const user = React.useMemo(() => getCurrentUser(), []);
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
  const [isMergingDuplicates, setIsMergingDuplicates] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(userWarehouseId ? String(userWarehouseId) : '');
  const [transferData, setTransferData] = useState({
    fromWarehouseId: '',
    toWarehouseId: '',
    quantity: '',
    selectedPackagingId: '',
    packageQuantityInput: '',
  });
  const [restockData, setRestockData] = useState({
    warehouseId: '',
    quantity: '',
    selectedPackagingId: '',
    packageQuantityInput: '',
    costPrice: '',
    sellingPrice: '',
    reason: '',
  });
  const [ocrResults, setOcrResults] = useState<any[] | null>(null);
  const [ocrOriginalCount, setOcrOriginalCount] = useState(0);
  const [ocrImportedCount, setOcrImportedCount] = useState(0);
  const [usdRate, setUsdRate] = useState<string>('10.95'); // Default rate
  const [scanExpensePercent, setScanExpensePercent] = useState<string>('0');
  const [showOnlyProblematicOcrRows, setShowOnlyProblematicOcrRows] = useState(false);
  const [highlightedOcrLine, setHighlightedOcrLine] = useState<number | null>(null);
  const [isCategoryManual, setIsCategoryManual] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'name', direction: 'asc' });
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const ocrRowRefs = React.useRef<Record<number, HTMLDivElement | null>>({});
  const emptyTransferData = {
    fromWarehouseId: '',
    toWarehouseId: '',
    quantity: '',
    selectedPackagingId: '',
    packageQuantityInput: '',
  };
  const emptyRestockData = {
    warehouseId: '',
    quantity: '',
    selectedPackagingId: '',
    packageQuantityInput: '',
    costPrice: '',
    sellingPrice: '',
    reason: '',
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setProductHistory([]);
    setSelectedProduct(null);
  };

  const closeBatchesModal = () => {
    setShowBatchesModal(false);
    setProductBatches([]);
    setSelectedProduct(null);
  };

  const closeDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    setSelectedProduct(null);
  };

  const closeProductFormModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    resetForm();
  };

  const closeTransferModal = () => {
    setShowTransferModal(false);
    setTransferData(emptyTransferData);
    setSelectedProduct(null);
  };

  const closeRestockModal = () => {
    setShowRestockModal(false);
    setRestockData(emptyRestockData);
    setSelectedProduct(null);
  };

  const closeMergeModal = () => {
    setShowMergeModal(false);
    setMergeTargetId('');
    setSelectedProduct(null);
  };

  const closeOcrResultsModal = () => {
    setOcrResults(null);
    setOcrOriginalCount(0);
    setOcrImportedCount(0);
    setShowOnlyProblematicOcrRows(false);
    setHighlightedOcrLine(null);
  };

  const availableTransferStock = selectedProduct && transferData.fromWarehouseId
    ? String(selectedProduct.warehouseId || '') === transferData.fromWarehouseId || selectedWarehouseId === transferData.fromWarehouseId
      ? Number(selectedProduct.stock || 0)
      : null
    : selectedProduct
      ? Number(selectedProduct.stock || 0)
      : null;
  const transferPackagings = normalizePackagings(selectedProduct);
  const selectedTransferPackaging =
    transferPackagings.find((entry) => String(entry.id) === String(transferData.selectedPackagingId || '')) ||
    getDefaultPackaging(transferPackagings);
  const transferPackageQuantity = Math.max(0, Math.floor(Number(transferData.packageQuantityInput || 0) || 0));
  const transferUnitsPerPackage = Number(selectedTransferPackaging?.unitsPerPackage || 0);
  const transferAvailableFullPackages =
    selectedTransferPackaging && transferUnitsPerPackage > 0 && Number.isFinite(Number(availableTransferStock))
      ? Math.floor(Number(availableTransferStock || 0) / transferUnitsPerPackage)
      : 0;
  const transferRemainderUnits =
    selectedTransferPackaging && transferUnitsPerPackage > 0 && Number.isFinite(Number(availableTransferStock))
      ? Number(availableTransferStock || 0) % transferUnitsPerPackage
      : 0;
  const totalTransferUnits =
    selectedTransferPackaging && transferUnitsPerPackage > 0
      ? transferPackageQuantity * transferUnitsPerPackage
      : Number(transferData.quantity || 0);

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
  const numericSortKeys = new Set(['costPrice', 'sellingPrice', 'stock', 'totalIncoming', 'minStock', 'initialStock']);
  const effectiveFormCostPrice = (() => {
    return calculateEffectiveCost(formData.costPrice, formData.expensePercent);
  })();
  const restockPackagings = normalizePackagings(selectedProduct);
  const selectedRestockPackaging =
    restockPackagings.find((entry) => String(entry.id) === String(restockData.selectedPackagingId || '')) || null;
  const restockPackageQuantity = Math.max(0, Math.floor(Number(restockData.packageQuantityInput || 0) || 0));
  const totalRestockUnits =
    selectedRestockPackaging && selectedRestockPackaging.unitsPerPackage > 0
      ? restockPackageQuantity * selectedRestockPackaging.unitsPerPackage
      : Number(restockData.quantity || 0);
  const invalidOcrRowsCount = Array.isArray(ocrResults)
    ? ocrResults.filter((item) => item.enabled !== false && getOcrProblemReason(item, usdRate, scanExpensePercent)).length
    : 0;
  const visibleOcrResults = Array.isArray(ocrResults)
    ? ocrResults.filter((item) =>
        showOnlyProblematicOcrRows
          ? item.enabled !== false && Boolean(getOcrProblemReason(item, usdRate, scanExpensePercent))
          : true
      )
    : [];
  const problematicOcrRows = Array.isArray(ocrResults)
    ? ocrResults
        .filter((item) => item.enabled !== false)
        .map((item) => ({
          lineIndex: Number(item.lineIndex || 0),
          reason: getOcrProblemReason(item, usdRate, scanExpensePercent),
        }))
        .filter((item): item is { lineIndex: number; reason: string } => Boolean(item.reason))
        .sort((a, b) => a.lineIndex - b.lineIndex)
    : [];

  const jumpToOcrLine = (lineIndex: number) => {
    setShowOnlyProblematicOcrRows(true);
    setHighlightedOcrLine(lineIndex);

    window.setTimeout(() => {
      const target = ocrRowRefs.current[lineIndex];
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);

    window.setTimeout(() => {
      setHighlightedOcrLine((current) => (current === lineIndex ? null : current));
    }, 2200);
  };

  useEffect(() => {
    fetchInitialData();
  }, [selectedWarehouseId]);

  useEffect(() => {
    if (!showAddModal || showEditModal || isCategoryManual) {
      return;
    }

    const suggestedCategoryName = detectCategoryName(formData.name);
    const suggestedCategory = categories.find(
      (category) => String(category.name || '').trim().toLowerCase() === suggestedCategoryName.trim().toLowerCase()
    );

    setFormData((prev) => {
      const nextCategoryId = suggestedCategory?.id ? String(suggestedCategory.id) : '';
      if (prev.categoryId === nextCategoryId) {
        return prev;
      }

      return {
        ...prev,
        categoryId: nextCategoryId,
      };
    });
  }, [categories, formData.name, isCategoryManual, showAddModal, showEditModal]);

  useEffect(() => {
    const hasOpenModal =
      showAddModal ||
      showEditModal ||
      showTransferModal ||
      showRestockModal ||
      showMergeModal ||
      showDeleteConfirm ||
      showHistoryModal ||
      showBatchesModal ||
      Boolean(ocrResults);

    if (!hasOpenModal) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (showDeleteConfirm) return closeDeleteConfirm();
      if (showHistoryModal) return closeHistoryModal();
      if (showBatchesModal) return closeBatchesModal();
      if (showMergeModal) return closeMergeModal();
      if (showTransferModal) return closeTransferModal();
      if (showRestockModal) return closeRestockModal();
      if (showAddModal || showEditModal) return closeProductFormModal();
      if (ocrResults) return closeOcrResultsModal();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    ocrResults,
    showAddModal,
    showBatchesModal,
    showDeleteConfirm,
    showEditModal,
    showHistoryModal,
    showMergeModal,
    showRestockModal,
    showTransferModal,
  ]);

  const fetchInitialData = async (warehouseIdOverride?: string) => {
    setIsLoading(true);
    try {
      const effectiveWarehouseId = warehouseIdOverride !== undefined ? warehouseIdOverride : selectedWarehouseId;
      const productsData = await getProducts(effectiveWarehouseId ? Number(effectiveWarehouseId) : undefined);
      setProducts(Array.isArray(productsData) ? productsData : []);
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
      const targetWarehouseId = Number(transferData.toWarehouseId);
      const response = await client.post(`/products/${selectedProduct.id}/transfer`, {
        fromWarehouseId: Number(transferData.fromWarehouseId),
        toWarehouseId: targetWarehouseId,
        quantity: totalTransferUnits
      });

      closeTransferModal();

      if (targetWarehouseId) {
        setSelectedWarehouseId(String(targetWarehouseId));
      }

      await fetchInitialData(targetWarehouseId ? String(targetWarehouseId) : undefined);

      const destinationProductName = response?.data?.destinationProduct?.name;
      toast.success(
        destinationProductName
          ? `Товар перенесён: ${formatProductName(destinationProductName)}`
          : 'Товар успешно перенесён!'
      );
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при переносе товара');
    }
  };

  useEffect(() => {
    if (hasLoadedReferenceDataRef.current) {
      return;
    }

    hasLoadedReferenceDataRef.current = true;

    Promise.all([
      getWarehouses(),
      getSettingsCategories(),
    ])
      .then(([warehousesData, categoriesData]) => {
        const filteredWarehouses = filterWarehousesForUser(Array.isArray(warehousesData) ? warehousesData : [], user);
        setWarehouses(filteredWarehouses);
        const defaultWarehouseId = getDefaultWarehouseId(filteredWarehouses);
        if (isAdmin && defaultWarehouseId) {
          setSelectedWarehouseId((currentValue) => currentValue || String(defaultWarehouseId));
        } else if (!isAdmin && filteredWarehouses[0]) {
          setSelectedWarehouseId(String(filteredWarehouses[0].id));
        }
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      })
      .catch((error) => {
        hasLoadedReferenceDataRef.current = false;
        console.error(error);
        toast.error('Ошибка при загрузке данных');
      });
  }, [isAdmin, user]);

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      await restockProduct(selectedProduct.id, {
        warehouseId: Number(restockData.warehouseId),
        quantity: selectedRestockPackaging ? totalRestockUnits : Number(restockData.quantity),
        costPrice: roundMoney(restockData.costPrice),
        purchaseCostPrice: roundMoney(restockData.costPrice),
        sellingPrice: roundMoney(restockData.sellingPrice || 0),
        expensePercent: 0,
        reason: restockData.reason
      });
      toast.success('Товар успешно пополнен!');
      closeRestockModal();
      fetchInitialData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при пополнении товара');
    }
  };

  const handleShowHistory = async (product: any) => {
    setShowBatchesModal(false);
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
    setShowHistoryModal(false);
    setSelectedProduct(product);
    try {
      const batches = await getProductBatches(product.id);
      setProductBatches(batches);
      setShowBatchesModal(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при загрузке партий');
    }
  };

  const refreshSelectedProductBatches = async () => {
    if (!selectedProduct?.id) {
      return;
    }

    const batches = await getProductBatches(selectedProduct.id);
    setProductBatches(batches);
  };

  const handleDeleteBatch = async (batchId: number) => {
    const confirmed = window.confirm('Удалить эту партию? Это действие нельзя отменить.');
    if (!confirmed) {
      return;
    }

    setProductBatches((prev) => prev.filter((batch) => batch.id !== batchId));

    try {
      await deleteProductBatch(batchId);
      await Promise.allSettled([refreshSelectedProductBatches(), fetchInitialData()]);
      toast.success('Партия удалена');
    } catch (err: any) {
      await Promise.allSettled([refreshSelectedProductBatches(), fetchInitialData()]);
      toast.error(err.response?.data?.error || 'Ошибка при удалении партии');
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
        timeout: 300000,
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
          expensePercent: Number(item.expensePercent || 0),
        }))
        .filter((item: any) => item.rawName || item.name)
        .sort((a: any, b: any) => a.lineIndex - b.lineIndex);
      if (!items.length) {
        toast.error('Сканирование завершено, но товары не были распознаны');
        setOcrOriginalCount(0);
        setOcrImportedCount(0);
        setOcrResults([]);
        return;
      }
      setOcrOriginalCount(items.length);
      setOcrImportedCount(0);
      setScanExpensePercent('0');
      setShowOnlyProblematicOcrRows(false);
      setHighlightedOcrLine(null);
      setOcrResults(items);
      toast.success('Накладная успешно отсканирована!');
    } catch (err: any) {
      const isTimeout =
        err?.code === 'ECONNABORTED'
        || String(err?.message || '').toLowerCase().includes('timeout');

      toast.error(
        isTimeout
          ? 'Сканирование заняло слишком много времени. Подождите ещё немного, повторите попытку или используйте файл поменьше.'
          : err.response?.data?.error || err.message || 'Ошибка при сканировании накладной'
      );
    } finally {
      setIsScanning(false);
      e.target.value = '';
    }
  };

  const handleAddOcrToStock = async () => {
    if (!ocrResults || !selectedWarehouseId) return;
    const rate = parseFloat(usdRate) || 1;
    const sharedExpensePercent = Math.max(0, Number(scanExpensePercent || 0));
    try {
      setIsLoading(true);
      const invalidRows: Array<{ lineIndex: number; reason: string }> = [];
      const enabledRowsCount = ocrResults.filter((item) => item.enabled !== false).length;

      const preparedResults = ocrResults
        .map((item) => {
          if (item.enabled === false) {
            return null;
          }

          const lineIndex = Number(item.lineIndex || 0);
          const validationReason = getOcrProblemReason(item, rate, sharedExpensePercent);
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
          const expensePercent = sharedExpensePercent;
          const costPricePerPieceTJS =
            lineTotal > 0 && quantity > 0
              ? calculateUnitCostFromLineTotal(lineTotal * rate, quantity)
              : unitsPerPackage > 0
                ? calculateUnitCostFromPackage(price * rate, unitsPerPackage)
              : calculateUnitCostFromLineTotal(price * rate, quantity);
          const effectiveCostPricePerPieceTJS = calculateEffectiveCost(costPricePerPieceTJS, expensePercent);

          if (validationReason) {
            invalidRows.push({
              lineIndex,
              reason: validationReason,
            });
            return null;
          }

          return {
            lineIndex,
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
            expensePercent,
            costPricePerPieceTJS,
            effectiveCostPricePerPieceTJS,
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
          expensePercent: number;
          costPricePerPieceTJS: number;
          effectiveCostPricePerPieceTJS: number;
          sellingPrice: number;
          rawQuantity: string;
          note: string;
        }>;

      const importRows = [...preparedResults].sort((a, b) => a.lineIndex - b.lineIndex);

      if (invalidRows.length > 0) {
        const invalidRowsText = invalidRows
          .sort((a, b) => a.lineIndex - b.lineIndex)
          .slice(0, 6)
          .map((row) => `#${row.lineIndex}: ${row.reason}`)
          .join(', ');

        setShowOnlyProblematicOcrRows(true);
        if (invalidRows[0]?.lineIndex) {
          jumpToOcrLine(invalidRows[0].lineIndex);
        }
        toast.error(
          `Не все товары готовы к добавлению. Проверьте ${invalidRows.length} строк: ${invalidRowsText}${invalidRows.length > 6 ? '...' : ''}`
        );
        return;
      }

      if (!importRows.length) {
        toast.error('После сканирования не осталось корректных товаров для добавления');
        return;
      }

      const response = await client.post(
        '/ocr/import-items',
        {
          warehouseId: Number(selectedWarehouseId),
          items: importRows.map((item) => ({
            lineIndex: item.lineIndex,
            name: item.name,
            rawName: item.name || item.rawName,
            brand: item.brand,
            packageName: item.packageName,
            baseUnitName: item.baseUnitName,
            unitsPerPackage: item.unitsPerPackage,
            quantity: Number(item.quantity),
            purchaseCostPrice: roundMoney(item.costPricePerPieceTJS),
            effectiveCostPricePerPieceTJS: roundMoney(item.effectiveCostPricePerPieceTJS),
            expensePercent: Number(item.expensePercent || 0),
            sellingPrice: roundMoney(item.sellingPrice || 0),
          })),
        },
        { timeout: 300000 }
      );

      const importedCount = Number(response.data?.importedCount || 0);

      const importedLineIndexes = new Set(
        Array.isArray(response.data?.importedLineIndexes)
          ? response.data.importedLineIndexes.map((value: unknown) => Number(value)).filter((value: number) => value > 0)
          : importRows.slice(0, importedCount).map((item) => item.lineIndex)
      );
      const failedItems = Array.isArray(response.data?.failedItems) ? response.data.failedItems : [];
      const failedPairs = failedItems
        .map((entry: any): [number, string] => [Number(entry?.lineIndex || 0), String(entry?.reason || '').trim()])
        .filter((entry: [number, string]): entry is [number, string] => entry[0] > 0 && Boolean(entry[1]));
      const failedByLineIndex = new Map<number, string>(failedPairs);

      const remainingRows = ocrResults
        .filter((item) => {
          if (item.enabled === false) {
            return true;
          }

          return !importedLineIndexes.has(Number(item.lineIndex || 0));
        })
        .map((item) => ({
          ...item,
          serverError: failedByLineIndex.get(Number(item.lineIndex || 0)) || '',
        }));

      setOcrImportedCount((prev) => prev + importedCount);

      if (failedByLineIndex.size > 0) {
        setOcrResults(remainingRows);
        setShowOnlyProblematicOcrRows(true);
        const firstFailedLineIndex = Array.from(failedByLineIndex.keys()).sort((a, b) => a - b)[0];
        if (firstFailedLineIndex) {
          jumpToOcrLine(firstFailedLineIndex);
        }
        toast.error(
          `Добавлено ${ocrImportedCount + importedCount} из ${ocrOriginalCount}. Осталось проверить ${failedByLineIndex.size} строк.`
        );
      } else if (remainingRows.length > 0) {
        setOcrResults(remainingRows);
        setShowOnlyProblematicOcrRows(false);
        setHighlightedOcrLine(null);
        toast.success(`Добавлено ${ocrImportedCount + importedCount} из ${ocrOriginalCount}. Осталось ${remainingRows.length} строк.`);
      } else {
        toast.success(`Все товары успешно добавлены на склад: ${ocrImportedCount + importedCount} из ${ocrOriginalCount} строк`);
        closeOcrResultsModal();
      }
      await fetchInitialData();
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
        costPrice: roundMoney(formData.costPrice),
        purchaseCostPrice: roundMoney(formData.costPrice),
        expensePercent: parseFloat(formData.expensePercent || '0'),
        sellingPrice: roundMoney(formData.sellingPrice),
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
        costPrice: roundMoney(formData.costPrice),
        purchaseCostPrice: roundMoney(formData.costPrice),
        expensePercent: parseFloat(formData.expensePercent || '0'),
        sellingPrice: roundMoney(formData.sellingPrice),
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

  const handleDeleteProduct = async (productId: number) => {
    try {
      await deleteProduct(productId, { force: true });
      toast.success('Товар успешно удалён!');
      await fetchInitialData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при удалении товара');
      throw err;
    }
  };

  const handleConfirmDeleteProduct = () => {
    if (!selectedProduct?.id) {
      return Promise.resolve();
    }

    const productId = selectedProduct.id;
    closeDeleteConfirm();

    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        void handleDeleteProduct(productId).then(resolve).catch(reject);
      }, 0);
    });
  };

  const handleReverseIncoming = async (transactionId: number) => {
    if (!selectedProduct || !transactionId) return;

    const confirmed = window.confirm('Отменить этот приход? Количество будет снято со склада, а в истории появится корректирующая запись.');
    if (!confirmed) {
      return;
    }

    try {
      await reverseIncomingTransaction(transactionId);
      const history = await getProductHistory(selectedProduct.id);
      setProductHistory(history);
      await fetchInitialData();
      toast.success('Приход успешно отменён');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Не удалось отменить приход');
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

  const getRobustDuplicateKey = (product: any) => {
    const warehouseId = Number(product?.warehouseId || selectedWarehouseId || 0);
    const familyKey = normalizeProductFamilyName(String(product?.name || ''));
    const massKey = extractMassKey(String(product?.name || ''));
    const fallbackName = normalizeCatalogName(String(product?.name || ''));

    if (familyKey && massKey) {
      return `${warehouseId}::${familyKey}::${massKey}`;
    }

    return `${warehouseId}::${fallbackName}`;
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
    setIsCategoryManual(false);
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
    const aValue = numericSortKeys.has(sortConfig.key) ? Number(a[sortConfig.key] || 0) : a[sortConfig.key];
    const bValue = numericSortKeys.has(sortConfig.key) ? Number(b[sortConfig.key] || 0) : b[sortConfig.key];
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
          packagings: Array.isArray(product.packagings) ? product.packagings : [],
          isAggregateRow: true,
        };
      } else {
        acc[key].stock += Number(product.stock || 0);
        acc[key].totalIncoming += Number(product.totalIncoming || 0);
        if (!acc[key].photoUrl && product.photoUrl) {
          acc[key].photoUrl = product.photoUrl;
        }
        if ((!Array.isArray(acc[key].packagings) || acc[key].packagings.length === 0) && Array.isArray(product.packagings)) {
          acc[key].packagings = product.packagings;
        }
      }
      return acc;
    }, {} as Record<string, any>)
  );

  const sortedAggregatedProducts = [...aggregatedProducts].sort((a, b) => {
    if (!sortConfig.direction) return 0;
    const aValue = numericSortKeys.has(sortConfig.key) ? Number(a[sortConfig.key] || 0) : a[sortConfig.key];
    const bValue = numericSortKeys.has(sortConfig.key) ? Number(b[sortConfig.key] || 0) : b[sortConfig.key];
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

  const groupedProducts = React.useMemo(() => {
    const groups = new Map<string, any[]>();

    filteredProducts.forEach((product) => {
      const key = getRobustDuplicateKey(product);
      const current = groups.get(key) || [];
      current.push(product);
      groups.set(key, current);
    });

    return Array.from(groups.values())
      .map((group) =>
        [...group].sort(
          (a, b) =>
            Number(b.stock || 0) - Number(a.stock || 0) ||
            Number(b.totalIncoming || 0) - Number(a.totalIncoming || 0) ||
            Number(a.id || 0) - Number(b.id || 0),
        ),
      );
  }, [filteredProducts, selectedWarehouseId]);

  const displayProducts = React.useMemo(
    () =>
      groupedProducts.map((group) => {
        const [primary, ...rest] = group;
        if (!rest.length) {
          return primary;
        }

        return {
          ...primary,
          stock: group.reduce((sum, product) => sum + Number(product?.stock || 0), 0),
          totalIncoming: group.reduce((sum, product) => sum + Number(product?.totalIncoming || 0), 0),
          duplicateCount: group.length - 1,
          mergedProductIds: group.map((product) => Number(product.id)).filter((id) => Number.isFinite(id)),
        };
      }),
    [groupedProducts],
  );

  const duplicateGroups = React.useMemo(
    () => groupedProducts.filter((group) => group.length > 1),
    [groupedProducts],
  );

  const duplicateProductsCount = React.useMemo(
    () => duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0),
    [duplicateGroups],
  );

  const handleMergeExactDuplicates = async () => {
    if (!duplicateGroups.length || isMergingDuplicates) {
      return;
    }

    setIsMergingDuplicates(true);
    try {
      let mergedCount = 0;

      for (const group of duplicateGroups) {
        const [target, ...sources] = group;
        for (const source of sources) {
          await mergeProduct(Number(source.id), Number(target.id));
          mergedCount += 1;
        }
      }

      await fetchInitialData();
      toast.success(`Объединено дублей: ${mergedCount}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Не удалось объединить дубликаты');
    } finally {
      setIsMergingDuplicates(false);
    }
  };

  return (
    <div className="app-page-shell">
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
            <span>{isScanning ? 'Чтение накладной...' : 'Загрузить накладную'}</span>
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
                  Система сама распознаёт позиции, количество и закупку. Обычно лучше всего читается одна чёткая страница.
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
            onClick={closeProductFormModal}
              className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
                className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:rounded-2xl"
            >
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5">
                <h3 className="text-lg font-black text-slate-900 flex items-center space-x-3">
                  <div className="p-2 bg-violet-500 text-white rounded-xl">
                    <Package size={20} />
                  </div>
                  <span>{showEditModal ? 'Редактировать товар' : 'Новый товар'}</span>
                </h3>
                <button onClick={closeProductFormModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={20} />
                </button>
              </div>
                <form onSubmit={showEditModal ? handleEditProduct : handleAddProduct} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-700 mb-1 uppercase tracking-widest">Название товара</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.name}
                      onChange={e => {
                        setIsCategoryManual(false);
                        setFormData({...formData, name: e.target.value});
                      }}
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
                      onChange={e => {
                        setIsCategoryManual(Boolean(e.target.value));
                        setFormData({...formData, categoryId: e.target.value});
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all font-bold text-sm appearance-none bg-white"
                    >
                      <option value="">Выберите категорию</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <p className="mt-1 text-[11px] font-medium text-slate-400">
                      Категория подставляется автоматически по названию, при необходимости можно выбрать вручную.
                    </p>
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
                      {!showEditModal && (
                        <p className="mt-2 text-xs font-medium text-slate-400">
                          Введите себестоимость вручную.
                        </p>
                      )}
                    </div>
                  )}
                  {isAdmin && showEditModal && (
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
                <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end sm:space-x-2 sm:gap-0">
                  <button type="button" onClick={closeProductFormModal} className="px-6 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all text-sm">Отмена</button>
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
            onClick={closeTransferModal}
              className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2.5rem]"
            >
              <div className="border-b border-slate-100 bg-amber-50/50 p-4 sm:p-5">
                <h3 className="text-lg font-black text-slate-900 flex items-center space-x-3">
                  <div className="p-2 bg-amber-600 text-white rounded-xl">
                    <ArrowRightLeft size={20} />
                  </div>
                  <span>Перенос товара</span>
                </h3>
                <p className="text-slate-500 mt-1 font-bold text-sm">{selectedProduct?.name}</p>
              </div>
              <form onSubmit={handleTransfer} className="space-y-4 p-4 sm:p-5">
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
                      {selectedTransferPackaging && transferUnitsPerPackage > 0 ? (
                        <div className="space-y-3">
                          {availableTransferStock !== null && (
                            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                              <p className="text-xs font-bold text-amber-900">
                                Доступно: {formatCountWithUnit(transferAvailableFullPackages, selectedTransferPackaging.packageName)}
                              </p>
                              {transferRemainderUnits > 0 && (
                                <p className="mt-1 text-xs font-medium text-amber-700">
                                  Остаток: {formatCountWithUnit(transferRemainderUnits, normalizeDisplayBaseUnit(selectedProduct?.unit || 'шт'))}
                                </p>
                              )}
                              <p className="mt-1 text-[11px] font-medium text-amber-700">
                                По умолчанию: {formatCountWithUnit(1, selectedTransferPackaging.packageName)} = {transferUnitsPerPackage} {normalizeDisplayBaseUnit(selectedProduct?.unit || 'шт')}
                              </p>
                            </div>
                          )}
                          {transferAvailableFullPackages > 0 ? (
                            <>
                              <input
                                type="number"
                                required
                                min="1"
                                max={transferAvailableFullPackages || undefined}
                                placeholder={`Введите количество (${selectedTransferPackaging.packageName})`}
                                value={transferData.packageQuantityInput}
                                onChange={e =>
                                  setTransferData((prev) => ({
                                    ...prev,
                                    packageQuantityInput: e.target.value,
                                    quantity: String(
                                      Math.max(0, Math.floor(Number(e.target.value || 0) || 0)) * transferUnitsPerPackage
                                    ),
                                  }))
                                }
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-bold text-sm"
                              />
                              <p className="text-xs font-medium text-slate-500">
                                Перенос: {formatCountWithUnit(transferPackageQuantity, selectedTransferPackaging.packageName)}
                                {transferPackageQuantity > 0 && ` = ${totalTransferUnits} ${normalizeDisplayBaseUnit(selectedProduct?.unit || 'шт')}`}
                              </p>
                            </>
                          ) : (
                            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500">
                              Для оптового переноса нужна хотя бы одна полная {selectedTransferPackaging.packageName}.
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          {availableTransferStock !== null && (
                            <p className="mb-2 text-xs font-bold text-slate-500">
                              Доступно: {formatCountWithUnit(Number(availableTransferStock || 0), normalizeDisplayBaseUnit(selectedProduct?.unit || 'шт'))}
                            </p>
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
                        </>
                      )}
                    </div>
                </div>
                <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end sm:space-x-2 sm:gap-0">
                  <button type="button" onClick={closeTransferModal} className="px-6 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all text-sm">Отмена</button>
                    <button
                      type="submit"
                      disabled={
                        (selectedTransferPackaging && transferUnitsPerPackage > 0 && transferAvailableFullPackages <= 0) ||
                        totalTransferUnits <= 0
                      }
                      className="px-8 py-2 bg-amber-600 text-white rounded-xl font-bold shadow-xl shadow-amber-600/20 hover:bg-amber-700 transition-all active:scale-95 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Перенести
                    </button>
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
            onClick={closeRestockModal}
              className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[28rem] overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2rem]"
            >
              <div className="border-b border-slate-100 bg-emerald-50/50 p-4 sm:p-6">
                <h3 className="flex items-center space-x-3 text-xl font-black text-slate-900">
                  <div className="rounded-2xl bg-emerald-600 p-2.5 text-white">
                    <PlusCircle size={20} />
                  </div>
                  <span>Пополнение товара</span>
                </h3>
                <p className="mt-2 text-sm font-bold text-slate-500">{selectedProduct?.name}</p>
              </div>
              <form onSubmit={handleRestock} className="space-y-5 p-4 sm:p-6">
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
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {selectedRestockPackaging ? (
                      <>
                        <div>
                          <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-700">Упаковка</label>
                          <select
                            value={restockData.selectedPackagingId}
                            onChange={e =>
                              setRestockData((prev) => ({
                                ...prev,
                                selectedPackagingId: e.target.value,
                                packageQuantityInput: '',
                                quantity: '',
                              }))
                            }
                            className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-bold outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                          >
                            {restockPackagings.map((packaging) => (
                              <option key={packaging.id} value={packaging.id}>
                                {packaging.packageName} x {packaging.unitsPerPackage}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-700">
                            Количество {selectedRestockPackaging.packageName}
                          </label>
                          <input
                            type="number"
                            min="0"
                            required
                            value={restockData.packageQuantityInput}
                          onChange={e =>
                            setRestockData((prev) => ({
                              ...prev,
                              packageQuantityInput: e.target.value,
                              quantity: String(
                                Math.max(0, Math.floor(Number(e.target.value || 0) || 0)) *
                                  (selectedRestockPackaging.unitsPerPackage || 0)
                              ),
                            }))
                          }
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 font-bold outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                          />
                          <p className="mt-2 text-xs font-medium text-slate-400">
                            1 {formatCountWithUnit(1, selectedRestockPackaging.packageName).replace(/^1\s+/, '')} = {selectedRestockPackaging.unitsPerPackage} {normalizeDisplayBaseUnit(selectedProduct?.unit || 'шт')}
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-400">
                            Итого: {totalRestockUnits} {normalizeDisplayBaseUnit(selectedProduct?.unit || 'шт')}
                          </p>
                        </div>
                      </>
                    ) : (
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
                    )}
                    {isAdmin && (
                      <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-700">Цена закупки</label>
                        <input 
                          type="number" 
                          step="0.01"
                          required
                          value={restockData.costPrice}
                          onChange={e => setRestockData((prev) => ({ ...prev, costPrice: e.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 font-bold outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" 
                        />
                        <p className="mt-2 text-xs font-medium text-slate-400">
                          Закупка за 1 шт без расходов.
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-700">Цена продажи</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={restockData.sellingPrice}
                        onChange={e => setRestockData({ ...restockData, sellingPrice: e.target.value })}
                        onBlur={e => setRestockData({ ...restockData, sellingPrice: formatPriceInput(e.target.value) })}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 font-bold outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                      />
                      <p className="mt-2 text-xs font-medium text-slate-400">
                        Новая цена продажи для этой поставки.
                      </p>
                    </div>
                  </div>
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
                <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end sm:space-x-3 sm:gap-0">
                  <button type="button" onClick={closeRestockModal} className="rounded-2xl px-6 py-3 text-sm font-bold text-slate-500 transition-all hover:bg-slate-50">Отмена</button>
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
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-2 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-[2.5rem]"
            >
              <div className="border-b border-slate-100 bg-slate-50/50 p-4 sm:p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-xl font-black text-slate-900 sm:text-2xl">Результаты сканирования</h3>
                  </div>
                  <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-sky-100 bg-white px-4 py-3 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Курс USD ($)</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <input 
                          type="number" 
                          step="0.01"
                          value={usdRate}
                          onChange={(e) => setUsdRate(e.target.value)}
                          className="w-24 bg-transparent text-left font-black text-sky-600 outline-none"
                        />
                        <DollarSign className="text-sky-300" size={18} />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-violet-100 bg-white px-4 py-3 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Общие расходы %</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={scanExpensePercent}
                          onChange={(e) => setScanExpensePercent(e.target.value)}
                          className="w-20 bg-transparent text-left font-black text-violet-600 outline-none"
                        />
                        <span className="text-sm font-black text-slate-300">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-8">
                <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-sky-600">Авторасчёт по накладной</p>
                      <p className="mt-2 text-sm font-medium text-slate-600">
                        Количество и закупка пересчитываются автоматически. Измените только то, что нужно перед добавлением на склад.
                      </p>
                      {invalidOcrRowsCount > 0 && (
                        <p className="mt-3 text-sm font-bold text-rose-600">
                          Проверьте проблемные строки: {invalidOcrRowsCount}. Они подсвечены красным и не дадут завершить импорт.
                        </p>
                      )}
                      {problematicOcrRows.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {problematicOcrRows.map((row) => (
                            <button
                              key={`problem-row-${row.lineIndex}`}
                              type="button"
                              onClick={() => jumpToOcrLine(row.lineIndex)}
                              className="rounded-xl bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-700 ring-1 ring-rose-200"
                              title={row.reason}
                            >
                              Строка {row.lineIndex}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 self-start rounded-2xl border border-sky-200 bg-white px-3 py-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Позиции</span>
                      <span className="rounded-xl bg-sky-500 px-2.5 py-1 text-sm font-black text-white">
                        {ocrImportedCount + ocrResults.filter((entry) => entry.enabled !== false).length}/{ocrOriginalCount || ocrResults.length}
                      </span>
                      {ocrImportedCount > 0 && (
                        <span className="rounded-xl bg-emerald-500 px-2.5 py-1 text-sm font-black text-white">
                          Добавлено: {ocrImportedCount}
                        </span>
                      )}
                      {ocrResults.filter((entry) => entry.enabled !== false).length > 0 && (
                        <span className="rounded-xl bg-slate-500 px-2.5 py-1 text-sm font-black text-white">
                          Осталось: {ocrResults.filter((entry) => entry.enabled !== false).length}
                        </span>
                      )}
                      {invalidOcrRowsCount > 0 && (
                        <span className="rounded-xl bg-rose-500 px-2.5 py-1 text-sm font-black text-white">
                          Ошибки: {invalidOcrRowsCount}
                        </span>
                      )}
                      {invalidOcrRowsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowOnlyProblematicOcrRows((prev) => !prev)}
                          className={clsx(
                            'rounded-xl px-3 py-1.5 text-xs font-black transition-all',
                            showOnlyProblematicOcrRows
                              ? 'bg-rose-600 text-white'
                              : 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
                          )}
                        >
                          {showOnlyProblematicOcrRows ? 'Показать все строки' : 'Только проблемные'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="hidden grid-cols-12 gap-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 sm:grid">
                  <div className="col-span-4">Товар</div>
                  <div className="col-span-2 text-center">Кол-во</div>
                  <div className="col-span-2 text-right">Закупка</div>
                  <div className="col-span-2 text-right">Наша закупка</div>
                  <div className="col-span-2 text-right">Цена продажи</div>
                </div>
                {visibleOcrResults.map((item, i) => {
                  const validationReason = getOcrProblemReason(item, usdRate, scanExpensePercent);
                  const sourceIndex = ocrResults.findIndex((entry) => entry === item);

                  return (
                  <div
                    key={`${item.lineIndex || sourceIndex || i}-${sourceIndex}`}
                    ref={(node) => {
                      ocrRowRefs.current[Number(item.lineIndex || sourceIndex || i)] = node;
                    }}
                    className={clsx(
                    "grid grid-cols-1 gap-4 rounded-[28px] border p-4 transition-colors sm:grid-cols-12 sm:items-center sm:p-5",
                    item.enabled === false
                      ? "bg-slate-100 opacity-65"
                      : highlightedOcrLine === Number(item.lineIndex || sourceIndex || i)
                        ? "border-rose-400 bg-rose-100 shadow-lg shadow-rose-200/60 ring-2 ring-rose-300"
                      : validationReason
                        ? "border-rose-200 bg-rose-50 hover:bg-rose-100/60"
                        : "bg-sky-50 hover:bg-sky-100/50"
                  )}
                  >
                    <div className="sm:col-span-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-sky-500">
                          <input
                            type="checkbox"
                            checked={item.enabled !== false}
                            onChange={(e) => {
                              const newResults = [...ocrResults];
                              if (sourceIndex >= 0) {
                                newResults[sourceIndex].enabled = e.target.checked;
                                if (e.target.checked) {
                                  newResults[sourceIndex].serverError = '';
                                }
                              }
                              setOcrResults(newResults);
                            }}
                            className="h-4 w-4 rounded border-sky-300 text-sky-600 focus:ring-sky-500"
                          />
                          Добавить строку #{item.lineIndex || i + 1}
                        </label>
                        <div className="flex shrink-0 items-center gap-2">
                          {validationReason && item.enabled !== false && (
                            <span className="rounded-xl bg-rose-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                              Проблема
                            </span>
                          )}
                          <span className="shrink-0 rounded-xl bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 ring-1 ring-sky-100">
                            Строка {item.lineIndex || i + 1}
                          </span>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={item.name || ''}
                        onChange={(e) => {
                          const newResults = [...ocrResults];
                          if (sourceIndex >= 0) {
                            newResults[sourceIndex].name = e.target.value;
                            newResults[sourceIndex].serverError = '';
                          }
                          setOcrResults(newResults);
                        }}
                        className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-sky-500"
                      />
                      {item.rawName && item.rawName !== item.name && (
                        <p className="mt-1 text-[10px] font-bold text-slate-400">
                          OCR: {formatProductName(item.rawName)}
                        </p>
                      )}
                      {validationReason && item.enabled !== false && (
                        <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-[11px] font-bold text-rose-600 ring-1 ring-rose-200">
                          Нужно проверить: {validationReason}
                        </p>
                      )}
                      {item.rawQuantity && (
                        <p className="mt-1 text-[10px] font-bold text-slate-400">Из накладной: {item.rawQuantity}</p>
                      )}
                      {item.lineTotal > 0 && (
                        <p className="mt-1 text-[10px] font-bold text-slate-400">
                          Сумма строки: {formatDollar(item.lineTotal)} / ≈ {formatMoney(item.lineTotal * parseFloat(usdRate || '0'))}
                        </p>
                      )}
                      {item.note && <p className="mt-1 text-[10px] text-slate-500">{item.note}</p>}
                    </div>
                    <div className="sm:col-span-2 sm:text-center">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400 sm:hidden">Кол-во</p>
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={item.packageCount || ''}
                          onChange={(e) => {
                            const newResults = [...ocrResults];
                            if (sourceIndex >= 0) {
                              newResults[sourceIndex].packageCount = Number(e.target.value || 0);
                              newResults[sourceIndex].serverError = '';
                            }
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
                            if (sourceIndex >= 0) {
                              newResults[sourceIndex].unitsPerPackage = Number(e.target.value || 0);
                              newResults[sourceIndex].serverError = '';
                            }
                            setOcrResults(newResults);
                          }}
                          className="w-16 rounded-lg border border-sky-200 bg-white px-2 py-1 text-center text-xs font-black text-sky-700 outline-none focus:border-sky-500"
                        />
                      </div>
                      <p className="text-[10px] font-bold text-slate-500">
                        = {getOcrResolvedQuantity(item)} шт
                      </p>
                      <p className="text-[10px] font-bold text-slate-400">итог для склада</p>
                      {item.price > 0 && item.packageCount > 0 && (
                        <p className="mt-1 text-[10px] font-bold text-slate-400">
                          {formatDollar(item.price)} x {item.packageCount} = {formatDollar(calculateLineTotal(item.packageCount, item.price))}
                        </p>
                      )}
                    </div>
                    <div className="sm:col-span-2 sm:text-right">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400 sm:hidden">Закупка</p>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price || ''}
                        onChange={(e) => {
                          const newResults = [...ocrResults];
                          if (sourceIndex >= 0) {
                            newResults[sourceIndex].price = Number(e.target.value || 0);
                            newResults[sourceIndex].serverError = '';
                          }
                          setOcrResults(newResults);
                        }}
                        className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-right text-sm font-black text-slate-900 outline-none focus:border-sky-500"
                      />
                      <p className="mt-1 text-[10px] font-bold text-slate-400">≈ {formatMoney(item.price * parseFloat(usdRate || '0'))} / упаковка</p>
                    </div>
                    <div className="sm:col-span-2 sm:text-right">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400 sm:hidden">Наша закупка</p>
                      {(() => {
                        const quantity = getOcrResolvedQuantity(item);
                        const baseCostPerPiece =
                          item.lineTotal > 0 && quantity > 0
                            ? calculateUnitCostFromLineTotal(item.lineTotal * parseFloat(usdRate || '0'), quantity)
                            : item.unitsPerPackage > 0
                              ? calculateUnitCostFromPackage(item.price * parseFloat(usdRate || '0'), item.unitsPerPackage)
                              : calculateUnitCostFromLineTotal(item.price * parseFloat(usdRate || '0'), quantity);
                        const expensePercent = Math.max(0, Number(scanExpensePercent || 0));
                        const effectiveCostPerPiece = calculateEffectiveCost(baseCostPerPiece, expensePercent);

                        return (
                          <>
                            <p className="font-black text-slate-900">
                              {formatMoney(effectiveCostPerPiece)}
                            </p>
                            <p className="mt-1 text-[10px] font-bold text-slate-400">
                              база: {formatMoney(baseCostPerPiece)}
                            </p>
                            <p className="mt-2 text-[10px] font-bold text-slate-400">
                              расходы: {toFixedNumber(expensePercent)}%
                            </p>
                          </>
                        );
                      })()}
                    </div>
                    <div className="sm:col-span-2 sm:text-right">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400 sm:hidden">Цена продажи</p>
                      <input 
                        type="number"
                        placeholder="Укажите цену"
                        value={item.sellingPrice}
                        onChange={(e) => {
                          const newResults = [...ocrResults];
                          if (sourceIndex >= 0) {
                            newResults[sourceIndex].sellingPrice = e.target.value;
                            newResults[sourceIndex].serverError = '';
                          }
                          setOcrResults(newResults);
                        }}
                        className="w-full text-right bg-white px-4 py-2 rounded-xl border border-sky-200 focus:border-sky-500 outline-none font-black text-emerald-600"
                      />
                    </div>
                  </div>
                )})}
                {showOnlyProblematicOcrRows && visibleOcrResults.length === 0 && (
                  <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6 text-center text-sm font-bold text-emerald-700">
                    Проблемных строк не осталось. Можно добавить все товары на склад.
                  </div>
                )}
              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-sky-50/60 p-4 sm:flex-row sm:justify-end sm:space-x-3 sm:gap-0 sm:p-8">
                <button onClick={closeOcrResultsModal} className="px-8 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-200 transition-all">Отмена</button>
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
            key={showHistoryModal ? `history-${selectedProduct?.id || 'empty'}` : 'history-closed'}
            isOpen={showHistoryModal}
            onClose={closeHistoryModal}
            productName={selectedProduct?.name}
            product={selectedProduct}
            productHistory={productHistory}
            onReverseIncoming={handleReverseIncoming}
          />
          <ProductBatchesModal
            key={showBatchesModal ? `batches-${selectedProduct?.id || 'empty'}` : 'batches-closed'}
            isOpen={showBatchesModal}
            onClose={closeBatchesModal}
            selectedProduct={selectedProduct}
            productBatches={productBatches}
            canManage={isAdmin}
            onDeleteBatch={handleDeleteBatch}
          />
      </React.Suspense>

      <AnimatePresence>
        {showMergeModal && selectedProduct && (
          <motion.div
            onClick={closeMergeModal}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2rem]"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-fuchsia-50/50 p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-fuchsia-600 p-3 text-white">
                    <GitMerge size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Объединить дубликаты</h3>
                    <p className="text-sm text-slate-500">Выберите основной товар, в который нужно перенести остатки и историю.</p>
                  </div>
                </div>
                <button onClick={closeMergeModal} className="text-slate-400 transition-colors hover:text-slate-600">
                  <X size={22} />
                </button>
              </div>

              <div className="space-y-5 p-4 sm:p-6">
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

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:justify-end sm:p-6">
                <button
                  onClick={closeMergeModal}
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
            onClose={closeDeleteConfirm}
            onConfirm={handleConfirmDeleteProduct}
            title="Удалить товар навсегда?"
              message={`Товар "${formatProductName(selectedProduct?.name)}" будет удалён навсегда. Если он уже участвовал в продажах, система не даст удалить его полностью.`}
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
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full bg-emerald-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Товаров: {displayProducts.length}
            </div>
            {duplicateProductsCount > 0 ? (
              <>
                <div className="rounded-full bg-amber-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
                  Дублей: {duplicateProductsCount}
                </div>
                <button
                  type="button"
                  onClick={handleMergeExactDuplicates}
                  disabled={isMergingDuplicates}
                  className="rounded-full bg-fuchsia-600 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition-all hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isMergingDuplicates ? 'Объединение...' : 'Объединить дубликаты'}
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 p-3 md:hidden">
          {displayProducts.map((product, index) => (
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
                  <p className="mt-1 whitespace-pre-line break-words text-sm font-semibold text-slate-900">
                    {getStockBreakdown(product).primary}
                  </p>
                  {getStockBreakdown(product).secondary && (
                    <p className="mt-1 break-words text-[11px] font-medium text-slate-500">
                      {getStockBreakdown(product).secondary}
                    </p>
                  )}
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Приход</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                    {product.totalIncoming} <span className="text-[10px] uppercase text-slate-400">{normalizeDisplayBaseUnit(product.unit || 'шт')}</span>
                  </p>
                </div>
                {isAdmin && (
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Закупка</p>
                    <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                      {isAggregateMode ? '-' : formatMoney(product.costPrice)}
                    </p>
                  </div>
                )}
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Продажа</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                    {isAggregateMode ? '-' : formatMoney(product.sellingPrice)}
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
                      const defaultPackaging = getDefaultPackaging(normalizePackagings(product));
                      setSelectedProduct(product);
                      setRestockData({
                        ...restockData,
                        warehouseId: product.warehouseId?.toString() || '',
                        quantity: '',
                        selectedPackagingId: defaultPackaging ? String(defaultPackaging.id) : '',
                        packageQuantityInput: '',
                        costPrice: formatPriceInput(product.purchaseCostPrice ?? product.costPrice),
                        sellingPrice: formatPriceInput(product.sellingPrice),
                        reason: '',
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
                        const defaultPackaging = getDefaultPackaging(normalizePackagings(product));
                        setSelectedProduct(product);
                        setTransferData({
                          ...emptyTransferData,
                          fromWarehouseId: product.warehouseId?.toString() || '',
                          selectedPackagingId: defaultPackaging ? String(defaultPackaging.id) : '',
                        });
                        setShowTransferModal(true);
                      }}
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-semibold text-amber-700"
                  >
                    Перенос
                  </button>
                  <button
                    onClick={() => {
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
          {displayProducts.length === 0 && !isLoading && (
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
                {displayProducts.map((product, index) => (
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
                        <p className="text-xs font-medium text-slate-500">{formatMoney(product.costPrice)}</p>
                      ) : (
                        <span className="text-xs text-slate-300">-</span>
                      )}
                    </td>
                  )}
                  <td className="px-5 py-3">
                    {selectedWarehouseId ? (
                      <p className="text-sm font-semibold text-slate-900">{formatMoney(product.sellingPrice)}</p>
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
                      <div className={clsx(
                        "min-w-0",
                        product.stock <= product.minStock ? "text-rose-600" : "text-slate-900"
                      )}>
                        <p className="whitespace-pre-line text-sm font-semibold">
                          {getStockBreakdown(product).primary}
                        </p>
                        {getStockBreakdown(product).secondary && (
                          <p className="text-[11px] font-medium text-slate-400">
                            {getStockBreakdown(product).secondary}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-xs font-medium text-slate-500">{product.totalIncoming} <span className="text-[10px] font-medium text-slate-400 uppercase">{normalizeDisplayBaseUnit(product.unit || 'шт')}</span></p>
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
                              const defaultPackaging = getDefaultPackaging(normalizePackagings(product));
                              setSelectedProduct(product);
                              setRestockData({
                                ...restockData,
                                warehouseId: product.warehouseId?.toString() || '',
                                quantity: '',
                                selectedPackagingId: defaultPackaging ? String(defaultPackaging.id) : '',
                                packageQuantityInput: '',
                                costPrice: formatPriceInput(product.purchaseCostPrice ?? product.costPrice),
                                sellingPrice: formatPriceInput(product.sellingPrice),
                                reason: '',
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
                                const defaultPackaging = getDefaultPackaging(normalizePackagings(product));
                                setSelectedProduct(product);
                                setTransferData({
                                  ...emptyTransferData,
                                  fromWarehouseId: product.warehouseId?.toString() || '',
                                  selectedPackagingId: defaultPackaging ? String(defaultPackaging.id) : '',
                                });
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
               {displayProducts.length === 0 && !isLoading && (
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


