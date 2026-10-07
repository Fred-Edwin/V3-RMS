import { describe, expect, it } from 'vitest';
import { hasActiveFilters, isBackwardsRange, parseHistoryFilters, rangeText, toRunsQuery, writeHistoryFilters } from './history-filters';

const params = (qs: string) => new URLSearchParams(qs);

describe('parseHistoryFilters', () => {
  it('reads every filter from the URL', () => {
    const f = parseHistoryFilters(params('q=chick&output=o1&person=p1&status=CANCELLED&from=2026-10-01&to=2026-10-07&page=3'), false);
    expect(f).toEqual({ search: 'chick', outputItemId: 'o1', personId: 'p1', status: 'CANCELLED', from: '2026-10-01', to: '2026-10-07', mine: false, page: 3 });
  });
  it('ignores a bad status, a bad date and a bad page instead of sending them', () => {
    const f = parseHistoryFilters(params('status=BOGUS&from=yesterday&to=2026-13&page=-4'), false);
    expect(f).toMatchObject({ status: undefined, from: undefined, to: undefined, page: 1 });
  });
  it('starts the Attendant on "mine" and lets mine=0 turn it off', () => {
    expect(parseHistoryFilters(params(''), true).mine).toBe(true);
    expect(parseHistoryFilters(params('mine=0'), true).mine).toBe(false);
    expect(parseHistoryFilters(params(''), false).mine).toBe(false);
    expect(parseHistoryFilters(params('mine=1'), false).mine).toBe(true);
  });
});

describe('writeHistoryFilters', () => {
  const base = parseHistoryFilters(params(''), false);
  it('leaves defaults out so the clean URL is the default view', () => {
    expect(writeHistoryFilters(params(''), base, false).toString()).toBe('');
    expect(writeHistoryFilters(params(''), parseHistoryFilters(params(''), true), true).toString()).toBe('');
  });
  it('keeps the open run and other parameters', () => {
    const next = writeHistoryFilters(params('run=abc'), { ...base, status: 'CORRECTED', page: 2 }, false);
    expect(next.get('run')).toBe('abc');
    expect(next.get('status')).toBe('CORRECTED');
    expect(next.get('page')).toBe('2');
  });
  it('removes a filter that was cleared', () => {
    const current = parseHistoryFilters(params('q=x&status=CANCELLED'), false);
    expect(writeHistoryFilters(params('q=x&status=CANCELLED'), { ...current, search: '' }, false).toString()).toBe('status=CANCELLED');
  });
  it('writes mine=0 only when the Attendant turns their default off', () => {
    expect(writeHistoryFilters(params(''), { ...base, mine: false }, true).get('mine')).toBe('0');
    expect(writeHistoryFilters(params(''), { ...base, mine: true }, false).get('mine')).toBe('1');
  });
  it('round-trips', () => {
    const f = parseHistoryFilters(params('q=a&output=o&person=p&status=RECORDED&from=2026-10-01&to=2026-10-02&page=2&mine=1'), false);
    expect(parseHistoryFilters(writeHistoryFilters(params(''), f, false), false)).toEqual(f);
  });
});

describe('the query and the helpers', () => {
  it('builds the same query for the list and the export, without paging', () => {
    const q = toRunsQuery({ search: '', outputItemId: 'o', mine: true, page: 4, from: '2026-10-01' });
    expect(q).toEqual({ search: undefined, outputItemId: 'o', personId: undefined, status: undefined, mine: true, from: '2026-10-01', to: undefined });
    expect(q).not.toHaveProperty('page');
  });
  it('knows when Clear filters has work to do', () => {
    const d = parseHistoryFilters(params(''), true);
    expect(hasActiveFilters(d, true)).toBe(false);
    expect(hasActiveFilters({ ...d, mine: false }, true)).toBe(true);
    expect(hasActiveFilters({ ...d, search: 'x' }, true)).toBe(true);
  });
  it('spots a backwards range', () => {
    expect(isBackwardsRange({ from: '2026-10-07', to: '2026-10-01' })).toBe(true);
    expect(isBackwardsRange({ from: '2026-10-01', to: '2026-10-01' })).toBe(false);
    expect(isBackwardsRange({ from: '2026-10-01' })).toBe(false);
  });
  it('writes the range in words', () => {
    expect(rangeText({ from: '2026-09-29', to: '2026-10-12' })).toBe('29 Sep to 12 Oct 2026');
    expect(rangeText({ from: '2026-10-01' })).toBe('from 1 Oct 2026');
    expect(rangeText({})).toBe('');
  });
});
