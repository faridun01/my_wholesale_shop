import React from 'react';
import toast from 'react-hot-toast';
import { createProduct, deleteProduct, updateProduct } from '../../api/products.api';
import { createSettingsCategory } from '../../api/settings-reference.api';
import { buildProductSubmitPayload, submitWithCostConfirmation, type ProductFormData } from '../../utils/productsViewUtils';

type UseProductCrudActionsOptions = {
  formData: ProductFormData;
  categoryInput: string;
  visibleCategories: any[];
  categories: any[];
  selectedProduct: any;
  setCategories: React.Dispatch<React.SetStateAction<any[]>>;
  setCategoryInput: React.Dispatch<React.SetStateAction<string>>;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  setShowAddModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowEditModal: React.Dispatch<React.SetStateAction<boolean>>;
  resetForm: () => void;
  fetchInitialData: (warehouseIdOverride?: string) => Promise<void>;
  closeDeleteConfirm: () => void;
};

const useProductCrudActions = ({
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
}: UseProductCrudActionsOptions) => {
  const resolveCategoryIdForSubmit = async () => {
    const typedCategoryName = String(categoryInput || '').trim();
    const existingCategory = visibleCategories.find(
      (category) => String(category?.name || '').trim().toLowerCase() === typedCategoryName.toLowerCase()
    );

    if (existingCategory?.id) {
      return Number(existingCategory.id);
    }

    if (formData.categoryId) {
      return Number(formData.categoryId);
    }

    if (!typedCategoryName) {
      throw new Error('Укажите категорию');
    }

    const createdCategory = await createSettingsCategory(typedCategoryName);
    setCategories([...categories, createdCategory]);
    setCategoryInput(String(createdCategory?.name || typedCategoryName));
    setFormData((prev) => ({ ...prev, categoryId: String(createdCategory?.id || '') }));
    return Number(createdCategory.id);
  };

  const handleAddProduct = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      const categoryId = await resolveCategoryIdForSubmit();
      await submitWithCostConfirmation((confirmCostAboveSelling) =>
        createProduct({ ...buildProductSubmitPayload(formData, categoryId), confirmCostAboveSelling }),
      );
      toast.success('Товар успешно добавлен!');
      setShowAddModal(false);
      resetForm();
      void fetchInitialData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при добавлении товара');
    }
  };

  const handleEditProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProduct) return;

    try {
      const categoryId = await resolveCategoryIdForSubmit();
      await updateProduct(selectedProduct.id, buildProductSubmitPayload(formData, categoryId));
      toast.success('Товар успешно обновлён!');
      setShowEditModal(false);
      resetForm();
      void fetchInitialData();
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

  return {
    handleAddProduct,
    handleEditProduct,
    handleConfirmDeleteProduct,
  };
};

export default useProductCrudActions;
