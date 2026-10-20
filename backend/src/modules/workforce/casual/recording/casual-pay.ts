import { formatCents, mulDiv, parseCents } from '../../payroll/engine/money';

/** A day is eight paid hours at the day rate (Rules, Casual work). */
export const DAY_MINUTES = 480;

/**
 * PD22: hours up to 8 pay `rate × hours ÷ 8`, hours over 8 pay `rate ÷ 8` each. Those are the same straight line, so the pay is
 * `rate × minutes ÷ 480`, rounded to the whole shilling, half up. A full 8 hour day is exactly the day rate. Money is bigint cents
 * here, never a float; the result is a string with two decimals ("900.00").
 */
export function casualDayPay(dailyRate: string, minutes: number): string {
  if (!Number.isInteger(minutes) || minutes <= 0) throw new RangeError('minutes must be a positive whole number');
  // shillings = rateCents × minutes ÷ (480 × 100), half up (payroll's one rounding rule), then back to cents.
  const shillings = mulDiv(parseCents(dailyRate), BigInt(minutes), BigInt(DAY_MINUTES) * 100n);
  return formatCents(shillings * 100n);
}

/** The working shown beside the pay: "8 h × KES 900 ÷ 8 = 900" (PD22). */
export function payWorking(dailyRate: string, minutes: number): string {
  const hours = minutes % 60 === 0 ? String(minutes / 60) : (minutes / 60).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  const rate = dailyRate.replace(/\.00$/, '');
  return `${hours} h × KES ${rate} ÷ 8 = ${casualDayPay(dailyRate, minutes).replace(/\.00$/, '')}`;
}

/** Adds shilling amounts held as two decimal strings. */
export const sumAmounts = (amounts: readonly string[]): string => formatCents(amounts.reduce((sum, a) => sum + parseCents(a), 0n));
