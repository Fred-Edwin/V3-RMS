import { describe, expect, it } from 'vitest';

import type { MonthSite } from '../_shared/types/month-types';
import { oldSystemLine, remindWord, siteStatus, siteWhen } from './site-words';

const site = (over: Partial<MonthSite>): MonthSite => ({ siteId: 's', name: 'Nyeri Highway', headcount: 28, timesheetState: 'TO_APPROVE', approvedAt: null, documentNumber: null, ...over });

describe('a site in the month', () => {
  it('reads waiting with days since the month ended', () => {
    const s = site({ waitingSince: '2026-10-01', waitingDays: 18 });
    expect(siteStatus(s)).toEqual({ word: 'Waiting', tone: 'warning' });
    expect(siteWhen(s)).toBe('Since 1 Oct · 18 days');
  });
  it('says the month is not over while it is open', () => {
    expect(siteWhen(site({ timesheetState: 'OPEN' }))).toBe('Month not over yet');
  });
  it('shows a site on the old payslips with no colour and no reminder', () => {
    const s = site({ timesheetState: 'NOT_ON_NEW_SYSTEM' });
    expect(siteStatus(s).tone).toBe('muted');
    expect(siteWhen(s)).toBe('Paid by the old payslips');
    expect(remindWord(s).canRemind).toBe(false);
    expect(oldSystemLine([s])).toBe('28 people at Nyeri Highway are still paid by the old payslips.');
    expect(oldSystemLine([site({})])).toBeNull();
  });
  it('allows a reminder only when the server says now, else shows when it was sent', () => {
    expect(remindWord(site({ canRemindNow: true })).canRemind).toBe(true);
    const sent = remindWord(site({ canRemindNow: false, lastReminderAt: '2026-10-19T07:02:00.000Z' }));
    expect(sent.canRemind).toBe(false);
    expect(sent.reminded).toBe('Reminded 19 Oct, 10:02');
  });
});
