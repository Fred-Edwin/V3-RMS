import { describe, expect, it } from 'vitest';
import { groupCounts, orderForHome, summariseForHome, ageWords } from './needs-you-groups';
import type { NeedsYouRow } from './needs-you-types';

const NOW = new Date('2026-10-22T09:00:00Z');
const row = (id: string, kind: string, since: string): NeedsYouRow =>
  ({ id, kind, text: id, opens: '/x', badge: null, since, siteId: 's1', siteName: null, waitingOnRole: 'HR_MANAGER', personUserId: null }) as unknown as NeedsYouRow;

describe('Needs you kinds and ages', () => {
  it('counts kinds the same on Home and on the See all page: the Overdue row is not a kind', () => {
    const rows = orderForHome(
      [row('a', 'pay-change', '2026-10-01T00:00:00Z'), row('b', 'leave', '2026-10-02T00:00:00Z'), row('c', 'leave', '2026-10-22T08:00:00Z'), row('d', 'security', '2026-10-22T08:30:00Z')],
      NOW,
    );
    const home = summariseForHome(rows, NOW, 5);
    expect(home.summary.some((s) => s.overdue)).toBe(true);
    expect(home.kinds).toBe(groupCounts(rows).length);
    expect(home.kinds).toBe(3);
  });

  it('never says 0 days: a same-day item "came in today" and waits "since today"', () => {
    expect(ageWords(0)).toBe('since today');
    expect(ageWords(0, true)).toBe('came in today.');
    expect(ageWords(1)).toBe('1 day');
    expect(ageWords(3, true)).toBe('is 3 days old.');
    const rows = orderForHome([row('a', 'leave', '2026-10-22T08:00:00Z'), row('b', 'leave', '2026-10-22T08:30:00Z')], NOW);
    expect(summariseForHome(rows, NOW, 5).summary[0]?.line).toBe('The oldest came in today.');
  });
});
