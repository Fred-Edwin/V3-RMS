import type { Prisma } from '@prisma/client';

const MINUS = '−';

/** A plain decimal string for the wire ("160", "-20", "0.5"): never exponent notation. */
export const qty = (value: Prisma.Decimal): string => value.toFixed();

/** KES with two decimals for the wire ("30012.00"). */
export const money2 = (value: Prisma.Decimal): string => value.toDecimalPlaces(2).toFixed(2);

/** Whole shillings with thousands separators ("482,400"), of the absolute value. */
export const wholeKes = (value: Prisma.Decimal): string => Math.round(Math.abs(value.toNumber())).toLocaleString('en-US');

/** "KES 482,400"; a negative reads "−KES 360". */
export const kesText = (value: Prisma.Decimal): string => `${value.isNegative() && Math.round(Math.abs(value.toNumber())) > 0 ? MINUS : ''}KES ${wholeKes(value)}`;

/** "+KES 214,600" or "−KES 239,000". */
export const signedKesText = (value: Prisma.Decimal): string => `${value.isNegative() ? MINUS : '+'}KES ${wholeKes(value)}`;

/** "KES 482K" for the big KPI cells; under a thousand it stays exact. */
export const compactKesText = (value: Prisma.Decimal): string => {
  const n = Math.abs(value.toNumber());
  const sign = value.isNegative() && n >= 0.5 ? MINUS : '';
  if (n < 1000) return `${sign}KES ${Math.round(n)}`;
  if (n < 1_000_000) return `${sign}KES ${Math.round(n / 1000)}K`;
  return `${sign}KES ${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
};

/** A unit cost for a sentence: "183" for 183, "183.50" for 183.5. */
export const unitCostText = (value: Prisma.Decimal): string => {
  const rounded = value.toDecimalPlaces(2);
  return rounded.isInteger() ? rounded.toFixed(0) : rounded.toFixed(2);
};
