import { describe, expect, it } from 'vitest';

import type { CountLine } from '../../_shared/types/branch-day-contract';
import { changedLines, cleanFigure, groupSections, isFigure, nextRowToCount, progressOf, stillToCount, unitHint } from './count-logic';

const line = (itemId: string, itemName: string, category: string, countedQty: string | null = null): CountLine => ({ itemId, itemName, unit: 'Bags', categoryPath: [category], countedQty });

describe('typing a figure', () => {
  it('keeps digits and one decimal point', () => {
    expect(cleanFigure('1a2')).toBe('12');
    expect(cleanFigure('1.2.3')).toBe('1.23');
    expect(cleanFigure('-4')).toBe('4');
    expect(cleanFigure('')).toBe('');
  });
  it('treats blank as not counted and zero as counted', () => {
    expect(isFigure('')).toBe(false);
    expect(isFigure('.')).toBe(false);
    expect(isFigure(null)).toBe(false);
    expect(isFigure('0')).toBe(true);
    expect(isFigure('2.5')).toBe(true);
  });
});

describe('progress', () => {
  const ids = ['a', 'b', 'c', 'd'];
  it('counts filled boxes, zero included', () => {
    expect(progressOf(ids, { a: '3', b: '0', c: '', d: '' })).toEqual({ filled: 2, total: 4, blank: 2, percent: 50 });
  });
  it('is 0% with no items', () => {
    expect(progressOf([], {}).percent).toBe(0);
  });
  it('words the helper line', () => {
    expect(stillToCount(3)).toBe('3 items still to count.');
    expect(stillToCount(1)).toBe('1 item still to count.');
    expect(stillToCount(0)).toBeNull();
  });
});

describe('Enter moves to the next empty row', () => {
  const ids = ['a', 'b', 'c', 'd'];
  it('skips filled rows', () => {
    expect(nextRowToCount(ids, { a: '1', b: '2', c: '', d: '' }, 0)).toBe(2);
  });
  it('falls back to the next row when everything below is filled, and ends at the last', () => {
    expect(nextRowToCount(ids, { a: '1', b: '2', c: '3', d: '4' }, 1)).toBe(2);
    expect(nextRowToCount(ids, { a: '1', b: '2', c: '3', d: '4' }, 3)).toBeNull();
  });
});

describe('what is saved and shown', () => {
  it('saves only changed boxes, and a cleared box as null', () => {
    expect(changedLines({ a: '3', b: '', c: '5' }, { a: '3', b: '4', c: '' })).toEqual([
      { itemId: 'b', countedQty: null },
      { itemId: 'c', countedQty: '5' },
    ]);
  });
  it('groups the check-and-sign sections in order', () => {
    const groups = groupSections([line('1', 'Beans', 'Drinks'), line('2', 'Milk', 'Drinks'), line('3', 'Cups', 'Serving')]);
    expect(groups).toEqual([
      { name: 'Drinks', itemCount: 2, names: ['Beans', 'Milk'] },
      { name: 'Serving', itemCount: 1, names: ['Cups'] },
    ]);
  });
  it('writes the unit hint', () => {
    expect(unitHint('Bags')).toBe('Count in bags');
  });
});
