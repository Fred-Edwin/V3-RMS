import { describe, expect, it } from 'vitest';

import {
  applyPatch,
  DEFAULT_PER_PAGE,
  hasActiveNarrowing,
  matchSummary,
  normalizePerPage,
  pageItems,
  parseTableQuery,
  showingText,
  splitMatches,
  totalPages,
  UNPAGED,
  writeTableQuery,
} from './table-query';

const shape = { filterKeys: ['status', 'categoryId'] as const };
const parse = (qs: string) => parseTableQuery(new URLSearchParams(qs), shape);

describe('URL round-trip', () => {
  it('reads defaults from a clean address', () => {
    expect(parse('')).toEqual({ page: 1, perPage: DEFAULT_PER_PAGE, search: '', filters: {} });
  });

  it('writes then reads the same view (refresh, Back and a pasted link land on it)', () => {
    const q = { page: 3, perPage: 25, search: 'oat milk', filters: { status: 'low', categoryId: 'c1' } };
    const qs = writeTableQuery(new URLSearchParams(), q, shape).toString();
    expect(parse(qs)).toEqual(q);
  });

  it('omits defaults so the clean address is the unfiltered list', () => {
    const qs = writeTableQuery(new URLSearchParams('page=4&perPage=100&search=x&status=low'), parse(''), shape);
    expect(qs.toString()).toBe('');
  });

  it('leaves parameters the table does not own (an open drawer) alone', () => {
    const q = { page: 2, perPage: DEFAULT_PER_PAGE, search: '', filters: {} };
    const qs = writeTableQuery(new URLSearchParams('item=abc'), q, shape);
    expect(qs.get('item')).toBe('abc');
    expect(qs.get('page')).toBe('2');
  });

  it('ignores a bad page and an unknown rows-per-page', () => {
    expect(parse('page=-3&perPage=7').page).toBe(1);
    expect(parse('page=abc').page).toBe(1);
    expect(parse('perPage=7').perPage).toBe(DEFAULT_PER_PAGE);
    expect(normalizePerPage(100)).toBe(100);
  });

  it('uses a custom search parameter', () => {
    const custom = { filterKeys: [], searchParam: 'q' };
    expect(parseTableQuery(new URLSearchParams('q=oat'), custom).search).toBe('oat');
    expect(writeTableQuery(new URLSearchParams(), { page: 1, perPage: 50, search: 'oat', filters: {} }, custom).toString()).toBe('q=oat');
  });

  it('keeps the whole list on one page when unpaged (the reorder exception)', () => {
    const unpaged = { filterKeys: [], paged: false };
    const q = parseTableQuery(new URLSearchParams('page=3&perPage=25'), unpaged);
    expect(q).toMatchObject({ page: 1, perPage: UNPAGED });
    expect(writeTableQuery(new URLSearchParams(), q, unpaged).toString()).toBe('');
  });
});

describe('changing the view', () => {
  const base = { page: 4, perPage: 50, search: '', filters: { status: 'low' } };

  it('returns to page 1 when a filter changes', () => {
    expect(applyPatch(base, { filters: { categoryId: 'c1' } }).page).toBe(1);
  });
  it('returns to page 1 when the search changes', () => {
    expect(applyPatch(base, { search: 'oat' }).page).toBe(1);
  });
  it('returns to page 1 when rows per page changes', () => {
    expect(applyPatch(base, { perPage: 100 }).page).toBe(1);
  });
  it('keeps the filters when only the page changes', () => {
    expect(applyPatch(base, { page: 5 })).toMatchObject({ page: 5, filters: { status: 'low' } });
  });
  it('clears a filter set back to All', () => {
    expect(applyPatch(base, { filters: { status: '' } }).filters).toEqual({});
  });
  it('knows when a search or filter is narrowing the list', () => {
    expect(hasActiveNarrowing(base)).toBe(true);
    expect(hasActiveNarrowing({ ...base, filters: {} })).toBe(false);
    expect(hasActiveNarrowing({ ...base, filters: {}, search: 'a' })).toBe(true);
  });
});

describe('pager', () => {
  it('shows every page when there are few', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it('collapses a long run: ‹ 1 2 3 … 12 ›', () => {
    expect(pageItems(1, 12)).toEqual([1, 2, 3, 4, 'gap', 11, 12]);
    expect(pageItems(6, 12)).toEqual([1, 2, 'gap', 5, 6, 7, 'gap', 11, 12]);
    expect(pageItems(12, 12)).toEqual([1, 2, 'gap', 9, 10, 11, 12]);
  });
  it('counts pages, at least one', () => {
    expect(totalPages(142, 50)).toBe(3);
    expect(totalPages(0, 50)).toBe(1);
    expect(totalPages(10, UNPAGED)).toBe(1);
  });
  it('words the footer like Paper', () => {
    expect(showingText(1, 50, 50, 142)).toBe('Showing 1–50 of 142');
    expect(showingText(3, 50, 42, 142)).toBe('Showing 101–142 of 142');
    expect(showingText(1, 50, 0, 0)).toBe('Showing 0 of 0');
  });
});

describe('type-ahead matches', () => {
  it('splits around every case-insensitive match', () => {
    expect(splitMatches('Oat milk, Goat cheese', 'oat')).toEqual([
      { text: 'Oat', match: true },
      { text: ' milk, G', match: false },
      { text: 'oat', match: true },
      { text: ' cheese', match: false },
    ]);
  });
  it('returns the text whole when nothing matches or the box is empty', () => {
    expect(splitMatches('Flour', 'oat')).toEqual([{ text: 'Flour', match: false }]);
    expect(splitMatches('Flour', '  ')).toEqual([{ text: 'Flour', match: false }]);
  });
  it('treats punctuation in the search as plain text', () => {
    expect(splitMatches('Milk (1 L)', '(1')).toEqual([
      { text: 'Milk ', match: false },
      { text: '(1', match: true },
      { text: ' L)', match: false },
    ]);
  });
  it('says what matched', () => {
    expect(matchSummary(3, 'oat')).toBe('3 matches for “oat”');
    expect(matchSummary(1, 'oat')).toBe('1 match for “oat”');
  });
});
