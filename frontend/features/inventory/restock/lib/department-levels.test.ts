import { describe, expect, it } from 'vitest';

import { changeCountLabel, reviewSubline, stepLevel, suggestionLine } from './department-levels';

const row = { suggestedLevel: '14', suggestionNote: null, usageUnit: 'kg', daysOfCover: '2' } as const;

describe('stepLevel', () => {
  it('steps by one and never goes below zero', () => {
    expect(stepLevel('12', 1, null)).toBe('13');
    expect(stepLevel('12.5', -1, null)).toBe('11.5');
    expect(stepLevel('0', -1, null)).toBe('0');
    expect(stepLevel('0.5', -1, null)).toBe('0');
  });
  it('starts from the suggestion when there is no level', () => {
    expect(stepLevel(null, 1, '14')).toBe('14');
    expect(stepLevel(null, 1, null)).toBe('1');
    expect(stepLevel(null, -1, '14')).toBeNull();
  });
  it('does not drift with decimals', () => {
    expect(stepLevel('0.1', 1, null)).toBe('1.1');
  });
});

describe('suggestionLine', () => {
  it('says applied in green when the typed level equals the suggestion', () => {
    expect(suggestionLine(row, '12', '14')).toEqual({ text: 'Suggested 14 · applied. You use about 7 kg a day.', tone: 'success' });
  });
  it('says higher or lower when the typed level is far from it', () => {
    expect(suggestionLine({ ...row, suggestedLevel: '6' }, '6', '8')?.text).toBe('Suggested 6 · you chose higher');
    expect(suggestionLine({ ...row, suggestedLevel: '20' }, '20', '10')?.text).toBe('Suggested 20 · you chose lower');
  });
  it('shows the daily use when the level matches or is close', () => {
    expect(suggestionLine(row, '14', '14')?.text).toBe('Suggested 14 · you use about 7 kg a day');
  });
  it('explains a missing suggestion', () => {
    expect(suggestionLine({ ...row, suggestedLevel: null, suggestionNote: 'NEEDS_HISTORY' }, '1', '1')?.text).toBe('Needs 14 days of use first');
    expect(suggestionLine({ ...row, suggestedLevel: null }, '1', '1')).toBeNull();
  });
});

describe('review wording', () => {
  it('reads like the sheet', () => {
    expect(reviewSubline('STAYS_LOW', '9', 'kg')).toBe('Still Low · 9 kg on hand');
    expect(changeCountLabel(1)).toBe('1 change');
    expect(changeCountLabel(2)).toBe('2 changes');
  });
});
