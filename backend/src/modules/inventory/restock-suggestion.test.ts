import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { computeSuggestion, restockStatus, suggestionDiffers } from './restock-suggestion';

const now = new Date('2026-10-03T00:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const d = (v: string) => new Prisma.Decimal(v);

describe('computeSuggestion', () => {
  it('has nothing to say with no use at all', () => {
    expect(computeSuggestion(undefined, now)).toEqual({ suggestedLevel: null, suggestionNote: null });
  });

  it('asks for 14 days of use first', () => {
    expect(computeSuggestion({ useInWindow: d('50'), firstUseAt: daysAgo(10) }, now)).toEqual({
      suggestedLevel: null,
      suggestionNote: 'NEEDS_HISTORY',
    });
  });

  it('averages over the 30-day window and covers 15 days', () => {
    // 360 kg over 30 days = 12 / day; × 15 = 180
    expect(computeSuggestion({ useInWindow: d('360'), firstUseAt: daysAgo(90) }, now).suggestedLevel).toBe('180.00');
  });

  it('averages over the history when it is shorter than 30 days', () => {
    // 20 days of history, 100 used = 5 / day; × 15 = 75
    expect(computeSuggestion({ useInWindow: d('100'), firstUseAt: daysAgo(20) }, now).suggestedLevel).toBe('75.00');
  });

  it('rounds up, never down', () => {
    // 1 over 30 days × 15 days of cover = 0.50 exactly; a hair more must round up to 0.51, never down.
    expect(computeSuggestion({ useInWindow: d('1'), firstUseAt: daysAgo(30) }, now).suggestedLevel).toBe('0.50');
    expect(computeSuggestion({ useInWindow: d('1.001'), firstUseAt: daysAgo(30) }, now).suggestedLevel).toBe('0.51');
  });

  it('gives no suggestion when net use in the window is not positive', () => {
    expect(computeSuggestion({ useInWindow: d('0'), firstUseAt: daysAgo(40) }, now)).toEqual({
      suggestedLevel: null,
      suggestionNote: null,
    });
    expect(computeSuggestion({ useInWindow: d('-3'), firstUseAt: daysAgo(40) }, now).suggestedLevel).toBeNull();
  });
});

describe('suggestionDiffers', () => {
  it('needs both a level and a suggestion', () => {
    expect(suggestionDiffers(null, '10.00')).toBe(false);
    expect(suggestionDiffers(d('10'), null)).toBe(false);
  });
  it('is true only beyond 20 %', () => {
    expect(suggestionDiffers(d('150'), '180.00')).toBe(false); // exactly 20 %
    expect(suggestionDiffers(d('150'), '181.00')).toBe(true);
    expect(suggestionDiffers(d('100'), '70.00')).toBe(true);
  });
  it('treats a zero level as different whenever there is a suggestion', () => {
    expect(suggestionDiffers(d('0'), '1.00')).toBe(true);
  });
});

describe('restockStatus', () => {
  it('classifies the four states', () => {
    expect(restockStatus(d('5'), null)).toBe('NO_LEVEL');
    expect(restockStatus(d('0'), d('10'))).toBe('OUT');
    expect(restockStatus(d('-2'), d('10'))).toBe('OUT');
    expect(restockStatus(d('4'), d('10'))).toBe('LOW');
    expect(restockStatus(d('10'), d('10'))).toBe('OK');
  });
});
