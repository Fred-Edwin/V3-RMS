import type { ClockTime, NairobiDate } from './nairobi-time';

export interface ShiftWindow {
  date: NairobiDate;
  startTime: ClockTime;
  endTime: ClockTime; // must be later than startTime
  unpaidBreakMinutes: number; // from the shift template (rules, WEEK_AND_BREAKS, shows it read-only)
}

export type ClockEventType = 'IN' | 'OUT' | 'AUTO_OUT' | 'CORRECTION';

/** One row of the append-only clock_events table, reduced to what the maths needs. */
export interface ClockEventFact {
  id: string;
  type: ClockEventType;
  occurredAt: Date; // the moment that counts (server-trusted)
  correctsEventId: string | null; // set on CORRECTION
  voidsCorrected: boolean; // CORRECTION that cancels the event it points at (undo)
}

/** An IN matched to its OUT. clockOut is null while the person is still on shift. */
export interface ClockPair {
  clockIn: Date;
  clockOut: Date | null;
  closedBy: 'OUT' | 'AUTO_OUT' | null;
}

export type DayStatus = 'NO_CLOCK' | 'OPEN' | 'CLOSED' | 'AUTO_CLOSED';

export interface LatenessResult {
  minutesLate: number; // raw, floored, never negative: 06:05 against 06:00 is 5
  countsAsLate: boolean; // minutesLate is more than the grace period
  minutesAfterGrace: number; // minutesLate minus grace when it counts as late, else 0
  earlyMinutes: number; // arrived before the start (not paid, not overtime)
}

export interface DayHours {
  shiftDate: NairobiDate;
  status: DayStatus;
  scheduledMinutes: number; // end minus start minus the unpaid break
  firstClockIn: Date | null;
  lastClockOut: Date | null;
  workedMinutes: number; // inside the scheduled window, break taken off, then rounded; never above scheduledMinutes
  breakMinutes: number; // the unpaid break actually taken off
  leftEarlyMinutes: number; // closed before the scheduled end
  afterEndMinutes: number; // time after the scheduled end: the raw overtime candidate
  lateness: LatenessResult | null; // null when there was no clock-in
}
