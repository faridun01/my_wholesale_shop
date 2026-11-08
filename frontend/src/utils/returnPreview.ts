import { addMoney, cumulativeValue } from './financial';
export function returnPreview(item: any, units: number) {
  if (!Number.isSafeInteger(units) || units < 0) return 0;
  const sold = Number(item.originalQuantity ?? item.quantity);
  const returned = Number(item.cumulativeReturnedQty ?? item.returnedQty ?? 0);
  if (sold <= 0 || returned + units > sold) return 0;
  const merchandise = item.originalEligibleNetAmount ?? item.eligibleNetAmount ?? 0;
  return addMoney(cumulativeValue(merchandise, returned + units, sold), -cumulativeValue(merchandise, returned, sold));
}
