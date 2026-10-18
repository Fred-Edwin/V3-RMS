import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import type { EventRow } from '../../attendance/attendance.types';
import { applyFix } from '../../attendance/fixes/fixes-service';
import type { FixInput } from '../../attendance/fixes/fixes-validators';
import type { RequestRow } from '../timesheets.types';
import { loadSnapshot, type DaySnapshot } from './day-snapshot';

export interface ClockApplied {
  /** The correction rows this approval made, in order. Empty when the day already read as requested (a retry). */
  eventIds: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

/** One correction for the fix door; the person, day and reason are added when it is applied. */
export type ClockEdit =
  | { action: 'EDIT'; eventId: string; at: Date; rotaEntryId?: string }
  | { action: 'ADD'; type: 'IN' | 'OUT'; at: Date; rotaEntryId?: string }
  | { action: 'VOID'; eventId: string; rotaEntryId?: string };

const at = (value: unknown): Date | null => (typeof value === 'string' ? new Date(value) : null);
const same = (a: Date | null, b: Date | null): boolean => a !== null && b !== null && a.getTime() === b.getTime();

/** The newest original event of a kind that no correction has taken away. */
function liveEvent(events: readonly EventRow[], types: readonly EventRow['type'][]): EventRow | null {
  const gone = new Set(events.filter((e) => e.type === 'CORRECTION' && e.voidsCorrected && e.correctsEventId).map((e) => e.correctsEventId as string));
  return [...events].reverse().find((e) => types.includes(e.type) && !gone.has(e.id)) ?? null;
}

/**
 * What corrections an approved clock request needs, given the day as it stands. A day that already reads as requested
 * needs none, so approving twice (a retry after a failure) cannot double the correction.
 */
export function planClockRequest(request: RequestRow, snapshot: DaySnapshot): ClockEdit[] {
  const { entry, events } = snapshot;
  const want = request.requested;
  const entryId = entry?.entryId;
  const base = entryId ? { rotaEntryId: entryId } : {};
  const edits: ClockEdit[] = [];

  const setTime = (type: 'IN' | 'OUT', target: Date | null): void => {
    if (target === null) return;
    const current = type === 'IN' ? (entry?.clockedInAt ?? null) : (entry?.clockedOutAt ?? null);
    if (same(current, target)) return;
    const existing = liveEvent(events, type === 'IN' ? ['IN'] : ['OUT', 'AUTO_OUT']);
    edits.push(existing ? { action: 'EDIT', eventId: existing.id, at: target, ...base } : { action: 'ADD', type, at: target, ...base });
  };

  if (request.kind === 'CLOCK_TIME_WRONG') setTime(want.type === 'IN' ? 'IN' : 'OUT', at(want.at));
  if (request.kind === 'WORKED_NOT_RECORDED') {
    setTime('IN', at(want.clockIn));
    setTime('OUT', at(want.clockOut));
  }
  if (request.kind === 'CLOCKED_OUT_BY_MISTAKE') {
    const target = at(want.at);
    if (target) setTime('OUT', target);
    else {
      const out = liveEvent(events, ['OUT', 'AUTO_OUT']);
      if (out && entry?.clockedOutAt) edits.push({ action: 'VOID', eventId: out.id, ...base });
    }
  }
  return edits;
}

/** Makes the corrections through the attendance fix door (new rows pointing at the old; nothing is edited or deleted). */
export async function applyClockRequest(subject: AccessSubject, request: RequestRow, reason: string, now: Date): Promise<ClockApplied> {
  const date = request.shiftDate as NairobiDate;
  const first = await loadSnapshot(request.siteId, request.employeeId, date, now);
  const eventIds: string[] = [];
  for (const edit of planClockRequest(request, first)) {
    const fixed = await applyFix(subject, { ...edit, employeeId: request.employeeId, date, reason } satisfies FixInput, now);
    eventIds.push(fixed.eventId);
  }
  const last = eventIds.length > 0 ? await loadSnapshot(request.siteId, request.employeeId, date, now) : first;
  const view = (s: DaySnapshot) => ({ clockIn: s.entry?.clockedInAt?.toISOString() ?? null, clockOut: s.entry?.clockedOutAt?.toISOString() ?? null, workedMinutes: s.entry?.hours.workedMinutes ?? 0 });
  return { eventIds, before: view(first), after: view(last) };
}
