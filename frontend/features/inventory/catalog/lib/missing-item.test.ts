import { describe, expect, it } from 'vitest';

import { matchItems, missingItemErrors, packPreview, pluralUnit, tidyName, toMissingItemInput } from './missing-item';

const draft = { name: 'tomato paste', type: 'STOCKED', packUnit: 'tin', holds: '400', usageUnit: 'g' } as const;

describe('missing item form', () => {
  it('accepts the Paper example', () => {
    expect(missingItemErrors(draft)).toEqual({});
    expect(packPreview(draft)).toBe('1 tin = 400 g');
  });
  it('names each missing part', () => {
    const errors = missingItemErrors({ ...draft, name: ' ', packUnit: '', holds: '0', usageUnit: '' });
    expect(Object.keys(errors).sort()).toEqual(['holds', 'name', 'packUnit', 'usageUnit']);
    expect(missingItemErrors({ ...draft, holds: '4,0' }).holds).toBeDefined();
  });
  it('sends only what an attendant may send', () => {
    const body = toMissingItemInput(draft);
    expect(body).toEqual({ name: 'Tomato paste', type: 'STOCKED', buyUnit: 'tin', usageUnit: 'g', conversionFactor: '400', departmentTags: [] });
    expect(Object.keys(body)).not.toContain('categoryId');
    expect(Object.keys(body)).not.toContain('usualPrice');
  });
  it('tidies names and plurals', () => {
    expect(tidyName('  tomato   paste ')).toBe('Tomato paste');
    expect(pluralUnit('tin')).toBe('tins');
    expect(pluralUnit('box')).toBe('boxes');
  });
  it('finds starts-with before contains', () => {
    const items = [{ name: 'Paste, curry' }, { name: 'Tomato paste' }, { name: 'Tomatoes' }];
    expect(matchItems(items, 'tomato').map((i) => i.name)).toEqual(['Tomato paste', 'Tomatoes']);
    expect(matchItems(items, 'paste').map((i) => i.name)).toEqual(['Paste, curry', 'Tomato paste']);
    expect(matchItems(items, '  ')).toEqual([]);
  });
});
