import { Prisma } from '@prisma/client';

/**
 * Receiving prices are entered per BUY unit (a 25 kg bag at KES 12,000), but
 * `InventoryItem.currentCost` and the ledger's `unitCost` are per USAGE unit
 * (KES 480 / kg) — every consumer (counts, prep, waste, dispatch, stock
 * value) multiplies them by a usage-unit quantity.
 *
 * The factor is taken from the line's own saved quantities
 * (`quantityUsageUnit / quantityBuyUnit`, i.e. the factor that produced the
 * ledger quantity), so the cost and the quantity can never disagree. A
 * conversion-less item has equal quantities, so its factor is 1.
 * Rounded to the column's 4dp precision.
 */
export const costPerUsageUnit = (
  unitPrice: Prisma.Decimal,
  quantityBuyUnit: Prisma.Decimal,
  quantityUsageUnit: Prisma.Decimal,
): Prisma.Decimal => {
  if (quantityUsageUnit.isZero() || quantityBuyUnit.isZero()) return unitPrice;
  return unitPrice.times(quantityBuyUnit).dividedBy(quantityUsageUnit).toDecimalPlaces(4);
};
