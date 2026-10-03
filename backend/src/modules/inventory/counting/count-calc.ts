import { Prisma } from '@prisma/client';

/** counted − expected, signed. Null when either side is missing. */
export const lineVariance = (counted: Prisma.Decimal | null, expected: Prisma.Decimal | null): Prisma.Decimal | null =>
  counted && expected ? counted.minus(expected) : null;

/** Signed KES value of a variance, unrounded (rounded only for display). */
export const lineVarianceValue = (variance: Prisma.Decimal | null, unitCost: Prisma.Decimal | null): Prisma.Decimal | null =>
  variance && unitCost ? variance.times(unitCost) : null;

/**
 * A reason is required when there is a variance and its absolute KES value
 * reaches the threshold. `0` means "always" (plan §1.9); a zero variance never
 * needs one.
 */
export const isReasonRequired = (variance: Prisma.Decimal | null, unitCost: Prisma.Decimal | null, thresholdKes: number): boolean => {
  const value = lineVarianceValue(variance, unitCost);
  if (!variance || !value || variance.isZero()) return false;
  return value.abs().greaterThanOrEqualTo(thresholdKes);
};

/** Same test against the Director alert amount. */
export const isDirectorAlert = (variance: Prisma.Decimal | null, unitCost: Prisma.Decimal | null, alertKes: number): boolean =>
  isReasonRequired(variance, unitCost, alertKes);

export const toMoney = (value: Prisma.Decimal): string => value.toDecimalPlaces(2).toString();

/** "Joseph Mwangi" → "J. Mwangi" — the ledger counterparty style. */
export const shortName = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  return `${parts[0]!.charAt(0)}. ${parts[parts.length - 1]}`;
};
