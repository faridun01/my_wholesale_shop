const formatDecimal = (value: unknown, digits = 2) => {
  const numeric = Number(value || 0);
  const fixed = numeric.toFixed(digits);
  const [wholePart, fractionPart] = fixed.split('.');
  const sign = wholePart.startsWith('-') ? '-' : '';
  const absoluteWhole = sign ? wholePart.slice(1) : wholePart;
  const groupedWhole = absoluteWhole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  return fractionPart !== undefined
    ? `${sign}${groupedWhole}.${fractionPart}`
    : `${sign}${groupedWhole}`;
};

export function toFixedNumber(value: unknown, digits = 2) {
  return formatDecimal(value, digits);
}

export function roundMoney(value: unknown, digits = 2) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Number(numeric.toFixed(digits));
}

export function formatMoney(value: unknown, currency = 'TJS') {
  return `${formatDecimal(value)} ${currency}`;
}

export function formatDollar(value: unknown) {
  return `$${formatDecimal(value)}`;
}

export function formatCount(value: unknown) {
  return `${Math.round(Number(value || 0))}`;
}

export function formatPercent(value: unknown, digits = 0) {
  return `${toFixedNumber(value, digits)}%`;
}
