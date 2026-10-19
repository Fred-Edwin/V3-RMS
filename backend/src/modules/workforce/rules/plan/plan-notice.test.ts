import { describe, expect, it, vi } from 'vitest';
import { GROUPS } from '../rules-values';
import { as } from '../testing/rules-fake';

vi.mock('../resolve/rules-repository', async (importOriginal) => ({ ...(await importOriginal<typeof import('../resolve/rules-repository')>()), rulesRepository: (await import('../testing/rules-fake')).fakeRulesRepository }));
vi.mock('../../../../config/database', () => ({ prisma: {} }));

import { impactRows } from './plan-impact';
import { audiencesFor, resolveNotice, toldAudiencesOf, toldCounts } from './plan-notice';
import { parseNairobiDate } from '../../_shared/time/nairobi-time';

describe('who is told (the TOLD column)', () => {
  it('every tab has an audience, and the pay tabs never tell a Branch Manager of the Accountant’s work', () => {
    for (const group of GROUPS) expect(toldAudiencesOf(group).length, group).toBeGreaterThan(0);
    expect(toldAudiencesOf('STATUTORY')).toEqual(['DIRECTOR', 'HR']);
    expect(toldAudiencesOf('WEEK_AND_BREAKS')).toEqual(['ALL_BRANCH_MANAGERS', 'DEPARTMENT_HEADS']);
  });

  it('a site’s own rule tells that site’s manager instead of all of them; a branch manager’s change also tells the Director', () => {
    expect([...audiencesFor('LATENESS', 's1', as('dir'), false)].sort()).toEqual(['ACCOUNTANT', 'BRANCH_MANAGER_OF_SITE', 'HR']);
    expect([...audiencesFor('LATENESS', 's1', as('bm1'), false)].sort()).toEqual(['ACCOUNTANT', 'BRANCH_MANAGER_OF_SITE', 'DIRECTOR', 'HR']);
  });

  it('minimum cover tells the department heads of the site rather than every manager', () => {
    expect([...audiencesFor('LEAVE', 's1', as('bm1'), true)].sort()).toEqual(['BRANCH_MANAGER_OF_SITE', 'DEPARTMENT_HEADS', 'DIRECTOR', 'HR']);
  });
});

describe('resolving the people', () => {
  it('never tells the person who made the change, and counts each person once per role', async () => {
    const notice = await resolveNotice('c1', null, as('bm1'), audiencesFor('LATENESS', null, as('bm1'), false));
    expect(notice.recipients.map((r) => r.userId)).not.toContain('bm1');
    expect(toldCounts(notice)).toEqual(expect.arrayContaining([{ role: 'BRANCH_MANAGER', count: 2 }, { role: 'DIRECTOR', count: 3 }])); // bm2 and the Store Manager; three Directors in the fixtures
  });

  it('department heads come from the head rows of the site', async () => {
    const notice = await resolveNotice('c1', 's1', as('dir'), new Set(['DEPARTMENT_HEADS']));
    expect(notice.recipients).toEqual([{ userId: 'head1', audience: 'DEPARTMENT_HEADS' }]);
  });
});

describe('the impact rows (D12)', () => {
  const from = parseNairobiDate('2026-11-02');
  const levels = (months: number[]) => ({ levels: ['VERBAL_NOTE', 'WRITTEN_WARNING', 'FINAL_WRITTEN_WARNING'].map((level, i) => ({ level, validForMonths: months[i] })) });

  it('conduct: issued notices keep their end date and new ones from the day end after the new months', () => {
    expect(impactRows('CONDUCT', ['levels'], levels([3, 6, 12]), levels([3, 9, 12]), from)).toEqual([
      { label: 'Notices already issued', value: 'Keep their old end date' },
      { label: 'Notices issued from 2 Nov', value: 'End after 9 months' },
      { label: 'Months already approved', value: 'Not changed' },
    ]);
  });

  it('leave: past leave is never recounted; minimum cover leaves approved leave as it is', () => {
    expect(impactRows('LEAVE', ['leaveTypes'], {}, {}, from)[0]).toEqual({ label: 'Leave already taken or booked', value: 'Not changed' });
    expect(impactRows('LEAVE', ['minimumCover'], {}, {}, from)[0]).toEqual({ label: 'Leave already approved', value: 'Stays as it is' });
  });

  it('a field with no honest calculation gets only the fixed statement, never a made-up count', () => {
    expect(impactRows('LATENESS', ['graceMinutes'], {}, {}, from)).toEqual([{ label: 'Months already approved', value: 'Not changed' }]);
    expect(impactRows('OVERTIME', ['approvalWindowHours'], {}, {}, from)).toEqual([{ label: 'Months already approved', value: 'Not changed' }]);
  });

  it('never more than three rows', () => {
    for (const group of GROUPS) expect(impactRows(group, ['levels', 'minimumCover'], levels([3, 6, 12]), levels([3, 9, 12]), from).length).toBeLessThanOrEqual(3);
  });
});
