import { ConflictError, ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { nairobiToday, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { resolveActor, type ActorCtx } from '../../people/people-context';
import type { AttendanceRuleSet, EventRow, PersonRow } from '../attendance.types';
import { attendanceRulesFor } from '../days/day-rules';
import { daysRepository } from '../days/days-repository';
import { switchRepository } from '../switch/switch-repository';

export interface ClockContext {
  ctx: ActorCtx;
  person: PersonRow;
  site: { id: string; name: string; companyId: string; latitude: number; longitude: number };
  rules: AttendanceRuleSet;
  today: NairobiDate;
}

/** What a tap answers. The screen then reads "my day" for the full card. */
export interface ClockResult {
  replayed: boolean;
  event: { id: string; type: string; occurredAt: string; rotaEntryId: string | null; shiftDate: NairobiDate; skewFlagged: boolean };
  /** When the "Undo" button stops working for this tap; null when it cannot be undone. */
  undoUntil: string | null;
  lateness?: { minutesLate: number; countsAsLate: boolean; minutesAfterGrace: number };
  leftEarlyMinutes?: number;
}

export const resultOf = (event: EventRow, replayed: boolean, undoUntil: Date | null, extra: Partial<ClockResult> = {}): ClockResult => ({
  replayed,
  event: { id: event.id, type: event.type, occurredAt: event.occurredAt.toISOString(), rotaEntryId: event.rotaEntryId, shiftDate: event.shiftDate, skewFlagged: event.skewFlagged },
  undoUntil: undoUntil?.toISOString() ?? null,
  ...extra,
});

/**
 * Everything a person's own tap needs before it touches the clock: their file (only people who track time clock), their
 * site, the switch (the new clock must be on for that site) and the rules in force today.
 */
export async function loadClockContext(subject: AccessSubject, now: Date): Promise<ClockContext> {
  const person = await daysRepository.personByUserId(subject.id);
  if (!person) throw new ForbiddenError('You do not have a staff file yet. Ask HR.', 'NO_EMPLOYEE_FILE');
  if (!person.tracksTime) throw new ForbiddenError('This person does not clock in', 'DOES_NOT_CLOCK');
  const site = await daysRepository.siteFacts(person.siteId);
  if (!site) throw new NotFoundError('Site not found');
  if (!(await switchRepository.isEnabled(site.id))) {
    throw new ConflictError('The new clock is not switched on for your branch yet.', 'ATTENDANCE_NOT_ENABLED');
  }
  const today = nairobiToday(now);
  return {
    ctx: await resolveActor(subject),
    person,
    site: { id: site.id, name: site.name, companyId: site.companyId, latitude: Number(site.latitude), longitude: Number(site.longitude) },
    rules: await attendanceRulesFor(site.id, today),
    today,
  };
}

/** The distance a tap may be from the branch: the rule, or the environment value while the rule is unset. */
export const radiusFor = (rules: AttendanceRuleSet, environmentRadius: number): number => rules.attendance.locationRadiusMetres ?? environmentRadius;
