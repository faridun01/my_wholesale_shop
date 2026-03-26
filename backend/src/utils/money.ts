export const roundMoney = (value: unknown, digits = 2) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Number(numeric.toFixed(digits));
};

