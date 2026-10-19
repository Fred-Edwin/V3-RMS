/**
 * Money inside the payroll engine is whole cents as a bigint. Percentages and multipliers are scaled integers. Nothing here is a float.
 * Rounding is half up on the size of the number (so -2.5 becomes -3, like +2.5 becomes 3): one rule for every line (E5, P8).
 */
export type Cents = bigint;

const MONEY = /^(-?)(\d{1,12})(?:\.(\d{1,2}))?$/;

export function parseCents(value: string): Cents {
  const match = MONEY.exec(value);
  if (!match) throw new RangeError(`Not a money amount: ${value}`);
  const cents = BigInt(match[2] ?? '0') * 100n + BigInt((match[3] ?? '').padEnd(2, '0') || '0');
  return match[1] === '-' ? -cents : cents;
}

export function formatCents(cents: Cents): string {
  const negative = cents < 0n;
  const size = negative ? -cents : cents;
  return `${negative ? '-' : ''}${size / 100n}.${(size % 100n).toString().padStart(2, '0')}`;
}

/** Integer division, half up on the size. The denominator is positive. */
export function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError('The denominator must be positive');
  const negative = numerator < 0n;
  const size = negative ? -numerator : numerator;
  const quotient = (size * 2n + denominator) / (denominator * 2n);
  return negative ? -quotient : quotient;
}

/** `a × b ÷ c`, rounded once at the end (no rounding between the steps). */
export const mulDiv = (a: bigint, b: bigint, c: bigint): bigint => roundDiv(a * b, c);

/** A decimal string such as "6.5" or "1.5" as an integer times 10^places. Throws on more places than allowed. */
export function parseScaled(value: string, places: number): bigint {
  const match = /^(\d{1,12})(?:\.(\d+))?$/.exec(value);
  if (!match) throw new RangeError(`Not a number: ${value}`);
  const fraction = match[2] ?? '';
  if (fraction.length > places) throw new RangeError(`Too many decimals: ${value}`);
  return BigInt(match[1] ?? '0') * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, '0') || '0');
}

/** Rates are written with up to 4 decimals (the Rules schema); a rate of 6% is 60000 over a denominator of 10^6. */
export const RATE_PLACES = 4;
export const RATE_DENOMINATOR = 100n * 10n ** BigInt(RATE_PLACES);
export const parseRate = (percent: string): bigint => parseScaled(percent, RATE_PLACES);

/** `amount × percent ÷ 100`, rounded once. */
export const percentOf = (amount: Cents, percent: string): Cents => mulDiv(amount, parseRate(percent), RATE_DENOMINATOR);

/** Whole shillings with thousands separators, half up: what a screen and a payslip's working text show. */
export function formatWhole(cents: Cents): string {
  const shillings = roundDiv(cents, 100n);
  const negative = shillings < 0n;
  const digits = (negative ? -shillings : shillings).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return negative ? `-${digits}` : digits;
}

/** A percentage the way a payslip says it: "6%", "2.75%", "32.5%" (trailing zeros dropped). */
export function formatPercent(percent: string): string {
  return `${percent.includes('.') ? percent.replace(/0+$/, '').replace(/\.$/, '') : percent}%`;
}

export const sumCents = (values: readonly Cents[]): Cents => values.reduce((total, value) => total + value, 0n);
export const maxCents = (a: Cents, b: Cents): Cents => (a > b ? a : b);
export const minCents = (a: Cents, b: Cents): Cents => (a < b ? a : b);
