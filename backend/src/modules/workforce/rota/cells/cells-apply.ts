import { ConflictError, NotFoundError, ValidationError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { AuditEntryInput, JsonValue } from '../../_shared/audit/audit.types';
import { addDays, fromDateColumn, nairobiToday, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { changeBatcher } from '../changes/change-batcher';
import { AUDIT_CELL_LIST_LIMIT, MAX_WEEKS_AHEAD } from '../rota.constants';
import { isPastDay, requireReasonWhenNeeded, weekStartOf } from '../rota-days';
import { assertCanWriteFor, gridScope } from '../rota-scope';
import type { CellChange } from '../rota.types';
import { templateFits } from '../templates/template-rules';
import { templatesRepository } from '../templates/templates-repository';
import { approvedLeave } from '../warnings/leave-lookup';
import { planCells, type PlanEntry } from './cell-plan';
import { cellsRepository, type CellPerson } from './cells-repository';

export interface ApplyRequest {
  siteId: string | undefined;
  changes: readonly CellChange[];
  reason: string | undefined;
  overrideReason: string | undefined;
  /** 'rota.cells_changed' for set, clear, fill and pattern; 'rota.week_copied' for "start from last week". */
  action: 'rota.cells_changed' | 'rota.week_copied';
  note?: Record<string, JsonValue>;
}

export interface ApplyResult {
  changedCells: number;
  peopleAffected: number;
  /** Cells set on an approved-leave day with the override reason. */
  leaveOverrides: number;
}

const days = (changes: readonly CellChange[]): NairobiDate[] => [...new Set(changes.map((c) => c.date))].sort();

/**
 * The one write path of the rota. Every edit is live the moment it is saved, so each call is one transaction with one
 * audit entry (names, shift names and dates; no pay), and the people it touches are queued for one batched notice.
 */
export async function applyCellChanges(subject: AccessSubject, request: ApplyRequest, now: Date): Promise<ApplyResult> {
  const ctx = await resolveActor(subject);
  const { siteId } = gridScope(subject, 'rota.write', request.siteId);
  const today = nairobiToday(now);
  const dates = days(request.changes);
  if (dates.some((d) => isPastDay(d, today))) throw new ConflictError('Past days are read-only; fix them in timesheets', 'PAST_DAY_READ_ONLY');
  if (dates.some((d) => d > addDays(today, MAX_WEEKS_AHEAD * 7))) throw new ValidationError('That day is too far ahead', 'WEEK_OUT_OF_RANGE');

  const people = new Map<string, CellPerson>((await cellsRepository.people(ctx.companyId, request.changes.map((c) => c.employeeId))).map((p) => [p.id, p]));
  for (const change of request.changes) {
    const person = people.get(change.employeeId);
    if (!person) throw new NotFoundError('Person not found');
    if (person.siteId !== siteId) throw new NotFoundError('Person not found');
    assertCanWriteFor(subject, person);
    if (!person.tracksTime) throw new ValidationError(`${person.name} does not clock in, so has no shifts`, 'EMPLOYEE_NOT_ON_ROTA');
  }

  const templateIds = [...new Set(request.changes.flatMap((c) => c.templateIds))];
  const templates = new Map((await templatesRepository.findManyByIds(ctx.companyId, templateIds)).map((t) => [t.id, t] as const));
  for (const change of request.changes) {
    const person = people.get(change.employeeId) as CellPerson;
    for (const templateId of change.templateIds) {
      const template = templates.get(templateId);
      if (!template || !template.isActive || !templateFits(template, { siteId: person.siteId, departmentId: person.departmentId, departmentName: person.department?.name ?? null })) {
        throw new ValidationError(`That shift cannot go on ${person.name}'s day`, 'TEMPLATE_NOT_AVAILABLE');
      }
    }
  }

  const rule = await getEffectiveRuleGroup(siteId, today, 'WEEK_AND_BREAKS');
  const first = dates[0] as NairobiDate;
  const last = dates[dates.length - 1] as NairobiDate;
  const leave = await approvedLeave([...people.keys()], first, last);

  const { plan, leaveDays } = await runAudited(async (tx) => {
    const rows = await cellsRepository.entriesFor(tx, [...people.keys()], toDateColumn(first), toDateColumn(last));
    const existing: PlanEntry[] = rows.map((r) => ({ id: r.id, employeeId: r.employeeId, date: fromDateColumn(r.date), templateId: r.templateId }));
    const plan = planCells(request.changes, existing);
    const touched = plan.changed.map((c) => c.date as NairobiDate);
    const reason = plan.changed.length > 0 ? requireReasonWhenNeeded(touched, today, request.reason) : null;
    const leaveDays = plan.changed.filter((c) => c.to.length > 0 && leave.get(c.employeeId)?.has(c.date));
    const overrideReason = request.overrideReason?.trim() || null;
    if (leaveDays.length > 0 && !overrideReason) {
      throw new ConflictError('Someone is on approved leave on those days; say why they are planned anyway', 'LEAVE_OVERRIDE_REQUIRED', { cells: leaveDays.map((c) => ({ employeeId: c.employeeId, date: c.date })) });
    }
    if (plan.changed.length === 0) return { result: { plan, leaveDays }, entries: [] as AuditEntryInput[] };

    await cellsRepository.deleteEntries(tx, plan.remove.map((e) => e.id));
    const weekIds = new Map<string, string>();
    const adds = [];
    for (const add of plan.add) {
      const person = people.get(add.employeeId) as CellPerson;
      const start = weekStartOf(add.date as NairobiDate, rule.values.weekStartsOn);
      const key = `${person.departmentId ?? ''}|${start}`;
      const weekId = weekIds.get(key) ?? (await cellsRepository.ensureWeek(tx, siteId, person.departmentId, toDateColumn(start)));
      weekIds.set(key, weekId);
      const onLeave = leave.get(add.employeeId)?.has(add.date) === true;
      adds.push({ weekId, siteId, employeeId: add.employeeId, date: toDateColumn(add.date as NairobiDate), templateId: add.templateId, overrideReason: onLeave ? overrideReason : null, setById: subject.id });
    }
    await cellsRepository.addEntries(tx, adds);
    await cellsRepository.touchWeeks(tx, [...weekIds.values()], now);

    const nameOf = (id: string): string => templates.get(id)?.name ?? 'Day off';
    const listed = plan.changed.slice(0, AUDIT_CELL_LIST_LIMIT).map((c) => ({
      person: people.get(c.employeeId)?.name ?? c.employeeId,
      date: c.date,
      from: c.from.map(nameOf).join(' + ') || 'Day off',
      to: c.to.map(nameOf).join(' + ') || 'Day off',
    }));
    const entry: AuditEntryInput = {
      companyId: ctx.companyId,
      siteId,
      actor: ctx.auditActor,
      category: 'TIME',
      subjectType: 'RotaCells',
      subjectId: siteId,
      action: request.action,
      before: null,
      after: { cells: plan.changed.length, people: new Set(plan.changed.map((c) => c.employeeId)).size, leaveOverrides: leaveDays.length, listed, ...(request.note ?? {}) },
      reason: reason ?? (leaveDays.length > 0 ? overrideReason : null),
    };
    return { result: { plan, leaveDays }, entries: [entry] };
  });

  const touchedPeople = new Set(plan.changed.map((c) => c.employeeId));
  changeBatcher.record(
    plan.changed.map((c) => {
      const person = people.get(c.employeeId) as CellPerson;
      return { siteId, employeeId: person.id, userId: person.userId, date: c.date as NairobiDate, changedById: subject.id };
    }),
  );
  return { changedCells: plan.changed.length, peopleAffected: touchedPeople.size, leaveOverrides: leaveDays.length };
}
