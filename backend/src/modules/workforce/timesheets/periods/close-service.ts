import { ConflictError } from '../../../../utils/errors';
import { logger } from '../../../../utils/logger';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { AuditActor } from '../../_shared/audit/audit.types';
import { addDays, nairobiToday } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { daysRepository } from '../../attendance/days/days-repository';
import { resolveActor } from '../../people/people-context';
import { refreshPeriod, weekRulesFor } from '../assemble/assemble-service';
import { timesheetDaysRepository } from '../days/timesheet-days-repository';
import { rebuildWeeks } from '../days/weeks';
import { overtimeRepository } from '../overtime/overtime-repository';
import { SYSTEM_ACTOR, eventOf, timesheetEntry } from '../timesheets-audit';
import { viewerFor } from '../timesheets-scope';
import type { PeriodRow } from '../timesheets.types';
import { periodsRepository } from './periods-repository';
import { periodForViewer } from './periods-service';
import { windowForDay } from './period-window';
import type { CloseBody } from './periods-validators';

interface Closer {
  kind: 'AUTO' | 'EARLY';
  actor: AuditActor;
  userId: string | null;
  companyId: string;
}

/**
 * Closes one period. Anything still open (an exception nobody decided, overtime nobody answered) is not lost and not
 * silently approved: it moves to the next period, held, where HR decides it ("anything still open goes to HR"). One
 * transaction: the claim, the move, the weeks, the audit entry. A second caller finds the claim taken and does nothing.
 */
async function closeNow(period: PeriodRow, closer: Closer, allowCarry: boolean, now: Date): Promise<boolean> {
  if (period.state === 'CLOSED') return false;
  const week = await weekRulesFor(period.siteId, period.end);
  const next = windowForDay(addDays(period.end, 1), week);
  let counts = { days: 0, overtime: 0 };
  const closed = await runAudited(async (tx) => {
    if (period.state === 'OPEN' && !(await periodsRepository.transition(period.id, 'OPEN', { state: 'CLOSING' }, tx))) return { result: false, entries: [] };
    const days = (await timesheetDaysRepository.allInPeriod(period.id, period.siteId, tx)).filter(({ day }) => day.status === 'NEEDS_LOOK' || day.status === 'HELD');
    const pending = await overtimeRepository.pendingIn(period.id, period.siteId, tx);
    if ((days.length > 0 || pending.length > 0) && !allowCarry) {
      throw new ConflictError('Some days and overtime are still waiting for a decision.', 'OPEN_ITEMS', { days: days.length, overtime: pending.length });
    }
    counts = { days: days.length, overtime: pending.length };
    if (counts.days + counts.overtime > 0) {
      const target = await periodsRepository.ensure(period.siteId, next, tx);
      await timesheetDaysRepository.carry(tx, days.map(({ day }) => day.id), target.id, period.id);
      await overtimeRepository.moveToPeriod(tx, pending.map((item) => item.id), target.id);
      const people = new Set([...days.map(({ day }) => day.employeeId), ...pending.map((item) => item.employeeId)]);
      for (const employeeId of people) {
        await rebuildWeeks(tx, period.id, period.siteId, employeeId, week.weekStartsOn);
        await rebuildWeeks(tx, target.id, period.siteId, employeeId, week.weekStartsOn);
      }
    }
    await periodsRepository.transition(period.id, 'CLOSING', { state: 'CLOSED', closedAt: now, closeKind: closer.kind, closedById: closer.userId }, tx);
    const entry = timesheetEntry({
      companyId: closer.companyId,
      siteId: period.siteId,
      actor: closer.actor,
      ...(closer.kind === 'AUTO' ? { channel: 'SYSTEM' as const } : {}),
      action: 'timesheet.period_closed',
      subjectId: period.id,
      subjectType: 'TimesheetPeriod',
      before: { state: 'OPEN', label: period.label },
      after: { state: 'CLOSED', kind: closer.kind, carriedDays: counts.days, carriedOvertime: counts.overtime },
    });
    const event = eventOf('timesheet.period_closed', { siteId: period.siteId, periodId: period.id, kind: closer.kind, closedById: closer.userId, carriedDays: counts.days, carriedOvertime: counts.overtime }, now);
    return { result: true, entries: [entry], events: [event] };
  });
  return closed;
}

/**
 * Close a period early (Chapter 8, step 4): only on its last day, or after it. It brings the closing forward; it does not
 * skip anything. Open items must be confirmed: `confirmCarry` says "yes, send what is still open to HR".
 */
export async function closePeriodEarly(subject: AccessSubject, id: string, body: CloseBody, now: Date = new Date()): Promise<PeriodRow> {
  const { period: found } = await periodForViewer(subject, id);
  viewerFor(subject, 'timesheet.close', found.siteId);
  if (found.state === 'CLOSED') throw new ConflictError('This period is already closed.', 'ALREADY_CLOSED');
  if (nairobiToday(now) < found.end) throw new ConflictError('A period can be closed early only on its last day.', 'TOO_EARLY');
  await refreshPeriod(found, now, true);
  const ctx = await resolveActor(subject);
  const done = await closeNow(found, { kind: 'EARLY', actor: ctx.auditActor, userId: subject.id, companyId: ctx.companyId }, body.confirmCarry, now);
  if (!done) throw new ConflictError('This period is already closing.', 'ALREADY_CLOSED');
  return (await periodsRepository.find(found.siteId, found.id)) ?? found;
}

/** The job: closes every period whose cut-off has passed (Nairobi time) and finishes any close that was claimed but not completed. */
export async function sweepPeriods(now: Date = new Date()): Promise<{ closed: number }> {
  let closed = 0;
  for (const period of await periodsRepository.dueToClose(now)) {
    try {
      await refreshPeriod(period, now, true);
      const company = await periodCompany(period.siteId);
      if (await closeNow(period, { kind: 'AUTO', actor: SYSTEM_ACTOR, userId: null, companyId: company }, true, now)) closed += 1;
    } catch (error) {
      logger.error({ err: error, periodId: period.id }, 'timesheet period close failed');
    }
  }
  return { closed };
}

const periodCompany = async (siteId: string): Promise<string> => {
  const site = await daysRepository.siteFacts(siteId);
  if (!site) throw new Error(`Site ${siteId} not found`);
  return site.companyId;
};
