import { describe, expect, it } from 'vitest';

import { badgeText, kindCounts, kindLabel, matchesSearch, opensFor, rowName, sinceTone, sinceWords } from './needs-you-words';

// 20 Oct 2026, 12:00 in Nairobi (09:00 UTC).
const NOW = new Date('2026-10-20T09:00:00Z');

describe('since', () => {
  it('reads Today with the Nairobi clock, Yesterday, then days', () => {
    expect(sinceWords('2026-10-20T06:02:00Z', NOW)).toBe('Today 09:02');
    expect(sinceWords('2026-10-19T08:00:00Z', NOW)).toBe('Yesterday');
    expect(sinceWords('2026-10-17T08:00:00Z', NOW)).toBe('3 days');
    expect(sinceWords('2026-10-07T08:00:00Z', NOW)).toBe('13 days');
  });

  it('counts calendar days in Nairobi, not 24 hour blocks', () => {
    // 23:50 Nairobi yesterday is 20:50 UTC; at 00:10 Nairobi today it is already "Yesterday".
    const justAfterMidnight = new Date('2026-10-19T21:10:00Z');
    expect(sinceWords('2026-10-19T20:50:00Z', justAfterMidnight)).toBe('Yesterday');
  });

  it('is neutral today, amber from yesterday and red after 3 days', () => {
    expect(sinceTone('2026-10-20T05:00:00Z', NOW)).toBe('default');
    expect(sinceTone('2026-10-19T05:00:00Z', NOW)).toBe('warning');
    expect(sinceTone('2026-10-17T05:00:00Z', NOW)).toBe('warning');
    expect(sinceTone('2026-10-16T05:00:00Z', NOW)).toBe('error');
  });
});

describe('row wording', () => {
  it('names the row for a screen reader, with New only when it is new', () => {
    const row = { kind: 'overtime', text: 'Dan Kiprop, Waiter · 1 h 40 over the week', since: '2026-10-19T05:00:00Z', isNew: true };
    expect(rowName(row, NOW)).toBe('Overtime, Dan Kiprop, Waiter · 1 h 40 over the week, since Yesterday, new');
    expect(rowName({ ...row, isNew: false }, NOW)).not.toContain('new');
  });

  it('shows an unknown kind capitalised instead of hiding it', () => {
    expect(kindLabel('casual-pay')).toBe('Casual pay');
    expect(kindLabel('some-new-kind')).toBe('Some new kind');
  });

  it('caps a badge at 99+', () => {
    expect(badgeText(7)).toBe('7');
    expect(badgeText(99)).toBe('99');
    expect(badgeText(100)).toBe('99+');
  });

  it('counts kinds in the order they first appear', () => {
    expect(kindCounts([{ kind: 'overtime' }, { kind: 'clock-fix' }, { kind: 'overtime' }])).toEqual([
      { kind: 'overtime', count: 2 },
      { kind: 'clock-fix', count: 1 },
    ]);
  });

  it('searches kind, text and site', () => {
    const row = { kind: 'overtime', text: 'Dan Kiprop, Waiter', siteName: 'Nyeri Town' };
    expect(matchesSearch(row, 'dan')).toBe(true);
    expect(matchesSearch(row, 'nyeri town')).toBe(true);
    expect(matchesSearch(row, 'nobody')).toBe(false);
    expect(matchesSearch(row, '  ')).toBe(true);
  });
});

describe('links the server guessed', () => {
  it('sends a casual sheet to the approval list, the statutory tables to their tab and the P9 to its year', () => {
    expect(opensFor({ kind: 'casual-pay', text: 'x', opens: '/app/workforce/casual?sheet=abc' })).toBe('/app/workforce/casuals/approve');
    expect(opensFor({ kind: 'tables', text: 'x', opens: '/app/workforce/rules/statutory' })).toBe('/app/workforce/rules?tab=statutory');
    expect(opensFor({ kind: 'p9', text: 'Confirm the P9 format for 2026', opens: '/app/workforce/payslips/p9' })).toBe('/app/workforce/my-payslips/p9/2026');
  });

  it('leaves a link that is already right alone', () => {
    expect(opensFor({ kind: 'overtime', text: 'x', opens: '/app/workforce/timesheets' })).toBe('/app/workforce/timesheets');
  });
});
