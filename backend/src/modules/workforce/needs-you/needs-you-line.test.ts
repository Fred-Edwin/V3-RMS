import { describe, expect, it } from 'vitest';

import { lineOf } from './needs-you-groups';

const NOW = new Date('2026-10-22T09:00:00.000Z');
const daysAgo = (n: number): string => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('the grey line of a Needs you row', () => {
  it('names HR as HR, never "hr manager"', () => {
    expect(lineOf({ since: daysAgo(4), waitingOnRole: 'HR_MANAGER' }, NOW)).toBe('Waiting for HR, 4 days.');
  });

  it('says "the Director" and uses the singular for one day', () => {
    expect(lineOf({ since: daysAgo(1), waitingOnRole: 'DIRECTOR' }, NOW)).toBe('Waiting for the Director, 1 day.');
  });

  it('says "since today" for a row from today, and words a role it has no name for', () => {
    expect(lineOf({ since: daysAgo(0), waitingOnRole: 'SOME_NEW_ROLE' }, NOW)).toBe('Waiting for some new role, since today.');
  });
});
