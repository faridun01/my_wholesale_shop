import React from 'react';
import toast from 'react-hot-toast';
import { restockProduct } from '../../api/products.api';
import { roundMoney } from '../../utils/format';
import {
  formatPriceInput,
  getDefaultPackaging,
  normalizePackagings,
} from '../../utils/productsViewUtils';

type RestockData = {
  warehouseId: string;
  quantity: string;
  selectedPackagingId: string;
  packageQuantityInput: string;
  costPrice: string;
  sellingPrice: string;
  expensePercent: string;
  reason: string;
};

type UseProductRestockActionsOptions = {
  selectedProduct: any;
  restockData: RestockData;
  setSelectedProduct: React.Dispatch<React.SetStateAction<any>>;
  setRestockData: React.Dispatch<React.SetStateAction<RestockData>>;
  setShowRestockModal: React.Dispatch<React.SetStateAction<boolean>>;
  closeRestockModal: () => void;
  fetchInitialData: (warehouseIdOverride?: string) => Promise<void>;
};

const useProductRestockActions = ({
  selectedProduct,
  restockData,
  setSelectedProduct,
  setRestockData,
  setShowRestockModal,
  closeRestockModal,
  fetchInitialData,
}: UseProductRestockActionsOptions) => {
  const restockPackagings = normalizePackagings(selectedProduct);
  const selectedRestockPackaging =
    restockPackagings.find((entry) => String(entry.id) === String(restockData.selectedPackagingId || '')) || null;
  const restockPackageQuantity = Math.max(0, Math.floor(Number(restockData.packageQuantityInput || 0) || 0));
  const totalRestockUnits =
    selectedRestockPackaging && selectedRestockPackaging.unitsPerPackage > 0
      ? restockPackageQuantity * selectedRestockPackaging.unitsPerPackage + Math.max(0, Number(restockData.quantity || 0))
      : Number(restockData.quantity || 0);

  const openRestockProductModal = (product: any) => {
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
      expensePercent: String(product.expensePercent ?? 0),
      reason: '',
    });
    setShowRestockModal(true);
  };

  const handleRestock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProduct) return;

    try {
      await restockProduct(selectedProduct.id, {
        warehouseId: Number(restockData.warehouseId),
        quantity: selectedRestockPackaging ? totalRestockUnits : Number(restockData.quantity),
        costPrice: roundMoney(restockData.costPrice),
        purchaseCostPrice: roundMoney(restockData.costPrice),
        sellingPrice: roundMoney(restockData.sellingPrice || 0),
        expensePercent: Number(restockData.expensePercent || 0),
        reason: restockData.reason,
      });
      toast.success('Товар успешно пополнен!');
      closeRestockModal();
      void fetchInitialData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при пополнении товара');
    }
  };

  return {
    restockPackagings,
    selectedRestockPackaging,
    totalRestockUnits,
    openRestockProductModal,
    handleRestock,
  };
};

export default useProductRestockActions;
