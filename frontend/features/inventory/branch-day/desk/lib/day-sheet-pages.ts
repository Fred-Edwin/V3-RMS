import { SHEET_ROWS_PER_PAGE } from '../../_shared/types/branch-day-contract';

/**
 * Pagination of the printed day sheet (Paper B13b to B13d), pure so a test pins the rule. A4 is 794 by 1123 px. The cover is page 1; a
 * department starts on a new page and takes `max(1, ceil(items / SHEET_ROWS_PER_PAGE))` pages, so the first page of each department is the
 * `page` the back end sends. A long department continues on the next page with its heading row repeated (gap G17); its total row and
 * footnotes are on its last page. The signatures and the QR are on the last page only: when they do not fit under the last table they
 * take a page of their own, and the page count grows by one (the delivery note does the same).
 *
 * The heights are the blocks Paper draws, in px (ROW is the 9px-padding row of the six-row department, 47 with its rule).
 */
export const PAGE_HEIGHT = 1123;
const BAR = 10;
const TOP = 30;
const FOOTER = 47;
const ROOM = PAGE_HEIGHT - BAR - TOP - FOOTER;
const FIRST_HEAD = 188;
const CONTINUED_HEAD = 161;
export const SHEET_ROW = 47;
const TOTAL_ROW = 41;
const CLOSING_BLOCK = 300;

export type SheetPage =
  | { kind: 'cover' }
  | { kind: 'department'; department: number; from: number; to: number; first: boolean; last: boolean; closing: boolean }
  | { kind: 'closing' };

export interface SheetPlan {
  pages: SheetPage[];
  /** The first page of each department, in order (what the cover's PAGE column says). */
  departmentPages: number[];
}

/**
 * `itemCounts` is the number of rows of each department in order; `footnoteHeights` the height of each department's footnotes (0 when it has none).
 */
export function paginateDaySheet(itemCounts: readonly number[], footnoteHeights: readonly number[] = []): SheetPlan {
  const pages: SheetPage[] = [{ kind: 'cover' }];
  const departmentPages: number[] = [];
  itemCounts.forEach((count, department) => {
    departmentPages.push(pages.length + 1);
    const chunks = Math.max(1, Math.ceil(count / SHEET_ROWS_PER_PAGE));
    for (let c = 0; c < chunks; c += 1) {
      const from = c * SHEET_ROWS_PER_PAGE;
      const to = Math.min(count, from + SHEET_ROWS_PER_PAGE);
      const last = c === chunks - 1;
      const finalDepartment = department === itemCounts.length - 1;
      const used = (c === 0 ? FIRST_HEAD : CONTINUED_HEAD) + (to - from) * SHEET_ROW + (last ? TOTAL_ROW + (footnoteHeights[department] ?? 0) : 0);
      const closing = last && finalDepartment && used + CLOSING_BLOCK <= ROOM;
      pages.push({ kind: 'department', department, from, to, first: c === 0, last, closing });
    }
  });
  const tail = pages[pages.length - 1];
  if (itemCounts.length > 0 && tail?.kind === 'department' && !tail.closing) pages.push({ kind: 'closing' });
  if (itemCounts.length === 0) pages.push({ kind: 'closing' });
  return { pages, departmentPages };
}
