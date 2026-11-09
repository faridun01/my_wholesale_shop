import React from 'react';
import toast from 'react-hot-toast';
import {
  deleteProductBatch,
  deleteWriteOffTransactionPermanently,
  getProductBatches,
  getProductHistory,
  returnWriteOffTransaction,
  reverseCorrectionWriteOffTransaction,
  reverseIncomingTransaction,
  updateProductBatchCost,
  writeOffProduct,
} from '../../api/products.api';
import { parseMoneyInput } from '../../utils/format';
import { submitWithCostConfirmation } from '../../utils/productsViewUtils';

type WriteOffData = {
  productId: string;
  quantity: string;
  reason: string;
};

type ReturnWriteOffData = {
  quantity: string;
  reason: string;
};

type UseProductMovementActionsOptions = {
  selectedWarehouseId: string;
  selectedProduct: any;
  selectedWriteOffProduct: any;
  selectedHistoryTransaction: any;
  writeOffData: WriteOffData;
  returnWriteOffData: ReturnWriteOffData;
  setSelectedProduct: React.Dispatch<React.SetStateAction<any>>;
  setSelectedHistoryTransaction: React.Dispatch<React.SetStateAction<any>>;
  setProductHistory: React.Dispatch<React.SetStateAction<any[]>>;
  setProductBatches: React.Dispatch<React.SetStateAction<any[]>>;
  setWriteOffData: React.Dispatch<React.SetStateAction<WriteOffData>>;
  setReturnWriteOffData: React.Dispatch<React.SetStateAction<ReturnWriteOffData>>;
  setShowHistoryModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowBatchesModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowWriteOffModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowReturnWriteOffModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowDeleteWriteOffConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  closeWriteOffModal: () => void;
  closeReturnWriteOffModal: () => void;
  closeDeleteWriteOffConfirm: () => void;
  fetchInitialData: (warehouseIdOverride?: string) => Promise<void>;
};

const useProductMovementActions = ({
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
}: UseProductMovementActionsOptions) => {
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

  const handleUpdateBatchCost = async (batchId: number, value: string) => {
    const purchaseCostPrice = parseMoneyInput(value);
    if (purchaseCostPrice === null || purchaseCostPrice <= 0) {
      toast.error('Введите цену закупки больше нуля');
      return false;
    }

    try {
      await submitWithCostConfirmation((confirmCostAboveSelling) =>
        updateProductBatchCost(batchId, { purchaseCostPrice, confirmCostAboveSelling }),
      );
      await Promise.allSettled([refreshSelectedProductBatches(), fetchInitialData()]);
      toast.success('Цена закупки обновлена');
      return true;
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при изменении цены');
      return false;
    }
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

  const handleReverseCorrectionWriteOff = async (transactionId: number) => {
    if (!selectedProduct || !transactionId) return;

    const confirmed = window.confirm(
      'Отменить корректировочное списание? Система вернёт товар на склад и восстановит приход по этой корректировке.'
    );
    if (!confirmed) {
      return;
    }

    try {
      await reverseCorrectionWriteOffTransaction(transactionId);
      const history = await getProductHistory(selectedProduct.id);
      setProductHistory(history);
      await fetchInitialData();
      toast.success('Корректировочное списание успешно отменено');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Не удалось отменить корректировку');
    }
  };

  const handleOpenReturnWriteOffModal = (transaction: any) => {
    const originalQuantity = Math.abs(Number(transaction?.qtyChange || 0));
    if (!transaction?.transactionId || originalQuantity <= 0) {
      toast.error('Некорректное списание для возврата');
      return;
    }

    setSelectedHistoryTransaction(transaction);
    setReturnWriteOffData({
      quantity: String(originalQuantity),
      reason: 'ошибка ввода',
    });
    setShowReturnWriteOffModal(true);
  };

  const handleSubmitReturnWriteOff = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedProduct?.id || !selectedHistoryTransaction?.transactionId) {
      return;
    }

    const quantity = Number(String(returnWriteOffData.quantity || '').trim());
    const reason = String(returnWriteOffData.reason || '').trim();

    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Введите целое количество для возврата');
      return;
    }

    try {
      await returnWriteOffTransaction(Number(selectedHistoryTransaction.transactionId), { quantity, reason });
      const history = await getProductHistory(selectedProduct.id);
      setProductHistory(history);
      await fetchInitialData();
      closeReturnWriteOffModal();
      toast.success('Списание возвращено на склад');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Не удалось вернуть списание');
    }
  };

  const handleOpenDeleteWriteOffConfirm = (transaction: any) => {
    if (!transaction?.transactionId) {
      toast.error('Некорректное списание для удаления');
      return;
    }

    setSelectedHistoryTransaction(transaction);
    setShowDeleteWriteOffConfirm(true);
  };

  const handleDeleteWriteOffPermanently = async () => {
    if (!selectedProduct?.id || !selectedHistoryTransaction?.transactionId) {
      return;
    }

    try {
      await deleteWriteOffTransactionPermanently(Number(selectedHistoryTransaction.transactionId));
      const history = await getProductHistory(selectedProduct.id);
      setProductHistory(history);
      await fetchInitialData();
      closeDeleteWriteOffConfirm();
      toast.success('Списание отменено, история сохранена');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Не удалось удалить списание');
    }
  };

  const handleOpenWriteOffModal = (productArg?: any) => {
    if (!selectedWarehouseId) {
      toast.error('Сначала выберите склад');
      return;
    }

    const baseProduct = productArg || selectedProduct;
    if (!baseProduct?.id) {
      toast.error('Выберите товар из списка и нажмите списание');
      return;
    }

    const availableStock = Number(baseProduct.stock || 0);
    if (availableStock <= 0) {
      toast.error('У этого товара нет остатка для списания');
      return;
    }

    setSelectedProduct(baseProduct);
    setWriteOffData({
      productId: String(baseProduct.id),
      quantity: String(Math.min(1, availableStock) || 1),
      reason: 'брак',
    });
    setShowWriteOffModal(true);
  };

  const handleSubmitWriteOff = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedWriteOffProduct?.id) {
      return;
    }

    const quantity = Number(String(writeOffData.quantity || '').trim());
    const reason = String(writeOffData.reason || '').trim();
    const availableStock = Number(selectedWriteOffProduct.stock || 0);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Введите целое количество для списания');
      return;
    }

    if (quantity > availableStock) {
      toast.error(`Нельзя списать больше остатка. Сейчас доступно: ${availableStock}`);
      return;
    }

    if (!reason) {
      toast.error('Нужно указать причину списания');
      return;
    }

    try {
      await writeOffProduct(selectedWriteOffProduct.id, { quantity, reason });
      const history = await getProductHistory(selectedWriteOffProduct.id);
      if (selectedProduct?.id === selectedWriteOffProduct.id) {
        setProductHistory(history);
      }
      await fetchInitialData();
      setSelectedProduct((prev: any) => (
        prev && prev.id === selectedWriteOffProduct.id
          ? { ...prev, stock: Math.max(0, Number(prev.stock || 0) - quantity) }
          : prev
      ));
      closeWriteOffModal();
      toast.success('Списание успешно проведено');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || err.message || 'Не удалось выполнить списание');
    }
  };

  const handleSetWriteOffQuantity = (value: number) => {
    if (!selectedWriteOffProduct) {
      return;
    }

    const availableStock = Number(selectedWriteOffProduct.stock || 0);
    const nextValue = Math.max(0, Math.min(value, availableStock));
    setWriteOffData((prev) => ({ ...prev, quantity: String(nextValue) }));
  };

  return {
    handleShowHistory,
    handleShowBatches,
    handleDeleteBatch,
    handleUpdateBatchCost,
    handleReverseIncoming,
    handleReverseCorrectionWriteOff,
    handleOpenReturnWriteOffModal,
    handleSubmitReturnWriteOff,
    handleOpenDeleteWriteOffConfirm,
    handleDeleteWriteOffPermanently,
    handleOpenWriteOffModal,
    handleSubmitWriteOff,
    handleSetWriteOffQuantity,
  };
};

export default useProductMovementActions;
