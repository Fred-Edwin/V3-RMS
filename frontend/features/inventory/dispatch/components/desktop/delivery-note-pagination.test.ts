import { describe, expect, it } from 'vitest';

import { continuedLabel, paginateNote } from './delivery-note-print-screen';

const CLOSING_STORE = 219;

describe('the continuation line (D17c)', () => {
  it('names the lines a page carries, and says only the count on the signature page that carries none', () => {
    expect(continuedLabel(21, 36, 36)).toBe('Continued from page 1 · lines 21 to 36 of 36');
    expect(continuedLabel(0, 0, 19)).toBe('Continued · 19 lines');
    expect(continuedLabel(0, 0, 1)).toBe('Continued · 1 line');
  });

  it('a 19-line note puts every row on page 1 and the signature block alone on page 2', () => {
    const pages = paginateNote(19, CLOSING_STORE);
    expect(pages).toHaveLength(2);
    expect(pages[0]?.rows).toHaveLength(19);
    expect(pages[1]).toMatchObject({ rows: [], last: true });
  });
});

describe('paginateNote (Paper D17, D17c)', () => {
  it('keeps a short note on one page with the closing block', () => {
    const pages = paginateNote(8, CLOSING_STORE);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ first: true, last: true });
    expect(pages[0]?.rows).toHaveLength(8);
  });

  it('continues a long table on a second page; the closing block is on the last page only', () => {
    const pages = paginateNote(36, CLOSING_STORE);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.filter((p) => p.last)).toHaveLength(1);
    expect(pages[pages.length - 1]?.last).toBe(true);
    expect(pages[0]?.last).toBe(false);
  });

  it('never splits a line and never drops one: every row appears exactly once, in order', () => {
    for (const n of [1, 12, 20, 21, 25, 26, 36, 40, 60, 100]) {
      const rows = paginateNote(n, CLOSING_STORE).flatMap((p) => p.rows);
      expect(rows).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });

  it('gives the closing block a page of its own when it does not fit under the last row', () => {
    // A count that fills the last page right up to the closing block's height.
    const counts = Array.from({ length: 60 }, (_, i) => i + 1);
    const lone = counts.filter((n) => paginateNote(n, CLOSING_STORE).some((p) => p.last && p.rows.length === 0));
    for (const n of lone) {
      const pages = paginateNote(n, CLOSING_STORE);
      expect(pages[pages.length - 1]?.rows).toHaveLength(0);
      expect(pages.slice(0, -1).every((p) => p.rows.length > 0)).toBe(true);
    }
  });

  it('the branch copy has a shorter closing block, so it fits more rows on its last page', () => {
    const store = paginateNote(24, 219);
    const branch = paginateNote(24, 168);
    expect(branch.length).toBeLessThanOrEqual(store.length);
  });

  it('a voided note loses room for the band on every page', () => {
    const plain = paginateNote(20, CLOSING_STORE);
    const voided = paginateNote(20, CLOSING_STORE, true);
    expect(voided[0]?.rows.length).toBeLessThanOrEqual(plain[0]?.rows.length ?? 0);
  });
});
