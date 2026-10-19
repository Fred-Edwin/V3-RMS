import { describe, expect, it } from 'vitest';

import type { Period, Request } from '../types/timesheet-types';
import { answeredCompare, requestedCompare, shortCompare } from './request-compare';
import { cutoffWords, hm, periodLine, reasonsLine, requestTitle, weekLabel, wholeHours } from './timesheet-words';

const period = (over: Partial<Period> = {}): Period => ({
  id: 'p1',
  organizationId: 's1',
  start: '2026-10-01',
  end: '2026-10-31',
  label: 'October 2026',
  cutoffAt: '2026-11-02T15:00:00.000Z',
  state: 'OPEN',
  reportNumber: 7,
  closeKind: null,
  closedAt: null,
  closedById: null,
  signedById: null,
  signedAt: null,
  reopenedAt: null,
  reopenedById: null,
  reopenReason: null,
  ...over,
});

describe('period wording (Nairobi time)', () => {
  it('says when the month closes by itself, in Nairobi time (15:00 UTC is 18:00)', () => {
    expect(cutoffWords(period())).toBe('Monday 2 November, 18:00');
    expect(periodLine(period())).toBe('October 2026 · closes by itself on Monday 2 November, 18:00');
  });

  it('says a closed month is closed, and how', () => {
    expect(periodLine(period({ state: 'CLOSED', closedAt: '2026-11-02T15:00:00.000Z', closeKind: 'AUTO' }))).toBe('October 2026 · closed 2 November, 18:00 (automatically)');
  });

  it('labels a part week with only this month’s days', () => {
    // Monday 26 Oct to Sunday 1 Nov, in the October month: ends on the 31st.
    expect(weekLabel('2026-10-26', true, '2026-10-01', '2026-10-31')).toBe('26 Oct to 31 Oct · part week');
    // Monday 28 Sep to Sunday 4 Oct, in October: starts on the 1st.
    expect(weekLabel('2026-09-28', true, '2026-10-01', '2026-10-31')).toBe('1 Oct to 4 Oct · part week');
    expect(weekLabel('2026-10-05', false, '2026-10-01', '2026-10-31')).toBe('5 Oct to 11 Oct');
  });

  it('formats hours as the table prints them', () => {
    expect(hm(2465)).toBe('41 h 05');
    expect(hm(0)).toBe('0 h 00');
    expect(wholeHours(62760)).toBe('1,046 h');
  });
});

describe('reasons and request titles', () => {
  it('writes the reasons in words, with the minutes for lateness', () => {
    expect(reasonsLine(['LATE', 'AUTO_CLOSED'], 12)).toBe('Late 12 min · Closed by the phone');
    expect(reasonsLine(['OVERTIME'], 0)).toBe('');
  });

  it('titles a request by what it is about', () => {
    expect(requestTitle('CLOCK_TIME_WRONG', { type: 'OUT' }, '2026-10-09')).toBe('Clock-out, Fri 9 Oct');
    expect(requestTitle('OVERTIME_MISSING', {}, '2026-10-07')).toBe('Overtime, Wed 7 Oct');
  });
});

const req = (over: Partial<Request>): Pick<Request, 'kind' | 'recorded' | 'requested' | 'note' | 'state' | 'answerAfter'> => ({
  kind: 'CLOCK_TIME_WRONG',
  recorded: {},
  requested: {},
  note: 'I tapped Clock out by accident',
  state: 'WAITING',
  answerAfter: null,
  ...over,
});

describe('before and after of a request', () => {
  it('sets what was recorded against what the person says it should be', () => {
    const r = req({ recorded: { clockOut: '2026-10-09T08:20:00.000Z' }, requested: { type: 'OUT', at: '2026-10-09T11:00:00.000Z' } });
    expect(requestedCompare(r)).toEqual({ was: 'Out 11:20', want: 'Out 14:00' });
    expect(shortCompare(r)).toBe('Out 11:20, should be 14:00');
  });

  it('shows "Still on shift" when a clock-out taken away is the ask', () => {
    expect(requestedCompare(req({ kind: 'CLOCKED_OUT_BY_MISTAKE', recorded: { clockOut: '2026-10-09T08:20:00.000Z' } }))).toEqual({ was: 'Out 11:20', want: 'Still on shift' });
  });

  it('shows nothing for a request that changes no time, and the note on the list line', () => {
    const r = req({ kind: 'PAY_OTHER' });
    expect(requestedCompare(r)).toBeNull();
    expect(shortCompare(r)).toBe('I tapped Clock out by accident');
  });

  it('reads the correction the server made once it is approved, and nothing when declined', () => {
    const approved = req({ state: 'APPROVED', answerAfter: { before: { clockIn: '2026-10-09T02:58:00.000Z', clockOut: '2026-10-09T08:20:00.000Z' }, after: { clockIn: '2026-10-09T02:58:00.000Z', clockOut: '2026-10-09T11:00:00.000Z' } } });
    expect(answeredCompare(approved)).toEqual({ was: 'Out 11:20', want: 'Out 14:00' });
    expect(answeredCompare(req({ state: 'DECLINED', answerAfter: { outcome: 'DECLINE' } }))).toBeNull();
  });
});
