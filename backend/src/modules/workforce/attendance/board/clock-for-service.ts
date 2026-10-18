import { ConflictError, ValidationError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { computeLateness } from '../../_shared/time/lateness';
import { nairobiDateOf, nairobiToday } from '../../_shared/time/nairobi-time';
import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import { resolveActor, told } from '../../people/people-context';
import { eventOf, timeEntry } from '../attendance-audit';
import { personInScope } from '../attendance-scope';
import { clockRepository } from '../clock/clock-repository';
import { chooseEntryToClockIn, chooseEntryToClockOut } from '../clock/clock-rules';
import { attendanceRulesFor } from '../days/day-rules';
import { daysRepository } from '../days/days-repository';
import { buildPersonDay } from '../days/person-day';
import { switchRepository } from '../switch/switch-repository';
import type { ClockForInput } from './board-validators';

export interface ClockForResult {
  eventId: string;
  type: 'IN' | 'OUT';
  occurredAt: string;
  source: 'HEAD' | 'MANAGER';
  lateness: { minutesLate: number; countsAsLate: boolean; minutesAfterGrace: number } | null;
}

/**
 * "Clock in for her" on the Today board (Chapter 7, step 3): today only, the time of arrival and a reason, both required.
 * A head does it for their departments, a Branch or Store Manager for their site. The same checks as a person's own tap
 * apply (an open shift, no double clock-in); the event says who recorded it, and the person is told.
 */
export async function clockForSomeone(subject: AccessSubject, input: ClockForInput, now: Date = new Date()): Promise<ClockForResult> {
  const person = await personInScope(subject, 'today.act', input.employeeId, 'write');
  if (!(await switchRepository.isEnabled(person.siteId))) throw new ConflictError('The new clock is not switched on for this branch.', 'ATTENDANCE_NOT_ENABLED');
  const date = nairobiToday(now);
  if (nairobiDateOf(input.at) !== date) throw new ValidationError('You can clock someone for today only. Use Fix time for another day.', 'CLOCK_FOR_TODAY_ONLY');
  if (input.at.getTime() > now.getTime()) throw new ValidationError('That time has not happened yet', 'FIX_IN_FUTURE');

  const [ctx, rules, site] = await Promise.all([resolveActor(subject), attendanceRulesFor(person.siteId, date), daysRepository.siteFacts(person.siteId)]);
  const source = scopeOf(subject, 'today.act') === 'dept' ? ('HEAD' as const) : ('MANAGER' as const);

  const result = await runAudited(async (tx) => {
    await clockRepository.lockEmployee(tx, person.id);
    const data = await daysRepository.loadDayData(person.siteId, date, date, [person.id], tx);
    const day = buildPersonDay(person, date, data, rules, input.at);
    const entry = input.type === 'IN' ? chooseEntryToClockIn(day.entries, input.rotaEntryId) : chooseEntryToClockOut(day.entries, input.rotaEntryId);
    const lateness = input.type === 'IN' ? computeLateness(entry.shift, input.at, rules.lateness) : null;

    const event = await clockRepository.insert(tx, {
      siteId: person.siteId,
      employeeId: person.id,
      rotaEntryId: entry.entryId,
      shiftDate: date,
      type: input.type,
      source,
      occurredAt: input.at,
      serverAt: now,
      reasonCode: 'CLOCKED_FOR',
      reason: input.reason,
      recordedById: subject.id,
    });
    const audit = timeEntry({
      companyId: site?.companyId ?? ctx.companyId,
      siteId: person.siteId,
      actor: ctx.auditActor,
      action: 'attendance.clocked_for',
      employeeId: person.id,
      userId: person.userId,
      after: { type: input.type, shift: entry.templateName, date, at: input.at.toISOString(), recordedAs: source },
      reason: input.reason,
    });
    const base = { siteId: person.siteId, employeeId: person.id, userId: person.userId, rotaEntryId: entry.entryId, shiftDate: date, occurredAt: input.at.toISOString() };
    const events =
      input.type === 'IN' && lateness
        ? [
            eventOf('attendance.clocked_in', { ...base, source, minutesLate: lateness.minutesLate, countsAsLate: lateness.countsAsLate }, now),
            ...(lateness.countsAsLate ? [eventOf('attendance.late', { ...base, minutesLate: lateness.minutesLate, minutesAfterGrace: lateness.minutesAfterGrace }, now)] : []),
          ]
        : [
            eventOf(
              'attendance.clocked_out',
              { ...base, closedBy: 'OUT', leftEarlyMinutes: Math.max(0, Math.floor((entry.endsAt.getTime() - input.at.getTime()) / 60_000)), afterEndMinutes: Math.max(0, Math.floor((input.at.getTime() - entry.endsAt.getTime()) / 60_000)) },
              now,
            ),
          ];
    const out: ClockForResult = {
      eventId: event.id,
      type: input.type,
      occurredAt: input.at.toISOString(),
      source,
      lateness: lateness ? { minutesLate: lateness.minutesLate, countsAsLate: lateness.countsAsLate, minutesAfterGrace: lateness.minutesAfterGrace } : null,
    };
    return { result: out, entries: [audit], events };
  });
  await told([person.userId], 'attendance.clocked_for', { type: input.type, at: input.at.toISOString() });
  return result;
}
