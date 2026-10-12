import type { DiscrepancyRow } from '../_shared/types/discrepancies-contract';

/** "1 sent · 0.5 counted · short 0.5" for one line of a delivery (Paper chapter 14, D). */
export function gapWords(sent: string, counted: string, gap: string): string {
  const n = Math.abs(Number(gap));
  return `${Number(sent)} sent · ${Number(counted)} counted · ${Number(gap) < 0 ? 'short' : 'extra'} ${n}`;
}

/** The open lines of the same delivery as `row` that the caller may record (the grouped drawer opens when there are two or more). */
export function openLinesOfDelivery(rows: readonly DiscrepancyRow[], row: DiscrepancyRow): DiscrepancyRow[] {
  return rows.filter((r) => r.dispatch.id === row.dispatch.id && r.status === 'OPEN' && r.can.recordFinding);
}
