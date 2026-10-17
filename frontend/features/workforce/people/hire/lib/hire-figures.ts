/**
 * The two figures the hire form shows before anything is saved. Both mirror the server (`pay-math.ts` and `probationEnd`), which
 * stays the authority; the file that comes back from the hire is what is kept. Money is whole cents in integers, never a float:
 * an amount is read as text, so 28000.10 is 2,800,010 cents exactly. Amounts over KES 1,000,000,000 are not previewed (the integers
 * would lose exactness); the server still accepts them.
 */
const SAFE_CENTS = 100_000_000_000;

const toCents = (value: string): number | null => {
  const m = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
  return cents <= SAFE_CENTS ? cents : null;
};
const toHundredths = (value: string): number | null => {
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(value.trim());
  return m ? Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0') : null;
};
/** Integer division of positives, rounded half up. */
const divRound = (n: number, d: number): number => Math.floor((n * 2 + d) / (d * 2));
const fromCents = (cents: number): string => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;

/** Monthly: amount ÷ (week hours × 52 ÷ 12). Daily: amount ÷ day hours. Half-up to two places; null until the numbers are usable. */
export function hourlyEquivalent(casual: boolean, amount: string, weekHours: string, dayHours: string): string | null {
  const cents = toCents(amount);
  if (cents === null) return null;
  if (casual) {
    const day = toHundredths(dayHours);
    return day === null || day === 0 ? null : fromCents(divRound(cents * 100, day));
  }
  const week = toHundredths(weekHours);
  return week === null || week === 0 ? null : fromCents(divRound(cents * 100 * 12, week * 52));
}

/** The working line under the figure: "KES 28,000 ÷ (48 h × 52 weeks ÷ 12)". */
export function hourlyWorking(casual: boolean, amount: string, weekHours: string, dayHours: string): string {
  const kes = `KES ${Number(amount).toLocaleString('en-KE')}`;
  return casual ? `${kes} ÷ ${dayHours} h` : `${kes} ÷ (${weekHours} h × 52 weeks ÷ 12)`;
}

/** The same calendar day `months` later; a short month ends on its last day (31 Aug + 6 months is 28 Feb). */
export function addMonths(date: string, months: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + months;
  const year = Math.floor(total / 12);
  const month = total % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(Number(m[3]), lastDay);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Probation ends on the same day months later. A casual has none. */
export const probationEndsOn = (startDate: string, months: number, casual: boolean): string | null => (casual || months <= 0 ? null : addMonths(startDate, months));
