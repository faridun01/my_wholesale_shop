export const roundMoney = (value: unknown, digits = 2) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  const factor = Math.pow(10, digits);
  return Math.round((numeric + Math.sign(numeric || 1) * Number.EPSILON) * factor) / factor;
};

export const ceilMoney = (value: unknown, digits = 2) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  const factor = Math.pow(10, digits);
  return Math.ceil((numeric - Number.EPSILON) * factor) / factor;
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
  return new Intl.NumberFormat('ru-RU').format(numeric);
};

export const toFixedNumber = (value: unknown, digits = 2) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  const factor = Math.pow(10, digits);
  return Math.round((numeric + Math.sign(numeric || 1) * Number.EPSILON) * factor) / factor;
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

