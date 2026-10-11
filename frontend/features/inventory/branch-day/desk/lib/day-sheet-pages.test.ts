import { describe, expect, it } from 'vitest';

import { SHEET_ROWS_PER_PAGE } from '../../_shared/types/branch-day-contract';
import { paginateDaySheet } from './day-sheet-pages';

describe('paginateDaySheet', () => {
  it('draws Paper’s sheet: a cover, one page for each of five departments, signatures on the last page (six pages)', () => {
    const plan = paginateDaySheet([12, 8, 8, 9, 6], [0, 0, 36, 0, 0]);
    expect(plan.pages).toHaveLength(6);
    expect(plan.departmentPages).toEqual([2, 3, 4, 5, 6]);
    const last = plan.pages[5];
    expect(last).toMatchObject({ kind: 'department', department: 4, last: true, closing: true });
    expect(plan.pages.filter((p) => p.kind === 'department' && p.closing)).toHaveLength(1);
  });

  it('continues a long department on the next page with its rows split at the contract constant', () => {
    const plan = paginateDaySheet([SHEET_ROWS_PER_PAGE + 3]);
    const pages = plan.pages.filter((p) => p.kind === 'department');
    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({ from: 0, to: SHEET_ROWS_PER_PAGE, first: true, last: false });
    expect(pages[1]).toMatchObject({ from: SHEET_ROWS_PER_PAGE, to: SHEET_ROWS_PER_PAGE + 3, first: false, last: true });
  });

  it('keeps every department on its own pages and starts the next one on a new page', () => {
    const plan = paginateDaySheet([SHEET_ROWS_PER_PAGE * 2, 4]);
    expect(plan.departmentPages).toEqual([2, 4]);
  });

  it('gives the signatures a page of their own when they do not fit under the last table', () => {
    const plan = paginateDaySheet([SHEET_ROWS_PER_PAGE]);
    expect(plan.pages.at(-1)).toEqual({ kind: 'closing' });
    expect(plan.pages.filter((p) => p.kind === 'department' && p.closing)).toHaveLength(0);
  });

  it('gives an empty department one page', () => {
    expect(paginateDaySheet([0, 3]).departmentPages).toEqual([2, 3]);
  });
});
