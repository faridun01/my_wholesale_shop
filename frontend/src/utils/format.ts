export function toFixedNumber(value: unknown, digits = 2) {
  const numeric = Number(value || 0);
  return numeric.toFixed(digits);
}

export function formatMoney(value: unknown, currency = 'TJS') {
  return `${toFixedNumber(value)} ${currency}`;
}

export function formatDollar(value: unknown) {
  return `$${toFixedNumber(value)}`;
}

export function formatCount(value: unknown) {
  return `${Math.round(Number(value || 0))}`;
}

export function formatPercent(value: unknown, digits = 0) {
  return `${toFixedNumber(value, digits)}%`;
}
