import { describe, expect, it } from 'vitest';

import { ApiError } from '@/types/api';

import { ruleFailure, wordsForCode } from './error-words';
import { andList, hoursAsDays, isoWeekdayOf, longDay, minutesAsHours, multiplierWords, orList, perHourOver8, plainName, roleInSentence, toldPhrase } from './rules-words';
import { appliesFrom, bandLabel, bandProblem, fromDraft, toDraft } from './statutory-view';
import { greyLine } from './tab-copy';
import { TABS, tabOfSlug } from './tab-defs';
import type { RulesPage, StatutoryBand } from '../types/rules-types';

describe('words', () => {
  it('writes days the way Paper does', () => {
    expect(longDay('2026-11-02')).toBe('Mon 2 Nov 2026');
    expect(isoWeekdayOf('2026-11-01')).toBe(7);
  });
  it('shows whole days when hours divide by 24, otherwise hours', () => {
    expect(hoursAsDays(72)).toBe('3 days');
    expect(hoursAsDays(24)).toBe('1 day');
    expect(hoursAsDays(36)).toBe('36 hours');
  });
  it('formats hours, multipliers and the hourly rate over 8', () => {
    expect(minutesAsHours(750)).toBe('12.5 h');
    expect(multiplierWords('1.5')).toBe('1.5 ×');
    expect(multiplierWords('2')).toBe('2.0 ×');
    expect(multiplierWords(null)).toBe('Not set');
    expect(perHourOver8('900')).toBe('112.50');
  });
  it('names roles in a sentence and never a person', () => {
    expect(roleInSentence('DIRECTOR')).toBe('the Director');
    expect(roleInSentence('HR_MANAGER')).toBe('HR');
    expect(roleInSentence('MANAGER', 'Nyeri Town')).toBe('the Branch Manager of Nyeri Town');
    expect(orList(['the Director', 'HR', 'the Accountant'])).toBe('the Director, HR or the Accountant');
    expect(andList(['A', 'B'])).toBe('A and B');
    expect(plainName('Anne Muthoni (Accountant)')).toBe('Anne Muthoni');
  });
  it('says who is told with counts', () => {
    expect(toldPhrase([{ role: 'BRANCH_MANAGER', count: 4 }, { role: 'HR_MANAGER', count: 1 }, { role: 'ACCOUNTANT', count: 1 }])).toBe('The 4 Branch Managers, HR and the Accountant');
  });
});

describe('error words', () => {
  it('a wrong PIN is words, not a logout, and a lock says so', () => {
    expect(ruleFailure(new ApiError('x', 403, 'PIN_INVALID'))).toMatchObject({ kind: 'pin', text: 'That PIN is not right. Try again.' });
    expect(ruleFailure(new ApiError('x', 429, 'PIN_LOCKED')).kind).toBe('locked');
  });
  it('a stale save and a clashing day read in plain words', () => {
    expect(ruleFailure(new ApiError('x', 409, 'RULE_STALE', { latestVersion: 4 }))).toMatchObject({ kind: 'stale', latestVersion: 4 });
    const clash = wordsForCode('RULE_FUTURE_VERSION_EXISTS', '', { version: 3, effectiveFrom: '2026-11-02', withdrawable: true });
    expect(clash.text).toBe('Version 3 already starts on Mon 2 Nov 2026. Choose that day or later, or withdraw version 3 first.');
    expect(wordsForCode('RULE_DATE_NOT_WEEK_START', '', {}, 'Sunday').text).toBe('Pick a Sunday.');
  });
  it('a network failure says nothing was changed', () => {
    expect(ruleFailure(new Error('offline')).text).toBe('Could not save. Nothing was changed. Try again.');
  });
});

describe('statutory bands', () => {
  const bands: StatutoryBand[] = [
    { fromAmount: '0', toAmount: '24000', ratePercent: '10', flatAmount: null },
    { fromAmount: '24000', toAmount: '32333', ratePercent: '25', flatAmount: null },
    { fromAmount: '32333', toAmount: null, ratePercent: '30', flatAmount: null },
  ];
  it('shows widths, not from and to', () => {
    expect([0, 1, 2].map((i) => bandLabel(bands, i))).toEqual(['First 24,000', 'Next 8,333', 'Above 32,333']);
  });
  it('turns typed widths into contiguous stored bands and back', () => {
    const rows = toDraft(bands);
    expect(rows).toEqual([{ width: '24000', rate: '10' }, { width: '8333', rate: '25' }, { width: '', rate: '30' }]);
    expect(fromDraft(rows)).toEqual(bands);
  });
  it('refuses a band with no width or a rate over 100', () => {
    expect(bandProblem([{ width: '', rate: '10' }, { width: '', rate: '5' }])).toMatch(/width/);
    expect(bandProblem([{ width: '100', rate: '101' }])).toMatch(/rate/);
    expect(bandProblem([{ width: '', rate: '10' }])).toBeNull();
  });
  it('derives the day a table took its present form from history', () => {
    const table = (rate: string) => ({ values: { tables: [{ code: 'NSSF', name: 'NSSF', bands: [{ fromAmount: '0', toAmount: null, ratePercent: rate, flatAmount: null }], note: null }] } });
    const items = [
      { effectiveFrom: '2026-02-01', status: 'IN_FORCE', ...table('6') },
      { effectiveFrom: '2025-06-01', status: 'REPLACED', ...table('6') },
      { effectiveFrom: '2024-01-01', status: 'REPLACED', ...table('5') },
    ];
    expect(appliesFrom(items, (all) => all.find((t) => t.code === 'NSSF'))).toBe('2025-06-01');
    expect(appliesFrom([], () => undefined)).toBeNull();
  });
});

describe('tabs and the grey line', () => {
  it('has ten tabs with a slug each and falls back to Lateness', () => {
    expect(TABS).toHaveLength(10);
    expect(tabOfSlug('holidays').title).toBe('Holidays and pay');
    expect(tabOfSlug('nonsense').slug).toBe('lateness');
  });
  const page = (over: Partial<RulesPage>): RulesPage => ({ group: 'OVERTIME', organizationId: null, organizationName: null, values: {}, companyValues: null, version: 4, siteVersion: null, effectiveFrom: '2026-08-01', isDefault: false, expectedVersion: 4, expectedSiteVersion: 0, scheduled: null, pendingConfirmations: [], ownFields: [], rows: {}, sitesWithOwnRule: [], organizations: [], ...over });
  it('reads as Paper does', () => {
    expect(greyLine(page({}))).toBe('Company rule · version 4, in force since 1 Aug 2026 · overtime is paid only when a manager authorises it');
    expect(greyLine(page({ isDefault: true, version: 0, effectiveFrom: null }))).toContain('Starting values, nothing set yet');
    expect(greyLine(page({ group: 'LEAVE' }))).toMatch(/^Every change makes a new version/);
  });
});
