import { describe, expect, it } from 'vitest';

import type { RestockLevelRow } from '../../types';
import {
  changeEffect,
  effectOfLevel,
  matchesStripFilter,
  parseLevelInput,
  rowsForTab,
  sortLowAndOutFirst,
  statusFor,
  suggestedPerDay,
  suggestionDiffers,
  suggestionVerdict,
} from './restock-logic';

const row = (over: Partial<RestockLevelRow>): RestockLevelRow => ({
  inventoryItemId: over.itemName ?? 'x',
  itemName: 'Item',
  usageUnit: 'kg',
  itemType: 'STOCKED',
  onHandQty: '10',
  level: null,
  isBelowLevel: false,
  status: 'NO_LEVEL',
  suggestedLevel: null,
  suggestionNote: null,
  daysOfCover: '15',
  ...over,
});

describe('statusFor (the backend rule)', () => {
  it('has no level, so no status', () => expect(statusFor(5, null)).toBe('NO_LEVEL'));
  it('is Out at zero or below, even for a level of 0', () => {
    expect(statusFor(0, 10)).toBe('OUT');
    expect(statusFor(-3, 10)).toBe('OUT');
    expect(statusFor(0, 0)).toBe('OUT');
  });
  it('is Low strictly below the level, OK at it', () => {
    expect(statusFor(42, 150)).toBe('LOW');
    expect(statusFor(100, 100)).toBe('OK');
    expect(statusFor(101, 100)).toBe('OK');
  });
});

describe('changeEffect', () => {
  it('names the four moves the design shows', () => {
    expect(changeEffect('LOW', 'LOW')).toMatchObject({ label: 'Stays Low', tone: 'neutral' });
    expect(changeEffect('OK', 'LOW')).toMatchObject({ label: 'Becomes Low', tone: 'warning' });
    expect(changeEffect('LOW', 'OK')).toMatchObject({ label: 'Becomes OK', tone: 'success' });
    expect(changeEffect('OK', 'OUT')).toMatchObject({ label: 'Becomes Out', tone: 'error' });
  });
  it('covers the other cases', () => {
    expect(changeEffect('OUT', 'OUT').label).toBe('Stays Out');
    expect(changeEffect('OK', 'OK').label).toBe('Stays OK');
    expect(changeEffect('NO_LEVEL', 'OK').label).toBe('Level set');
    expect(changeEffect('NO_LEVEL', 'LOW').label).toBe('Becomes Low');
    expect(changeEffect('LOW', 'NO_LEVEL').label).toBe('Level cleared');
  });
  it('works from on hand and the new level (Cooking oil 60 → 100 with 80 on hand)', () => {
    const oil = row({ onHandQty: '80', level: '60', status: 'OK' });
    expect(effectOfLevel(oil, 100).label).toBe('Becomes Low');
    expect(effectOfLevel(oil, 70).label).toBe('Stays OK');
  });
});

describe('parseLevelInput', () => {
  it('reads empty as clearing the level', () => expect(parseLevelInput('  ')).toEqual({ ok: true, level: null, text: null }));
  it('reads amounts, with separators', () => {
    expect(parseLevelInput('1,200')).toEqual({ ok: true, level: 1200, text: '1200' });
    expect(parseLevelInput('12.5')).toEqual({ ok: true, level: 12.5, text: '12.5' });
    expect(parseLevelInput('0')).toEqual({ ok: true, level: 0, text: '0' });
  });
  it('refuses the rest', () => {
    for (const bad of ['abc', '-5', '1.23456', '1..2', '12kg']) expect(parseLevelInput(bad).ok).toBe(false);
  });
});

describe('suggestionDiffers (more than 20% apart)', () => {
  it('is false at exactly 20%', () => expect(suggestionDiffers(100, 120)).toBe(false));
  it('is true beyond it, either way', () => {
    expect(suggestionDiffers(100, 121)).toBe(true);
    expect(suggestionDiffers(100, 79)).toBe(true);
  });
  it('needs a level and a suggestion', () => {
    expect(suggestionDiffers(null, 50)).toBe(false);
    expect(suggestionDiffers(50, null)).toBe(false);
  });
  it('differs for a level of 0 whenever a suggestion above 0 exists', () => {
    expect(suggestionDiffers(0, 3)).toBe(true);
    expect(suggestionDiffers(0, 0)).toBe(false);
  });
});

describe('suggestionVerdict', () => {
  it('reads "applied" when the typed level is the suggestion and it changed', () => expect(suggestionVerdict(150, 180, 180)).toBe('APPLIED'));
  it('reads "matches" when the saved level already is the suggestion', () => expect(suggestionVerdict(40, 40, 40)).toBe('MATCHES'));
  it('reads "close" within 20%', () => {
    expect(suggestionVerdict(55, 55, 60)).toBe('CLOSE');
    expect(suggestionVerdict(30, 30, 28)).toBe('CLOSE');
  });
  it('reads "you chose higher" more than 20% above', () => expect(suggestionVerdict(60, 100, 60 / 1.5)).toBe('HIGHER'));
  it('reads "you chose lower" more than 20% below', () => expect(suggestionVerdict(40, 40, 100)).toBe('LOWER'));
  it('has nothing to say with no level', () => expect(suggestionVerdict(null, null, 40)).toBeNull());
});

describe('suggestedPerDay', () => {
  it('divides the fixed 15 days of cover back out', () => {
    expect(suggestedPerDay(180)).toBe(12);
    expect(suggestedPerDay(40)).toBe(2.67);
    // an item with its own cover: 18 kg over 1.5 days is 12 a day
    expect(suggestedPerDay(18, 1.5)).toBe(12);
  });
});

describe('the list', () => {
  const rows = [
    row({ itemName: 'Wheat flour', status: 'OK', level: '100' }),
    row({ itemName: 'Brown sugar', status: 'OUT', level: '100' }),
    row({ itemName: 'Salt', status: 'NO_LEVEL' }),
    row({ itemName: 'Chicken, cut', status: 'LOW', level: '40' }),
    row({ itemName: 'Sugar, white', status: 'LOW', level: '150' }),
  ];
  it('puts Out then Low first, by name within', () => {
    expect(sortLowAndOutFirst(rows).map((r) => r.itemName)).toEqual(['Brown sugar', 'Chicken, cut', 'Sugar, white', 'Wheat flour', 'Salt']);
  });
  it('"Low and Out first" leaves out items with no level; "No level set" is only those; "All" is everything by name', () => {
    expect(rowsForTab(rows, 'LOW_OUT_FIRST').map((r) => r.itemName)).toEqual(['Brown sugar', 'Chicken, cut', 'Sugar, white', 'Wheat flour']);
    expect(rowsForTab(rows, 'NO_LEVEL').map((r) => r.itemName)).toEqual(['Salt']);
    expect(rowsForTab(rows, 'ALL').map((r) => r.itemName)).toEqual(['Brown sugar', 'Chicken, cut', 'Salt', 'Sugar, white', 'Wheat flour']);
  });
  it('filters by strip cell, "differ" from the suggestion', () => {
    const far = row({ level: '100', suggestedLevel: '150', status: 'OK' });
    expect(matchesStripFilter(far, 'DIFFER')).toBe(true);
    expect(matchesStripFilter(row({ level: '100', suggestedLevel: '110' }), 'DIFFER')).toBe(false);
    expect(matchesStripFilter(rows[1], 'OUT')).toBe(true);
    expect(matchesStripFilter(rows[2], 'NO_LEVEL')).toBe(true);
  });
});
