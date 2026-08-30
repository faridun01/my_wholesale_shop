import React, { useState } from 'react';
import toast from 'react-hot-toast';
import client from '../../api/client';
import { getProducts } from '../../api/products.api';
import { ceilMoney, roundMoney, toFixedNumber } from '../../utils/format';
import { formatProductName } from '../../utils/productName';
import {
  SALES_PAYMENT_EPSILON,
  getDefaultPackaging,
  normalizeDisplayBaseUnit,
  normalizePackagings,
  normalizeProductSearchValue,
} from '../../utils/salesViewUtils';
import type { EditInvoiceItem, EditProductOption } from './salesTypes';

type UseSalesEditInvoiceOptions = {
  selectedInvoice: any;
  setSelectedInvoice: React.Dispatch<React.SetStateAction<any>>;
  setInvoices: React.Dispatch<React.SetStateAction<any[]>>;
  isAdmin: boolean;
  user: any;
  fetchInvoices: () => Promise<void>;
};

const useSalesEditInvoice = ({
  selectedInvoice,
  setSelectedInvoice,
  setInvoices,
  isAdmin,
  user,
  fetchInvoices,
}: UseSalesEditInvoiceOptions) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCustomerId, setEditCustomerId] = useState<number | ''>('');
  const [editDiscount, setEditDiscount] = useState<string>('0');
  const [editInvoiceItems, setEditInvoiceItems] = useState<EditInvoiceItem[]>([]);
  const [editProducts, setEditProducts] = useState<any[]>([]);
  const [editInvoiceSearch, setEditInvoiceSearch] = useState('');
  const [openEditProductMenuKey, setOpenEditProductMenuKey] = useState<string | null>(null);
  const [editProductMenuSearch, setEditProductMenuSearch] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isEditItemsDirty, setIsEditItemsDirty] = useState(false);

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditCustomerId('');
    setEditDiscount('0');
    setEditInvoiceItems([]);
    setEditProducts([]);
    setEditInvoiceSearch('');
    setOpenEditProductMenuKey(null);
    setEditProductMenuSearch('');
    setIsEditItemsDirty(false);
  };

  const canEditInvoice = (invoice: any) => {
    if (!invoice) {
      return false;
    }

    // Not admin-exempt: the backend wipes Return rows and never reconciles paidAmount
    // when items are edited, so nobody — including admins — can safely edit an
    // invoice that already has a return or a payment recorded against it.
    const hasReturns = Array.isArray(invoice.returns) && invoice.returns.length > 0;
    const hasReturnedAmount = Number(invoice.returnedAmount || 0) > SALES_PAYMENT_EPSILON;
    if (hasReturns || hasReturnedAmount) {
      return false;
    }

    const hasPayments = Array.isArray(invoice.payments) && invoice.payments.length > 0;
    const hasPaidAmount = Number(invoice.paidAmount || 0) > SALES_PAYMENT_EPSILON;
    if (hasPayments || hasPaidAmount) {
      return false;
    }

    if (isAdmin) {
      return true;
    }

    if (invoice.cancelled) {
      return false;
    }

    if (Number(invoice.userId || 0) !== Number(user?.id || 0)) {
      return false;
    }

    return true;
  };

  const getEditBlockedReason = (invoice: any) => {
    if (!invoice) {
      return 'Накладную нельзя изменить';
    }

    if (Array.isArray(invoice.returns) && invoice.returns.length > 0) {
      return 'Накладную с возвратом нельзя изменить';
    }

    if (Number(invoice.returnedAmount || 0) > SALES_PAYMENT_EPSILON) {
      return 'Накладную с возвратом нельзя изменить';
    }

    if (Array.isArray(invoice.payments) && invoice.payments.length > 0) {
      return 'Оплаченную накладную нельзя изменить';
    }

    if (Number(invoice.paidAmount || 0) > SALES_PAYMENT_EPSILON) {
      return 'Оплаченную накладную нельзя изменить';
    }

    if (isAdmin) {
      return 'Администратор может изменить накладную';
    }

    if (Number(invoice.userId || 0) !== Number(user?.id || 0)) {
      return 'Можно редактировать только свои накладные';
    }

    if (invoice.cancelled) {
      return 'Отменённую накладную нельзя изменить';
    }

    return 'Накладную можно изменить';
  };

  const createEditInvoiceItem = (item?: any, productMeta?: any): EditInvoiceItem => {
    const product = productMeta || item?.product || null;
    const packagings = normalizePackagings(product);
    const defaultPackaging = getDefaultPackaging(packagings);
    const existingPackaging =
      item?.packagingId
        ? packagings.find((entry: any) => Number(entry.id) === Number(item.packagingId)) ||
          (item?.packageNameSnapshot && Number(item?.unitsPerPackageSnapshot || 0) > 0
            ? {
                id: Number(item.packagingId),
                packageName: String(item.packageNameSnapshot),
                baseUnitName: normalizeDisplayBaseUnit(
                  item?.baseUnitNameSnapshot || product?.baseUnitName || product?.unit || 'шт',
                ),
                unitsPerPackage: Number(item.unitsPerPackageSnapshot || 0),
                isDefault: false,
              }
            : null)
        : null;
    const isEmpty = !item && !product;
    const totalUnits =
      item?.totalBaseUnits !== undefined && item?.totalBaseUnits !== null
        ? Math.max(0, Number(item.totalBaseUnits) || 0)
        : item?.quantity !== undefined && item?.quantity !== null
          ? Math.max(0, Number(item.quantity) || 0)
          : isEmpty
            ? 0
            : defaultPackaging
              ? Number(defaultPackaging.unitsPerPackage || 0)
              : 1;
    const selectedPackaging = existingPackaging || defaultPackaging;
    const usePackaging = Boolean(selectedPackaging && Number(selectedPackaging.unitsPerPackage || 0) > 1);
    const unitsPerPackage = usePackaging ? Number(selectedPackaging?.unitsPerPackage || 0) : 0;
    const packageQuantity =
      item?.packageQuantity !== undefined && item?.packageQuantity !== null
        ? Math.max(0, Number(item.packageQuantity) || 0)
        : usePackaging && unitsPerPackage > 0
          ? Math.floor(totalUnits / unitsPerPackage)
          : 0;
    const extraUnitQuantity =
      item?.extraUnitQuantity !== undefined && item?.extraUnitQuantity !== null
        ? Math.max(0, Number(item.extraUnitQuantity) || 0)
        : usePackaging && unitsPerPackage > 0
          ? totalUnits % unitsPerPackage
          : totalUnits;
    const baseUnitName = normalizeDisplayBaseUnit(
      item?.unit || item?.baseUnitNameSnapshot || product?.baseUnitName || product?.unit || 'шт',
    );

    return {
      key: `${item?.id || 'new'}-${Math.random().toString(36).slice(2, 9)}`,
      productId: item?.productId ? Number(item.productId) : product?.id ? Number(product.id) : '',
      productSearch: String(item?.product_name || item?.productNameSnapshot || product?.name || ''),
      quantity: String(totalUnits),
      sellingPrice:
        item?.sellingPrice !== undefined && item?.sellingPrice !== null
          ? String(toFixedNumber(Number(item.sellingPrice)))
          : isEmpty
            ? ''
            : String(toFixedNumber(Number(product?.sellingPrice || 0))),
      unit: baseUnitName,
      baseUnitName,
      packagings: existingPackaging && !packagings.some((entry: any) => Number(entry.id) === Number(existingPackaging.id))
        ? [existingPackaging, ...packagings]
        : packagings,
      selectedPackagingId: usePackaging ? Number(selectedPackaging?.id || '') : '',
      packageQuantityInput: isEmpty ? '' : String(packageQuantity),
      extraUnitQuantityInput: isEmpty ? '' : String(extraUnitQuantity),
      discount: item?.discount !== undefined ? String(item.discount) : '',
      isNew: isEmpty,
    };
  };

  const getEditProductMeta = (productId: number | '') =>
    editProducts.find((product) => Number(product.id) === Number(productId));

  const findEditProductBySearch = (value: string) => {
    const normalized = normalizeProductSearchValue(value);
    if (!normalized) {
      return null;
    }

    return (
      editProducts.find((product) => normalizeProductSearchValue(product.name) === normalized) ||
      editProducts.find((product) => normalizeProductSearchValue(product.rawName) === normalized) ||
      editProducts.find((product) => normalizeProductSearchValue(product.name).includes(normalized)) ||
      editProducts.find((product) => normalizeProductSearchValue(product.rawName).includes(normalized)) ||
      null
    );
  };

  const updateEditInvoiceItem = (key: string, patch: Partial<EditInvoiceItem>) => {
    setEditInvoiceItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  };

  const getEditItemPackaging = (item: EditInvoiceItem) =>
    (Array.isArray(item.packagings) ? item.packagings : []).find((entry) => Number(entry.id) === Number(item.selectedPackagingId)) || null;

  const getEditItemDefaultBulkPackaging = (item: EditInvoiceItem) =>
    getDefaultPackaging((Array.isArray(item.packagings) ? item.packagings : []).filter((entry) => Number(entry.unitsPerPackage || 0) > 1));

  const normalizeEditInvoiceItem = (item: EditInvoiceItem): EditInvoiceItem => {
    const packaging = getEditItemPackaging(item);
    const unitsPerPackage = Number(packaging?.unitsPerPackage || 0);
    const packageQuantity = Math.max(0, Math.floor(Number(item.packageQuantityInput || 0) || 0));
    const extraUnitQuantity = Math.max(0, Number(item.extraUnitQuantityInput || 0) || 0);
    const totalUnits = packaging && unitsPerPackage > 0 ? packageQuantity * unitsPerPackage + extraUnitQuantity : extraUnitQuantity;

    return {
      ...item,
      quantity: String(totalUnits),
      baseUnitName: normalizeDisplayBaseUnit(item.baseUnitName || item.unit || 'шт'),
      unit: normalizeDisplayBaseUnit(item.baseUnitName || item.unit || 'шт'),
      packageQuantityInput: String(packageQuantity),
      extraUnitQuantityInput: String(extraUnitQuantity),
    };
  };

  const originalInvoiceQtyByProduct = React.useMemo(() => {
    const result = new Map<number, number>();
    for (const sourceItem of Array.isArray(selectedInvoice?.items) ? selectedInvoice.items : []) {
      const productId = Number(sourceItem?.productId);
      if (!productId) {
        continue;
      }

      const quantity = Math.max(0, Number(sourceItem?.totalBaseUnits ?? sourceItem?.quantity ?? 0));
      result.set(productId, (result.get(productId) || 0) + quantity);
    }

    return result;
  }, [selectedInvoice?.items]);

  const getAvailableForEditProduct = (productId: number | '') => {
    const numericProductId = Number(productId);
    if (!numericProductId) {
      return 0;
    }

    const product = getEditProductMeta(numericProductId);
    const availableNow = Math.max(0, Number(product?.stock || 0));
    const originalQty = Math.max(0, Number(originalInvoiceQtyByProduct.get(numericProductId) || 0));
    return availableNow + originalQty;
  };

  const getRequestedUnitsForProduct = (items: EditInvoiceItem[], productId: number, skipItemKey?: string) =>
    items.reduce((sum, currentItem) => {
      if (skipItemKey && currentItem.key === skipItemKey) {
        return sum;
      }

      if (Number(currentItem.productId) !== productId) {
        return sum;
      }

      return sum + Math.max(0, Number(normalizeEditInvoiceItem(currentItem).quantity || 0));
    }, 0);

  const applyEditItemQuantityCap = (item: EditInvoiceItem, allItems: EditInvoiceItem[]) => {
    const productId = Number(item.productId);
    const normalized = normalizeEditInvoiceItem(item);
    if (!productId) {
      return normalized;
    }

    const maxAvailableForProduct = getAvailableForEditProduct(productId);
    const requestedWithoutCurrent = getRequestedUnitsForProduct(allItems, productId, item.key);
    const maxAllowedForItem = Math.max(0, maxAvailableForProduct - requestedWithoutCurrent);
    const currentUnits = Math.max(0, Number(normalized.quantity || 0));

    if (currentUnits <= maxAllowedForItem) {
      return normalized;
    }

    const selectedPackaging = getEditItemPackaging(normalized);
    const unitsPerPackage = Math.max(0, Number(selectedPackaging?.unitsPerPackage || 0));

    if (selectedPackaging && unitsPerPackage > 0) {
      const packageQuantity = Math.floor(maxAllowedForItem / unitsPerPackage);
      const extraUnitQuantity = maxAllowedForItem % unitsPerPackage;
      return {
        ...normalized,
        quantity: String(maxAllowedForItem),
        packageQuantityInput: String(packageQuantity),
        extraUnitQuantityInput: String(extraUnitQuantity),
      };
    }

    return {
      ...normalized,
      quantity: String(maxAllowedForItem),
      extraUnitQuantityInput: String(maxAllowedForItem),
    };
  };

  const getEditItemMaxAllowedQuantity = (item: EditInvoiceItem, allItems: EditInvoiceItem[]) => {
    const productId = Number(item.productId);
    if (!productId) {
      return 0;
    }

    const maxAvailableForProduct = getAvailableForEditProduct(productId);
    const requestedWithoutCurrent = getRequestedUnitsForProduct(allItems, productId, item.key);
    return Math.max(0, maxAvailableForProduct - requestedWithoutCurrent);
  };

  const updateNormalizedEditInvoiceItem = (key: string, patch: Partial<EditInvoiceItem>) => {
    setIsEditItemsDirty(true);
    setEditInvoiceItems((current) =>
      current.map((item) => {
        if (item.key !== key) {
          return item;
        }

        return applyEditItemQuantityCap({ ...item, ...patch }, current);
      }),
    );
  };

  const selectEditProductForItem = (itemKey: string, product: EditProductOption) => {
    const packagings = normalizePackagings(product);
    const defaultPackaging = getDefaultPackaging(packagings);
    const usePackaging = Boolean(defaultPackaging && Number(defaultPackaging.unitsPerPackage || 0) > 1);

    updateNormalizedEditInvoiceItem(itemKey, {
      productSearch: formatProductName(product.name),
      productId: Number(product.id),
      sellingPrice: String(toFixedNumber(Number(product.sellingPrice || 0))),
      unit: normalizeDisplayBaseUnit(product.baseUnitName || product.unit || 'шт'),
      baseUnitName: normalizeDisplayBaseUnit(product.baseUnitName || product.unit || 'шт'),
      packagings,
      selectedPackagingId: usePackaging ? Number(defaultPackaging?.id || '') : '',
      packageQuantityInput: usePackaging ? '1' : '0',
      extraUnitQuantityInput: usePackaging ? '0' : '1',
      discount: '0',
      isNew: false,
    });
  };

  const addEditInvoiceItem = () => {
    setIsEditItemsDirty(true);
    setEditInvoiceItems((current) => [
      createEditInvoiceItem(),
      ...current,
    ]);
  };

  const removeEditInvoiceItem = (key: string) => {
    setIsEditItemsDirty(true);
    setEditInvoiceItems((current) => current.filter((item) => item.key !== key));
  };

  const filteredEditInvoiceItems = editInvoiceItems.filter((item) => {
    const query = editInvoiceSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }

    const product = getEditProductMeta(item.productId);
    const productName = String(product?.name || '').toLowerCase();
    return productName.includes(query) || String(item.productId || '').includes(query);
  });

  const editInvoiceSubtotal = React.useMemo(
    () =>
      editInvoiceItems.reduce((sum, item) => {
        const quantity = Number(item.quantity);
        const sellingPrice = Number(item.sellingPrice);
        const itemDiscount = Number(item.discount || 0);
        if (!Number.isFinite(quantity) || !Number.isFinite(sellingPrice) || quantity <= 0 || sellingPrice < 0) {
          return sum;
        }
        const unitPriceRounded = ceilMoney(sellingPrice * (1 - (Number.isFinite(itemDiscount) ? itemDiscount : 0) / 100));
        const itemDiscounted = quantity * unitPriceRounded;
        return sum + itemDiscounted;
      }, 0),
    [editInvoiceItems],
  );

  const editInvoiceDiscountAmount = React.useMemo(() => {
    const discountPercent = Number(editDiscount || 0);
    if (!Number.isFinite(discountPercent) || discountPercent <= 0) {
      return 0;
    }
    return roundMoney(editInvoiceSubtotal * (discountPercent / 100));
  }, [editInvoiceSubtotal, editDiscount]);

  const editInvoiceTaxAmount = React.useMemo(() => {
    const taxAmount = Number(selectedInvoice?.tax || 0);
    if (!Number.isFinite(taxAmount) || taxAmount <= 0) {
      return 0;
    }
    return taxAmount;
  }, [selectedInvoice?.tax]);

  const editInvoiceNetAmount = React.useMemo(
    () => roundMoney(Math.max(0, editInvoiceSubtotal - editInvoiceDiscountAmount + editInvoiceTaxAmount)),
    [editInvoiceDiscountAmount, editInvoiceSubtotal, editInvoiceTaxAmount],
  );

  const openEditInvoiceModal = async (invoice: any) => {
    if (!canEditInvoice(invoice)) {
      toast.error(getEditBlockedReason(invoice));
      return;
    }

    try {
      const res = await client.get(`/invoices/${invoice.id}`);
      const products = await getProducts(Number(res.data.warehouseId));
      setSelectedInvoice(res.data);
      setEditCustomerId(res.data.customerId || '');
      setEditDiscount(String(res.data.discount || 0));
      setEditProducts(Array.isArray(products) ? products : []);
      setEditInvoiceItems(
        Array.isArray(res.data.items) && res.data.items.length
          ? res.data.items.map((item: any) =>
              createEditInvoiceItem(
                item,
                (Array.isArray(products) ? products : []).find((product: any) => Number(product.id) === Number(item.productId)),
              ),
            )
          : [],
      );
      setIsEditItemsDirty(false);
      setShowEditModal(true);
    } catch (err) {
      toast.error('Ошибка при загрузке накладной');
    }
  };

  const handleUpdateInvoice = async () => {
    if (!selectedInvoice) return;

    if (editInvoiceItems.length === 0) {
      toast.error('Добавьте хотя бы один товар в накладную');
      return;
    }

    let payloadItems: any[] = [];

    try {
      payloadItems = editInvoiceItems.map((item) => {
        const normalizedItem = normalizeEditInvoiceItem(item);
        const quantity = Number(normalizedItem.quantity);
        const sellingPrice = Number(item.sellingPrice);
        const product = getEditProductMeta(normalizedItem.productId);

        if (!normalizedItem.productId || !product) {
          throw new Error('Выберите товар для каждой строки');
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(`Укажите корректное количество для "${product.name}"`);
        }

        if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
          throw new Error(`Укажите корректную цену продажи для "${product.name}"`);
        }

        return {
          productId: Number(normalizedItem.productId),
          quantity,
          totalBaseUnits: quantity,
          sellingPrice,
          packagingId: normalizedItem.selectedPackagingId ? Number(normalizedItem.selectedPackagingId) : null,
          packageQuantity: normalizedItem.selectedPackagingId ? Math.max(0, Number(normalizedItem.packageQuantityInput || 0) || 0) : null,
          extraUnitQuantity: Math.max(0, Number(normalizedItem.extraUnitQuantityInput || 0) || 0),
          packageName: normalizedItem.selectedPackagingId ? getEditItemPackaging(normalizedItem)?.packageName || null : null,
          unitsPerPackage: normalizedItem.selectedPackagingId ? Number(getEditItemPackaging(normalizedItem)?.unitsPerPackage || 0) || null : null,
          baseUnitName: normalizeDisplayBaseUnit(product.baseUnitName || product.unit || normalizedItem.baseUnitName || normalizedItem.unit || 'шт'),
          productName: product.name,
          rawName: product.rawName || null,
          brand: product.brand || null,
          discount: Number(item.discount || 0),
        };
      });
    } catch (error: any) {
      toast.error(error.message || 'Проверьте строки накладной');
      return;
    }

    const requestedByProduct = new Map<number, number>();
    for (const item of payloadItems) {
      const productId = Number(item.productId);
      const quantity = Math.max(0, Number(item.totalBaseUnits ?? item.quantity ?? 0));
      requestedByProduct.set(productId, (requestedByProduct.get(productId) || 0) + quantity);
    }

    const originalByProduct = new Map<number, number>();
    for (const item of Array.isArray(selectedInvoice.items) ? selectedInvoice.items : []) {
      const productId = Number(item.productId);
      const quantity = Math.max(0, Number(item.totalBaseUnits ?? item.quantity ?? 0));
      originalByProduct.set(productId, (originalByProduct.get(productId) || 0) + quantity);
    }

    for (const [productId, requestedQty] of requestedByProduct.entries()) {
      const product = getEditProductMeta(productId);
      const availableNow = Math.max(0, Number(product?.stock || 0));
      const originalQty = Math.max(0, Number(originalByProduct.get(productId) || 0));
      const availableForEdit = availableNow + originalQty;

      if (requestedQty > availableForEdit) {
        const productName = formatProductName(product?.name || `Товар #${productId}`);
        const unit = normalizeDisplayBaseUnit(product?.baseUnitName || product?.unit || 'шт');
        toast.error(
          `Нельзя продать больше остатка для "${productName}". Доступно: ${availableForEdit} ${unit}, запрошено: ${requestedQty} ${unit}`,
        );
        return;
      }
    }

    setIsSavingEdit(true);
    try {
      const res = await client.put(`/invoices/${selectedInvoice.id}`, {
        customerId: editCustomerId || null,
        items: payloadItems,
        discount: Number(editDiscount || 0),
      });
      const updatedInvoice = res.data;

      setInvoices((prev) => prev.map((inv) => inv.id === updatedInvoice.id ? {
        ...updatedInvoice,
        customer_name: updatedInvoice.customer_name || inv.customer_name,
        staff_name: updatedInvoice.staff_name || inv.staff_name,
      } : inv));

      setSelectedInvoice(updatedInvoice);
      toast.success('Накладная обновлена');
      closeEditModal();
      await fetchInvoices();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при обновлении продажи');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return {
    showEditModal,
    editCustomerId,
    editDiscount,
    editInvoiceItems,
    editProducts,
    editInvoiceSearch,
    openEditProductMenuKey,
    editProductMenuSearch,
    isSavingEdit,
    isEditItemsDirty,
    filteredEditInvoiceItems,
    editInvoiceSubtotal,
    editInvoiceDiscountAmount,
    editInvoiceTaxAmount,
    editInvoiceNetAmount,
    setEditCustomerId,
    setEditDiscount,
    setEditInvoiceSearch,
    setOpenEditProductMenuKey,
    setEditProductMenuSearch,
    closeEditModal,
    canEditInvoice,
    getEditBlockedReason,
    getEditProductMeta,
    findEditProductBySearch,
    updateEditInvoiceItem,
    getEditItemPackaging,
    getEditItemDefaultBulkPackaging,
    getEditItemMaxAllowedQuantity,
    updateNormalizedEditInvoiceItem,
    selectEditProductForItem,
    addEditInvoiceItem,
    removeEditInvoiceItem,
    openEditInvoiceModal,
    handleUpdateInvoice,
  };
};

export default useSalesEditInvoice;
