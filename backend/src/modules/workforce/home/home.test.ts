import { describe, expect, it } from 'vitest';
import type { UserRole } from '@prisma/client';
import type { AccessSubject } from '../_shared/workforce-access';
import { groupCounts, groupOf, isOverdue, orderForHome, summariseForHome } from '../needs-you/needs-you-groups';
import type { NeedsYouRow } from '../needs-you/needs-you-types';
import { homeAudienceOf } from './home-audience';
import { kpisFor } from './home-kpis';
import { HOME_AUDIENCES, emptyFacts } from './home-types';

const subject = (role: UserRole, extra: Partial<AccessSubject> = {}): AccessSubject => ({ id: 'u1', role, siteId: 's1', ...extra });

describe('which Home a person gets', () => {
  const cases: Array<[UserRole, string, Partial<AccessSubject>?]> = [
    ['HR_MANAGER', 'HR'],
    ['DIRECTOR', 'DIRECTOR'],
    ['ACCOUNTANT', 'ACCOUNTANT'],
    ['MANAGER', 'BRANCH_MANAGER'],
    ['STORE_MANAGER', 'STORE_MANAGER'],
    ['SYSTEM_ADMIN', 'SYSTEM_ADMIN', { siteId: null }],
    ['CHEF', 'HEAD', { headOfDepartmentIds: ['d1'] }],
    ['WAITER', 'STAFF'],
    ['STORE_ATTENDANT', 'STAFF'],
  ];
  for (const [role, audience, extra] of cases) {
    it(`${role} gets the ${audience} Home`, () => expect(homeAudienceOf(subject(role, extra))).toBe(audience));
  }
  it('a head who is not a head any more is staff', () => expect(homeAudienceOf(subject('CHEF', { headOfDepartmentIds: [] }))).toBe('STAFF'));
});

describe('the five numbers', () => {
  it('gives every Home at least three and at most five cards, with unique keys', () => {
    for (const audience of HOME_AUDIENCES) {
      const cards = kpisFor(audience, emptyFacts());
      expect(cards.length, audience).toBeGreaterThanOrEqual(3);
      expect(cards.length, audience).toBeLessThanOrEqual(5);
      expect(new Set(cards.map((c) => c.key)).size, audience).toBe(cards.length);
    }
  });

  it('draws red only for a real problem (overdue, security) and amber for something to act on', () => {
    const quiet = emptyFacts();
    for (const audience of HOME_AUDIENCES) expect(kpisFor(audience, quiet).filter((c) => c.tone !== 'normal'), audience).toEqual([]);
    const hr = kpisFor('HR', { ...quiet, probationOverdue: 2, probationDueSoon: 1, blocksPayroll: 4, departmentsWithoutHead: 8, payChangesWaiting: 2 });
    expect(hr.filter((c) => c.tone === 'problem').map((c) => c.key)).toEqual(['probation']);
    expect(hr.filter((c) => c.tone === 'attention').map((c) => c.key)).toEqual(['blocks-payroll', 'no-head', 'pay-changes']);
    expect(kpisFor('SYSTEM_ADMIN', { ...quiet, openSecurityAlerts: 1 })[0]?.tone).toBe('problem');
  });

  it('counts overdue probation decisions inside the probation number and says so', () => {
    const card = kpisFor('DIRECTOR', { ...emptyFacts(), probationDueSoon: 3, probationOverdue: 1 }).find((c) => c.key === 'probation');
    expect(card).toMatchObject({ value: '4', detail: '1 overdue, 3 in 30 days', tone: 'problem' });
  });

  it('shows Password resets, never "Locked out", on the System Admin Home', () => {
    const labels = kpisFor('SYSTEM_ADMIN', emptyFacts()).map((c) => c.label.toLowerCase());
    expect(labels).toContain('password resets');
    expect(labels.some((l) => l.includes('locked'))).toBe(false);
  });

  it('never shows a pay figure: pay numbers are counts', () => {
    for (const audience of HOME_AUDIENCES) for (const c of kpisFor(audience, { ...emptyFacts(), payChangesWaiting: 2 })) expect(c.value).not.toMatch(/KES|\d,\d{3}/);
  });
});

const row = (id: string, kind: string, since: string): NeedsYouRow => ({ id, kind, text: id, opens: '/x', badge: null, since, siteId: 's1', siteName: 'Nyeri Town', waitingOnRole: 'X', personUserId: null, canRemind: false });

describe('Needs you grouping and order', () => {
  const now = new Date('2026-10-22T09:00:00Z');
  it('groups kinds under one chip', () => {
    expect(groupOf('overtime').key).toBe(groupOf('clock-fix').key);
    expect(groupOf('pay-change').label).toBe('Pay changes');
    expect(groupOf('never-heard-of-it').label).toBe('Other');
  });
  it('is overdue after 3 days waiting, and a passed probation date is overdue at once', () => {
    expect(isOverdue(row('a', 'leave', '2026-10-18T09:00:00Z'), now)).toBe(true);
    expect(isOverdue(row('b', 'leave', '2026-10-21T09:00:00Z'), now)).toBe(false);
    expect(isOverdue(row('c', 'attention-probation', '2026-10-21T00:00:00.000Z'), now)).toBe(true);
    expect(isOverdue(row('d', 'attention-probation', '2026-10-22T00:00:00.000Z'), now)).toBe(false);
  });
  it('puts overdue probation decisions first, then other overdue, then the oldest of the rest', () => {
    const ordered = orderForHome(
      [row('new', 'leave', '2026-10-22T08:00:00Z'), row('old-leave', 'leave', '2026-10-10T08:00:00Z'), row('probation', 'attention-probation', '2026-10-20T00:00:00.000Z'), row('older', 'leave', '2026-10-21T08:00:00Z')],
      now,
    );
    expect(ordered.map((r) => r.id)).toEqual(['probation', 'old-leave', 'older', 'new']);
  });
  it('summarises Home as one row per kind, overdue first, with the counts of Paper 1.1', () => {
    const at = (id: string, kind: string, since: string, text = id) => ({ ...row(id, kind, since), text });
    const marked = orderForHome(
      [
        at('probation', 'attention-probation', '2026-10-20T00:00:00.000Z', 'Joy Rotich · Barista · Nyeri Town'),
        at('pc1', 'pay-change', '2026-10-20T08:00:00Z'),
        at('pc2', 'pay-change', '2026-10-21T08:00:00Z'),
        at('l1', 'leave', '2026-10-22T07:00:00Z', 'Faith Njeri · Leave 3 days'),
      ],
      now,
    );
    const { summary, kinds } = summariseForHome(marked, now, 5);
    expect(kinds).toBe(3);
    expect(summary.map((s) => s.kindLabel)).toEqual(['Overdue · 1', 'Pay changes · 2', 'Leave · 1']);
    expect(summary[0]).toMatchObject({ title: 'Joy Rotich · Barista · Nyeri Town', action: 'Decide', overdue: true });
    expect(summary[1]).toMatchObject({ title: '2 pay changes waiting for the Director', line: 'The oldest is 2 days old.', action: 'Review' });
    expect(summary[2]).toMatchObject({ title: 'Faith Njeri · Leave 3 days', overdue: false });
    expect(summariseForHome(marked, now, 2).summary).toHaveLength(2);
  });

  it('counts per group in first-seen order', () => {
    const counts = groupCounts([row('a', 'leave', 'x'), row('b', 'pay-change', 'x'), row('c', 'leave', 'x')]);
    expect(counts.map((g) => [g.key, g.count])).toEqual([['leave', 2], ['pay-changes', 1]]);
  });
});
