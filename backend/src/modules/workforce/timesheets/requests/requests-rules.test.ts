import { describe, expect, it } from 'vitest';
import { escalationCut, escalationDue, firstApprover, waitingDays } from './requests-rules';

describe('who a request waits on', () => {
  it('goes to the Branch Manager, the Store Manager for the hub, and to HR for pay questions', () => {
    expect(firstApprover('CLOCK_TIME_WRONG', 'BARISTA')).toBe('MANAGER');
    expect(firstApprover('OVERTIME_MISSING', 'WAITER')).toBe('MANAGER');
    expect(firstApprover('CLOCKED_OUT_BY_MISTAKE', 'STORE_ATTENDANT')).toBe('STORE_MANAGER');
    expect(firstApprover('PAY_OTHER', 'WAITER')).toBe('HR_MANAGER');
  });

  it('a manager\'s own request goes to HR: nobody answers their own', () => {
    expect(firstApprover('CLOCK_TIME_WRONG', 'MANAGER')).toBe('HR_MANAGER');
    expect(firstApprover('ROTA_WRONG', 'STORE_MANAGER')).toBe('HR_MANAGER');
  });
});

describe('escalation to HR after 3 days (Nairobi calendar days)', () => {
  const created = new Date('2026-10-12T08:00:00Z'); // Mon 12 Oct, 11:00 in Nairobi

  it('is not due on day 2, and is due on day 3', () => {
    expect(escalationDue(created, new Date('2026-10-14T20:00:00Z'))).toBe(false); // Wed 23:00 Nairobi
    expect(escalationDue(created, new Date('2026-10-14T21:00:00Z'))).toBe(true); // Thu 00:00 Nairobi
    expect(waitingDays(created, new Date('2026-10-15T07:00:00Z'))).toBe(3);
  });

  it('counts the Nairobi day, not the UTC day: 23:30 UTC is already tomorrow in Nairobi', () => {
    const lateNight = new Date('2026-10-12T21:30:00Z'); // Tue 13 Oct, 00:30 in Nairobi (still Mon 12 Oct in UTC)
    expect(waitingDays(lateNight, new Date('2026-10-15T20:59:00Z'))).toBe(2); // Thu 23:59 in Nairobi
    expect(waitingDays(lateNight, new Date('2026-10-15T21:00:00Z'))).toBe(3); // Fri 00:00 in Nairobi
  });

  it('the database cut is a superset of what is due, so nothing due is missed', () => {
    const due = new Date('2026-10-14T21:00:00Z');
    expect(created.getTime()).toBeLessThan(escalationCut(due).getTime());
    const justUnderTwoDays = new Date('2026-10-12T21:59:00Z'); // Tue 00:59 Nairobi
    expect(escalationDue(justUnderTwoDays, new Date('2026-10-14T21:00:00Z'))).toBe(false);
  });
});
