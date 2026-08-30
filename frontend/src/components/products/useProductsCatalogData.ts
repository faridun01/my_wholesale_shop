import React from 'react';
import {
  compareProductsBySort,
  getDefaultPackaging,
  normalizeCatalogName,
  normalizePackagings,
} from '../../utils/productsViewUtils';

interface UseProductsCatalogDataParams {
  products: any[];
  categories: any[];
  search: string;
  selectedWarehouseId: string;
  forceWarehouseLowStockView: boolean;
  sortConfig: { key: string; direction: 'asc' | 'desc' | null };
  writeOffProductId: string;
  currentPage: number;
  pageSize: number;
}

export default function useProductsCatalogData({
  products,
  categories,
  search,
  selectedWarehouseId,
  forceWarehouseLowStockView,
  sortConfig,
  writeOffProductId,
  currentPage,
  pageSize,
}: UseProductsCatalogDataParams) {
  const sortedProducts = React.useMemo(
    () => [...products].sort((a, b) => compareProductsBySort(a, b, sortConfig)),
    [products, sortConfig],
  );

  const sortedAggregatedProducts = React.useMemo(() => {
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
      }, {} as Record<string, any>),
    );

    return [...aggregatedProducts].sort((a, b) => compareProductsBySort(a, b, sortConfig));
  }, [products, sortConfig]);

  const isAggregateMode = !selectedWarehouseId && !forceWarehouseLowStockView;

  const filteredProducts = React.useMemo(() => {
    const baseProducts = selectedWarehouseId || forceWarehouseLowStockView ? sortedProducts : sortedAggregatedProducts;
    const normalizedSearch = normalizeCatalogName(search);

    return baseProducts.filter((product) => {
      const productSearchValue = normalizeCatalogName(String(product.name || ''));
      const matchesSearch = !normalizedSearch || productSearchValue.includes(normalizedSearch);
      const matchesWarehouse =
        !selectedWarehouseId || product.warehouseId === Number(selectedWarehouseId);

      return matchesSearch && matchesWarehouse;
    });
  }, [forceWarehouseLowStockView, search, selectedWarehouseId, sortedAggregatedProducts, sortedProducts]);

  const groupedProducts = React.useMemo(() => {
    const groups = new Map<string, any[]>();

    filteredProducts.forEach((product) => {
      const warehouseId =
        selectedWarehouseId || forceWarehouseLowStockView
          ? Number(product?.warehouseId || selectedWarehouseId || 0)
          : 0;
      const fallbackName = normalizeCatalogName(String(product?.name || ''));
      const key = `${warehouseId}::${fallbackName}`;
      const current = groups.get(key) || [];
      current.push(product);
      groups.set(key, current);
    });

    return Array.from(groups.values()).map((group) =>
      [...group].sort(
        (a, b) =>
          compareProductsBySort(a, b, { key: 'stock', direction: 'desc' }) ||
          Number(b.totalIncoming || 0) - Number(a.totalIncoming || 0) ||
          Number(a.id || 0) - Number(b.id || 0),
      ),
    );
  }, [filteredProducts, forceWarehouseLowStockView, selectedWarehouseId]);

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

  const writeOffProducts = React.useMemo(
    () =>
      filteredProducts
        .filter((product) => Number(product?.stock || 0) > 0)
        .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'ru')),
    [filteredProducts],
  );

  const selectedWriteOffProduct = React.useMemo(
    () => writeOffProducts.find((product) => String(product.id) === String(writeOffProductId || '')) || null,
    [writeOffProductId, writeOffProducts],
  );

  const selectedWriteOffPackaging = React.useMemo(
    () => getDefaultPackaging(normalizePackagings(selectedWriteOffProduct)),
    [selectedWriteOffProduct],
  );

  const visibleCategories = React.useMemo(
    () => categories.filter((category) => String(category?.name || '').trim().toLowerCase() !== 'прочее'),
    [categories],
  );

  const totalPages = Math.max(1, Math.ceil(displayProducts.length / pageSize));

  const paginatedProducts = React.useMemo(
    () => displayProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, displayProducts, pageSize],
  );

  return {
    filteredProducts,
    groupedProducts,
    displayProducts,
    duplicateGroups,
    duplicateProductsCount,
    writeOffProducts,
    selectedWriteOffProduct,
    selectedWriteOffPackaging,
    visibleCategories,
    totalPages,
    paginatedProducts,
    isAggregateMode,
  };
}
