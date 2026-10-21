/**
 * The sidebar's attention marks (Paper 7.6). The boxed count is gone: a link with something waiting shows a 6 px amber dot and a small
 * number; the dot is red-brown only when something is overdue or blocks payroll. Nothing waiting draws nothing. A closed feature row
 * shows one dot and the SUM of its links; an open one shows the numbers on the links and never on the parent. Over 99 reads "99+".
 * Pure, so the rules are tested without a browser.
 */

export interface Mark {
  count: number;
  /** Red-brown dot: something here is overdue or blocks payroll. */
  urgent: boolean;
}

export const AMBER = '#D9A65E';
export const RED_BROWN = '#E4694A';
export const MARK_NUMBER = '#E8DFD0';

export const markText = (count: number): string => (count > 99 ? '99+' : String(count));

/** What a screen reader says: "3 waiting", "2 waiting, overdue". */
export const markSpoken = (m: Mark): string => `${markText(m.count)} waiting${m.urgent ? ', overdue' : ''}`;

export interface MarkedSub {
  count?: number;
  urgent?: boolean;
}

/** One link's mark, or null when nothing waits (a zero or missing count draws nothing). */
export const markOf = (count: number | undefined, urgent: boolean | undefined): Mark | null => (count && count > 0 ? { count, urgent: urgent === true } : null);

/** A closed feature: the sum of its links' numbers, urgent when any of them is. Null when the sum is 0. */
export function sumMark(subs: readonly MarkedSub[]): Mark | null {
  const count = subs.reduce((n, s) => n + (s.count && s.count > 0 ? s.count : 0), 0);
  return count > 0 ? { count, urgent: subs.some((s) => s.urgent === true && (s.count ?? 0) > 0) } : null;
}
