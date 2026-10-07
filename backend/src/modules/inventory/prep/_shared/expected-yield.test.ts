import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import cases from './expected-yield.cases.json';
import { expectedYieldFor, formatAmount, isTypoSuspect, judgeYield, pastRunsExpected, scaleRecipe, vsUsualFor } from './expected-yield';

describe('shared cases (the front end copy must give the same answers)', () => {
  it.each(cases.scale)('scale %j', (c) => {
    expect(scaleRecipe(c)?.toString() ?? null).toBe(c.expected);
  });

  it.each(cases.judge)('judge %j', (c) => {
    const j = judgeYield(c.made, c.expected);
    expect(j.label).toBe(c.label);
    expect(j.tier).toBe(c.tier);
  });

  it.each(cases.typo)('typo %j', (c) => {
    expect(isTypoSuspect(c.made, c.expected)).toBe(c.suspect);
  });

  it('the front-end copy of the cases is identical', () => {
    const mine = readFileSync(join(__dirname, 'expected-yield.cases.json'), 'utf8');
    const theirs = readFileSync(join(__dirname, '../../../../../../frontend/features/inventory/prep/_shared/lib/expected-yield.cases.json'), 'utf8');
    expect(theirs).toBe(mine);
  });
});

describe('pastRunsExpected', () => {
  const now = new Date('2026-10-07T10:00:00Z');
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  it('is null with no runs', () => expect(pastRunsExpected([], now)).toBeNull());

  it('averages the runs in the last 30 days when that gives fewer than ten', () => {
    const runs = [
      { actualYield: '2', createdAt: daysAgo(1) },
      { actualYield: '4', createdAt: daysAgo(5) },
      { actualYield: '100', createdAt: daysAgo(60) },
    ];
    expect(pastRunsExpected(runs, now)?.toString()).toBe('3');
  });

  it('uses only the last ten runs when more than ten fall in the window', () => {
    const runs = Array.from({ length: 12 }, (_, i) => ({ actualYield: i < 10 ? '10' : '1000', createdAt: daysAgo(i + 1) }));
    expect(pastRunsExpected(runs, now)?.toString()).toBe('10');
  });

  it('is null when every run is older than the window and ten is not reached... but still uses the fewer set', () => {
    // Two old runs: the window gives zero, the last-ten gives two, "whichever gives fewer" is the window: nothing to judge by.
    const runs = [
      { actualYield: '5', createdAt: daysAgo(40) },
      { actualYield: '7', createdAt: daysAgo(50) },
    ];
    expect(pastRunsExpected(runs, now)).toBeNull();
  });
});

describe('wording', () => {
  it('rounds portions to whole numbers and kg to one decimal, dropping ".0"', () => {
    expect(formatAmount('75.6', 'portions')).toBe('76');
    expect(formatAmount('3', 'kg')).toBe('3');
    expect(formatAmount('2.96', 'kg')).toBe('3');
    expect(formatAmount('0.34', 'L')).toBe('0.3');
  });

  it('builds the expected-yield text per source', () => {
    expect(expectedYieldFor('76', 'portions', 'RECIPE').text).toBe('about 76 portions');
    expect(expectedYieldFor('3', 'kg', 'PAST_RUNS').text).toBe('about 3 kg, from past runs');
    expect(expectedYieldFor(null, 'kg', 'NONE')).toMatchObject({ amount: null, source: 'NONE' });
  });

  it('builds the vs-usual chip', () => {
    expect(vsUsualFor('72', '76', 'portions')).toEqual({ label: 'ON_TARGET', deltaAmount: '−4', text: 'on target' });
    expect(vsUsualFor('60', '76', 'portions')).toEqual({ label: 'LOW', deltaAmount: '−16', text: '−16 portions · low yield' });
    expect(vsUsualFor('3.3', '3', 'kg').deltaAmount).toBe('+0.3');
    expect(vsUsualFor('5', null, 'kg').label).toBe('NO_BASIS');
  });
});
