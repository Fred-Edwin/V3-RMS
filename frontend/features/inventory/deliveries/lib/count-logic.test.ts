import { describe, expect, it } from 'vitest';

import { differenceText, itemWord } from '../../_shared/lib/block2-words';
import { countFooterNote, validCount } from './count-logic';

describe('item words in the count sentences', () => {
  it('takes the first word with no trailing comma, so "Bacon, collar" reads "bacon"', () => {
    expect(itemWord('Bacon, collar')).toBe('bacon');
    expect(itemWord('Milk 1L')).toBe('milk');
    expect(itemWord('  Beef sausage, choma')).toBe('beef');
    expect(itemWord('Mahamri')).toBe('mahamri');
  });

  it('names the lines that differ by direction, never calling an extra line short', () => {
    expect(differenceText(['SHORT'])).toBe('1 short');
    expect(differenceText(['SHORT', 'SHORT'])).toBe('2 short');
    expect(differenceText(['EXTRA'])).toBe('1 extra');
    expect(differenceText(['SHORT', 'EXTRA'])).toBe('1 short · 1 extra');
    expect(differenceText([])).toBe('');
  });

  it('writes the footer under Check and sign without a stray comma', () => {
    expect(countFooterNote(0, ['Bacon, collar'])).toBe('Count the bacon again to go on.');
    expect(countFooterNote(0, ['Bacon, collar', 'Milk 1L'])).toBe('Count the 2 flagged lines again to go on.');
    expect(countFooterNote(2, [])).toBe('2 lines still to count.');
    expect(countFooterNote(0, [])).toBeUndefined();
  });

  it('accepts 0 as a count and refuses an empty box', () => {
    expect(validCount('0')).toBe(true);
    expect(validCount('2.5')).toBe(true);
    expect(validCount('')).toBe(false);
    expect(validCount('-1')).toBe(false);
  });
});
