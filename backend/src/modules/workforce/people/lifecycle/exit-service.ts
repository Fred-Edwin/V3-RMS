import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { ConflictError, ValidationError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { fromDateColumn, parseNairobiDate, toDateColumn } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import type { WorkforceEvent } from '../../_shared/events';
import { employeesRepository } from '../employees/employees-repository';
import { employeesService } from '../employees/employees-service';
import { restoreHeadRows } from '../organisation/heads/head-undo';
import { accountGateway } from '../people-account-gateway';
import { resolveActor, told, todayOf } from '../people-context';
import { canUndoExit, probationEnd, undoUntil } from '../people-dates';
import { collectImpacts } from '../people-hooks';
import type { EmployeeFileView, MovePreview } from '../people.types';
import type { ExitChecklistSchema, ExitSchema, RehireSchema } from '../people-validators';
import { finalizeExitFor, initialSnapshot, parseSnapshot } from './lifecycle-engine';
import { lifecycleRepository, type LifecycleEmployee } from './lifecycle-repository';
import { appDoer, loadForWrite } from './lifecycle-support';

export type ExitBody = z.infer<typeof ExitSchema>;
export type ExitChecklistBody = z.infer<typeof ExitChecklistSchema>;
export type RehireBody = z.infer<typeof RehireSchema>;
export type UndoResult = EmployeeFileView & { notRestored: string[] };

/** Leaving, taking it back, and coming back: one file for the whole life of an exit. */
export const exitService = {
  // ---- W19 to W21: exit --------------------------------------------------------------------------------------
  async previewExit(subject: AccessSubject, id: string, body: ExitBody, now: Date = new Date()): Promise<MovePreview> {
    const ctx = await resolveActor(subject);
    const today = todayOf(now);
    const emp = await loadForWrite(ctx, id, 'employee.lifecycle');
    const lastDay = parseNairobiDate(body.lastDay);
    const impacts = await collectImpacts({ kind: 'EXIT', employeeIds: [emp.id], siteId: emp.siteId, departmentId: emp.departmentId, effectiveOn: lastDay > today ? lastDay : today });
    const directors = await employeesRepository.userIdsByRole(ctx.companyId, 'DIRECTOR');
    const names = new Map((await employeesRepository.findUserNames(directors)).map((u) => [u.id, u.name]));
    return { effectiveOn: lastDay, newHead: null, newReportsTo: null, notified: directors.map((userId) => ({ userId, name: names.get(userId) ?? '' })), impacts };
  },

  async exit(subject: AccessSubject, id: string, body: ExitBody, now: Date = new Date()): Promise<EmployeeFileView> {
    const ctx = await resolveActor(subject);
    const today = todayOf(now);
    const emp = await loadForWrite(ctx, id, 'employee.lifecycle');
    if (emp.status === 'EXITED' || emp.status === 'NOTICE') throw new ConflictError('This exit is already recorded', 'ALREADY_EXITED');
    const lastDay = parseNairobiDate(body.lastDay);
    const spell = await lifecycleRepository.currentSpellTop(emp.id);
    if (!spell || spell.endedOn) throw new ConflictError('This file has no open employment', 'ALREADY_EXITED');
    if (lastDay < fromDateColumn(spell.startsOn)) throw new ValidationError('The last day cannot be before the start day', 'EFFECTIVE_DATE_PAST');

    await runAudited(async (tx) => {
      const claimed = await lifecycleRepository.endSpell(tx, spell.id, {
        endedOn: toDateColumn(lastDay),
        exitReason: body.reason,
        exitNote: body.note ?? null,
        uniformReturned: body.uniformReturned,
        endedById: subject.id,
        endedAt: now,
        exitSnapshot: initialSnapshot(emp) as unknown as Prisma.InputJsonValue,
      });
      if (claimed.count === 0) throw new ConflictError('This exit is already recorded', 'ALREADY_EXITED');
      await lifecycleRepository.setStatus(tx, emp.id, emp.companyId, 'NOTICE', { exitedOn: toDateColumn(lastDay) });
      return {
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: emp.siteId,
            actor: ctx.auditActor,
            action: 'people.exit_recorded',
            category: 'PEOPLE' as const,
            subjectType: 'Employee',
            subjectId: emp.id,
            subjectUserId: emp.userId,
            after: { lastDay: body.lastDay, reason: body.reason, uniformReturned: body.uniformReturned },
          },
        ],
        events: [
          { name: 'employee.exit_recorded' as const, occurredAt: now.toISOString(), payload: { employeeId: emp.id, userId: emp.userId, siteId: emp.siteId, lastDay, reason: body.reason } },
        ],
      };
    });
    await told(await employeesRepository.userIdsByRole(ctx.companyId, 'DIRECTOR'), 'employee.exit_recorded', { employeeId: emp.id });
    // A last day that has already passed closes the file at once; otherwise the daily scheduler does it after the day ends.
    if (lastDay < today) await finalizeExitFor(await lifecycleRepository.findEmployeeTop(ctx.companyId, emp.id), today, now, appDoer(ctx));
    return employeesService.getFile(subject, id);
  },

  async updateExitChecklist(subject: AccessSubject, id: string, body: ExitChecklistBody): Promise<EmployeeFileView> {
    const ctx = await resolveActor(subject);
    const emp = await loadForWrite(ctx, id, 'employee.lifecycle');
    if (emp.status !== 'NOTICE' && emp.status !== 'EXITED') throw new ConflictError('No exit is recorded', 'NOT_EXITED');
    const spell = await lifecycleRepository.currentSpellTop(emp.id);
    if (!spell?.endedOn) throw new ConflictError('No exit is recorded', 'NOT_EXITED');
    await runAudited(async (tx) => {
      await lifecycleRepository.setUniform(tx, spell.id, body.uniformReturned);
      return {
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: emp.siteId,
            actor: ctx.auditActor,
            action: 'people.updated',
            category: 'PEOPLE' as const,
            subjectType: 'Employee',
            subjectId: emp.id,
            subjectUserId: emp.userId,
            after: { changed: ['uniformReturned'] },
          },
        ],
      };
    });
    return employeesService.getFile(subject, id);
  },

  // ---- W22: undo ---------------------------------------------------------------------------------------------
  async undoExit(subject: AccessSubject, id: string, now: Date = new Date()): Promise<UndoResult> {
    const ctx = await resolveActor(subject);
    const today = todayOf(now);
    const emp = await loadForWrite(ctx, id, 'employee.lifecycle');
    if (emp.status !== 'NOTICE' && emp.status !== 'EXITED') throw new ConflictError('No exit is recorded', 'NOT_EXITED');
    const spell = await lifecycleRepository.currentSpellTop(emp.id);
    if (!spell?.endedOn) throw new ConflictError('No exit is recorded', 'NOT_EXITED');
    const lastDay = fromDateColumn(spell.endedOn);
    if (!canUndoExit(lastDay, today)) throw new ConflictError(`An exit can be undone until ${undoUntil(lastDay)}`, 'UNDO_WINDOW_CLOSED');
    const snapshot = parseSnapshot(spell.exitSnapshot) ?? initialSnapshot(emp);
    const finalized = spell.finalizedAt !== null;
    const notRestored: string[] = [];

    if (finalized && emp.userId && snapshot.loginDeactivated) await accountGateway.setActive(emp.userId, true);
    try {
      await runAudited(async (tx) => {
        let headEvents: WorkforceEvent[] = [];
        await lifecycleRepository.reopenSpell(tx, spell.id);
        await lifecycleRepository.setStatus(tx, emp.id, emp.companyId, snapshot.statusBefore as LifecycleEmployee['status'], {
          exitedOn: null,
          ...(finalized ? { contractStatus: snapshot.contractStatusBefore as LifecycleEmployee['contractStatus'] } : {}),
        });
        if (finalized) {
          if (snapshot.contractIds.length > 0) await lifecycleRepository.restoreContracts(tx, snapshot.contractIds);
          const heads = await restoreHeadRows(tx, emp, snapshot.heads, today, ctx.subject.id, now);
          if (heads.notRestored > 0) notRestored.push('HEAD_ROLE');
          headEvents = heads.events;
          if (snapshot.cancelledMoveIds.length > 0) notRestored.push('SCHEDULED_MOVES');
        }
        return {
          result: null,
          entries: [
            {
              companyId: ctx.companyId,
              siteId: emp.siteId,
              actor: ctx.auditActor,
              action: 'people.exit_undone',
              category: 'PEOPLE' as const,
              subjectType: 'Employee',
              subjectId: emp.id,
              subjectUserId: emp.userId,
              after: { notRestored: [...new Set(notRestored)] },
            },
          ],
          events: [...headEvents, { name: 'employee.exit_undone' as const, occurredAt: now.toISOString(), payload: { employeeId: emp.id, userId: emp.userId, siteId: emp.siteId } }],
        };
      });
    } catch (error) {
      if (finalized && emp.userId && snapshot.loginDeactivated) await accountGateway.setActive(emp.userId, false);
      throw error;
    }
    await told(await employeesRepository.userIdsByRole(ctx.companyId, 'DIRECTOR'), 'employee.exit_undone', { employeeId: emp.id });
    return { ...(await employeesService.getFile(subject, id)), notRestored: [...new Set(notRestored)] };
  },

  // ---- W23: rehire -------------------------------------------------------------------------------------------
  async rehire(subject: AccessSubject, id: string, body: RehireBody, now: Date = new Date()): Promise<EmployeeFileView> {
    const ctx = await resolveActor(subject);
    const today = todayOf(now);
    const emp = await loadForWrite(ctx, id, 'employee.lifecycle');
    if (emp.status !== 'EXITED') throw new ConflictError('Only someone who has left can be rehired', 'NOT_EXITED');
    const spell = await lifecycleRepository.currentSpellTop(emp.id);
    if (!spell?.endedOn) throw new ConflictError('Only someone who has left can be rehired', 'NOT_EXITED');
    const lastDay = fromDateColumn(spell.endedOn);
    if (canUndoExit(lastDay, today)) throw new ConflictError(`Undo the exit instead, until ${undoUntil(lastDay)}`, 'UNDO_WINDOW_OPEN');
    const startsOn = parseNairobiDate(body.startsOn);
    if (startsOn <= lastDay) throw new ValidationError('The new start must be after the last day', 'EFFECTIVE_DATE_PAST');

    // A different department or position must still be offered (same site only; a different site is a transfer afterwards).
    const departmentId = body.departmentId ?? emp.departmentId;
    const positionId = body.positionId ?? emp.positionId;
    if (!departmentId || !positionId) throw new ValidationError('Choose a department and a position');
    const department = await lifecycleRepository.findDepartment(ctx.companyId, departmentId);
    if (!department || department.siteId !== emp.siteId) throw new ValidationError('The department must be at the same site', 'DEPARTMENT_NOT_AT_SITE');
    if (department.status !== 'ACTIVE') throw new ValidationError('That department is retired');
    const position = await lifecycleRepository.findPosition(ctx.companyId, positionId);
    if (!position || !position.isActive) throw new ValidationError('That position is not available');
    if (!department.positions.some((p) => p.positionId === positionId)) throw new ConflictError('That department does not offer this position', 'POSITION_NOT_OFFERED');
    if (emp.payType === 'DAILY_RATE' && !position.casualsAllowed) throw new ConflictError('This position does not take casuals', 'CASUALS_NOT_ALLOWED');
    if (body.reportsToId) {
      const boss = await lifecycleRepository.findActiveEmployee(ctx.companyId, body.reportsToId);
      if (!boss || boss.id === emp.id) throw new ValidationError('That manager is not an active employee');
    }

    const months = emp.payType === 'DAILY_RATE' ? 0 : (await getEffectiveRuleGroup(emp.siteId, startsOn, 'PROBATION')).values.defaultMonths;
    const end = probationEnd(startsOn, months);
    if (emp.userId) await accountGateway.setActive(emp.userId, true);
    try {
      await runAudited(async (tx) => {
        await lifecycleRepository.createSpell(tx, { employeeId: emp.id, startsOn: toDateColumn(startsOn) });
        await lifecycleRepository.setStatus(tx, emp.id, emp.companyId, startsOn <= today ? 'ACTIVE' : 'ONBOARDING', {
          startDate: toDateColumn(startsOn),
          exitedOn: null,
          probationEndsOn: end ? toDateColumn(end) : null,
          probationExtensions: 0,
          probationDecidedOn: null,
          probationConfirmedOn: null,
          contractStatus: 'NONE',
          departmentId,
          positionId,
          ...(body.reportsToId !== undefined ? { reportsToId: body.reportsToId } : {}),
          ...(emp.tracksTimeOverride ? {} : { tracksTime: position.defaultTracksTime }),
        });
        return {
          result: null,
          entries: [
            {
              companyId: ctx.companyId,
              siteId: emp.siteId,
              actor: ctx.auditActor,
              action: 'people.rehired',
              category: 'PEOPLE' as const,
              subjectType: 'Employee',
              subjectId: emp.id,
              subjectUserId: emp.userId,
              after: { startsOn: body.startsOn, departmentChanged: departmentId !== emp.departmentId, positionChanged: positionId !== emp.positionId },
            },
          ],
          events: [{ name: 'employee.rehired' as const, occurredAt: now.toISOString(), payload: { employeeId: emp.id, userId: emp.userId, siteId: emp.siteId, startsOn } }],
        };
      });
    } catch (error) {
      if (emp.userId) await accountGateway.setActive(emp.userId, false);
      throw error;
    }
    return employeesService.getFile(subject, id);
  },
};
