import { decimal } from './financial';
import { roundMoney } from './format';

export const calculateEffectiveCost = (purchaseCost: unknown, expensePercent: unknown) => {
  const base = roundMoney(purchaseCost);
  const percent = Math.max(0, Number(expensePercent || 0));
  return roundMoney(decimal(base).times(decimal(percent).div(100).plus(1)).toNumber());
};

export const calculateDiscountAmount = (amount: unknown, discountPercent: unknown) => {
  const total = roundMoney(amount);
  const percent = Math.max(0, Number(discountPercent || 0));
  return roundMoney(decimal(total).times(percent).div(100).toNumber());
};

export const calculateLineTotal = (quantity: unknown, price: unknown) => {
  return roundMoney(decimal(quantity || 0).times(decimal(price || 0)).toNumber());
};

export const calculateUnitCostFromPackage = (packagePrice: unknown, unitsPerPackage: unknown) => {
  const packageCost = roundMoney(packagePrice);
  const units = Number(unitsPerPackage || 0);
  if (!Number.isFinite(units) || units <= 0) {
    return packageCost;
  }

  return roundMoney(decimal(packageCost).div(decimal(units)).toNumber());
};

export const calculateUnitCostFromLineTotal = (lineTotal: unknown, quantity: unknown) => {
  const total = roundMoney(lineTotal);
  const qty = Number(quantity || 0);
  if (!Number.isFinite(qty) || qty <= 0) {
    return 0;
  }

  return roundMoney(decimal(total).div(qty).toNumber());
};

