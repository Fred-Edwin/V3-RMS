/**
 * The planned cost of a rota, in whole cents (never a float). Shown only to callers who may read pay.
 * A monthly salary costs its weekly share (12 months over 52 weeks) for everyone on the rota; a daily rate costs the rate
 * for each day the person has a shift. It is an estimate for planning, not a payroll figure (decision R9).
 */
export const COST_BASIS = 'Weekly share of monthly salaries plus daily rates for planned days';

/** "12345.67" to 1234567 cents; null for anything that is not a plain money string. */
export function toCents(money: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(money.trim());
  if (!match) return null;
  return BigInt(match[1] ?? '0') * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
}

export function formatCents(cents: bigint): string {
  const whole = cents / 100n;
  const rest = (cents % 100n).toString().padStart(2, '0');
  return `${whole}.${rest}`;
}

export interface CostPerson {
  payType: 'MONTHLY_SALARY' | 'DAILY_RATE';
  /** The amount in force that week as a money string, or null when none is approved. */
  amount: string | null;
  /** Days with at least one shift. */
  shiftDays: number;
}

export function weekCostCents(people: readonly CostPerson[]): bigint {
  let total = 0n;
  for (const person of people) {
    const cents = person.amount ? toCents(person.amount) : null;
    if (cents === null) continue;
    if (person.payType === 'DAILY_RATE') total += cents * BigInt(person.shiftDays);
    else if (person.shiftDays > 0) total += (cents * 12n + 26n) / 52n; // rounded to the nearest cent
  }
  return total;
}
