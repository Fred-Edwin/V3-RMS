/** Money is a string with up to two decimals and is computed in whole cents (BigInt), never as a float. */

const CENTS = /^(\d{1,10})(?:\.(\d{1,2}))?$/;

export const toCents = (value: string): bigint => {
  const match = CENTS.exec(value);
  if (!match) throw new RangeError(`Not a money amount: ${value}`);
  return BigInt(match[1] ?? '0') * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
};

export const fromCents = (cents: bigint): string => {
  const whole = cents / 100n;
  const frac = (cents % 100n).toString().padStart(2, '0');
  return `${whole}.${frac}`;
};

/** Hours such as "48" or "7.5" in hundredths of an hour. */
const toHundredths = (value: string): bigint => {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new RangeError(`Not an hours value: ${value}`);
  return BigInt(match[1] ?? '0') * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
};

/** Integer division of positives, rounded half up. */
const divRound = (numerator: bigint, denominator: bigint): bigint => (numerator * 2n + denominator) / (denominator * 2n);

/**
 * Monthly: amount / (week hours x 52 / 12). Daily: amount / day hours. Half-up to 2 places.
 * Null until the hours are set (or when they are zero).
 */
export function hourlyEquivalent(
  payType: 'MONTHLY_SALARY' | 'DAILY_RATE',
  amount: string | null,
  standardWeekHours: string | null,
  standardDayHours: string | null,
): string | null {
  if (amount === null) return null;
  const cents = toCents(amount);
  if (payType === 'MONTHLY_SALARY') {
    if (standardWeekHours === null) return null;
    const week = toHundredths(standardWeekHours);
    if (week === 0n) return null;
    // cents / (week/100 * 52/12) = cents * 100 * 12 / (week * 52)
    return fromCents(divRound(cents * 100n * 12n, week * 52n));
  }
  if (standardDayHours === null) return null;
  const day = toHundredths(standardDayHours);
  if (day === 0n) return null;
  return fromCents(divRound(cents * 100n, day));
}
