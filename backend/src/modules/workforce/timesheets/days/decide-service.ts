import { ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { instantAt, parseClockTime, type NairobiDate } from '../../_shared/time/nairobi-time';
import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import { personInScope } from '../../attendance/attendance-scope';
import { resolveActor, told } from '../../people/people-context';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { weekRulesFor } from '../assemble/assemble-service';
import { periodsRepository } from '../periods/periods-repository';
import { eventOf, timesheetEntry } from '../timesheets-audit';
import type { DayRow } from '../timesheets.types';
import type { DecisionBody } from './days-validators';
import { timesheetDaysRepository } from './timesheet-days-repository';
import { rebuildWeeks } from './weeks';

const MS_PER_HOUR = 3_600_000;

/** Excusing lateness is open for the rule's hours after the day ends (LATENESS.excuseWindowHours); HR and the System Admin are not held to it. */
async function assertExcuseWindow(subject: AccessSubject, siteId: string, date: NairobiDate, now: Date): Promise<void> {
  if (scopeOf(subject, 'timesheet.approve') === 'all') return;
  const rules = (await getEffectiveRuleGroup(siteId, date, 'LATENESS')).values;
  const closesAt = instantAt(date, parseClockTime('23:59')).getTime() + rules.excuseWindowHours * MS_PER_HOUR;
  if (now.getTime() > closesAt) throw new ConflictError(`Lateness can be excused for ${rules.excuseWindowHours} hours after the day. Ask HR.`, 'EXCUSE_WINDOW_OVER');
}

const statusFor = (outcome: DecisionBody['outcome']): DayRow['status'] => (outcome === 'HOLD' ? 'HELD' : 'APPROVED');

/**
 * Decide an exception (Chapter 8, steps 2 and 4): accept the day as recorded, excuse the lateness, or hold it back.
 * Needs `timesheet.approve` for the person (a head: own department; a manager: own branch; HR and System Admin: all); nobody
 * decides their own day. A day with overtime waiting is settled by the overtime answer first. A closed period is
 * read-only. Writes the audit entry in the same transaction; the person is told.
 */
export async function decideDay(subject: AccessSubject, dayId: string, body: DecisionBody, now: Date = new Date()): Promise<DayRow> {
  const row = await timesheetDaysRepository.byIdAnywhere(dayId);
  if (!row) throw new NotFoundError('Day not found');
  const person = await personInScope(subject, 'timesheet.approve', row.employeeId, 'write');
  const ctx = await resolveActor(subject);
  const period = await periodsRepository.find(row.siteId, row.periodId);
  if (!period) throw new NotFoundError('Period not found');
  if (period.state !== 'OPEN') throw new ConflictError('That pay period is closed. HR can reopen it.', 'PERIOD_CLOSED');
  if (row.status !== 'NEEDS_LOOK' && row.status !== 'HELD') throw new ConflictError('This day does not need a decision.', 'NOTHING_TO_DECIDE');
  if (body.outcome === 'ACCEPT' && row.reasons.includes('OVERTIME')) throw new ConflictError('Answer the overtime first.', 'OVERTIME_UNDECIDED');
  if (body.outcome === 'EXCUSE') {
    if (!row.reasons.includes('LATE')) throw new ConflictError('Nothing to excuse: this day was not late.', 'NOT_LATE');
    await assertExcuseWindow(subject, row.siteId, row.shiftDate, now);
  }
  const weekStartsOn = (await weekRulesFor(row.siteId, row.shiftDate)).weekStartsOn;
  const reason = body.reason ?? null;
  const status = statusFor(body.outcome);

  await runAudited(async (tx) => {
    await timesheetDaysRepository.decide(tx, row.id, { status, decidedById: subject.id, decidedAt: now, decisionReason: reason, lateExcused: body.outcome === 'EXCUSE' });
    await rebuildWeeks(tx, row.periodId, row.siteId, row.employeeId, weekStartsOn);
    const entry = timesheetEntry({
      companyId: ctx.companyId,
      siteId: row.siteId,
      actor: ctx.auditActor,
      action: 'timesheet.day_decided',
      subjectId: row.employeeId,
      userId: person.userId,
      before: { date: row.shiftDate, status: row.status, reasons: row.reasons, minutesLate: row.minutesLate },
      after: { date: row.shiftDate, status, outcome: body.outcome, lateExcused: body.outcome === 'EXCUSE' },
      reason,
    });
    const event = eventOf('timesheet.day_decided', { siteId: row.siteId, periodId: row.periodId, employeeId: row.employeeId, userId: person.userId, shiftDate: row.shiftDate, outcome: body.outcome, decidedById: subject.id }, now);
    return { result: undefined, entries: [entry], events: [event] };
  });
  await told([person.userId], 'timesheet.day_decided', { date: row.shiftDate, outcome: body.outcome });
  const fresh = await timesheetDaysRepository.byIdAnywhere(row.id);
  if (!fresh) throw new NotFoundError('Day not found');
  return fresh;
}
