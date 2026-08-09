import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import client from '../api/client';
import * as ProductsApi from '../api/products.api';
const {
  getProducts,
  mergeProduct,
} = ProductsApi as any;
import {
  Edit,
  Trash2,
  X,
  History,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatMoney } from '../utils/format';
import { getWarehouses } from '../api/warehouses.api';
import { getSettingsCategories } from '../api/settings-reference.api';
import { filterWarehousesForUser, getCurrentUser, getUserWarehouseId, isAdminUser } from '../utils/userAccess';
import { formatProductName } from '../utils/productName';
import { getDefaultWarehouseId } from '../utils/warehouse';
import ProductsCatalogSection from '../components/products/ProductsCatalogSection';
import ProductsModals from '../components/products/ProductsModals';
import ProductsPageHeader from '../components/products/ProductsPageHeader';
import ProductsScanOverlay from '../components/products/ProductsScanOverlay';
import useProductOcrImport from '../components/products/useProductOcrImport';
import useProductOcrScanner from '../components/products/useProductOcrScanner';
import useProductOcrState from '../components/products/useProductOcrState';
import useProductPhotoUpload from '../components/products/useProductPhotoUpload';
import useProductCrudActions from '../components/products/useProductCrudActions';
import useProductMovementActions from '../components/products/useProductMovementActions';
import useProductRestockActions from '../components/products/useProductRestockActions';
import useProductsCatalogData from '../components/products/useProductsCatalogData';
import {
  buildProductFormData,
  createEmptyProductForm,
  detectCategoryName,
  extractMassKey,
  formatCountWithUnit,
  formatPriceInput,
  getDefaultPackaging,
  getOcrResolvedQuantity,
  getPreferredPackaging,
  getStockBreakdown,
  normalizeDisplayBaseUnit,
  normalizePackagings,
  normalizeProductFamilyName,
  type ProductFormData,
} from '../utils/productsViewUtils';

const PAGE_SIZE = 12;
const WRITE_OFF_REASON_PRESETS = ['Брак', 'Потеря', 'Внутреннее использование', 'Корректировка'];
const EMPTY_TRANSFER_DATA = {
  fromWarehouseId: '',
  toWarehouseId: '',
  quantity: '',
  selectedPackagingId: '',
  packageQuantityInput: '',
};
const EMPTY_RESTOCK_DATA = {
  warehouseId: '',
  quantity: '',
  selectedPackagingId: '',
  packageQuantityInput: '',
  costPrice: '',
  sellingPrice: '',
  expensePercent: '0',
  reason: '',
};

export default function ProductsView() {
  const pageSize = PAGE_SIZE;
  const hasLoadedReferenceDataRef = React.useRef(false);
  const latestProductsRequestRef = React.useRef(0);
  const initialSortAppliedRef = React.useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showBatchesModal, setShowBatchesModal] = useState(false);
  const [showReturnWriteOffModal, setShowReturnWriteOffModal] = useState(false);
  const [showDeleteWriteOffConfirm, setShowDeleteWriteOffConfirm] = useState(false);
  const [productHistory, setProductHistory] = useState<any[]>([]);
  const [productBatches, setProductBatches] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedHistoryTransaction, setSelectedHistoryTransaction] = useState<any>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [isMergingDuplicates, setIsMergingDuplicates] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(userWarehouseId ? String(userWarehouseId) : '');
  const [forceWarehouseLowStockView, setForceWarehouseLowStockView] = useState(false);
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
    expensePercent: '0',
    reason: '',
  });
  const [writeOffData, setWriteOffData] = useState({
    productId: '',
    quantity: '1',
    reason: 'брак',
  });
  const [returnWriteOffData, setReturnWriteOffData] = useState({
    quantity: '1',
    reason: 'ошибка ввода',
  });
  const {
    ocrResults,
    setOcrResults,
    ocrOriginalCount,
    setOcrOriginalCount,
    ocrImportedCount,
    setOcrImportedCount,
    usdRate,
    setUsdRate,
    scanExpensePercent,
    setScanExpensePercent,
    showOnlyProblematicOcrRows,
    setShowOnlyProblematicOcrRows,
    highlightedOcrLine,
    setHighlightedOcrLine,
    ocrRowRefs,
    closeOcrResultsModal,
    invalidOcrRowsCount,
    visibleOcrResults,
    problematicOcrRows,
    jumpToOcrLine,
  } = useProductOcrState();
  const { handleScanInvoice } = useProductOcrScanner({
    selectedWarehouseId,
    setIsScanning,
    setOcrOriginalCount,
    setOcrImportedCount,
    setOcrResults,
    setScanExpensePercent,
    setShowOnlyProblematicOcrRows,
    setHighlightedOcrLine,
  });
  const [isCategoryManual, setIsCategoryManual] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'name', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedMobileActionsId, setExpandedMobileActionsId] = useState<number | null>(null);
  const [isReferenceDataReady, setIsReferenceDataReady] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const emptyTransferData = EMPTY_TRANSFER_DATA;
  const emptyRestockData = EMPTY_RESTOCK_DATA;

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setShowWriteOffModal(false);
    setShowReturnWriteOffModal(false);
    setShowDeleteWriteOffConfirm(false);
    setProductHistory([]);
    setSelectedHistoryTransaction(null);
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

  const closeWriteOffModal = () => {
    setShowWriteOffModal(false);
    setWriteOffData({
      productId: '',
      quantity: '1',
      reason: 'брак',
    });
  };

  const closeReturnWriteOffModal = () => {
    setShowReturnWriteOffModal(false);
    setSelectedHistoryTransaction(null);
    setReturnWriteOffData({
      quantity: '1',
      reason: 'ошибка ввода',
    });
  };

  const closeDeleteWriteOffConfirm = () => {
    setShowDeleteWriteOffConfirm(false);
    setSelectedHistoryTransaction(null);
  };

  const closeMergeModal = () => {
    setShowMergeModal(false);
    setMergeTargetId('');
    setSelectedProduct(null);
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

  const [formData, setFormData] = useState<ProductFormData>(createEmptyProductForm());
  const { isPhotoUploading, handlePhotoUpload } = useProductPhotoUpload({ setFormData });
  const numericSortKeys = new Set(['costPrice', 'sellingPrice', 'stock', 'totalIncoming', 'minStock', 'initialStock']);
  useEffect(() => {
    if (!isReferenceDataReady) {
      return;
    }

    fetchInitialData();
  }, [isReferenceDataReady, selectedWarehouseId]);

  useEffect(() => {
    if (!showAddModal || showEditModal || isCategoryManual) {
      return;
    }

    const suggestedCategoryName = detectCategoryName(formData.name);
    const suggestedCategory = categories.find(
      (category) =>
        String(category.name || '').trim().toLowerCase() === suggestedCategoryName.trim().toLowerCase() &&
        String(category.name || '').trim().toLowerCase() !== 'прочее'
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
    setCategoryInput(suggestedCategory?.name || '');
  }, [categories, formData.name, isCategoryManual, showAddModal, showEditModal]);

  useEffect(() => {
    if ((!showAddModal && !showEditModal) || categoryInput.trim()) {
      return;
    }

    const selectedCategory = categories.find((category) => String(category?.id) === String(formData.categoryId || ''));
    if (selectedCategory?.name) {
      setCategoryInput(String(selectedCategory.name));
    }
  }, [categories, categoryInput, formData.categoryId, showAddModal, showEditModal]);

  useEffect(() => {
    const hasOpenModal =
      showAddModal ||
      showEditModal ||
      showTransferModal ||
      showRestockModal ||
      showWriteOffModal ||
      showReturnWriteOffModal ||
      showMergeModal ||
      showDeleteConfirm ||
      showDeleteWriteOffConfirm ||
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

      if (showWriteOffModal) return closeWriteOffModal();
      if (showReturnWriteOffModal) return closeReturnWriteOffModal();
      if (showDeleteConfirm) return closeDeleteConfirm();
      if (showDeleteWriteOffConfirm) return closeDeleteWriteOffConfirm();
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
    showDeleteWriteOffConfirm,
    showEditModal,
    showHistoryModal,
    showMergeModal,
    showReturnWriteOffModal,
    showRestockModal,
    showWriteOffModal,
    showTransferModal,
  ]);

  const fetchInitialData = async (warehouseIdOverride?: string) => {
    const requestId = latestProductsRequestRef.current + 1;
    latestProductsRequestRef.current = requestId;
    setIsLoading(true);
    try {
      const effectiveWarehouseId = warehouseIdOverride !== undefined ? warehouseIdOverride : selectedWarehouseId;
      const productsData = await getProducts(effectiveWarehouseId ? Number(effectiveWarehouseId) : undefined);
      if (latestProductsRequestRef.current !== requestId) {
        return;
      }
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (err) {
      if (latestProductsRequestRef.current !== requestId) {
        return;
      }
      console.error(err);
      toast.error('Ошибка при загрузке данных');
    } finally {
      if (latestProductsRequestRef.current === requestId) {
        setIsLoading(false);
      }
    }
  };

  const { handleAddOcrToStock } = useProductOcrImport({
    ocrResults,
    selectedWarehouseId,
    usdRate,
    scanExpensePercent,
    ocrImportedCount,
    ocrOriginalCount,
    setIsLoading,
    setOcrImportedCount,
    setOcrResults,
    setShowOnlyProblematicOcrRows,
    setHighlightedOcrLine,
    jumpToOcrLine,
    closeOcrResultsModal,
    fetchInitialData,
  });

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
        const defaultWarehouseId = getDefaultWarehouseId(filteredWarehouses) || (filteredWarehouses.length === 1 ? Number(filteredWarehouses[0].id) : null);
        if (isAdmin && defaultWarehouseId) {
          setSelectedWarehouseId((currentValue) => currentValue || String(defaultWarehouseId));
        } else if (!isAdmin && filteredWarehouses[0]) {
          setSelectedWarehouseId(String(filteredWarehouses[0].id));
        }
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
        setIsReferenceDataReady(true);
      })
      .catch((error) => {
        hasLoadedReferenceDataRef.current = false;
        setIsReferenceDataReady(true);
        console.error(error);
        toast.error('Ошибка при загрузке данных');
      });
  }, [isAdmin, user]);

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

  const openEditProductModal = (product: any) => {
    setSelectedProduct(product);
    setFormData(buildProductFormData(product));
    setCategoryInput(product.category?.name || '');
    setShowEditModal(true);
  };

  const openTransferProductModal = (product: any) => {
    const defaultPackaging = getDefaultPackaging(normalizePackagings(product));
    setSelectedProduct(product);
    setTransferData({
      ...emptyTransferData,
      fromWarehouseId: product.warehouseId?.toString() || '',
      selectedPackagingId: defaultPackaging ? String(defaultPackaging.id) : '',
    });
    setShowTransferModal(true);
  };

  const openDeleteProductConfirm = (product: any) => {
    setSelectedProduct(product);
    setShowDeleteConfirm(true);
  };

  const closeMobileActions = () => {
    setExpandedMobileActionsId(null);
  };

  const handleMobileEditProduct = (product: any) => {
    openEditProductModal(product);
    closeMobileActions();
  };

  const handleMobileRestockProduct = (product: any) => {
    openRestockProductModal(product);
    closeMobileActions();
  };

  const handleMobileShowHistory = (product: any) => {
    handleShowHistory(product);
    closeMobileActions();
  };

  const handleMobileOpenWriteOffModal = (product: any) => {
    handleOpenWriteOffModal(product);
    closeMobileActions();
  };

  const handleMobileShowBatches = (product: any) => {
    handleShowBatches(product);
    closeMobileActions();
  };

  const handleMobileTransferProduct = (product: any) => {
    openTransferProductModal(product);
    closeMobileActions();
  };

  const handleMobileDeleteProduct = (product: any) => {
    openDeleteProductConfirm(product);
    closeMobileActions();
  };

  const resetForm = () => {
    setFormData(createEmptyProductForm());
    setCategoryInput('');
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

  const {
    filteredProducts,
    displayProducts,
    duplicateGroups,
    duplicateProductsCount,
    selectedWriteOffProduct,
    selectedWriteOffPackaging,
    visibleCategories,
    totalPages,
    paginatedProducts,
    isAggregateMode,
  } = useProductsCatalogData({
    products,
    categories,
    search,
    selectedWarehouseId,
    forceWarehouseLowStockView,
    sortConfig,
    writeOffProductId: writeOffData.productId,
    currentPage,
    pageSize,
  });

  const {
    handleAddProduct,
    handleEditProduct,
    handleConfirmDeleteProduct,
  } = useProductCrudActions({
    formData,
    categoryInput,
    visibleCategories,
    categories,
    selectedProduct,
    setCategories,
    setCategoryInput,
    setFormData,
    setShowAddModal,
    setShowEditModal,
    resetForm,
    fetchInitialData,
    closeDeleteConfirm,
  });

  const {
    restockPackagings,
    selectedRestockPackaging,
    totalRestockUnits,
    openRestockProductModal,
    handleRestock,
  } = useProductRestockActions({
    selectedProduct,
    restockData,
    setSelectedProduct,
    setRestockData,
    setShowRestockModal,
    closeRestockModal,
    fetchInitialData,
  });

  const {
    handleShowHistory,
    handleShowBatches,
    handleDeleteBatch,
    handleReverseIncoming,
    handleReverseCorrectionWriteOff,
    handleOpenReturnWriteOffModal,
    handleSubmitReturnWriteOff,
    handleOpenDeleteWriteOffConfirm,
    handleDeleteWriteOffPermanently,
    handleOpenWriteOffModal,
    handleSubmitWriteOff,
    handleSetWriteOffQuantity,
  } = useProductMovementActions({
    selectedWarehouseId,
    selectedProduct,
    selectedWriteOffProduct,
    selectedHistoryTransaction,
    writeOffData,
    returnWriteOffData,
    setSelectedProduct,
    setSelectedHistoryTransaction,
    setProductHistory,
    setProductBatches,
    setWriteOffData,
    setReturnWriteOffData,
    setShowHistoryModal,
    setShowBatchesModal,
    setShowWriteOffModal,
    setShowReturnWriteOffModal,
    setShowDeleteWriteOffConfirm,
    closeWriteOffModal,
    closeReturnWriteOffModal,
    closeDeleteWriteOffConfirm,
    fetchInitialData,
  });

  const normalizedWriteOffReason = String(writeOffData.reason || '').trim().toLowerCase();
  const isCustomWriteOffReason = Boolean(
    normalizedWriteOffReason &&
    !WRITE_OFF_REASON_PRESETS.some((reason) => reason.toLowerCase() === normalizedWriteOffReason)
  );

  useEffect(() => {
    setCurrentPage(1);
    setExpandedMobileActionsId(null);
  }, [forceWarehouseLowStockView, search, selectedWarehouseId, sortConfig.key, sortConfig.direction]);

  useEffect(() => {
    const sortMode = String(searchParams.get('sort') || '').trim().toLowerCase();
    const requestedView = String(searchParams.get('view') || '').trim().toLowerCase();
    const shouldForceWarehouseLowStockView = requestedView === 'warehouse-low-stock';

    if (forceWarehouseLowStockView !== shouldForceWarehouseLowStockView) {
      setForceWarehouseLowStockView(shouldForceWarehouseLowStockView);
    }

    if (sortMode !== 'low-stock' || initialSortAppliedRef.current) {
      if (!requestedView) {
        return;
      }
    } else {
      initialSortAppliedRef.current = true;
      setSortConfig({ key: 'stock', direction: 'asc' });
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('sort');
    nextParams.delete('view');
    setSearchParams(nextParams, { replace: true });
  }, [forceWarehouseLowStockView, searchParams, setSearchParams]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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

  const exportStockReport = async () => {
    if (!filteredProducts.length) {
      toast.error('Нет товаров для выгрузки');
      return;
    }

    const warehouseName = warehouses.find((warehouse) => String(warehouse.id) === selectedWarehouseId)?.name || 'Все склады';
    const downloadedAt = new Date();

    const { downloadStockReportPdf } = await import('../utils/print/stockReportPdf');

    await downloadStockReportPdf({
      warehouseName,
      generatedAt: downloadedAt,
      rows: filteredProducts.map((product, index) => {
        const stockBreakdown = getStockBreakdown(product);

        return {
          index: index + 1,
          name: formatProductName(product.name),
          stock: String(stockBreakdown.primary || '')
            .replace(/\n/g, ' + ')
            .replace(/\s+/g, ' ')
            .trim(),
        };
      }),
    });

    toast.success('Остатки товаров скачаны в PDF');
  };

  const exportPriceList = async () => {
    if (!filteredProducts.length) {
      toast.error('Нет товаров для выгрузки');
      return;
    }

    const warehouseName = warehouses.find((warehouse) => String(warehouse.id) === selectedWarehouseId)?.name || 'Все склады';
    const downloadedAt = new Date();

    const { downloadPriceListPdf } = await import('../utils/print/priceListPdf');

    await downloadPriceListPdf({
      warehouseName,
      generatedAt: downloadedAt,
      rows: filteredProducts.map((product, index) => {
        const preferredPackaging = getPreferredPackaging(product);
        const unitsPerPackage = Number(preferredPackaging?.unitsPerPackage || 1);
        const sellingPrice = Number(product.sellingPrice || 0);
        const packagePrice = preferredPackaging?.packageSellingPrice
          ? Number(preferredPackaging.packageSellingPrice)
          : sellingPrice * unitsPerPackage;

        return {
          index: index + 1,
          name: formatProductName(product.name),
          pricePerUnit: formatMoney(sellingPrice),
          unitsPerPackage: unitsPerPackage > 1 ? `${unitsPerPackage} шт` : '—',
          pricePerPackage: unitsPerPackage > 1 ? formatMoney(packagePrice) : '—'
        };
      }),
    });

    toast.success('Прайс-лист скачан в PDF');
  };

  return (
    <div className="app-page-shell min-h-full font-sans">
      <div className="space-y-5 overflow-hidden rounded-[28px] bg-[#f4f5fb] p-5 min-h-screen">
        <ProductsPageHeader
          isAdmin={isAdmin}
          isScanning={isScanning}
          selectedWarehouseId={selectedWarehouseId}
          onScanInvoice={handleScanInvoice}
          onAddProduct={() => {
            if (!selectedWarehouseId) {
              toast.error('Пожалуйста, выберите склад перед добавлением товара');
              return;
            }
            resetForm();
            setFormData(prev => ({ ...prev, warehouseId: selectedWarehouseId }));
            setShowAddModal(true);
          }}
        />

        <ProductsScanOverlay isOpen={isScanning} />

        <ProductsModals
          isAdmin={isAdmin}
          isLoading={isLoading}
          showAddModal={showAddModal}
          showEditModal={showEditModal}
          showTransferModal={showTransferModal}
          showRestockModal={showRestockModal}
          showWriteOffModal={showWriteOffModal}
          showMergeModal={showMergeModal}
          showDeleteConfirm={showDeleteConfirm}
          showHistoryModal={showHistoryModal}
          showBatchesModal={showBatchesModal}
          showReturnWriteOffModal={showReturnWriteOffModal}
          showDeleteWriteOffConfirm={showDeleteWriteOffConfirm}
          selectedProduct={selectedProduct}
          selectedHistoryTransaction={selectedHistoryTransaction}
          selectedWriteOffProduct={selectedWriteOffProduct}
          warehouses={warehouses}
          visibleCategories={visibleCategories}
          productHistory={productHistory}
          productBatches={productBatches}
          formData={formData}
          categoryInput={categoryInput}
          isPhotoUploading={isPhotoUploading}
          transferData={transferData}
          selectedTransferPackaging={selectedTransferPackaging}
          transferUnitsPerPackage={transferUnitsPerPackage}
          transferAvailableFullPackages={transferAvailableFullPackages}
          transferRemainderUnits={transferRemainderUnits}
          transferPackageQuantity={transferPackageQuantity}
          totalTransferUnits={totalTransferUnits}
          availableTransferStock={availableTransferStock}
          restockData={restockData}
          restockPackagings={restockPackagings}
          selectedRestockPackaging={selectedRestockPackaging}
          totalRestockUnits={totalRestockUnits}
          writeOffData={writeOffData}
          selectedWriteOffPackaging={selectedWriteOffPackaging}
          writeOffReasonPresets={WRITE_OFF_REASON_PRESETS}
          normalizedWriteOffReason={normalizedWriteOffReason}
          isCustomWriteOffReason={isCustomWriteOffReason}
          ocrResults={ocrResults}
          visibleOcrResults={visibleOcrResults}
          invalidOcrRowsCount={invalidOcrRowsCount}
          problematicOcrRows={problematicOcrRows}
          ocrImportedCount={ocrImportedCount}
          ocrOriginalCount={ocrOriginalCount}
          usdRate={usdRate}
          scanExpensePercent={scanExpensePercent}
          showOnlyProblematicOcrRows={showOnlyProblematicOcrRows}
          highlightedOcrLine={highlightedOcrLine}
          ocrRowRefs={ocrRowRefs}
          mergeCandidates={selectedProduct ? getMergeCandidates(selectedProduct) : []}
          mergeTargetId={mergeTargetId}
          returnWriteOffData={returnWriteOffData}
          closeProductFormModal={closeProductFormModal}
          closeTransferModal={closeTransferModal}
          closeRestockModal={closeRestockModal}
          closeWriteOffModal={closeWriteOffModal}
          closeOcrResultsModal={closeOcrResultsModal}
          closeHistoryModal={closeHistoryModal}
          closeBatchesModal={closeBatchesModal}
          closeMergeModal={closeMergeModal}
          closeDeleteConfirm={closeDeleteConfirm}
          closeDeleteWriteOffConfirm={closeDeleteWriteOffConfirm}
          closeReturnWriteOffModal={closeReturnWriteOffModal}
          handleAddProduct={handleAddProduct}
          handleEditProduct={handleEditProduct}
          handleTransfer={handleTransfer}
          handleRestock={handleRestock}
          handleSubmitWriteOff={handleSubmitWriteOff}
          handleSetWriteOffQuantity={handleSetWriteOffQuantity}
          handleAddOcrToStock={handleAddOcrToStock}
          jumpToOcrLine={jumpToOcrLine}
          handleReverseIncoming={handleReverseIncoming}
          handleReverseCorrectionWriteOff={handleReverseCorrectionWriteOff}
          handleOpenReturnWriteOffModal={handleOpenReturnWriteOffModal}
          handleOpenDeleteWriteOffConfirm={handleOpenDeleteWriteOffConfirm}
          handleOpenWriteOffModal={handleOpenWriteOffModal}
          handleDeleteBatch={handleDeleteBatch}
          handleMergeProduct={handleMergeProduct}
          handleConfirmDeleteProduct={handleConfirmDeleteProduct}
          handleDeleteWriteOffPermanently={handleDeleteWriteOffPermanently}
          handleSubmitReturnWriteOff={handleSubmitReturnWriteOff}
          setFormData={setFormData}
          setCategoryInput={setCategoryInput}
          setIsCategoryManual={setIsCategoryManual}
          handlePhotoUpload={handlePhotoUpload}
          setTransferData={setTransferData}
          setRestockData={setRestockData}
          setWriteOffData={setWriteOffData}
          setOcrResults={setOcrResults}
          setUsdRate={setUsdRate}
          setScanExpensePercent={setScanExpensePercent}
          setShowOnlyProblematicOcrRows={setShowOnlyProblematicOcrRows}
          setMergeTargetId={setMergeTargetId}
          setReturnWriteOffData={setReturnWriteOffData}
        />

        <ProductsCatalogSection
          search={search}
          warehouses={warehouses}
          isAdmin={isAdmin}
          isLoading={isLoading}
          isAggregateMode={isAggregateMode}
          selectedWarehouseId={selectedWarehouseId}
          filteredProductsCount={filteredProducts.length}
          duplicateProductsCount={duplicateProductsCount}
          isMergingDuplicates={isMergingDuplicates}
          canTransferProducts={warehouses.length > 1}
          products={paginatedProducts}
          totalItems={displayProducts.length}
          currentPage={currentPage}
          pageSize={pageSize}
          totalPages={totalPages}
          expandedMobileActionsId={expandedMobileActionsId}
          sortConfig={sortConfig}
          getDuplicateHintCount={getDuplicateHintCount}
          onSearchChange={setSearch}
          onWarehouseChange={setSelectedWarehouseId}
          onExportStockReport={exportStockReport}
          onExportPriceList={exportPriceList}
          onMergeExactDuplicates={handleMergeExactDuplicates}
          onToggleMobileActions={(productId) =>
            setExpandedMobileActionsId((current) => (current === productId ? null : productId))
          }
          onOpenMergeModal={handleOpenMergeModal}
          onMobileEditProduct={handleMobileEditProduct}
          onMobileRestockProduct={handleMobileRestockProduct}
          onMobileShowHistory={handleMobileShowHistory}
          onMobileOpenWriteOffModal={handleMobileOpenWriteOffModal}
          onMobileShowBatches={handleMobileShowBatches}
          onMobileTransferProduct={handleMobileTransferProduct}
          onMobileDeleteProduct={handleMobileDeleteProduct}
          onSort={handleSort}
          onEditProduct={openEditProductModal}
          onRestockProduct={openRestockProductModal}
          onShowBatches={handleShowBatches}
          onShowHistory={handleShowHistory}
          onOpenWriteOffModal={handleOpenWriteOffModal}
          onTransferProduct={openTransferProductModal}
          onDeleteProduct={openDeleteProductConfirm}
          onAddProduct={() => { resetForm(); setShowAddModal(true); }}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
