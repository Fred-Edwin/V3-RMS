import { Prisma, type CountLineResult } from '@prisma/client';

// ---------------------------------------------------------------------------
// The one place a count line is judged (stock-count-waste-contract.md §5.4). A line has no stored
// difference: difference, percent and value are computed here from the counted figure, the expected
// figure and the unit cost. The Counting back end and the words on the screens share this file.
// The four first functions are the old counting/count-calc.ts rewritten (that file stays for branch day).
// ---------------------------------------------------------------------------

/** counted − expected, signed. Null when either side is missing. */
export const lineVariance = (counted: Prisma.Decimal | null, expected: Prisma.Decimal | null): Prisma.Decimal | null =>
  counted && expected ? counted.minus(expected) : null;

/** Signed KES value of a variance, unrounded (rounded only for display). */
export const lineVarianceValue = (variance: Prisma.Decimal | null, unitCost: Prisma.Decimal | null): Prisma.Decimal | null =>
  variance && unitCost ? variance.times(unitCost) : null;

/**
 * True when there is a variance and its absolute KES value reaches the amount. `0` means "always"; a zero variance
 * never does.
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

/** "Joseph Mwangi" → "J. Mwangi". */
export const shortName = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  return `${parts[0]!.charAt(0)}. ${parts[parts.length - 1]}`;
};

// --- Judging a line ---------------------------------------------------------

/** A streak of this many signed counts, newest first, makes the item a repeat shortfall (Director KPI, C4). */
export const REPEAT_SHORTFALL_RUN = 3;

export type JudgeInput = {
  /** What was typed; null when the line was skipped or never counted. */
  counted: Prisma.Decimal | null;
  /** The ledger on-hand at the counter's sign (live, while the count is OPEN). */
  expected: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  /** "Worth up to" KES and "at most" percent: the settings in force. */
  rangeKes: number;
  rangePercent: number | Prisma.Decimal;
};

export type Judgement = {
  result: CountLineResult;
  /** counted − expected; null for NOT_COUNTED. */
  difference: Prisma.Decimal | null;
  /** difference × unitCost, KES to 2 dp; null for NOT_COUNTED. */
  value: Prisma.Decimal | null;
  /** |difference| ÷ expected × 100, 2 dp; null for NOT_COUNTED and when expected ≤ 0 (no percent exists). */
  percent: Prisma.Decimal | null;
};

/**
 * `NOT_COUNTED` when there is no number (never adjusted, never judged); `MATCHES` when the difference is zero;
 * `WITHIN_RANGE` when BOTH `|value| ≤ rangeKes` AND `percent ≤ rangePercent` (a tie is within: the settings read
 * "worth up to" and "at most"); `EXCEEDS` otherwise. When `expected ≤ 0` the percent test cannot pass, so any
 * non-zero difference exceeds. Value and percent are compared at the 2 decimals the screens show.
 */
export const judgeLine = (input: JudgeInput): Judgement => {
  if (input.counted === null) return { result: 'NOT_COUNTED', difference: null, value: null, percent: null };

  const difference = input.counted.minus(input.expected);
  const value = difference.times(input.unitCost).toDecimalPlaces(2);
  if (difference.isZero()) return { result: 'MATCHES', difference, value, percent: new Prisma.Decimal(0) };

  const percent = input.expected.greaterThan(0) ? difference.abs().dividedBy(input.expected).times(100).toDecimalPlaces(2) : null;
  const within = percent !== null && value.abs().lessThanOrEqualTo(input.rangeKes) && percent.lessThanOrEqualTo(input.rangePercent);
  return { result: within ? 'WITHIN_RANGE' : 'EXCEEDS', difference, value, percent };
};

/**
 * Consecutive counts, newest first, in which the item was short (difference < 0), this one included. Pass the
 * differences of the counts that counted the item (a count that skipped it or left it out is not in the list), newest
 * first, with this count's first. 0 when the repeat-shortfall setting is off.
 */
export const shortStreak = (differencesNewestFirst: readonly Prisma.Decimal[], flagRepeat: boolean): number => {
  if (!flagRepeat) return 0;
  let streak = 0;
  for (const difference of differencesNewestFirst) {
    if (!difference.isNegative() || difference.isZero()) break;
    streak += 1;
  }
  return streak;
};

export const isRepeatShortfall = (streak: number): boolean => streak >= REPEAT_SHORTFALL_RUN;
