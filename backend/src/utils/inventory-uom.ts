import { Prisma } from '@prisma/client';

/**
 * UOM conversion (D-7): InventoryItem.conversionFactor is usage units per one
 * buy unit (e.g. buy in kg, usage in g -> conversionFactor = 1000).
 */
export const buyToUsageQty = (
  buyQty: Prisma.Decimal.Value,
  conversionFactor: Prisma.Decimal.Value,
): Prisma.Decimal => {
  return new Prisma.Decimal(buyQty).mul(conversionFactor);
};

export const usageToBuyQty = (
  usageQty: Prisma.Decimal.Value,
  conversionFactor: Prisma.Decimal.Value,
): Prisma.Decimal => {
  return new Prisma.Decimal(usageQty).div(conversionFactor);
};

/** Cost per one usage unit, given a cost per buy unit. */
export const costPerUsageUnit = (
  costPerBuyUnit: Prisma.Decimal.Value,
  conversionFactor: Prisma.Decimal.Value,
): Prisma.Decimal => {
  return new Prisma.Decimal(costPerBuyUnit).div(conversionFactor);
};

/** Cost per one buy unit, given a cost per usage unit. */
export const costPerBuyUnit = (
  costPerUsageUnitValue: Prisma.Decimal.Value,
  conversionFactor: Prisma.Decimal.Value,
): Prisma.Decimal => {
  return new Prisma.Decimal(costPerUsageUnitValue).mul(conversionFactor);
};
