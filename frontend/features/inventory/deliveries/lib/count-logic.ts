import type { CountLine } from '../_shared/types/deliveries-contract';

/** A typed count the server accepts: digits and at most one point. 0 is a count; an empty box is not. */
export const validCount = (raw: string): boolean => /^\d+(\.\d+)?$/.test(raw.trim());

/**
 * A line shows the red "count again" flag while the server says COUNT_AGAIN and the person has not yet touched the box again.
 * Once they type, the flag clears and the next check is final.
 */
export const isFlagged = (line: Pick<CountLine, 'state' | 'lineId'>, touched: ReadonlySet<string>): boolean => line.state === 'COUNT_AGAIN' && !touched.has(line.lineId);

/** The line under "Check and sign": what is still to do. */
export function countFooterNote(left: number, flaggedNames: readonly string[]): string | undefined {
  if (flaggedNames.length > 0) {
    const first = flaggedNames[0] ?? '';
    const word = first.split(' ')[0]?.toLowerCase() ?? first.toLowerCase();
    return flaggedNames.length === 1 ? `Count the ${word} again to go on.` : `Count the ${flaggedNames.length} flagged lines again to go on.`;
  }
  if (left > 0) return `${left} ${left === 1 ? 'line' : 'lines'} still to count.`;
  return undefined;
}

/** "Line 2 of 3" for the reason sheet: how many differing lines there are and which one is open. */
export function reasonPosition(differing: readonly string[], currentId: string | undefined): { index: number; total: number } | null {
  if (!currentId) return null;
  const at = differing.indexOf(currentId);
  return at < 0 ? null : { index: at + 1, total: differing.length };
}
