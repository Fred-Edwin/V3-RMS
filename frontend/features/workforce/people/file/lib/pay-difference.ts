import { daysBetween, formatDayMonthYear, formatKes } from '../../_shared/lib/people-dates';
import type { PayChangeRow } from '../../_shared/types/people-types';

export interface PayDifference {
  /** "+ KES 3,750" or "− KES 1,000". */
  amount: string;
  /** "16.7% more", "5% less" or "no change". */
  percent: string;
  direction: 'up' | 'down' | 'same';
}

const round1 = (n: number): string => (Math.round(n * 10) / 10).toString();

/** The difference line of the pay dialogs (frames 7.3 and 7.4): the amount and the percentage against the pay now. Null with no pay now. */
export function payDifference(now: string | null, next: string): PayDifference | null {
  if (now === null || Number(now) <= 0 || !(Number(next) > 0)) return null;
  const diff = Number(next) - Number(now);
  if (diff === 0) return { amount: formatKes('0'), percent: 'no change', direction: 'same' };
  const pct = (Math.abs(diff) / Number(now)) * 100;
  const abs = formatKes(Math.abs(diff).toFixed(2));
  return diff > 0 ? { amount: `+ ${abs}`, percent: `${round1(pct)}% more`, direction: 'up' } : { amount: `− ${abs}`, percent: `${round1(pct)}% less`, direction: 'down' };
}

/** The pay in force today and since when: the newest approved change that has started. */
export function payNowSince(history: readonly PayChangeRow[], today: string): { amount: string; since: string } | null {
  const started = history.filter((h) => h.status === 'APPROVED' && h.effectiveFrom <= today).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  return started ? { amount: started.amount, since: started.effectiveFrom } : null;
}

/** Another approved or waiting change that starts on or after the new start day: the new one would be replaced by it, or replace it. */
export function overlappingChange(history: readonly PayChangeRow[], startsOn: string, exceptId?: string): PayChangeRow | null {
  return history.find((h) => h.id !== exceptId && h.startsInFuture && (h.status === 'APPROVED' || h.status === 'PENDING') && startsOn <= h.effectiveFrom) ?? null;
}

/** "today", "yesterday", "3 days ago" for the asked-by line. */
export function askedAgo(requestedOn: string, today: string): string {
  const days = Math.max(0, daysBetween(requestedOn, today));
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

export const startsLine = (day: string): string => `Starts ${formatDayMonthYear(day)}`;
