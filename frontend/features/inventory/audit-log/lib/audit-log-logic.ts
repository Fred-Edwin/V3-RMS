import type { AuditArea } from '../types/audit-log';

export const AREA_LABEL: Record<AuditArea, string> = { CATALOG: 'Catalog', SUPPLIERS: 'Suppliers', RESTOCK_LEVELS: 'Restock levels', PURCHASING: 'Purchasing', PAYMENTS: 'Payments', PREP: 'Prep' };
/** The area chips. Purchasing and Payments have their own "Purchasing and payments" view (Paper `23`), so they are not chips here. */
export const AREA_ORDER: readonly AuditArea[] = ['CATALOG', 'SUPPLIERS', 'RESTOCK_LEVELS', 'PREP'];

export type AuditPeriod = 'TODAY' | '7D' | '30D' | 'ANY';
export const PERIOD_LABEL: Record<AuditPeriod, string> = { TODAY: 'Today', '7D': 'Last 7 days', '30D': 'Last 30 days', ANY: 'Any time' };
export const PERIOD_ORDER: readonly AuditPeriod[] = ['TODAY', '7D', '30D', 'ANY'];

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** The `from` timestamp for a period (local midnight), or undefined for "any time". `to` is never sent: now is the end. */
export function periodStart(period: AuditPeriod, now: Date): string | undefined {
  const today = startOfDay(now);
  switch (period) {
    case 'TODAY':
      return today.toISOString();
    case '7D':
      return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).toISOString();
    case '30D':
      return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29).toISOString();
    case 'ANY':
      return undefined;
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n: number): string => String(n).padStart(2, '0');

/** "11:15" for today, "12 Oct 11:15" for any other day. */
export function whenLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const time = `${two(d.getHours())}:${two(d.getMinutes())}`;
  return startOfDay(d).getTime() === startOfDay(now).getTime() ? time : `${d.getDate()} ${MONTHS[d.getMonth()]} ${time}`;
}

/** "Showing today, Sat 3 Oct 2026." / "Showing the last 7 days." / "Showing everything on record." */
export function periodSentence(period: AuditPeriod, now: Date): string {
  if (period === 'ANY') return 'Showing everything on record.';
  if (period === 'TODAY') {
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];
    return `Showing today, ${day} ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}. Older entries stay available with the date filter.`;
  }
  return `Showing the ${PERIOD_LABEL[period].toLowerCase()}. Older entries stay available with the date filter.`;
}
