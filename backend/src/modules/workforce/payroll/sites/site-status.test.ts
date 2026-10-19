import { describe, expect, it } from 'vitest';
import { parseNairobiDate } from '../../_shared/time/nairobi-time';
import { monthWindow } from '../months/month-calendar';
import { approvalCount, classifySites, isCandidate, type SiteFacts } from './site-status';

const september = monthWindow('2026-09');
const d = parseNairobiDate;
const site = (over: Partial<SiteFacts> = {}): SiteFacts => ({ siteId: 's1', name: 'Nyeri Town', switchedOnAt: new Date('2026-08-15T08:00:00Z'), everInPayroll: false, period: null, headcount: 31, ...over });
const approved = { state: 'APPROVED' as const, approvedAt: new Date('2026-10-02T08:00:00Z'), approvedById: 'bm1', documentNumber: 9 };
const now = new Date('2026-10-10T09:00:00Z');

describe('isCandidate', () => {
  it('needs the switch on from the first day of the month, or an earlier payroll month', () => {
    expect(isCandidate({ switchedOnAt: new Date('2026-08-15T08:00:00Z'), everInPayroll: false }, september)).toBe(true);
    expect(isCandidate({ switchedOnAt: new Date('2026-08-31T21:00:00Z'), everInPayroll: false }, september)).toBe(true); // 1 Sep in Nairobi
    expect(isCandidate({ switchedOnAt: new Date('2026-09-03T08:00:00Z'), everInPayroll: false }, september)).toBe(false); // mid-month: the next full month
    expect(isCandidate({ switchedOnAt: null, everInPayroll: false }, september)).toBe(false);
    expect(isCandidate({ switchedOnAt: null, everInPayroll: true }, september)).toBe(true); // switched off later: it never returns to the old run
  });
});

describe('classifySites', () => {
  it('shows an approved site with its document, a waiting site with its days, and a site on the old run as not on the new system', () => {
    const rows = classifySites(
      [site({ period: approved }), site({ siteId: 's2', name: 'Nyeri Highway', headcount: 28 }), site({ siteId: 's3', name: 'Karatina', switchedOnAt: null, headcount: 12 })],
      september,
      d('2026-10-10'),
      new Map(),
      now,
    );
    expect(rows[0]).toMatchObject({ timesheetState: 'APPROVED', documentNumber: 'TSH-0009', approvedById: 'bm1' });
    expect(rows[1]).toMatchObject({ timesheetState: 'TO_APPROVE', waitingSince: '2026-10-01', waitingDays: 10, canRemindNow: true, canApproveLate: true });
    expect(rows[2]).toMatchObject({ timesheetState: 'NOT_ON_NEW_SYSTEM', canRemindNow: false, canApproveLate: false });
    expect(approvalCount(rows)).toEqual({ approved: 1, total: 2, people: 59, peopleApproved: 31 });
  });

  it('lets the Director approve for a site only after more than 5 days', () => {
    const at = (today: string) => classifySites([site()], september, d(today), new Map(), now)[0] ?? ({} as never);
    expect(at('2026-10-01')).toMatchObject({ waitingDays: 1, canApproveLate: false });
    expect(at('2026-10-06')).toMatchObject({ waitingDays: 6, canApproveLate: true });
    expect(at('2026-10-05')).toMatchObject({ canApproveLate: false });
  });

  it('does not offer a reminder before the month ends, or within 24 hours of the last one', () => {
    expect(classifySites([site()], september, d('2026-09-20'), new Map(), now)[0]).toMatchObject({ timesheetState: 'OPEN', canRemindNow: false, waitingSince: null });
    const recent = new Map([['s1', new Date('2026-10-10T02:00:00Z')]]);
    expect(classifySites([site()], september, d('2026-10-10'), recent, now)[0]).toMatchObject({ canRemindNow: false, lastReminderAt: '2026-10-10T02:00:00.000Z' });
    const old = new Map([['s1', new Date('2026-10-08T09:00:00Z')]]);
    expect(classifySites([site()], september, d('2026-10-10'), old, now)[0]?.canRemindNow).toBe(true);
  });
});
