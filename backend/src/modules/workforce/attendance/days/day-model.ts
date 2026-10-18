import { computeDayHours, resolveClockPairs } from '../../_shared/time/day-hours';
import { shiftInstants } from '../../_shared/time/lateness';
import { parseClockTime } from '../../_shared/time/nairobi-time';
import type { ClockEventFact, ShiftWindow } from '../../_shared/time/time-types';
import type { AnswerRow, AttendanceRuleSet, EntryDay, EntryRow, EntryState, EventRow } from '../attendance.types';

const MS_PER_MINUTE = 60_000;
const MS_PER_SECOND = 1000;

/** The append order the engine needs: a correction that comes later replaces an earlier one. */
export const inAppendOrder = (events: readonly EventRow[]): EventRow[] =>
  [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));

export const toFact = (event: EventRow): ClockEventFact => ({
  id: event.id,
  type: event.type,
  occurredAt: event.occurredAt,
  correctsEventId: event.correctsEventId,
  voidsCorrected: event.voidsCorrected,
});

export const shiftWindowOf = (entry: EntryRow): ShiftWindow => ({
  date: entry.date,
  startTime: parseClockTime(entry.startTime),
  endTime: parseClockTime(entry.endTime),
  unpaidBreakMinutes: entry.unpaidBreakMinutes,
});

/** The newest real event in append order: not a correction, and not one a later correction replaced or cancelled. */
export function lastLiveEvent(ordered: readonly EventRow[]): EventRow | null {
  const corrected = new Set(ordered.filter((e) => e.type === 'CORRECTION' && e.correctsEventId).map((e) => e.correctsEventId as string));
  const live = ordered.filter((e) => e.type !== 'CORRECTION' && !corrected.has(e.id));
  return live[live.length - 1] ?? null;
}

/** The tap that may still be undone: the newest real event, if it was the person's own tap and is inside the window. */
function undoable(ordered: readonly EventRow[], now: Date, windowSeconds: number): EntryDay['undo'] {
  const last = lastLiveEvent(ordered);
  if (!last || last.source !== 'PHONE' || (last.type !== 'IN' && last.type !== 'OUT')) return null;
  const until = new Date(last.serverAt.getTime() + windowSeconds * MS_PER_SECOND);
  return until.getTime() > now.getTime() ? { kind: last.type, eventId: last.id, until } : null;
}

function stateOf(args: { hasClock: boolean; open: boolean; autoClosed: boolean; answer: AnswerRow | null; now: number; opens: number; start: number; end: number }): EntryState {
  const { hasClock, open, autoClosed, answer, now, opens, start, end } = args;
  if (!hasClock) {
    if (now < opens) return 'UPCOMING';
    if (now < start) return 'CLOCK_IN_OPEN';
    return now < end ? 'NOT_IN' : 'MISSED';
  }
  if (open) {
    if (now < end) return 'ON_SHIFT';
    return answer?.answer === 'STAY_ON' ? 'STAYING_ON' : 'PROMPT_DUE';
  }
  return autoClosed ? 'AUTO_CLOSED' : 'DONE';
}

/** One rostered shift against the clock events that belong to it, at the moment `now`. Pure: the same inputs give the same answer. */
export function buildEntryDay(entry: EntryRow, events: readonly EventRow[], answer: AnswerRow | null, rules: AttendanceRuleSet, now: Date): EntryDay {
  const shift = shiftWindowOf(entry);
  const { start, end } = shiftInstants(shift);
  const ordered = inAppendOrder(events);
  const { pairs } = resolveClockPairs(ordered.map(toFact));
  const hours = computeDayHours(shift, pairs, now, rules);
  const lastPair = pairs[pairs.length - 1] ?? null;
  const open = pairs.some((p) => p.clockOut === null);
  const autoClosed = lastPair?.closedBy === 'AUTO_OUT';
  const opens = start.getTime() - rules.attendance.clockInOpensMinutesBefore * MS_PER_MINUTE;
  const state = stateOf({ hasClock: pairs.length > 0, open, autoClosed, answer, now: now.getTime(), opens, start: start.getTime(), end: end.getTime() });
  const recordedBy = ordered.find((e) => e.source === 'HEAD' || e.source === 'MANAGER');
  const autoOutIds = new Set(ordered.filter((e) => e.type === 'AUTO_OUT').map((e) => e.id));
  const reviewed = ordered.some((e) => e.type === 'CORRECTION' && e.correctsEventId !== null && autoOutIds.has(e.correctsEventId));

  return {
    entryId: entry.id,
    employeeId: entry.employeeId,
    date: entry.date,
    templateName: entry.templateName,
    colour: entry.colour,
    shift,
    state,
    opensAt: new Date(opens),
    startsAt: start,
    endsAt: end,
    autoCloseAt: new Date(end.getTime() + rules.attendance.autoCloseAfterMinutes * MS_PER_MINUTE),
    clockedInAt: pairs[0]?.clockIn ?? null,
    clockedOutAt: open ? null : (lastPair?.clockOut ?? null),
    closedBy: open ? null : (lastPair?.closedBy ?? null),
    hours,
    lateness: hours.lateness,
    answer,
    undo: undoable(ordered, now, rules.attendance.undoWindowSeconds),
    flags: {
      skew: ordered.some((e) => e.skewFlagged),
      autoClosed,
      reviewed,
      fixed: ordered.some((e) => (e.type === 'CORRECTION' && e.source !== 'PHONE') || e.source === 'HEAD' || e.source === 'MANAGER'),
      recordedForBy: recordedBy?.recordedById ?? null,
    },
  };
}
