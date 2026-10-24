import { describe, expect, it } from 'vitest';
import { instantAt, parseClockTime, parseNairobiDate } from '../../_shared/time/nairobi-time';
import type { DayData, EventRow } from '../attendance.types';
import { fixedAfterTheDay, PAST_DAY, whoCanSwitch } from './board-mode';

const DAY = parseNairobiDate('2026-10-23');
const event = (employeeId: string, createdAt: Date, recordedById: string | null): EventRow => ({
  id: `${employeeId}-${createdAt.getTime()}`, employeeId, rotaEntryId: null, shiftDate: DAY, type: 'IN', source: 'MANAGER', occurredAt: createdAt, serverAt: createdAt,
  createdAt, clientEventId: null, correctsEventId: null, voidsCorrected: false, skewFlagged: false, reasonCode: null, reason: null, recordedById,
});

describe('who can switch the clock', () => {
  it('reads the access table: the Director and the System Admin', () => {
    expect(whoCanSwitch().sort()).toEqual(['Director', 'System Admin']);
  });
});

describe('the past-day wording', () => {
  it('has no pronoun, no "expected by" and no "today"', () => {
    const words = JSON.stringify(PAST_DAY).toLowerCase();
    expect(words).not.toMatch(/expected by|on shift now|today|\bher\b|\bhis\b|\bshe\b|\bhe\b/);
    expect(PAST_DAY.tiles).toEqual({ onShift: 'WORKED', late: 'LATE', notIn: 'ABSENT', onLeave: 'ON LEAVE' });
  });
});

describe('"Fixed after the day"', () => {
  const afterMidnight = instantAt(parseNairobiDate('2026-10-24'), parseClockTime('09:30'));
  const duringTheDay = instantAt(DAY, parseClockTime('08:00'));
  const data: DayData = { entries: [], answers: [], events: [event('a', afterMidnight, 'mgr'), event('a', afterMidnight, 'mgr'), event('b', duringTheDay, 'mgr'), event('c', afterMidnight, null)] };

  it('counts only changes a person made after the day ended', () => {
    expect(fixedAfterTheDay(DAY, data, new Map([['a', 'Amina Hassan'], ['b', 'Joy Wanjiru'], ['c', 'Peter Kamau']]))).toEqual([{ employeeId: 'a', name: 'Amina Hassan', changes: 2 }]);
  });
});
