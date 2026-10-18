import { ConflictError, ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { instantAt, nairobiToday, parseClockTime } from '../../_shared/time/nairobi-time';
import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import { personInScope } from '../../attendance/attendance-scope';
import { resolveActor, told } from '../../people/people-context';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { refreshPeriod } from '../assemble/assemble-service';
import { periodsRepository } from '../periods/periods-repository';
import { eventOf, timesheetEntry } from '../timesheets-audit';
import { viewerFor } from '../timesheets-scope';
import type { OvertimeRow } from '../timesheets.types';
import { overtimeRepository } from './overtime-repository';
import type { OvertimeDecisionBody, OvertimeListQuery } from './overtime-validators';

export interface OvertimeListItem extends OvertimeRow {
  person: { id: string; name: string; departmentName: string | null };
  /** Past the approval window: it moves to the next approver (the Branch Manager, then HR). */
  overdue: boolean;
}

const MS_PER_HOUR = 3_600_000;

/** Waiting and decided overtime for a branch, in the viewer's scope (a head sees their departments only). */
export async function listOvertime(subject: AccessSubject, query: OvertimeListQuery, now: Date = new Date()) {
  const viewer = viewerFor(subject, 'timesheet.read', query.siteId);
  const statuses = query.status === 'PENDING' ? (['PENDING'] as const) : query.status === 'DECIDED' ? (['APPROVED', 'DECLINED', 'AUTO_AUTHORISED'] as const) : (['PENDING', 'APPROVED', 'DECLINED', 'AUTO_AUTHORISED'] as const);
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
 * Authorise or decline overtime (Chapter 8, step 3). Authorising allows the time; payroll decides pay. A department head
 * may decide only inside the allowance (the weekly cap and the branch budget); beyond it the Branch or Store Manager or
 * HR decides, with a reason. Nobody decides their own. A closed period is read-only.
 */
export async function decideOvertime(subject: AccessSubject, itemId: string, body: OvertimeDecisionBody, now: Date = new Date()): Promise<OvertimeRow> {
  const item = await overtimeRepository.byIdAnywhere(itemId);
  if (!item) throw new NotFoundError('Overtime not found');
  const person = await personInScope(subject, 'overtime.approve', item.employeeId, 'write');
  const ctx = await resolveActor(subject);
  const period = await periodsRepository.find(item.siteId, item.periodId);
  if (!period) throw new NotFoundError('Period not found');
  if (period.state !== 'OPEN') throw new ConflictError('That pay period is closed. HR can reopen it.', 'PERIOD_CLOSED');
  if (item.status !== 'PENDING') throw new ConflictError('This overtime has been answered already.', 'ALREADY_DECIDED');
  if (!item.limits.insideAllowance) {
    if (scopeOf(subject, 'overtime.approve') === 'dept') throw new ForbiddenError('This is beyond your overtime allowance. Your Branch Manager decides it.', 'OVERTIME_NEEDS_MANAGER');
    if (body.outcome === 'APPROVE' && !body.reason) throw new ConflictError('Say why you are authorising more than the limit.', 'REASON_REQUIRED_OVER_LIMIT');
  }

  const approving = body.outcome === 'APPROVE';
  const grantedMinutes = approving ? Math.min(body.minutes ?? item.needsMinutes, item.needsMinutes) : 0;
  const authorisedMinutes = item.autoMinutes + grantedMinutes;
  const status = approving ? 'APPROVED' : 'DECLINED';
  const reason = body.reason ?? null;

  await runAudited(async (tx) => {
    await overtimeRepository.decide(tx, item.id, { status, authorisedMinutes, decidedById: subject.id, decidedAt: now, decisionReason: reason });
    const entry = timesheetEntry({
      companyId: ctx.companyId,
      siteId: item.siteId,
      actor: ctx.auditActor,
      action: 'timesheet.overtime_decided',
      subjectId: item.employeeId,
      userId: person.userId,
      before: { date: item.shiftDate, status: item.status, rawMinutes: item.rawMinutes, needsMinutes: item.needsMinutes, autoMinutes: item.autoMinutes },
      after: { date: item.shiftDate, status, authorisedMinutes, insideAllowance: item.limits.insideAllowance },
      reason,
    });
    const event = eventOf('overtime.decided', { siteId: item.siteId, employeeId: item.employeeId, userId: person.userId, shiftDate: item.shiftDate, outcome: status, authorisedMinutes, decidedById: subject.id }, now);
    return { result: undefined, entries: [entry], events: [event] };
  });
  await refreshPeriod(period, now, true); // settles the day when overtime was its only exception
  await told([person.userId], 'overtime.decided', { date: item.shiftDate, outcome: status });
  const fresh = await overtimeRepository.byIdAnywhere(item.id);
  if (!fresh) throw new NotFoundError('Overtime not found');
  return fresh;
}
