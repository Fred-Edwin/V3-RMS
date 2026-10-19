import type { MonthListRow } from '../../_shared/types/month-types';

/**
 * Which month the page opens on (spec D20): the oldest month that waits for approval, else the open month, else the newest one listed.
 * The list is newest first.
 */
export function defaultMonth(months: readonly MonthListRow[]): string | null {
  const waiting = months.filter((m) => m.state === 'TO_APPROVE');
  if (waiting.length > 0) return waiting[waiting.length - 1]!.monthKey;
  return (months.find((m) => m.state === 'OPEN') ?? months[0])?.monthKey ?? null;
}

/** The range in the address, or null (the whole month) when it is missing, half given or back to front. */
export function rangeFromUrl(from: string | null, to: string | null): { from: string; to: string } | null {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (!from || !to || !day.test(from) || !day.test(to) || from > to) return null;
  return { from, to };
}
