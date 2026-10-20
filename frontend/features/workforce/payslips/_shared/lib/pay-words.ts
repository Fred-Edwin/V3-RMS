import type { PayslipItem } from '../types/payslip-types';

/** Words and numbers for the payslip screens. Pure; dates are Nairobi calendar days ('YYYY-MM-DD'), so no time zone maths is needed. */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const parts = (day: string): [number, number, number] => {
  const [y, m, d] = day.split('-').map(Number);
  return [y ?? 0, m ?? 1, d ?? 1];
};

/** "September" from "2026-09". */
export const monthName = (monthKey: string): string => MONTHS[(parts(`${monthKey}-01`)[1] ?? 1) - 1] ?? '';
/** "September 2026". */
export const monthLong = (monthKey: string): string => `${monthName(monthKey)} ${monthKey.slice(0, 4)}`;
/** "Fri 23 Oct". */
export function dayShort(day: string): string {
  const [y, m, d] = parts(day);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${(MONTHS[m - 1] ?? '').slice(0, 3)}`;
}
/** "20 Oct" from an instant or a day. */
export function dayMonth(value: string): string {
  const nairobi = value.length > 10 ? new Date(Date.parse(value) + 3 * 3600_000).toISOString().slice(0, 10) : value;
  const [, m, d] = parts(nairobi);
  return `${d} ${(MONTHS[m - 1] ?? '').slice(0, 3)}`;
}
/** "Pay day Fri 23 Oct" or "Paid Fri 25 Sep" (PD31). Empty when the pay day is not known yet. */
export const payLine = (p: Pick<PayslipItem, 'status' | 'payDay' | 'paidOn'>): { text: string; paid: boolean } => {
  if (p.status === 'PAID' && p.paidOn) return { text: `Paid ${dayShort(p.paidOn)}`, paid: true };
  if (p.status === 'PAID') return { text: 'Paid', paid: true };
  return { text: p.payDay ? `Pay day ${dayShort(p.payDay)}` : 'Pay day to be announced', paid: false };
};
/** "Version 2 · corrected 20 Oct" for a corrected payslip, else the pay line. */
export const rowLine = (p: PayslipItem): { text: string; paid: boolean } =>
  p.versionNumber > 1 && p.correctedAt ? { text: `Version ${p.versionNumber} · corrected ${dayMonth(p.correctedAt)}`, paid: false } : payLine(p);

/** "34,860" (whole shillings drop the cents); "7,329.50" keeps them. A minus sign for a negative line. */
export function money(value: string): string {
  const negative = value.startsWith('-');
  const [whole = '0', cents = '00'] = value.replace('-', '').split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '−' : ''}${/^0*$/.test(cents) ? grouped : `${grouped}.${cents.padEnd(2, '0').slice(0, 2)}`}`;
}

/** The year card: bar segments as whole percents of earned (taken off first, the rest is net). */
export function yearBar(earned: string, takenOff: string): { net: number; off: number } {
  const e = Number(earned);
  if (!(e > 0)) return { net: 100, off: 0 };
  const off = Math.min(100, Math.max(0, Math.round((Number(takenOff) / e) * 100)));
  return { net: 100 - off, off };
}

/** "JAN TO SEP" for the year card; one month reads as that month alone. */
export function yearRange(fromMonth: string, toMonth: string): string {
  const short = (m: string) => monthName(m).slice(0, 3).toUpperCase();
  return fromMonth === toMonth ? short(toMonth) : `${short(fromMonth)} TO ${short(toMonth)}`;
}

/** "Bank •••• 4412" line under the net: no bank profile hides it (S2). */
export const bankLine = (bank: { name: string; last4: string | null } | null): string =>
  bank ? `KES net · to ${bank.name}${bank.last4 ? ` •••• ${bank.last4}` : ''}` : 'KES net · bank details to come';
