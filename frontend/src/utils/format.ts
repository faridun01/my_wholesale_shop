import { Decimal, decimal, fromCents, toCents } from './financial';
export const parseMoneyInput = (value: unknown): number | null => {
  let text = String(value ?? '').trim().replace(/[\s\u00a0\u202f]/g, '');
  if (!text) return null;
  if (text.includes(',') && text.includes('.')) {
    const decimalSeparator = text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.';
    const groupingSeparator = decimalSeparator === ',' ? '.' : ',';
    text = text.split(groupingSeparator).join('').replace(decimalSeparator, '.');
  } else {
    text = text.replace(',', '.');
  }
  text = text.replace(/^([+-]?)\./, (_match, sign) => `${sign}0.`);
  if (!/^[+-]?\d+(?:\.\d*)?(?:e[+-]?\d+)?$/i.test(text)) return null;
  try {
    return fromCents(toCents(text));
  } catch {
    return null;
  }
};
export const roundMoney = (value: unknown, digits = 2) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  if (digits === 2) return fromCents(toCents(value || 0));
  return decimal(value || 0).toDecimalPlaces(digits, Decimal.ROUND_HALF_UP).toNumber();
};

export const ceilMoney = (value: unknown, digits = 2) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return decimal(value || 0).toDecimalPlaces(digits, Decimal.ROUND_CEIL).toNumber();
};

/** Local calendar day as YYYY-MM-DD (what date inputs and the API's date filters use). */
export const toLocalDateKey = (value: Date | string | number) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const formatMoney = (value: unknown, currency = '') => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return `0 ${currency}`.trim();
  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundMoney(numeric));
  return `${formatted} ${currency}`.trim();
};

export const formatCount = (value: unknown) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '0';
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(Math.round(numeric));
};

export const toFixedNumber = (value: unknown, digits = 2) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return decimal(value || 0).toDecimalPlaces(digits, Decimal.ROUND_HALF_UP).toNumber();
};

export const normalizeDisplayBaseUnit = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || 'шт';
};

export const formatDollar = (value: unknown) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numeric);
};

export const formatPercent = (value: unknown, digits = 0) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '0%';
  return `${numeric.toFixed(digits)}%`;
};

export const formatTransactionReason = (reason?: unknown): string => {
  if (reason === null || reason === undefined) return 'Без причины';
  let s = String(reason).trim();
  if (!s || s === '-' || s === '---') return 'Без причины';

  // Strip leading 'Списание: ' if needed, or translate 'Write-off'
  if (/^write-?off$/i.test(s)) return 'Списание';
  if (/^write-?off:\s*/i.test(s)) s = s.replace(/^write-?off:\s*/i, 'Списание: ');

  // Cancelled invoice
  const cancelMatch = s.match(/^Invoice #?(\d+)\s+(Cancelled|Canceled)$/i);
  if (cancelMatch) return `Отмена накладной #${cancelMatch[1]}`;

  // Return from Invoice
  const returnMatch = s.match(/^Return from Invoice #?(\d+)$/i);
  if (returnMatch) return `Возврат по накладной #${returnMatch[1]}`;

  // Updated Invoice
  const updatedMatch = s.match(/^Updated Invoice #?(\d+)$/i);
  if (updatedMatch) return `Обновление накладной #${updatedMatch[1]}`;

  // Invoice #X alone
  const invMatch = s.match(/^Invoice #?(\d+)$/i);
  if (invMatch) return `Накладная #${invMatch[1]}`;

  // Transfer to/from warehouse
  const transferToMatch = s.match(/^Transfer to Warehouse:?\s*#?(\d+)/i);
  if (transferToMatch) return `Перемещение на склад #${transferToMatch[1]}`;
  const transferFromMatch = s.match(/^Transfer from Warehouse:?\s*#?(\d+)/i);
  if (transferFromMatch) return `Перемещение со склада #${transferFromMatch[1]}`;

  // Common stock movements
  if (/^initial stock$/i.test(s)) return 'Начальный остаток';
  if (/^stock arrival$/i.test(s)) return 'Поступление товара';
  if (/^ocr restock$/i.test(s)) return 'Пополнение по накладной';

  // Common english terms
  if (/^damaged$/i.test(s)) return 'Брак';
  if (/^spoiled$/i.test(s)) return 'Испорчен';
  if (/^lost$/i.test(s)) return 'Потеря';
  if (/^expired$/i.test(s)) return 'Просрочен';
  if (/^internal(\s+use)?$/i.test(s)) return 'Внутреннее использование';
  if (/^correction$/i.test(s)) return 'Корректировка';

  // Return formatted like ' (Накладная #57)' or '(Накладная #57)'
  const bareInvInParens = s.match(/^\(?\s*Накладная #(\d+)\s*\)?$/i);
  if (bareInvInParens) return `Возврат (Накладная #${bareInvInParens[1]})`;

  // Capitalize first letter if it's lower-case Russian
  if (s.length > 0) {
    s = s.charAt(0).toUpperCase() + s.slice(1);
  }

  return s;
};
