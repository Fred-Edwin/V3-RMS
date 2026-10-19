import { ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { instantAt, nairobiToday, parseClockTime } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { personInScope } from '../../attendance/attendance-scope';
import { resolveActor, told } from '../../people/people-context';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { refreshPeriod } from '../assemble/assemble-service';
import { assertOwnPin } from '../approval/pin-check';
import { periodsRepository } from '../periods/periods-repository';
import { eventOf, timesheetEntry } from '../timesheets-audit';
import { assertCan, decisionCapability, viewerFor } from '../timesheets-scope';
import type { OvertimeRow } from '../timesheets.types';
import { decisionOutcome } from './overtime-plan';
import { overtimeRepository } from './overtime-repository';
import type { OvertimeDecisionBody, OvertimeListQuery } from './overtime-validators';

export interface OvertimeListItem extends OvertimeRow {
  person: { id: string; name: string; departmentName: string | null };
  /** Past the approval window: it moves to the next approver (the Branch Manager, then HR). */
  overdue: boolean;
}

const MS_PER_HOUR = 3_600_000;
const DECIDED = ['APPROVED', 'APPROVED_PART', 'DECLINED', 'AUTO_AUTHORISED'] as const;

/** Waiting and decided overtime for a branch, in the viewer's scope. */
export async function listOvertime(subject: AccessSubject, query: OvertimeListQuery, now: Date = new Date()) {
  const viewer = viewerFor(subject, 'timesheet.read', query.siteId);
  const statuses = query.status === 'PENDING' ? (['PENDING'] as const) : query.status === 'DECIDED' ? DECIDED : ([...DECIDED, 'PENDING'] as const);
  const rules = (await getEffectiveRuleGroup(viewer.siteId, nairobiToday(now), 'OVERTIME')).values;
  const all = await overtimeRepository.page(viewer.siteId, query.periodId ?? null, statuses, 0, 1000);
  const scoped = all.rows.filter(({ person }) => viewer.departmentIds === null || (person.departmentId !== null && viewer.departmentIds.includes(person.departmentId)));
  const start = (query.page - 1) * query.pageSize;
  const rows: OvertimeListItem[] = scoped.slice(start, start + query.pageSize).map(({ item, person }) => ({
    ...item,
    person: { id: person.id, name: person.name, departmentName: person.department?.name ?? null },
    overdue: item.status === 'PENDING' && now.getTime() > instantAt(item.shiftDate, parseClockTime('23:59')).getTime() + rules.approvalWindowHours * MS_PER_HOUR,
  }));
  return { rows, page: query.page, pageSize: query.pageSize, total: scoped.length };
}

/**
 * Decide an overtime item: approve all, part or none (Segment 1A, S6). The site's manager decides, with their own PIN, a reason
 * for part or none, and the version the screen showed. Approving authorises the time only; payroll decides pay. A site
 * manager's own overtime goes to the Director; nobody decides their own. A month that is approved is read-only. The answer can
 * be changed until the month is approved (the history stays in the audit log). The person is told.
 */
export async function decideOvertime(subject: AccessSubject, itemId: string, body: OvertimeDecisionBody, now: Date = new Date()): Promise<OvertimeRow> {
  const item = await overtimeRepository.byIdAnywhere(itemId);
  if (!item) throw new NotFoundError('Overtime not found');
  const ownerUserId = (await personInScope(subject, 'timesheet.read', item.employeeId, 'read')).userId;
  const role = ownerUserId ? ((await periodsRepository.people([ownerUserId])).get(ownerUserId)?.role ?? null) : null;
  const capability = decisionCapability(role, 'overtime.approve');
  assertCan(subject, capability);
  const person = await personInScope(subject, capability, item.employeeId, 'write');
  const period = await periodsRepository.find(item.siteId, item.periodId);
  if (!period) throw new NotFoundError('Period not found');
  if (period.state === 'APPROVED') throw new ConflictError('This month is approved. Tell HR if the overtime needs to change.', 'PERIOD_APPROVED');
  if (item.needsMinutes <= 0) throw new ConflictError('This overtime was covered by the service tail; nothing to decide.', 'NOTHING_TO_DECIDE');
  if (item.version !== body.version) throw new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH', { version: item.version, status: item.status });

  const outcome = decisionOutcome(item, body.decision, body.approvedMinutes);
  if (!outcome) throw new ConflictError('Pick between 5 minutes and 5 minutes less than the extra, in steps of 5.', 'PART_OUT_OF_RANGE', { needsMinutes: item.needsMinutes });
  if (!item.limits.insideAllowance && body.decision !== 'DECLINE' && (body.reason ?? '').length < 5) {
    throw new ConflictError('Say why you are authorising more than the limit.', 'REASON_REQUIRED_OVER_LIMIT');
  }
  await assertOwnPin(subject.id, body.pin);
  const ctx = await resolveActor(subject);
  const reason = body.reason?.trim() || null;

  await runAudited(async (tx) => {
    if ((await periodsRepository.lockState(tx, period.id)) === 'APPROVED') throw new ConflictError('This month is approved. Tell HR if the overtime needs to change.', 'PERIOD_APPROVED');
    const written = await overtimeRepository.decide(tx, item.id, body.version, { status: outcome.status, authorisedMinutes: outcome.authorisedMinutes, decidedById: subject.id, decidedAt: now, decisionReason: reason });
    if (!written) throw new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH');
    const entry = timesheetEntry({
      companyId: ctx.companyId,
      siteId: item.siteId,
      actor: ctx.auditActor,
      action: 'timesheet.overtime_decided',
      subjectId: item.employeeId,
      userId: person.userId,
      before: { date: item.shiftDate, status: item.status, rawMinutes: item.rawMinutes, needsMinutes: item.needsMinutes, autoMinutes: item.autoMinutes, authorisedMinutes: item.authorisedMinutes },
      after: { date: item.shiftDate, decision: body.decision, status: outcome.status, grantedMinutes: outcome.grantedMinutes, authorisedMinutes: outcome.authorisedMinutes, method: 'PIN', insideAllowance: item.limits.insideAllowance },
      reason,
    });
    const event = eventOf('overtime.decided', { siteId: item.siteId, employeeId: item.employeeId, userId: person.userId, shiftDate: item.shiftDate, outcome: outcome.status, authorisedMinutes: outcome.authorisedMinutes, decidedById: subject.id }, now);
    return { result: undefined, entries: [entry], events: [event] };
  });
  await refreshPeriod(period, now, true); // settles the day when overtime was its only exception
  // The person is told the answer; the reason is shown to them only for a part or a decline (D28).
  await told([person.userId], 'overtime.decided', {
    date: item.shiftDate,
    outcome: outcome.status,
    minutes: outcome.grantedMinutes,
    ofMinutes: item.needsMinutes,
    reason: outcome.status === 'APPROVED' ? null : reason,
  });
  const fresh = await overtimeRepository.byIdAnywhere(item.id);
  if (!fresh) throw new NotFoundError('Overtime not found');
  return fresh;
}
