import { ConflictError } from '../../../../../utils/errors';
import { runAudited } from '../../../_shared/audit/audit-writer';
import type { WorkforceEvent } from '../../../_shared/events';
import { fromDateColumn, toDateColumn } from '../../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../../_shared/workforce-access';
import { employeesRepository } from '../../employees/employees-repository';
import { resolveActor, told, todayOf } from '../../people-context';
import { collectImpacts } from '../../people-hooks';
import { viewAfterWrite } from '../departments/departments-service';
import type { DepartmentView, HeadCandidate, HeadPreview } from '../org.types';
import { isUniqueViolation } from '../org-errors';
import type { AssignHeadBody, EndHeadBody } from '../org-validators';
import { headChangedEvent, endRowToday, syncHeadClaims } from './head-sync';
import { claimsAfter, claimsBefore, loadDepartmentForHeads, planAssignment, type HeadPlan } from './head-plan';
import { headsRepository } from './heads-repository';

const ASSIGNED_ELSEWHERE = 'Someone changed this department’s head a moment ago; check the page and try again';

async function whoIsTold(plan: HeadPlan, extraUserIds: readonly (string | null)[]): Promise<{ userId: string; name: string }[]> {
  const managers = await employeesRepository.siteManagerUserIds(plan.department.siteId);
  const ids = [...new Set([...managers, plan.person.userId, ...plan.ending.map((e) => e.row.employee.userId), ...extraUserIds].filter((u): u is string => typeof u === 'string'))];
  const names = new Map((await employeesRepository.findUserNames(ids)).map((u) => [u.id, u.name]));
  return ids.map((userId) => ({ userId, name: names.get(userId) ?? '' }));
}

/** O6 to O9: who can be head, what a change does, naming a head or an acting head, and ending one. */
export const headsService = {
  /** O6: people who could lead the department, longest tenure first. The first one who is not already leading is `recommended`. */
  async candidates(subject: AccessSubject, departmentId: string, now: Date = new Date()): Promise<HeadCandidate[]> {
    const ctx = await resolveActor(subject);
    const department = await loadDepartmentForHeads(subject, ctx, departmentId, 'write');
    const today = toDateColumn(todayOf(now));
    const [people, rows] = await Promise.all([headsRepository.candidatesOf(ctx.companyId, department.id), headsRepository.activeRowsOfDepartment(department.id, today)]);
    const substantive = rows.find((row) => !row.isActing)?.employeeId ?? null;
    const actingHere = rows.find((row) => row.isActing)?.employeeId ?? null;
    const open = people.filter((p) => p.id !== substantive && p.userId !== null);
    return open.map((p, index) => ({
      employeeId: p.id,
      userId: p.userId as string,
      name: p.name,
      positionName: p.position?.name ?? null,
      startDate: fromDateColumn(p.startDate),
      isActingHere: p.id === actingHere,
      recommended: index === 0,
    }));
  },

  /** O7: what the change would do. Nothing is written. */
  async preview(subject: AccessSubject, departmentId: string, body: AssignHeadBody, now: Date = new Date()): Promise<HeadPreview> {
    const ctx = await resolveActor(subject);
    const today = todayOf(now);
    const plan = await planAssignment(subject, ctx, departmentId, body, today);
    const personRows = await headsRepository.activeRowsOfEmployee(plan.person.id, toDateColumn(today));
    const impacts = await collectImpacts({
      kind: 'HEAD_CHANGE',
      employeeIds: [plan.person.id, ...plan.ending.map((e) => e.row.employeeId)],
      siteId: plan.department.siteId,
      departmentId: plan.department.id,
      effectiveOn: today,
    });
    return {
      department: { id: plan.department.id, name: plan.department.name, siteId: plan.department.siteId },
      employee: { id: plan.person.id, name: plan.person.name },
      mode: plan.mode,
      effectiveOn: today,
      returnsOn: plan.returnsOn,
      endsHeadRoleOf: plan.ending.map((e) => ({ employeeId: e.row.employeeId, name: e.row.employee.name, isActing: e.row.isActing })),
      claims: { before: claimsBefore(personRows, today), after: claimsAfter(plan) },
      impacts,
      notified: await whoIsTold(plan, []),
    };
  },

  /** O8: name a head (REPLACE) or an acting head (ACTING). Rows, claims, audit entry and event are one transaction plus the event. */
  async assign(subject: AccessSubject, departmentId: string, body: AssignHeadBody, now: Date = new Date()): Promise<DepartmentView> {
    const ctx = await resolveActor(subject);
    const today = todayOf(now);
    let outcome: { plan: HeadPlan };
    try {
      outcome = await runAudited(async (tx) => {
        // Read again inside the transaction: what the preview saw may have changed.
        const plan = await planAssignment(subject, ctx, departmentId, body, today, tx);
        for (const { row, reason } of plan.ending) await endRowToday(tx, row, today, ctx.subject.id, reason);
        await headsRepository.createRow(tx, {
          departmentId: plan.department.id,
          employeeId: plan.person.id,
          isActing: plan.newRow.isActing,
          startsOn: toDateColumn(today),
          endsOn: plan.newRow.endsOn ? toDateColumn(plan.newRow.endsOn) : null,
          assignedById: ctx.subject.id,
        });
        const userIds = [plan.person.userId, ...plan.ending.map((e) => e.row.employee.userId)].filter((u): u is string => u !== null);
        for (const userId of new Set(userIds)) await syncHeadClaims(tx, ctx.companyId, userId, today);

        const department = { id: plan.department.id, siteId: plan.department.siteId, key: plan.department.key };
        const previousHead = plan.ending.find((e) => !e.row.isActing)?.row.employee.userId ?? null;
        const events: WorkforceEvent[] = [];
        if (plan.mode === 'REPLACE') {
          events.push(headChangedEvent(department, { previousUserId: previousHead, newUserId: plan.person.userId, effectiveOn: today }, now));
          // An acting head who was not the one promoted simply stops covering.
          for (const { row } of plan.ending) {
            if (row.isActing && row.employeeId !== plan.person.id) events.push(headChangedEvent(department, { previousUserId: row.employee.userId, newUserId: null, effectiveOn: today }, now));
          }
        } else {
          const replacedActing = plan.ending.find((e) => e.row.isActing)?.row.employee.userId ?? null;
          events.push(headChangedEvent(department, { previousUserId: replacedActing, newUserId: plan.person.userId, effectiveOn: today }, now));
        }
        return {
          result: { plan },
          entries: [
            {
              companyId: ctx.companyId,
              siteId: plan.department.siteId,
              actor: ctx.auditActor,
              action: 'org.head_changed',
              category: 'PEOPLE' as const,
              subjectType: 'Department',
              subjectId: plan.department.id,
              subjectUserId: plan.person.userId,
              reason: body.reason ?? null,
              after: { mode: plan.mode, employeeId: plan.person.id, returnsOn: plan.returnsOn, rolesEnded: plan.ending.length },
            },
          ],
          events,
        };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError(ASSIGNED_ELSEWHERE, 'HEAD_CHANGED_MEANWHILE');
      throw error;
    }
    const { plan } = outcome;
    await told((await whoIsTold(plan, [])).map((u) => u.userId), 'department.head_changed', { departmentId: plan.department.id });
    return viewAfterWrite(subject, ctx, departmentId, now);
  },

  /** O9: end the head, or the acting head, as of today. The department is left without that role; claims follow. */
  async end(subject: AccessSubject, departmentId: string, body: EndHeadBody, now: Date = new Date()): Promise<DepartmentView> {
    const ctx = await resolveActor(subject);
    const today = todayOf(now);
    const department = await loadDepartmentForHeads(subject, ctx, departmentId, 'write');
    await runAudited(async (tx) => {
      const rows = await headsRepository.activeRowsOfDepartment(department.id, toDateColumn(today), tx);
      const row = rows.find((r) => r.isActing === (body.which === 'ACTING'));
      if (!row) throw new ConflictError(body.which === 'ACTING' ? 'There is no acting head to end' : 'There is no head to end', 'NO_HEAD_TO_END');
      await endRowToday(tx, row, today, ctx.subject.id, 'ENDED_BY_USER');
      if (row.employee.userId) await syncHeadClaims(tx, ctx.companyId, row.employee.userId, today);
      return {
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: department.siteId,
            actor: ctx.auditActor,
            action: 'org.head_ended',
            category: 'PEOPLE' as const,
            subjectType: 'Department',
            subjectId: department.id,
            subjectUserId: row.employee.userId,
            reason: body.reason,
            after: { which: body.which, employeeId: row.employeeId },
          },
        ],
        events: [headChangedEvent({ id: department.id, siteId: department.siteId, key: department.key }, { previousUserId: row.employee.userId, newUserId: null, effectiveOn: today }, now)],
      };
    });
    return viewAfterWrite(subject, ctx, departmentId, now);
  },
};
