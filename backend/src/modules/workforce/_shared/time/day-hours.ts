import type { AttendanceRules, LatenessRules } from '../../rules/rules-schemas';
import { assertNoOvernight, computeLateness, shiftInstants } from './lateness';
import { minutesOfDay } from './nairobi-time';
import type { ClockEventFact, ClockPair, DayHours, ShiftWindow } from './time-types';

const MS_PER_MINUTE = 60_000;
const wholeMinutes = (ms: number): number => Math.max(0, Math.floor(ms / MS_PER_MINUTE));

interface EffectiveEvent {
  fact: ClockEventFact;
  at: Date;
}

/**
 * Rule: replay the append-only events into IN/OUT pairs. A CORRECTION with voidsCorrected cancels the event it points
 * at (undo). A CORRECTION without it replaces that event's time. The latest correction of an event wins ("latest" is
 * the later row in the array, which is append order). Events that are not matched (an OUT with no IN, a correction of
 * an unknown event) are ignored and returned in `unmatched` for the timesheet to show. Duplicate event ids collapse to one.
 */
export function resolveClockPairs(events: readonly ClockEventFact[]): { pairs: ClockPair[]; unmatched: ClockEventFact[] } {
  const seen = new Set<string>();
  const originals: ClockEventFact[] = [];
  const corrections = new Map<string, ClockEventFact>();
  const unmatched: ClockEventFact[] = [];

  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    if (event.type === 'CORRECTION') {
      if (event.correctsEventId === null) unmatched.push(event);
      else corrections.set(event.correctsEventId, event); // a later row replaces an earlier one
    } else {
      originals.push(event);
    }
  }

  const originalIds = new Set(originals.map((event) => event.id));
  for (const [targetId, correction] of corrections) {
    if (!originalIds.has(targetId)) unmatched.push(correction);
  }

  const effective: EffectiveEvent[] = [];
  for (const fact of originals) {
    const correction = corrections.get(fact.id);
    if (correction?.voidsCorrected) continue;
    effective.push({ fact, at: correction ? correction.occurredAt : fact.occurredAt });
  }
  effective.sort((a, b) => a.at.getTime() - b.at.getTime()); // stable: ties keep append order

  const pairs: ClockPair[] = [];
  let open: ClockPair | null = null;
  for (const { fact, at } of effective) {
    if (fact.type === 'IN') {
      if (open) {
        unmatched.push(fact);
      } else {
        open = { clockIn: at, clockOut: null, closedBy: null };
        pairs.push(open);
      }
    } else if (open) {
      open.clockOut = at;
      open.closedBy = fact.type === 'AUTO_OUT' ? 'AUTO_OUT' : 'OUT';
      open = null;
    } else {
      unmatched.push(fact);
    }
  }
  return { pairs, unmatched };
}

const roundMinutes = (minutes: number, step: number, mode: AttendanceRules['roundingMode']): number => {
  if (step <= 1) return minutes;
  const steps = minutes / step;
  const rounded = mode === 'DOWN' ? Math.floor(steps) : mode === 'UP' ? Math.ceil(steps) : Math.round(steps);
  return rounded * step;
};

/**
 * Rule: time counts inside [scheduled start, scheduled end] only; the unpaid break is taken off once, never more than
 * the time worked; the result is rounded to attendance.roundingMinutes by attendance.roundingMode (0 = none) and never
 * exceeds scheduledMinutes. Several IN/OUT pairs in one shift add up; gaps between them are not worked. An open pair
 * counts up to `now` and the day is marked OPEN (callers must not pay an OPEN day). A pair closed by AUTO_OUT marks the
 * day AUTO_CLOSED. Time after the scheduled end is reported in afterEndMinutes, not in workedMinutes.
 * Feeds on: attendance.roundingMinutes, attendance.roundingMode, lateness.graceMinutes, the shift's unpaidBreakMinutes.
 */
export function computeDayHours(
  shift: ShiftWindow,
  pairs: readonly ClockPair[],
  now: Date,
  rules: { attendance: Pick<AttendanceRules, 'roundingMinutes' | 'roundingMode'>; lateness: Pick<LatenessRules, 'graceMinutes'> },
): DayHours {
  assertNoOvernight(shift);
  const windowMinutes = minutesOfDay(shift.endTime) - minutesOfDay(shift.startTime);
  const scheduledMinutes = Math.max(0, windowMinutes - shift.unpaidBreakMinutes);

  if (pairs.length === 0) {
    return {
      shiftDate: shift.date,
      status: 'NO_CLOCK',
      scheduledMinutes,
      firstClockIn: null,
      lastClockOut: null,
      workedMinutes: 0,
      breakMinutes: 0,
      leftEarlyMinutes: 0,
      afterEndMinutes: 0,
      lateness: null,
    };
  }

  const { start, end } = shiftInstants(shift);
  let insideMs = 0;
  let afterEndMs = 0;
  let isOpen = false;
  let autoClosed = false;
  let firstClockIn = pairs[0]!.clockIn;
  let lastClockOut: Date | null = null;

  for (const clock of pairs) {
    const out = clock.clockOut ?? now;
    if (clock.clockOut === null) isOpen = true;
    if (clock.closedBy === 'AUTO_OUT') autoClosed = true;
    if (clock.clockIn.getTime() < firstClockIn.getTime()) firstClockIn = clock.clockIn;
    if (clock.clockOut !== null && (lastClockOut === null || clock.clockOut.getTime() > lastClockOut.getTime())) lastClockOut = clock.clockOut;

    const insideStart = Math.max(clock.clockIn.getTime(), start.getTime());
    const insideEnd = Math.min(out.getTime(), end.getTime());
    if (insideEnd > insideStart) insideMs += insideEnd - insideStart;
    const afterStart = Math.max(clock.clockIn.getTime(), end.getTime());
    if (out.getTime() > afterStart) afterEndMs += out.getTime() - afterStart;
  }

  const insideMinutes = wholeMinutes(insideMs);
  const breakMinutes = Math.min(shift.unpaidBreakMinutes, insideMinutes);
  const rounded = roundMinutes(insideMinutes - breakMinutes, rules.attendance.roundingMinutes, rules.attendance.roundingMode);
  const workedMinutes = Math.min(rounded, scheduledMinutes);

  return {
    shiftDate: shift.date,
    status: isOpen ? 'OPEN' : autoClosed ? 'AUTO_CLOSED' : 'CLOSED',
    scheduledMinutes,
    firstClockIn,
    lastClockOut: isOpen ? null : lastClockOut,
    workedMinutes,
    breakMinutes,
    leftEarlyMinutes: !isOpen && lastClockOut !== null ? Math.min(wholeMinutes(end.getTime() - lastClockOut.getTime()), windowMinutes) : 0,
    afterEndMinutes: wholeMinutes(afterEndMs),
    lateness: computeLateness(shift, firstClockIn, rules.lateness),
  };
}
