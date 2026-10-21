import { describe, expect, it } from 'vitest';

import { addDays, defaultQuery, isFiltered, paramsFromQuery, queryFromParams } from './audit-query';
import { changeRows, fieldName } from './change-rows';
import { countWords, footerText, matchesLine, rangeLabel, shortHash, whenShort } from './audit-words';
import { filterParams } from '../services/audit-log-services';

const TODAY = '2026-10-19';
const from = (s: string) => {
  const p = new URLSearchParams(s);
  return queryFromParams((k) => p.get(k), TODAY);
};

describe('the log view in the address bar', () => {
  it('defaults to the last 30 days, newest first, 50 rows', () => {
    const q = from('');
    expect(q).toMatchObject({ from: '2026-09-20', to: TODAY, sort: 'newest', page: 1, pageSize: 50, event: 'all', flagged: false });
    expect(addDays(TODAY, -29)).toBe('2026-09-20');
  });

  it('round-trips only what differs from the default', () => {
    const q = { ...defaultQuery(TODAY), q: 'oat', event: 'pay' as const, flagged: true, page: 3, pageSize: 25 as const };
    const text = paramsFromQuery(q, TODAY).toString();
    expect(text).toBe('q=oat&event=pay&flagged=1&page=3&rows=25');
    expect(from(text)).toEqual(q);
    expect(paramsFromQuery(defaultQuery(TODAY), TODAY).toString()).toBe('');
  });

  it('ignores a hand-edited link instead of sending the API a 400', () => {
    const q = from('event=nope&area=X&site=not-a-uuid&rows=7&page=-4&from=yesterday&sort=sideways');
    expect(q).toMatchObject({ event: 'all', area: '', siteId: '', pageSize: 50, page: 1, sort: 'newest', from: '2026-09-20' });
  });

  it('swaps From and To when they are the wrong way round and never goes past today', () => {
    expect(from('from=2026-10-10&to=2026-10-01')).toMatchObject({ from: '2026-10-01', to: '2026-10-10' });
    expect(from('from=2026-10-10&to=2027-01-01').to).toBe(TODAY);
  });

  it('knows when a filter is on', () => {
    expect(isFiltered(defaultQuery(TODAY), TODAY)).toBe(false);
    expect(isFiltered({ ...defaultQuery(TODAY), flagged: true }, TODAY)).toBe(true);
    expect(isFiltered({ ...defaultQuery(TODAY), sort: 'oldest', page: 4 }, TODAY)).toBe(false);
  });

  it('sends the API only keys it accepts', () => {
    const p = filterParams({ ...defaultQuery(TODAY), q: ' oat ', event: 'pay', flagged: true });
    expect(Object.fromEntries(p)).toEqual({ q: 'oat', event: 'pay', flagged: 'true', from: '2026-09-20', to: TODAY, sort: 'newest' });
  });
});

describe('the words of the log', () => {
  it('writes the footer, with the over-50,000 wording', () => {
    expect(footerText(1, 50, 50, 1284, true)).toBe('Showing 1 to 50 of 1,284');
    expect(footerText(3, 25, 25, 50000, false)).toBe('Showing 51 to 75 of over 50,000. Narrow the dates to count them.');
    expect(footerText(1, 50, 0, 0, true)).toBe('');
    expect(countWords(50000, false)).toBe('more than 50,000 entries');
    expect(countWords(1, true)).toBe('1 entry');
  });

  it('writes the search line only when there is a search', () => {
    expect(matchesLine(3, true, 'oat')).toBe('3 matches for “oat”');
    expect(matchesLine(1, true, 'oat')).toBe('1 match for “oat”');
    expect(matchesLine(3, true, '  ')).toBeNull();
    expect(matchesLine(50000, false, 'oat')).toBe('More than 50,000 matches for “oat”');
  });

  it('shows times in Nairobi, not the browser zone', () => {
    expect(whenShort('2026-10-19T11:05:00.000Z')).toBe('19 Oct 14:05');
    expect(rangeLabel('2026-09-20', TODAY, TODAY)).toBe('20 Sep to today');
    expect(rangeLabel('2026-10-19', '2026-10-19', TODAY)).toBe('Today');
    expect(shortHash('3f9ab1c2d3e4f5a6c21e')).toBe('3f9a…c21e');
  });
});

describe('what changed', () => {
  it('lists only the fields that moved, with plain values', () => {
    expect(changeRows({ latenessGrace: 5, same: 'x' }, { latenessGrace: 10, same: 'x', note: true })).toEqual([
      { field: 'Lateness grace', before: '5', after: '10' },
      { field: 'Note', before: '—', after: 'Yes' },
    ]);
    expect(changeRows(null, null)).toEqual([]);
    expect(fieldName('pay_run.status')).toBe('Pay run status');
  });
});
