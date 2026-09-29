/**
 * `InventoryItem.currentCost` is stored per USAGE unit (KES 480 / kg), while
 * purchase and receipt prices are entered per BUY unit (KES 12,000 / bag).
 * Pre-fills that start from the item's cost must convert back up by the
 * item's conversion factor (null = 1:1). Returns a plain decimal string.
 */
export function buyUnitPriceFromCost(currentCost: string, conversionFactor: string | null): string {
  const cost = Number(currentCost);
  const factor = conversionFactor ? Number(conversionFactor) : 1;
  if (!Number.isFinite(cost) || !Number.isFinite(factor) || factor <= 0) return currentCost;
  // Round to 2dp: a money field, and it removes float noise from the 4dp cost.
  return String(Math.round(cost * factor * 100) / 100);
}
