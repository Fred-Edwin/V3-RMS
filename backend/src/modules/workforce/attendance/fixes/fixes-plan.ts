import { ConflictError, ValidationError } from '../../../../utils/errors';
import { resolveClockPairs } from '../../_shared/time/day-hours';
import { nairobiDateOf, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AttendanceRuleSet, EntryRow, EventRow } from '../attendance.types';
import { buildEntryDay, inAppendOrder, toFact } from '../days/day-model';

export type FixRequest =
  | { action: 'EDIT'; eventId: string; at: Date }
  | { action: 'ADD'; type: 'IN' | 'OUT'; at: Date }
  | { action: 'VOID'; eventId: string };

/** What the day adds up to. Minutes of time, never money. */
export type DayNumbers = {
  workedMinutes: number;
  afterEndMinutes: number;
  leftEarlyMinutes: number;
  minutesLate: number;
  countsAsLate: boolean;
  clockedInAt: string | null;
  clockedOutAt: string | null;
};

export interface FixDraft {
  type: 'IN' | 'OUT' | 'CORRECTION';
  occurredAt: Date;
  rotaEntryId: string | null;
  correctsEventId: string | null;
  voidsCorrected: boolean;
  /** The time the target had before an EDIT or VOID, for the audit entry. */
  was: { type: string; at: string } | null;
}

export interface FixPlan {
  draft: FixDraft;
  before: DayNumbers | null;
  after: DayNumbers | null;
}

export function dayNumbers(entry: EntryRow, events: readonly EventRow[], rules: AttendanceRuleSet, now: Date): DayNumbers {
  const day = buildEntryDay(entry, events, null, rules, now);
  return {
    workedMinutes: day.hours.workedMinutes,
    afterEndMinutes: day.hours.afterEndMinutes,
    leftEarlyMinutes: day.hours.leftEarlyMinutes,
    minutesLate: day.lateness?.minutesLate ?? 0,
    countsAsLate: day.lateness?.countsAsLate ?? false,
    clockedInAt: day.clockedInAt?.toISOString() ?? null,
    clockedOutAt: day.clockedOutAt?.toISOString() ?? null,
  };
}

/** An event a correction has not replaced or cancelled yet: the only kind that can be edited or voided. */
const targetOf = (events: readonly EventRow[], id: string): EventRow => {
  const target = events.find((e) => e.id === id && e.type !== 'CORRECTION');
  const gone = events.some((e) => e.type === 'CORRECTION' && e.correctsEventId === id && e.voidsCorrected);
  if (!target || gone) throw new ConflictError('That clock event is not on this day (or was already removed).', 'EVENT_NOT_FOUND');
  return target;
};

export function planFix(args: { entry: EntryRow | null; events: readonly EventRow[]; request: FixRequest; shiftDate: NairobiDate; rules: AttendanceRuleSet; now: Date }): FixPlan {
  const { entry, events, request, shiftDate, rules, now } = args;
  if (request.action !== 'VOID') {
    if (nairobiDateOf(request.at) !== shiftDate) throw new ValidationError('The time must be on the same day as the shift', 'FIX_WRONG_DAY');
    if (request.at.getTime() > now.getTime()) throw new ValidationError('That time has not happened yet', 'FIX_IN_FUTURE');
  }

  let draft: FixDraft;
  if (request.action === 'ADD') {
    draft = { type: request.type, occurredAt: request.at, rotaEntryId: entry?.id ?? null, correctsEventId: null, voidsCorrected: false, was: null };
  } else {
    const target = targetOf(events, request.eventId);
    const was = { type: target.type, at: target.occurredAt.toISOString() };
    draft =
      request.action === 'EDIT'
        ? { type: 'CORRECTION', occurredAt: request.at, rotaEntryId: target.rotaEntryId, correctsEventId: target.id, voidsCorrected: false, was }
        : { type: 'CORRECTION', occurredAt: target.occurredAt, rotaEntryId: target.rotaEntryId, correctsEventId: target.id, voidsCorrected: true, was };
  }

  const drafted: EventRow = {
    id: 'draft',
    employeeId: events[0]?.employeeId ?? '',
    rotaEntryId: draft.rotaEntryId,
    shiftDate,
    type: draft.type,
    source: 'MANAGER',
    occurredAt: draft.occurredAt,
    serverAt: now,
    createdAt: new Date(now.getTime() + 1), // after every existing row, so it is the latest correction
    clientEventId: null,
    correctsEventId: draft.correctsEventId,
    voidsCorrected: draft.voidsCorrected,
    skewFlagged: false,
    reasonCode: null,
    reason: null,
    recordedById: null,
  };
  const after = [...events, drafted];
  const loose = (rows: readonly EventRow[]) => resolveClockPairs(inAppendOrder(rows).map(toFact)).unmatched.length;
  if (loose(after) > loose(events)) {
    throw new ConflictError('That would leave a clock-out with no clock-in (or two clock-ins in a row). Fix the other event first.', 'FIX_BREAKS_ORDER');
  }

  return {
    draft,
    before: entry ? dayNumbers(entry, events, rules, now) : null,
    after: entry ? dayNumbers(entry, after, rules, now) : null,
  };
}
