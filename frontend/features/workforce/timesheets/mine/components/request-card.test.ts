import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { Request } from '../../_shared/types/timesheet-types';
import { RequestCard, stateWords } from './request-card';

const base: Request = {
  id: 'r1', organizationId: 's', employeeId: 'e', kind: 'CLOCK_TIME_WRONG', shiftDate: '2026-10-09', state: 'WAITING', note: 'I tapped Clock out by accident',
  recorded: { clockOut: '2026-10-09T08:20:00.000Z' }, requested: { type: 'OUT', at: '2026-10-09T11:00:00.000Z' }, waitingOnRole: 'MANAGER', waitingOnUserId: null, escalatedAt: null,
  decidedById: null, decidedAt: null, decisionReason: null, answerAfter: null, appliedEventId: null, createdAt: '2026-10-09T08:24:00.000Z',
  waitingOnName: null, waitingDays: 0, escalatedToHr: false, decidedByName: null,
};
const html = (r: Request): string => renderToStaticMarkup(h('ul', null, h(RequestCard, { request: r, busy: false, onWithdraw: () => undefined })));

describe('a request on My requests', () => {
  it('writes the state as Paper does', () => {
    expect(stateWords({ state: 'WAITING', waitingDays: 3 })).toBe('WAITING 3 DAYS');
    expect(stateWords({ state: 'DECLINED', waitingDays: 0 })).toBe('NOT APPROVED');
  });

  it('shows what was sent, that it is not answered, and lets the person take it back', () => {
    const out = html(base);
    expect(out).toContain('Clock-out, Fri 9 Oct');
    expect(out).toContain('Out 11:20, should be 14:00');
    expect(out).toContain('Not answered yet');
    expect(out).toContain('Take this request back');
  });

  it('says in words that a request has gone to HR after three days, and that nothing is needed', () => {
    const out = html({ ...base, waitingDays: 3, escalatedToHr: true, escalatedAt: '2026-10-12T08:00:00.000Z', waitingOnName: 'Mercy Achieng' });
    expect(out).toContain('Nobody has answered in 3 days, so this has also gone to HR (Mercy Achieng). You do not need to do anything.');
  });

  it('shows was and now when approved, who answered, and the day as it now reads', () => {
    const out = html({
      ...base, state: 'APPROVED', decidedByName: 'Faith Njeri', decidedAt: '2026-10-12T09:00:00.000Z',
      answerAfter: { before: { clockOut: '2026-10-09T08:20:00.000Z' }, after: { clockOut: '2026-10-09T11:00:00.000Z' }, day: { workedMinutes: 482 } },
    });
    expect(out).toContain('WAS');
    expect(out).toContain('Out 11:20');
    expect(out).toContain('Out 14:00');
    expect(out).toContain('Answered by Faith Njeri, 12 Oct 2026');
    expect(out).toContain('Your Friday now shows 8 h 02');
    expect(out).not.toContain('Take this request back');
  });

  it('gives the manager’s reason when it was not approved', () => {
    const out = html({ ...base, kind: 'OVERTIME_MISSING', state: 'DECLINED', decidedByName: 'Faith Njeri', decisionReason: 'Not agreed beforehand' });
    expect(out).toContain('Reason from Faith Njeri: Not agreed beforehand.');
  });
});
