import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../config/database', () => ({ prisma: {} }));

import { RULE_DEFAULTS } from '../../rules/rules-defaults';
import { instantAt, parseClockTime, parseNairobiDate } from '../../_shared/time/nairobi-time';
import type { AnswerRow, AttendanceRuleSet, EntryRow, EventRow } from '../attendance.types';
import { buildEntryDay } from '../days/day-model';
import { closeCause } from './auto-close-service';

const RULES: AttendanceRuleSet = { attendance: RULE_DEFAULTS.ATTENDANCE, lateness: RULE_DEFAULTS.LATENESS };
const DAY = parseNairobiDate('2026-10-12');
const NEXT = parseNairobiDate('2026-10-13');
const at = (clock: string, date = DAY) => instantAt(date, parseClockTime(clock));
const ENTRY: EntryRow = { id: 'e1', employeeId: 'p1', date: DAY, templateName: 'Morning', colour: 'BLUE', startTime: '06:00', endTime: '14:00', unpaidBreakMinutes: 0 };
const clockIn: EventRow = {
  id: 'ev1', employeeId: 'p1', rotaEntryId: 'e1', shiftDate: DAY, type: 'IN', source: 'PHONE', occurredAt: at('05:58'), serverAt: at('05:58'), createdAt: at('05:58'),
  clientEventId: null, correctsEventId: null, voidsCorrected: false, skewFlagged: false, reasonCode: null, reason: null, recordedById: null,
};
const stay: AnswerRow = { rotaEntryId: 'e1', answer: 'STAY_ON', reasonCode: 'BUSY', estimateMinutes: 30, answeredAt: at('14:03') };
const cause = (now: Date, events: EventRow[] = [clockIn], answer: AnswerRow | null = null) => closeCause(buildEntryDay(ENTRY, events, answer, RULES, now), now);

describe('when the phone closes a shift (decision A6)', () => {
  it('leaves a person alone while the prompt is still inside its 15 minutes', () => {
    expect(cause(at('13:59'))).toBeNull();
    expect(cause(at('14:05'))).toBeNull();
    expect(cause(at('14:14'))).toBeNull();
  });

  it('closes an unanswered prompt 15 minutes after the scheduled end', () => {
    expect(cause(at('14:15'))).toBe('NO_ANSWER');
    expect(cause(at('18:00'))).toBe('NO_ANSWER');
  });

  it('does not close someone who said they are staying on, until the day is over', () => {
    expect(cause(at('14:30'), [clockIn], stay)).toBeNull();
    expect(cause(at('23:59'), [clockIn], stay)).toBeNull();
    expect(cause(at('00:04', NEXT), [clockIn], stay)).toBeNull();
    expect(cause(at('00:05', NEXT), [clockIn], stay)).toBe('FORGOT');
  });

  it('closes a clock-in nobody ended once Nairobi is past midnight, even before the shift-end prompt was due', () => {
    expect(cause(at('00:05', NEXT))).toBe('FORGOT');
  });

  it('never touches a shift that has no open clock-in, or is already closed', () => {
    expect(cause(at('15:00'), [])).toBeNull();
    expect(cause(at('15:00'), [clockIn, { ...clockIn, id: 'ev2', type: 'OUT', occurredAt: at('14:01'), createdAt: at('14:01') }])).toBeNull();
  });
});
