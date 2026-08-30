import { roundMoney, toFixedNumber } from './format';
import {
  calculateEffectiveCost,
  calculateUnitCostFromLineTotal,
  calculateUnitCostFromPackage,
} from './money';

const normalizeVolumeSpacing = (value: string) =>
  value
    .replace(/(\d)\s*[.,]\s*(\d)/gu, '$1.$2')
    .replace(/(\d)\s+(\d)(?=\s*(?:гр|г|кг|л|мл)\b)/giu, '$1.$2')
    .replace(/(\d(?:\.\d+)?)\s*(гр|г|кг|л|мл|шт)\b/giu, '$1 $2');

export const normalizeCatalogName = (name: string) =>
  normalizeVolumeSpacing(String(name || ''))
    .replace(/\s*\[[^\]]*\]\s*$/u, '')
    .replace(/[«»“”„‟"']/gu, '')
    .replace(/[(),]/gu, ' ')
    .replace(/[ёЁ]/g, 'е')
    .replace(/plasticковых/gi, 'пластиковых')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const normalizeProductFamilyName = (name: string) =>
  normalizeCatalogName(name)
    .replace(/\bмассой\s+\d+(?:\.\d+)?\s*(?:гр|г|кг|л|мл|шт)\b/giu, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:гр|г|кг|л|мл|шт)\b/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const extractMassKey = (name: string) => {
  const match = normalizeVolumeSpacing(String(name || '').toLowerCase()).match(/(\d+(?:\.\d+)?)\s*(гр|г|кг|л|мл|шт)\b/u);
  return match ? `${match[1]} ${match[2]}` : '';
};

export const detectCategoryName = (name: string) => {
  const normalized = String(name || '').toLowerCase().replace(/[ё]/g, 'е');

  if (normalized.includes('порошок') && normalized.includes('автомат')) return 'Стиральные порошки';
  if (normalized.includes('порошок')) return 'Стиральные средства';
  if (normalized.includes('жидк') && normalized.includes('стира')) return 'Жидкие средства для стирки';
  if (normalized.includes('гель') && normalized.includes('посуд')) return 'Гели для посуды';
  if (normalized.includes('капля') && normalized.includes('посуд')) return 'Средства для мытья посуды';
  if (normalized.includes('посуд')) return 'Средства для мытья посуды';
  if (normalized.includes('чистящее средство')) return 'Чистящие средства';

  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).join(' ');
};

export const normalizeOcrBaseUnit = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'шт';
  if (['шт', 'штук', 'штука', 'штуки', 'pcs', 'piece', 'pieces'].includes(normalized)) return 'шт';
  if (['пачка', 'пачки', 'пачек'].includes(normalized)) return 'пачка';
  if (['флакон', 'флакона', 'флаконов'].includes(normalized)) return 'флакон';
  if (['емкость', 'ёмкость', 'емкости', 'ёмкости', 'емкостей', 'ёмкостей'].includes(normalized)) return 'ёмкость';
  if (['бутылка', 'бутылки', 'бутылок'].includes(normalized)) return 'бутылка';
  return normalized;
};

export const normalizeOcrPackageName = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (['мешок', 'мешка', 'мешков', 'bag'].includes(normalized)) return 'мешок';
  if (['коробка', 'коробки', 'коробок', 'box'].includes(normalized)) return 'коробка';
  if (['упаковка', 'упаковки', 'упаковок', 'pack'].includes(normalized)) return 'упаковка';
  if (['пачка', 'пачки', 'пачек'].includes(normalized)) return 'пачка';
  return normalized;
};

export const normalizeDisplayBaseUnit = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'шт';
  if (['пачка', 'пачки', 'пачек', 'шт', 'штук', 'штука', 'штуки', 'pcs', 'piece', 'pieces'].includes(normalized)) {
    return 'шт';
  }
  return normalized;
};

export const formatPriceInput = (value: unknown): string => {
  if (value === '' || value === null || value === undefined) {
    return '';
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(toFixedNumber(numeric)) : '';
};

export type PackagingOption = {
  id: number;
  packageName: string;
  baseUnitName: string;
  unitsPerPackage: number;
  isDefault?: boolean;
};

export type ProductFormData = {
  name: string;
  unit: string;
  baseUnitName: string;
  packagingEnabled: boolean;
  packageName: string;
  unitsPerPackage: string;
  categoryId: string;
  warehouseId: string;
  costPrice: string;
  expensePercent: string;
  sellingPrice: string;
  minStock: string;
  initialStock: string;
  photoUrl: string;
};

export const createEmptyProductForm = (): ProductFormData => ({
  name: '',
  unit: 'шт',
  baseUnitName: 'шт',
  packagingEnabled: true,
  packageName: 'коробка',
  unitsPerPackage: '',
  categoryId: '',
  warehouseId: '',
  costPrice: '',
  expensePercent: '0',
  sellingPrice: '',
  minStock: '0',
  initialStock: '0',
  photoUrl: ''
});

export const normalizePackagings = (product: any): PackagingOption[] =>
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

export const getDefaultPackaging = (packagings: PackagingOption[]) =>
  packagings.find((entry) => entry.isDefault) || packagings[0] || null;

export const buildProductFormData = (product?: any): ProductFormData => {
  if (!product) {
    return createEmptyProductForm();
  }

  const defaultPackaging = getDefaultPackaging(normalizePackagings(product));
  const baseUnitName = normalizeOcrBaseUnit(product.baseUnitName || product.unit || 'шт');
  const unitsPerPackage = Number(defaultPackaging?.unitsPerPackage || 0);

  return {
    name: product.name || '',
    unit: baseUnitName,
    baseUnitName,
    packagingEnabled: unitsPerPackage > 0,
    packageName: normalizeOcrPackageName(defaultPackaging?.packageName || 'коробка') || 'коробка',
    unitsPerPackage: unitsPerPackage > 0 ? String(unitsPerPackage) : '',
    categoryId: product.categoryId?.toString() || '',
    warehouseId: product.warehouseId?.toString() || '',
    costPrice: formatPriceInput(product.purchaseCostPrice ?? product.costPrice),
    expensePercent: String(product.expensePercent ?? 0),
    sellingPrice: formatPriceInput(product.sellingPrice),
    minStock: product.minStock?.toString() || '0',
    initialStock: product.initialStock?.toString() || '0',
    photoUrl: product.photoUrl || ''
  };
};

export const buildProductSubmitPayload = (formData: ProductFormData, categoryId: number) => {
  const baseUnitName = normalizeOcrBaseUnit(formData.baseUnitName || formData.unit || 'шт');
  const unitsPerPackage = Number(formData.unitsPerPackage || 0);
  const packagingEnabled = formData.packagingEnabled && unitsPerPackage > 0;

  return {
    name: formData.name,
    unit: baseUnitName,
    baseUnitName,
    categoryId,
    warehouseId: Number(formData.warehouseId),
    costPrice: roundMoney(formData.costPrice),
    purchaseCostPrice: roundMoney(formData.costPrice),
    expensePercent: parseFloat(formData.expensePercent || '0'),
    sellingPrice: roundMoney(formData.sellingPrice),
    minStock: parseFloat(formData.minStock),
    initialStock: parseFloat(formData.initialStock),
    photoUrl: formData.photoUrl,
    packaging: packagingEnabled
      ? {
        packageName: normalizeOcrPackageName(formData.packageName || 'коробка'),
        baseUnitName,
        unitsPerPackage,
        isDefault: true,
      }
      : null,
  };
};

export const getPreferredPackaging = (product: any) => {
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

export const formatCountWithUnit = (count: number, unit: string) => {
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

export const getStockBreakdown = (product: any) => {
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

const getStockSortMetrics = (product: any) => {
  const totalUnits = Number(product?.stock || 0);
  const preferredPackaging = getPreferredPackaging(product);
  const unitsPerPackage = Number(preferredPackaging?.unitsPerPackage || 0);

  if (!preferredPackaging || unitsPerPackage <= 1) {
    return {
      packageCount: totalUnits,
      remainderUnits: 0,
      totalUnits,
    };
  }

  return {
    packageCount: Math.floor(totalUnits / unitsPerPackage),
    remainderUnits: totalUnits % unitsPerPackage,
    totalUnits,
  };
};

export const getProductEfficiencyMetrics = (product: any) => {
  const costPrice = Number(product?.costPrice || 0);
  const sellingPrice = Number(product?.sellingPrice || 0);
  const profitPerUnit = sellingPrice - costPrice;
  const marginPercent = sellingPrice > 0 ? (profitPerUnit / sellingPrice) * 100 : 0;

  let label = 'Слабая';
  let className = 'bg-rose-50 text-rose-700 border-rose-100';

  if (marginPercent >= 25) {
    label = 'Высокая';
    className = 'bg-emerald-50 text-emerald-700 border-emerald-100';
  } else if (marginPercent >= 12) {
    label = 'Нормальная';
    className = 'bg-amber-50 text-amber-700 border-amber-100';
  }

  return {
    profitPerUnit,
    marginPercent,
    label,
    className,
  };
};

const compareValues = (aValue: any, bValue: any, direction: 'asc' | 'desc') => {
  if (aValue < bValue) return direction === 'asc' ? -1 : 1;
  if (aValue > bValue) return direction === 'asc' ? 1 : -1;
  return 0;
};

export const compareProductsBySort = (a: any, b: any, sortConfig: { key: string; direction: 'asc' | 'desc' | null }) => {
  if (!sortConfig.direction) return 0;
  const numericSortKeys = new Set(['costPrice', 'sellingPrice', 'stock', 'totalIncoming', 'minStock', 'initialStock']);

  if (sortConfig.key === 'stock') {
    const aStock = getStockSortMetrics(a);
    const bStock = getStockSortMetrics(b);

    return (
      compareValues(aStock.packageCount, bStock.packageCount, sortConfig.direction) ||
      compareValues(aStock.remainderUnits, bStock.remainderUnits, sortConfig.direction) ||
      compareValues(aStock.totalUnits, bStock.totalUnits, sortConfig.direction)
    );
  }

  const aValue = numericSortKeys.has(sortConfig.key) ? Number(a[sortConfig.key] || 0) : a[sortConfig.key];
  const bValue = numericSortKeys.has(sortConfig.key) ? Number(b[sortConfig.key] || 0) : b[sortConfig.key];
  return compareValues(aValue, bValue, sortConfig.direction);
};
