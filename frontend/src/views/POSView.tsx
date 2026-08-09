import React, { startTransition, useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { getProducts } from '../api/products.api';
import { createInvoice } from '../api/invoices.api';
import { getCustomers } from '../api/customers.api';
import { getWarehouses } from '../api/warehouses.api';
import { createCustomerOrder } from '../api/customer-orders.api';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { filterWarehousesForUser, getCurrentUser, getUserCustomerId, getUserWarehouseId, isAdminUser, isCustomerUser } from '../utils/userAccess';
import { formatMoney, roundMoney, ceilMoney, toFixedNumber } from '../utils/format';
import { getDefaultWarehouseId } from '../utils/warehouse';
import { type CartItem, type PackagingOption } from '../components/pos/POSCartItem';
import POSCartSummary from '../components/pos/POSCartSummary';
import POSCartCustomerBlock from '../components/pos/POSCartCustomerBlock';
import POSCartHeader from '../components/pos/POSCartHeader';
import POSCartItemsList from '../components/pos/POSCartItemsList';
import POSProductList from '../components/pos/POSProductList';

type PaymentMethod = 'cash' | 'card' | 'transfer';
function tone(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

function getStoredWarehouseId() {
  if (typeof window === 'undefined') {
    return '';
  }

  return sessionStorage.getItem('pos_warehouse_session') || localStorage.getItem('pos_warehouse_session') || '';
}

const posTheme = {
  products: {
    soft: 'bg-[#eef3f8]',
    icon: 'bg-[#dbe7f3] text-[#23527c]',
    accent: 'border border-[#7f9db9] bg-[#eaf2fb] text-[#1f3f63] hover:bg-[#dbeafd]',
    tab: 'border border-[#9fb7d5] bg-[#dbeafd] text-[#143a5a]',
    pill: 'bg-[#eaf2fb] text-[#23527c]',
  },
  cart: {
    soft: 'bg-[#fff7d6]',
    icon: 'bg-[#fff0b3] text-[#7a5a00]',
    accent: 'border border-[#c8a64a] bg-[#ffe184] text-[#2f2f2f] hover:bg-[#ffd45f]',
    tab: 'border border-[#c8a64a] bg-[#ffe184] text-[#2f2f2f]',
    pill: 'bg-[#fff0b3] text-[#7a5a00]',
  },
  payment: {
    active: 'border-[#b08a28] bg-[#ffd966] text-[#2f2f2f]',
    idle: 'border-[#c8d2df] bg-[#f5f7fa] text-[#32465a]',
    summary: 'bg-[#fff8dc]',
  },
};

const normalizePackagings = (product: any): PackagingOption[] =>
  Array.isArray(product?.packagings)
    ? product.packagings
        .map((entry: any) => ({
          id: Number(entry.id),
          packageName: String(entry.packageName || '').trim(),
          baseUnitName: normalizeDisplayBaseUnit(String(entry.baseUnitName || product?.baseUnitName || product?.unit || '\u0448\u0442')),
          unitsPerPackage: Number(entry.unitsPerPackage || 0),
          isDefault: Boolean(entry.isDefault),
        }))
        .filter((entry: PackagingOption) => entry.id > 0 && entry.packageName && entry.unitsPerPackage > 0)
    : [];

const getDefaultPackaging = (packagings: PackagingOption[]) =>
  packagings.find((entry) => entry.isDefault) || packagings[0] || null;

const clampDiscountPercent = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(100, Math.max(0, numeric));
};

const normalizeMoneyValue = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Object.is(value, -0) ? 0 : value;
};

const normalizeDisplayBaseUnit = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '\u0448\u0442';
  if (['\u043f\u0430\u0447\u043a\u0430', '\u043f\u0430\u0447\u043a\u0438', '\u043f\u0430\u0447\u0435\u043a', '\u0448\u0442', '\u0448\u0442\u0443\u043a', '\u0448\u0442\u0443\u043a\u0430', '\u0448\u0442\u0443\u043a\u0438', 'pcs', 'piece', 'pieces'].includes(normalized)) {
    return '\u0448\u0442';
  }
  return normalized;
};

const formatStockAmount = (stock: number, packaging: PackagingOption | null, baseUnitName: string) => {
  const normalizedStock = Math.max(0, Number(stock) || 0);
  const normalizedBaseUnit = normalizeDisplayBaseUnit(baseUnitName || '\u0448\u0442');

  if (!packaging || Number(packaging.unitsPerPackage || 0) <= 1) {
    return `${normalizedStock} ${normalizedBaseUnit}`;
  }

  const unitsPerPackage = Number(packaging.unitsPerPackage || 0);
  const packageQuantity = Math.floor(normalizedStock / unitsPerPackage);
  const extraUnits = normalizedStock % unitsPerPackage;

  if (packageQuantity > 0 && extraUnits > 0) {
    return `${packageQuantity} ${packaging.packageName} + ${extraUnits} ${normalizedBaseUnit}`;
  }

  if (packageQuantity > 0) {
    return `${packageQuantity} ${packaging.packageName}`;
  }

  return `${extraUnits} ${normalizedBaseUnit}`;
};

const WEIGHT_TOKEN_REGEX = /(^|[\s()[\]{}.,;:+\-_/\\*xх×])(\d+(?:[.,]\d+)?)\s*(кг\.?|килограмм(?:а|ов)?|kgs?|гр\.?|г\.?|grams?|g|л\.?|литр(?:а|ов)?|l|мл\.?|ml|milliliters?)(?=$|[\s()[\]{}.,;:+\-_/\\*xх×])/giu;

const getProductUnitWeightKg = (product: any) => {
  const explicitWeight = Number(String(product?.weightKg ?? product?.unitWeightKg ?? product?.weight_kg ?? product?.unit_weight_kg ?? '').replace(',', '.'));
  if (Number.isFinite(explicitWeight) && explicitWeight > 0) {
    return explicitWeight;
  }

  const text = String(product?.rawName || product?.name || '');
  let match: RegExpExecArray | null;
  let maxWeightKg = 0;
  WEIGHT_TOKEN_REGEX.lastIndex = 0;

  while ((match = WEIGHT_TOKEN_REGEX.exec(text)) !== null) {
    const numericValue = Number(String(match[2] || '').replace(',', '.'));
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      continue;
    }

    const unit = String(match[3] || '').toLowerCase();
    const weightKg =
      unit.startsWith('кг') || unit.startsWith('kg') || unit.startsWith('килограмм') || unit === 'л' || unit.startsWith('литр') || unit === 'l'
        ? numericValue
        : numericValue / 1000;

    maxWeightKg = Math.max(maxWeightKg, weightKg);
  }

  return maxWeightKg;
};

const formatWeightKg = (value: unknown) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '0 кг';
  }

  return `${new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(numeric)} кг`;
};

const getProductStockLabel = (product: any, fallbackBaseUnitName?: string) => {
  const packagings = normalizePackagings(product);
  const defaultPackaging = getDefaultPackaging(packagings);
  const baseUnitName = normalizeDisplayBaseUnit(
    String(product?.baseUnitName || product?.unit || fallbackBaseUnitName || defaultPackaging?.baseUnitName || '\u0448\u0442'),
  );

  return formatStockAmount(Number(product?.stock || 0), defaultPackaging, baseUnitName);
};

const getProductStockParts = (product: any, fallbackBaseUnitName?: string) => {
  const packagings = normalizePackagings(product);
  const defaultPackaging = getDefaultPackaging(packagings);
  const baseUnitName = normalizeDisplayBaseUnit(
    String(product?.baseUnitName || product?.unit || fallbackBaseUnitName || defaultPackaging?.baseUnitName || '\u0448\u0442'),
  );
  const stock = Math.max(0, Number(product?.stock || 0));

  if (!defaultPackaging || Number(defaultPackaging.unitsPerPackage || 0) <= 1) {
    return {
      primary: `${stock} ${baseUnitName}`,
      secondary: '',
    };
  }

  const unitsPerPackage = Number(defaultPackaging.unitsPerPackage || 0);
  const packageQuantity = Math.floor(stock / unitsPerPackage);
  const extraUnits = stock % unitsPerPackage;

  if (packageQuantity > 0 && extraUnits > 0) {
    return {
      primary: `${packageQuantity} ${defaultPackaging.packageName}`,
      secondary: `+ ${extraUnits} ${baseUnitName}`,
    };
  }

  if (packageQuantity > 0) {
    return {
      primary: `${packageQuantity} ${defaultPackaging.packageName}`,
      secondary: '',
    };
  }

  return {
    primary: `${extraUnits} ${baseUnitName}`,
    secondary: '',
  };
};

export default function POSView() {
  const cartStorageKey = 'pos_cart_session';
  const pendingCartStorageKey = 'pending_cart';
  const warehouseStorageKey = 'pos_warehouse_session';
  const navigate = useNavigate();
  const hasLoadedReferenceDataRef = useRef(false);
  const user = React.useMemo(() => getCurrentUser(), []);
  const isAdmin = isAdminUser(user);
  const isCustomerPortal = isCustomerUser(user);
  const userWarehouseId = getUserWarehouseId(user);
  const userCustomerId = getUserCustomerId(user);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState(() => {
    return getStoredWarehouseId() || (userWarehouseId ? String(userWarehouseId) : '');
  });
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discount, setDiscount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'cart'>('products');
  const [isCartExpanded, setIsCartExpanded] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [highlightedProductId, setHighlightedProductId] = useState<number | null>(null);
  const [isStorageHydrated, setIsStorageHydrated] = useState(false);
  const [pendingWarehouseId, setPendingWarehouseId] = useState<string | null>(null);
  const productListRef = useRef<HTMLDivElement | null>(null);
  const lastProductScrollRef = useRef(0);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deferredProductSearch = useDeferredValue(productSearch);
  const deferredCustomerSearch = useDeferredValue(customerSearch);

  const highlightProductRow = (productId: number | null) => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }

    setHighlightedProductId(productId);
    if (productId !== null) {
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedProductId((current) => (current === productId ? null : current));
      }, 1000);
    }
  };

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const getCartPackaging = (item: CartItem) =>
    (Array.isArray(item.packagings) ? item.packagings : []).find((entry) => entry.id === item.selectedPackagingId) || null;

  const getAvailableStockForCartItem = (item: CartItem) => {
    const currentProduct = products.find((product) => product.id === item.id);
    return Math.max(0, Number(currentProduct?.stock ?? item.stock ?? 0) || 0);
  };

  const isPackagingAvailableForCartItem = (item: CartItem, packaging: PackagingOption | null) => {
    const unitsPerPackage = Number(packaging?.unitsPerPackage || 0);
    return Boolean(packaging && unitsPerPackage > 0 && getAvailableStockForCartItem(item) >= unitsPerPackage);
  };

  const getPackageBlockedMessage = (item: CartItem, packaging: PackagingOption | null) => {
    const unitsPerPackage = Number(packaging?.unitsPerPackage || 0);
    const packageName = packaging?.packageName || 'коробка';
    const availableStock = getAvailableStockForCartItem(item);
    return `Нельзя продать ${packageName}: в коробке ${unitsPerPackage} ${item.baseUnitName}, доступно только ${availableStock} ${item.baseUnitName}.`;
  };

  const warnStockOverflow = (item: CartItem, availableStock: number) => {
    const currentProduct = products.find((product) => product.id === item.id);
    toast.error(
      `Нельзя продать больше остатка. Доступно: ${getProductStockLabel(currentProduct || item, item.baseUnitName || item.unit)}`,
      { id: `stock-overflow-${item.id}` },
    );
  };

  const getCartOverflowMessage = (item: CartItem) => {
    const currentProduct = products.find((product) => product.id === item.id);
    const sourceProduct = currentProduct || item;
    return `Нельзя продать больше остатка. Доступно: ${getProductStockLabel(sourceProduct, item.baseUnitName || item.unit)}`;
  };

  const getCartStockSummary = (item: CartItem) => {
    const currentProduct = products.find((product) => product.id === item.id);
    const sourceProduct = currentProduct || item;
    const availableStock = getAvailableStockForCartItem(item);
    const remainingStock = Math.max(0, availableStock - Math.max(0, Number(item.quantity || 0)));

    return {
      availableLabel: getProductStockLabel(sourceProduct, item.baseUnitName || item.unit),
      remainingLabel: getProductStockLabel({ ...sourceProduct, stock: remainingStock }, item.baseUnitName || item.unit),
    };
  };

  const normalizeCartItem = (item: CartItem, overrides: Partial<CartItem> = {}) => {
    const merged = { ...item, ...overrides };
    const availableStock = getAvailableStockForCartItem(merged as CartItem);
    let packaging = merged.packagings.find((entry) => entry.id === merged.selectedPackagingId) || null;
    let unitsPerPackage = packaging?.unitsPerPackage || 0;
    let packageQuantity = Math.max(0, Math.floor(Number(merged.packageQuantity || 0)));
    let extraUnitQuantity = Math.max(0, Number(merged.extraUnitQuantity || 0));

    if (packaging && unitsPerPackage > availableStock) {
      packaging = null;
      unitsPerPackage = 0;
      packageQuantity = 0;
      extraUnitQuantity = Math.min(Math.max(1, extraUnitQuantity || Number(merged.quantity || 1)), Math.max(availableStock, 1));
    }

    if (!packaging) {
      packageQuantity = 0;
    } else {
      extraUnitQuantity = 0;
    }

    let totalBaseUnits = packageQuantity * unitsPerPackage + extraUnitQuantity;

    if (totalBaseUnits > availableStock) {
      if (packaging && unitsPerPackage > 0) {
        packageQuantity = Math.floor(availableStock / unitsPerPackage);
        extraUnitQuantity = 0;
      } else {
        packageQuantity = 0;
        extraUnitQuantity = availableStock;
      }

      totalBaseUnits = packageQuantity * unitsPerPackage + extraUnitQuantity;
    }

    if (totalBaseUnits <= 0) {
      if (packaging && unitsPerPackage > 0) {
        if (availableStock >= unitsPerPackage) {
          packageQuantity = 1;
          extraUnitQuantity = 0;
          totalBaseUnits = unitsPerPackage;
        } else {
          packageQuantity = 0;
          extraUnitQuantity = 0;
          totalBaseUnits = 0;
        }
      } else {
        packageQuantity = 0;
        extraUnitQuantity = Math.min(Math.max(1, extraUnitQuantity), Math.max(availableStock, 1));
        totalBaseUnits = extraUnitQuantity;
      }
    }

    const normalizedLineDiscount = clampDiscountPercent(merged.lineDiscountPercent || 0);

    return {
      ...merged,
      stock: availableStock,
      selectedPackagingId: packaging?.id ?? null,
      packageQuantity,
      extraUnitQuantity,
      quantity: totalBaseUnits,
      packageQuantityInput: overrides.packageQuantityInput !== undefined ? overrides.packageQuantityInput : String(packageQuantity),
      extraUnitQuantityInput: packaging ? '0' : (overrides.extraUnitQuantityInput !== undefined ? overrides.extraUnitQuantityInput : String(extraUnitQuantity)),
      lineDiscountPercent: normalizedLineDiscount,
      lineDiscountInput:
        overrides.lineDiscountInput !== undefined
          ? overrides.lineDiscountInput
          : (merged.lineDiscountInput ?? (normalizedLineDiscount > 0 ? String(normalizedLineDiscount) : '')),
    };
  };

  const createCartItemFromProduct = (product: any): CartItem => {
    const packagings = normalizePackagings(product);
    const defaultPackaging = getDefaultPackaging(packagings);
    const baseUnitName = normalizeDisplayBaseUnit(String(product.baseUnitName || product.unit || defaultPackaging?.baseUnitName || '\u0448\u0442'));
    const initialItem: CartItem = {
      ...product,
      quantity: defaultPackaging && Number(product.stock || 0) >= defaultPackaging.unitsPerPackage ? defaultPackaging.unitsPerPackage : 1,
      stock: Number(product.stock || 0),
      unit: baseUnitName,
      baseUnitName,
      packagings,
      selectedPackagingId: defaultPackaging && Number(product.stock || 0) >= defaultPackaging.unitsPerPackage ? defaultPackaging.id : null,
      packageQuantity: defaultPackaging && Number(product.stock || 0) >= defaultPackaging.unitsPerPackage ? 1 : 0,
      packageQuantityInput: defaultPackaging && Number(product.stock || 0) >= defaultPackaging.unitsPerPackage ? '1' : '0',
      extraUnitQuantity: defaultPackaging && Number(product.stock || 0) >= defaultPackaging.unitsPerPackage ? 0 : 1,
      extraUnitQuantityInput: defaultPackaging && Number(product.stock || 0) >= defaultPackaging.unitsPerPackage ? '0' : '1',
      lineDiscountPercent: 0,
      lineDiscountInput: '',
    };

    return normalizeCartItem(initialItem);
  };

  useEffect(() => {
    const savedCart =
      sessionStorage.getItem(cartStorageKey) ||
      localStorage.getItem(cartStorageKey);
    const pendingCart =
      sessionStorage.getItem(pendingCartStorageKey) ||
      localStorage.getItem(pendingCartStorageKey);

    if (savedCart) {
      const parsedSavedCart = JSON.parse(savedCart);
      setCart(
        Array.isArray(parsedSavedCart)
          ? parsedSavedCart.map((item) => ({
              ...item,
              lineDiscountPercent: clampDiscountPercent(item?.lineDiscountPercent || 0),
              lineDiscountInput:
                item?.lineDiscountInput !== undefined
                  ? item.lineDiscountInput
                  : (clampDiscountPercent(item?.lineDiscountPercent || 0) > 0
                    ? String(clampDiscountPercent(item?.lineDiscountPercent || 0))
                    : ''),
            }))
          : [],
      );
    }

    if (pendingCart) {
      const parsedPendingCart = JSON.parse(pendingCart);
      const normalizedPendingCart = Array.isArray(parsedPendingCart)
        ? parsedPendingCart.map((item) => ({
            ...item,
            lineDiscountPercent: clampDiscountPercent(item?.lineDiscountPercent || 0),
            lineDiscountInput:
              item?.lineDiscountInput !== undefined
                ? item.lineDiscountInput
                : (clampDiscountPercent(item?.lineDiscountPercent || 0) > 0
                  ? String(clampDiscountPercent(item?.lineDiscountPercent || 0))
                  : ''),
          }))
        : [];
      setCart(normalizedPendingCart);
      sessionStorage.setItem(cartStorageKey, JSON.stringify(normalizedPendingCart));
      localStorage.setItem(cartStorageKey, JSON.stringify(normalizedPendingCart));
      sessionStorage.removeItem(pendingCartStorageKey);
      localStorage.removeItem(pendingCartStorageKey);
    }

    setIsStorageHydrated(true);
  }, []);

  useEffect(() => {
    const effectiveWarehouseId = warehouseId || (userWarehouseId ? String(userWarehouseId) : '');

    if (!effectiveWarehouseId) {
      setProducts([]);
      return;
    }

    getProducts(effectiveWarehouseId ? Number(effectiveWarehouseId) : undefined)
      .then((data) => {
        const normalizedProducts = Array.isArray(data) ? data : [];
        setProducts(
          normalizedProducts.filter((product) => Number(product?.warehouseId) === Number(effectiveWarehouseId)),
        );
      })
      .catch(console.error);
  }, [warehouseId, userWarehouseId]);

  useEffect(() => {
    if (!products.length) {
      return;
    }

    setCart((currentCart) =>
      currentCart.map((item) => {
        const product = products.find((entry) => entry.id === item.id);
        if (!product) {
          return item;
        }

        const packagings = normalizePackagings(product);
        const fallbackPackaging = getDefaultPackaging(packagings);
        const baseUnitName = normalizeDisplayBaseUnit(String(product.baseUnitName || product.unit || item.baseUnitName || fallbackPackaging?.baseUnitName || '\u0448\u0442'));

        return normalizeCartItem({
          ...item,
          ...product,
          stock: Number(product.stock || 0),
          unit: baseUnitName,
          baseUnitName,
          packagings,
          selectedPackagingId:
            item.selectedPackagingId && packagings.some((entry) => entry.id === item.selectedPackagingId)
              ? item.selectedPackagingId
              : fallbackPackaging?.id || null,
          packageQuantity: Number(item.packageQuantity || 0),
          packageQuantityInput: item.packageQuantityInput ?? String(Number(item.packageQuantity || 0)),
          extraUnitQuantity:
            item.extraUnitQuantity !== undefined && item.extraUnitQuantity !== null
              ? Number(item.extraUnitQuantity)
              : Number(item.quantity || 1),
          extraUnitQuantityInput:
            item.extraUnitQuantityInput
            ?? String(
              item.extraUnitQuantity !== undefined && item.extraUnitQuantity !== null
                ? Number(item.extraUnitQuantity)
                : Number(item.quantity || 1),
            ),
        } as CartItem);
      }),
    );
  }, [products]);

  useEffect(() => {
    if (hasLoadedReferenceDataRef.current) {
      return;
    }

    hasLoadedReferenceDataRef.current = true;
    if (isCustomerPortal) {
      setCustomers(userCustomerId ? [{ id: userCustomerId, name: user.customer?.name || user.username, phone: user.customer?.phone }] : []);
    } else {
      getCustomers()
        .then((data) => setCustomers(Array.isArray(data) ? data : []))
        .catch(console.error);
    }
    getWarehouses()
      .then((data) => {
        const filteredWarehouses = filterWarehousesForUser(Array.isArray(data) ? data : [], user);
        setWarehouses(filteredWarehouses);
        const defaultWarehouseId = getDefaultWarehouseId(filteredWarehouses) || (filteredWarehouses.length === 1 ? Number(filteredWarehouses[0].id) : null);
        if (isAdmin && !warehouseId && defaultWarehouseId) {
          setWarehouseId(String(defaultWarehouseId));
        } else if (!isAdmin && filteredWarehouses[0]) {
          setWarehouseId(String(filteredWarehouses[0].id));
        }
      })
      .catch((error) => {
        hasLoadedReferenceDataRef.current = false;
        console.error(error);
      });
  }, [isAdmin, isCustomerPortal, user, userCustomerId]);

  useEffect(() => {
    if (!isStorageHydrated) {
      return;
    }

    sessionStorage.setItem(cartStorageKey, JSON.stringify(cart));
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, isStorageHydrated]);

  useEffect(() => {
    if (!customerId) {
      setCustomerSearch('');
      return;
    }

    const selectedCustomer = customers.find((customer) => customer.id === customerId);
    if (selectedCustomer) {
      setCustomerSearch(selectedCustomer.name || '');
    }
  }, [customerId, customers]);

  useEffect(() => {
    if (!isCustomerPortal || !userCustomerId) {
      return;
    }

    setCustomerId(userCustomerId);
    setCustomerSearch(user.customer?.name || user.username || '');
  }, [isCustomerPortal, userCustomerId, user.customer?.name, user.username]);

  useEffect(() => {
    if (warehouseId) {
      sessionStorage.setItem(warehouseStorageKey, warehouseId);
      localStorage.setItem(warehouseStorageKey, warehouseId);
      return;
    }

    sessionStorage.removeItem(warehouseStorageKey);
    localStorage.removeItem(warehouseStorageKey);
  }, [warehouseId]);

  const resetSaleDraft = (showToast = false) => {
    setCart([]);
    setCustomerId(null);
    setCustomerSearch('');
    setPaidAmount('');
    setDiscount(0);
    setPaymentMethod('cash');
    sessionStorage.removeItem(cartStorageKey);
    localStorage.removeItem(cartStorageKey);
    sessionStorage.removeItem(pendingCartStorageKey);
    localStorage.removeItem(pendingCartStorageKey);

    if (showToast) {
      toast('Склад изменён. Черновик продажи сброшен автоматически.', {
        icon: '↺',
      });
    }
  };

  const hasSaleDraft =
    cart.length > 0 || customerId !== null || Number(paidAmount || 0) > 0 || discount > 0;

  const handleWarehouseChange = (nextWarehouseId: string) => {
    if (nextWarehouseId === warehouseId) {
      return;
    }

    if (hasSaleDraft) {
      setPendingWarehouseId(nextWarehouseId);
      return;
    }

    setWarehouseId(nextWarehouseId);
    resetSaleDraft(false);
  };

  const closeWarehouseConfirm = () => {
    setPendingWarehouseId(null);
  };

  const confirmWarehouseChange = async () => {
    if (!pendingWarehouseId) {
      return;
    }

    const nextWarehouseId = pendingWarehouseId;
    setPendingWarehouseId(null);
    setWarehouseId(nextWarehouseId);
    resetSaleDraft(true);
  };

  const addToCart = (product: any) => {
    if (productListRef.current) {
      lastProductScrollRef.current = productListRef.current.scrollTop;
    }

    if (isAdmin && !warehouseId) {
      toast.error('Сначала выберите склад');
      return;
    }

    const existing = cart.find((item) => item.id === product.id);

    if (false) {
      toast.error(`Недостаточно товара. Доступно: ${product.stock} ${product.unit}`);
      return;
    }

    if (existing) {
      const packaging = getCartPackaging(existing);
      const attemptedQuantity = packaging
        ? (existing.packageQuantity + 1) * Number(packaging.unitsPerPackage || 0) + Math.max(0, Number(existing.extraUnitQuantity || 0))
        : Math.max(0, Number(existing.extraUnitQuantity || 0)) + 1;
      const availableStock = Math.max(0, Number(product.stock || 0));
      const nextItem = normalizeCartItem(
        existing,
        packaging
          ? {
              packageQuantity: existing.packageQuantity + 1,
              packageQuantityInput: String(existing.packageQuantity + 1),
            }
          : {
              extraUnitQuantity: existing.extraUnitQuantity + 1,
              extraUnitQuantityInput: String(existing.extraUnitQuantity + 1),
            },
      );

      if (attemptedQuantity > availableStock) {
        toast.error(`Недостаточно товара. Доступно: ${getProductStockLabel(product, existing.baseUnitName || product.unit)}`);
        const cappedItem = normalizeCartItem(nextItem);
        setCart(cart.map((item) => (item.id === product.id ? cappedItem : item)));
        return;
      }

      setCart(cart.map((item) => (item.id === product.id ? nextItem : item)));
    } else {
      const nextItem = createCartItemFromProduct(product);
      if (nextItem.quantity > Number(product.stock || 0)) {
        toast.error(`Недостаточно товара. Доступно: ${getProductStockLabel(product, nextItem.baseUnitName || product.unit)}`);
        return;
      }

      setCart([...cart, nextItem]);
    }
  };

  const removeFromCart = (id: number) => {
    if (productListRef.current) {
      lastProductScrollRef.current = productListRef.current.scrollTop;
    }

    setCart(cart.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: number, quantity: number) => {
    if (productListRef.current) {
      lastProductScrollRef.current = productListRef.current.scrollTop;
    }

    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }

    const product = products.find((item) => item.id === id);
    if (product && quantity > product.stock) {
      toast.error(`Недостаточно товара. Доступно: ${getProductStockLabel(product, product.unit)}`);
      setCart(
        cart.map((item) =>
          item.id === id
            ? normalizeCartItem(item, {
                selectedPackagingId: null,
                packageQuantity: 0,
                packageQuantityInput: '0',
                extraUnitQuantity: Math.max(0, Math.floor(Number(product.stock || 0))),
                extraUnitQuantityInput: String(Math.max(0, Math.floor(Number(product.stock || 0)))),
              })
            : item,
        ),
      );
      return;
    }

    setCart(cart.map((item) => (item.id === id ? { ...item, quantity } : item)));
  };

  const updateQuantityInput = (id: number, value: string) => {
    if (productListRef.current) {
      lastProductScrollRef.current = productListRef.current.scrollTop;
    }

    setCart((currentCart) =>
      currentCart.map((item) => {
        if (item.id !== id) {
          return item;
        }

        if (value === '') {
          return { ...item, quantityInput: '' };
        }

        const parsedQuantity = Number(value);
        if (Number.isNaN(parsedQuantity)) {
          return item;
        }

        const product = products.find((productItem) => productItem.id === id);
        const maxStock = product?.stock ?? item.stock;
        if (parsedQuantity > maxStock) {
          warnStockOverflow(item, maxStock);
        }
        const nextQuantity = Math.max(1, Math.min(parsedQuantity, maxStock));
        return {
          ...item,
          quantity: nextQuantity,
          quantityInput: String(nextQuantity),
        };
      }),
    );
  };

  const commitQuantityInput = (id: number) => {
    setCart((currentCart) =>
      currentCart.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const product = products.find((productItem) => productItem.id === id);
        const maxStock = product?.stock ?? item.stock;
        if (item.quantity > maxStock) {
          warnStockOverflow(item, maxStock);
        }
        const normalizedQuantity = Math.max(1, Math.min(item.quantity, maxStock));
        return {
          ...item,
          quantity: normalizedQuantity,
          quantityInput: undefined,
        };
      }),
    );
  };

  const updateSelectedPackaging = (id: number, value: string) => {
    setCart((currentCart) =>
      currentCart.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const selectedPackagingId = value ? Number(value) : null;
        const selectedPackaging = selectedPackagingId
          ? (Array.isArray(item.packagings) ? item.packagings : []).find((entry) => entry.id === selectedPackagingId) || null
          : null;

        if (selectedPackaging && !isPackagingAvailableForCartItem(item, selectedPackaging)) {
          toast.error(getPackageBlockedMessage(item, selectedPackaging), { id: `package-blocked-${item.id}` });
          return normalizeCartItem(item);
        }

        return normalizeCartItem(item, {
          selectedPackagingId,
          packageQuantity: selectedPackagingId ? Math.max(1, item.packageQuantity || 0) : 0,
          packageQuantityInput: selectedPackagingId ? String(Math.max(1, item.packageQuantity || 0)) : '0',
          extraUnitQuantity: selectedPackagingId ? 0 : Math.max(1, Number(item.extraUnitQuantity || 0)),
          extraUnitQuantityInput: selectedPackagingId ? '0' : String(Math.max(1, Number(item.extraUnitQuantity || 0))),
        });
      }),
    );
  };

  const updatePackageQuantityInput = (id: number, value: string) => {
    setCart((currentCart) =>
      currentCart.map((item) => {
        if (item.id !== id) {
          return item;
        }

        if (value === '') {
          return { ...item, packageQuantityInput: '' };
        }

        const packaging = getCartPackaging(item);
        const unitsPerPackage = Number(packaging?.unitsPerPackage || 0);
        const parsedPackageQuantity = Math.max(0, Math.floor(Number(value) || 0));
        const maxByStock = unitsPerPackage > 0
          ? Math.max(0, (getAvailableStockForCartItem(item) - Math.max(0, Number(item.extraUnitQuantity || 0))) / unitsPerPackage)
          : 0;
        const nextPackageQuantity = Math.min(parsedPackageQuantity, Math.floor(Math.max(0, maxByStock)));
        const attemptedTotal = parsedPackageQuantity * unitsPerPackage + Math.max(0, Number(item.extraUnitQuantity || 0));
        const availableStock = getAvailableStockForCartItem(item);
        if (attemptedTotal > availableStock) {
          warnStockOverflow(item, availableStock);
        }

        return normalizeCartItem(item, {
          packageQuantity: nextPackageQuantity,
          packageQuantityInput: String(nextPackageQuantity),
        });
      }),
    );
  };

  const commitPackageQuantityInput = (id: number) => {
    setCart((currentCart) =>
      currentCart
        .map((item) => {
          if (item.id !== id) {
            return item;
          }

          const nextValue = Math.max(0, Math.floor(Number(item.packageQuantityInput || item.packageQuantity || 0) || 0));
          const packaging = getCartPackaging(item);
          const unitsPerPackage = Number(packaging?.unitsPerPackage || 0);
          const attemptedTotal = nextValue * unitsPerPackage + Math.max(0, Number(item.extraUnitQuantity || 0));
          const availableStock = getAvailableStockForCartItem(item);
          if (attemptedTotal > availableStock) {
            warnStockOverflow(item, availableStock);
          }
          return normalizeCartItem(item, {
            packageQuantity: nextValue,
            packageQuantityInput: String(nextValue),
          });
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const updateExtraUnitQuantityInput = (id: number, value: string) => {
    setCart((currentCart) =>
      currentCart.map((item) => {
        if (item.id !== id) {
          return item;
        }

        if (item.selectedPackagingId) {
          return normalizeCartItem(item, {
            extraUnitQuantity: 0,
            extraUnitQuantityInput: '0',
          });
        }

        if (value === '') {
          return { ...item, extraUnitQuantityInput: '' };
        }

        const packaging = getCartPackaging(item);
        const unitsPerPackage = Number(packaging?.unitsPerPackage || 0);
        const parsedExtraUnitQuantity = Math.max(0, Math.floor(Number(value) || 0));
        const maxByStock = packaging
          ? Math.max(0, getAvailableStockForCartItem(item) - Math.max(0, Number(item.packageQuantity || 0)) * unitsPerPackage)
          : getAvailableStockForCartItem(item);
        const nextExtraUnitQuantity = Math.min(parsedExtraUnitQuantity, Math.max(0, maxByStock));
        const attemptedTotal = packaging
          ? Math.max(0, Number(item.packageQuantity || 0)) * unitsPerPackage + parsedExtraUnitQuantity
          : parsedExtraUnitQuantity;
        const availableStock = getAvailableStockForCartItem(item);
        if (attemptedTotal > availableStock) {
          warnStockOverflow(item, availableStock);
        }

        return normalizeCartItem(item, {
          extraUnitQuantity: nextExtraUnitQuantity,
          extraUnitQuantityInput: String(nextExtraUnitQuantity),
        });
      }),
    );
  };

  const commitExtraUnitQuantityInput = (id: number) => {
    setCart((currentCart) =>
      currentCart
        .map((item) => {
          if (item.id !== id) {
            return item;
          }

          if (item.selectedPackagingId) {
            return normalizeCartItem(item, {
              extraUnitQuantity: 0,
              extraUnitQuantityInput: '0',
            });
          }

          const nextValue = Math.max(0, Math.floor(Number(item.extraUnitQuantityInput || item.extraUnitQuantity || 0) || 0));
          const packaging = getCartPackaging(item);
          const unitsPerPackage = Number(packaging?.unitsPerPackage || 0);
          const attemptedTotal = packaging
            ? Math.max(0, Number(item.packageQuantity || 0)) * unitsPerPackage + nextValue
            : nextValue;
          const availableStock = getAvailableStockForCartItem(item);
          if (attemptedTotal > availableStock) {
            warnStockOverflow(item, availableStock);
          }
          return normalizeCartItem(item, {
            extraUnitQuantity: nextValue,
            extraUnitQuantityInput: String(nextValue),
          });
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const updateLineDiscountInput = (id: number, value: string) => {
    setCart((currentCart) =>
      currentCart.map((item) => {
        if (item.id !== id) {
          return item;
        }

        if (value === '') {
          return {
            ...item,
            lineDiscountPercent: 0,
            lineDiscountInput: '',
          };
        }

        const nextValue = clampDiscountPercent(value);
        return {
          ...item,
          lineDiscountPercent: nextValue,
          lineDiscountInput: value,
        };
      }),
    );
  };

  const commitLineDiscountInput = (id: number) => {
    setCart((currentCart) =>
      currentCart.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const normalizedLineDiscount = clampDiscountPercent(item.lineDiscountInput ?? item.lineDiscountPercent ?? 0);
        return {
          ...item,
          lineDiscountPercent: normalizedLineDiscount,
          lineDiscountInput: normalizedLineDiscount > 0 ? String(normalizedLineDiscount) : '',
        };
      }),
    );
  };

  useLayoutEffect(() => {
    if (productListRef.current) {
      productListRef.current.scrollTop = lastProductScrollRef.current;
    }
  }, [cart]);

  const cartOverflowMessage = React.useMemo(() => {
    const overflowCartItem = cart.find((item) => {
      const currentProduct = products.find((product) => product.id === item.id);
      return !currentProduct || Number(item.quantity || 0) > Number(currentProduct.stock || 0);
    });

    return overflowCartItem ? getCartOverflowMessage(overflowCartItem) : null;
  }, [cart, products]);

  const getDiscountedUnitPrice = (item: CartItem) => {
    const sellingPrice = Number(item.sellingPrice || 0);
    const itemDiscount = clampDiscountPercent(item.lineDiscountPercent || 0);
    const unitPriceAfterDiscount = sellingPrice * (1 - itemDiscount / 100);
    return ceilMoney(unitPriceAfterDiscount);
  };
  const getLineTotal = (item: CartItem) => roundMoney(Number(item.quantity || 0) * getDiscountedUnitPrice(item));
  const getLineSubtotal = (item: CartItem) => roundMoney(Number(item.sellingPrice || 0) * Number(item.quantity || 0));
  const getLineDiscountAmount = (item: CartItem) => roundMoney(getLineSubtotal(item) - getLineTotal(item));

  const subtotal = normalizeMoneyValue(roundMoney(cart.reduce((sum, item) => sum + getLineSubtotal(item), 0)));
  const lineDiscountAmount = normalizeMoneyValue(
    Math.max(0, roundMoney(cart.reduce((sum, item) => sum + getLineDiscountAmount(item), 0))),
  );
  const subtotalAfterLineDiscount = normalizeMoneyValue(Math.max(0, roundMoney(subtotal - lineDiscountAmount)));
  const normalizedDiscount = Math.max(0, discount);
  const invoiceDiscountAmount = normalizeMoneyValue(
    Math.max(0, roundMoney(subtotalAfterLineDiscount * (normalizedDiscount / 100))),
  );
  const totalDiscountAmount = normalizeMoneyValue(roundMoney(lineDiscountAmount + invoiceDiscountAmount));
  const total = normalizeMoneyValue(Math.max(0, roundMoney(subtotalAfterLineDiscount - invoiceDiscountAmount)));
  const paid = parseFloat(paidAmount) || 0;
  const balance = paid - total;
  const cartWeightSummary = React.useMemo(
    () =>
      cart.reduce(
        (summary, item) => {
          const unitWeightKg = getProductUnitWeightKg(item);

          if (unitWeightKg <= 0) {
            return {
              ...summary,
              missingWeightItems: summary.missingWeightItems + 1,
            };
          }

          return {
            ...summary,
            totalWeightKg: summary.totalWeightKg + unitWeightKg * Math.max(0, Number(item.quantity || 0)),
          };
        },
        { totalWeightKg: 0, missingWeightItems: 0 },
      ),
    [cart],
  );

  const handleCheckout = async () => {
    if (paid > total + 0.01) {
      toast.error(`Сумма оплаты не может превышать сумму накладной (${toFixedNumber(total)})`);
      return;
    }

    if (!customerId) {
      toast.error('Сначала выберите клиента');
      return;
    }
    if (!warehouseId) {
      toast.error('Выберите склад');
      return;
    }

    const selectedWarehouseId = Number(warehouseId);
    const invalidCartItem = cart.find((item) => {
      const currentProduct = products.find((product) => product.id === item.id);
      return !currentProduct || Number(currentProduct.warehouseId) !== selectedWarehouseId;
    });

    if (invalidCartItem) {
      toast.error('В корзине есть товар не из выбранного склада. Очистите корзину или выберите правильный склад.');
      return;
    }

    const overflowCartItem = cart.find((item) => {
      const currentProduct = products.find((product) => product.id === item.id);
      return !currentProduct || Number(item.quantity || 0) > Number(currentProduct.stock || 0);
    });

    if (overflowCartItem) {
      toast.error(getCartOverflowMessage(overflowCartItem));
      return;
    }

    const blockedPackageCartItem = cart.find((item) => {
      const packaging = getCartPackaging(item);
      return Boolean(item.selectedPackagingId && packaging && !isPackagingAvailableForCartItem(item, packaging));
    });

    if (blockedPackageCartItem) {
      toast.error(getPackageBlockedMessage(blockedPackageCartItem, getCartPackaging(blockedPackageCartItem)));
      return;
    }

    setIsSubmitting(true);
    try {


      const checkoutPayload = {
        customerId,
        warehouseId: Number(warehouseId),
        items: cart.map((item) => ({
          productId: item.id,
          quantity: Number(item.quantity),
          totalBaseUnits: Number(item.quantity),
          packageQuantity: item.selectedPackagingId ? Number(item.packageQuantity) : 0,
          extraUnitQuantity: Number(item.extraUnitQuantity || 0),
          packagingId: item.selectedPackagingId || null,
          packageName: getCartPackaging(item)?.packageName || null,
          baseUnitName: item.baseUnitName,
          unitsPerPackage: getCartPackaging(item)?.unitsPerPackage || null,
          sellingPrice: Number(item.sellingPrice || 0),
          discount: Number(item.lineDiscountPercent || 0),
        })),
        discount: Number(normalizedDiscount),
        paidAmount: paid,
      };

      if (isCustomerPortal) {
        await createCustomerOrder(checkoutPayload);
      } else {
        await createInvoice({
          ...checkoutPayload,
          paidAmount: paid,
          paymentMethod,
        });
      }

      toast.success(isCustomerPortal ? 'Заказ отправлен на проверку' : 'Продажа оформлена');
      setCart([]);
      sessionStorage.removeItem(cartStorageKey);
      sessionStorage.removeItem(pendingCartStorageKey);
      setPaidAmount('');
      setCustomerId(isCustomerPortal ? userCustomerId : null);
      setDiscount(0);
      if (!isCustomerPortal) {
        navigate('/sales', { state: { warehouseId: String(warehouseId) } });
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Ошибка при создании продажи';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    if (warehouseId && Number(product.warehouseId) !== Number(warehouseId)) {
      return false;
    }

    if (Math.max(0, Number(product.stock || 0)) <= 0) {
      return false;
    }

    if (cart.some((item) => Number(item.id) === Number(product.id))) {
      return false;
    }

    const query = deferredProductSearch.trim().toLowerCase();
    if (!query) return true;

    return [product.name, String(product.id)]
      .filter(Boolean)
  });

  const canAddProductFromList = (product: any) =>
    !(Number(product.stock || 0) <= 0 || (isAdmin && !warehouseId));

  const handleAddFromList = (product: any) => {
    if (!canAddProductFromList(product)) {
      return;
    }

    const currentIndex = filteredProducts.findIndex((entry) => Number(entry.id) === Number(product.id));
    const nextProduct =
      currentIndex >= 0
        ? filteredProducts[currentIndex + 1] || filteredProducts[currentIndex - 1] || null
        : null;

    addToCart(product);
    highlightProductRow(nextProduct ? Number(nextProduct.id) : null);
  };

  const filteredCustomers = [...customers]
    .map((customer) => {
      const query = deferredCustomerSearch.trim().toLowerCase();
      const name = String(customer.name || '').toLowerCase();
      const startsWith = query ? name.startsWith(query) : false;
      const includes = query ? name.includes(query) : true;
      const index = query ? name.indexOf(query) : 0;

      return {
        customer,
        visible: query ? includes : true,
        score: startsWith ? 0 : index >= 0 ? index + 1 : Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((entry) => entry.visible)
    .sort((a, b) => a.score - b.score || String(a.customer.name || '').localeCompare(String(b.customer.name || ''), 'ru'))
    .map((entry) => entry.customer);

  return (
    <div className="app-page-shell min-h-full font-sans">
      <ConfirmationModal
        isOpen={Boolean(pendingWarehouseId)}
        onClose={closeWarehouseConfirm}
        onConfirm={confirmWarehouseChange}
        title="Сменить склад?"
        message="При смене склада корзина, клиент и черновик продажи будут очищены. Подтвердите смену, если хотите начать продажу с другого склада."
        confirmText="Сменить склад"
        cancelText="Остаться здесь"
        type="warning"
      />

      <div className="overflow-hidden rounded-[28px] bg-[#f4f5fb] min-h-screen lg:min-h-full">
        <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">POS Терминал</h1>
              <p className="mt-0.5 text-xs text-slate-500">Оформление продаж, выбор клиента и создание накладной.</p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <div className="flex items-center gap-3 rounded-full bg-[#f4f5fb] pl-1 pr-4 py-1 border border-slate-200/60">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {(user.username || 'A').slice(0, 1).toUpperCase()}
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-900">{user.username || 'Admin'}</p>
                  <p className="text-[10px] text-slate-400">{user.role || 'ADMIN'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={clsx('space-y-4 px-5 py-5 min-h-0 flex-1 flex flex-col', activeTab === 'cart' && 'pb-28 lg:pb-5')}>
          <div className="grid grid-cols-2 gap-1.5 rounded-full bg-[#e8eaf2] p-1.5 text-xs lg:hidden">
            <button
              onClick={() => setActiveTab('products')}
              className={clsx(
                'rounded-full py-2 text-xs font-medium transition-all',
                activeTab === 'products' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Товары
            </button>
            <button
              onClick={() => setActiveTab('cart')}
              className={clsx(
                'rounded-full py-2 text-xs font-medium transition-all',
                activeTab === 'cart' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Корзина {cart.length ? `(${cart.length})` : ''}
            </button>
          </div>

          <div
            className={clsx(
              'grid flex-1 items-stretch gap-5 overflow-visible lg:h-full lg:min-h-0 lg:overflow-hidden',
              isCartExpanded ? 'lg:grid-cols-[minmax(0,1fr)]' : 'lg:grid-cols-[1.55fr_0.95fr]',
            )}
          >
            <section className={clsx(activeTab === 'products' ? 'block overflow-visible lg:h-full lg:min-h-0 lg:overflow-hidden' : 'hidden overflow-visible lg:block lg:h-full lg:min-h-0 lg:overflow-hidden', isCartExpanded && 'lg:hidden')}>
              <POSProductList
                filteredProducts={filteredProducts}
                warehouses={warehouses}
                warehouseId={warehouseId}
                productSearch={productSearch}
                highlightedProductId={highlightedProductId}
                isAdmin={isAdmin}
                productListRef={productListRef}
                setProductSearch={setProductSearch}
                handleWarehouseChange={handleWarehouseChange}
                handleAddFromList={handleAddFromList}
                canAddProductFromList={canAddProductFromList}
                getProductStockParts={getProductStockParts}
                onClose={() => navigate('/sales')}
              />
            </section>

            <aside className={clsx(activeTab === 'cart' ? 'block min-h-0 overflow-visible lg:h-full lg:overflow-hidden' : 'hidden min-h-0 overflow-hidden lg:block lg:h-full')}>
              <div
                className={clsx(
                  'min-h-0 rounded-[28px] border border-white bg-white shadow-sm lg:h-full',
                  isCartExpanded
                    ? 'flex flex-col overflow-hidden lg:grid lg:h-full lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_auto_minmax(0,1fr)]'
                    : 'flex flex-col overflow-visible lg:overflow-hidden',
                )}
              >
                <POSCartHeader
                  isCartExpanded={isCartExpanded}
                  cartLength={cart.length}
                  totalWeightKg={cartWeightSummary.totalWeightKg}
                  formatWeightKg={formatWeightKg}
                  setIsCartExpanded={setIsCartExpanded}
                />

                <POSCartCustomerBlock
                  isCartExpanded={isCartExpanded}
                  total={total}
                  cartWeightSummary={cartWeightSummary}
                  cartOverflowMessage={cartOverflowMessage || ''}
                  customerId={customerId}
                  customerSearch={customerSearch}
                  isCustomerPortal={isCustomerPortal}
                  isCustomerDropdownOpen={isCustomerDropdownOpen}
                  filteredCustomers={filteredCustomers}
                  formatWeightKg={formatWeightKg}
                  setCustomerId={setCustomerId}
                  setCustomerSearch={setCustomerSearch}
                  setIsCustomerDropdownOpen={setIsCustomerDropdownOpen}
                />

                <POSCartItemsList
                  cart={cart}
                  isCartExpanded={isCartExpanded}
                  getCartStockSummary={getCartStockSummary}
                  getCartPackaging={getCartPackaging}
                  isPackagingAvailableForCartItem={isPackagingAvailableForCartItem}
                  getLineSubtotal={getLineSubtotal}
                  getLineDiscountAmount={getLineDiscountAmount}
                  getLineTotal={getLineTotal}
                  getProductUnitWeightKg={getProductUnitWeightKg}
                  formatWeightKg={formatWeightKg}
                  removeFromCart={removeFromCart}
                  updateSelectedPackaging={updateSelectedPackaging}
                  updatePackageQuantityInput={updatePackageQuantityInput}
                  commitPackageQuantityInput={commitPackageQuantityInput}
                  updateExtraUnitQuantityInput={updateExtraUnitQuantityInput}
                  commitExtraUnitQuantityInput={commitExtraUnitQuantityInput}
                  updateLineDiscountInput={updateLineDiscountInput}
                  commitLineDiscountInput={commitLineDiscountInput}
                />

                <POSCartSummary
                  isCartExpanded={isCartExpanded}
                  cartLength={cart.length}
                  customerId={customerId}
                  discount={discount}
                  paidAmount={paidAmount}
                  subtotal={subtotal}
                  total={total}
                  lineDiscountAmount={lineDiscountAmount}
                  invoiceDiscountAmount={invoiceDiscountAmount}
                  balance={balance}
                  cartWeightSummary={cartWeightSummary}
                  isSubmitting={isSubmitting}
                  formatWeightKg={formatWeightKg}
                  setDiscount={setDiscount}
                  setPaidAmount={setPaidAmount}
                  handleCheckout={handleCheckout}
                />
              </div>
            </aside>
          </div>
        </div>
      </div>

      {activeTab === 'cart' && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_rgba(15,23,42,0.1)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Итого к оплате</p>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-xl font-bold leading-none text-slate-900">{formatMoney(total)}</span>
                <span className="text-xs font-semibold text-emerald-600">{formatWeightKg(cartWeightSummary.totalWeightKg)}</span>
              </div>
              {totalDiscountAmount > 0 && (
                <p className="mt-1 inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700">
                  Скидка: -{formatMoney(totalDiscountAmount)}
                </p>
              )}
              <p className={clsx('mt-1 text-[11px] font-medium', customerId ? 'text-slate-500' : 'text-amber-600')}>
                {customerId ? 'Клиент выбран' : 'Выберите клиента'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={isSubmitting || cart.length === 0 || !customerId}
              className="min-h-12 shrink-0 rounded-xl border border-[#8f6f18] bg-[#ffd966] px-4 text-sm font-black text-[#2f2f2f] shadow-sm transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? '...' : 'Оформить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
