import type { z } from 'zod';
import { ConflictError, NotFoundError, ValidationError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { fromDateColumn, parseNairobiDate, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { assertInScope, type AccessSubject } from '../../_shared/workforce-access';
import { employeesRepository } from '../employees/employees-repository';
import { resolveActor, told, todayOf, type ActorCtx } from '../people-context';
import { collectImpacts } from '../people-hooks';
import type { MovePreview, MoveRow } from '../people.types';
import type { LoanSchema, TransferSchema } from '../people-validators';
import { applyTransfer, endLoan } from './lifecycle-engine';
import { lifecycleRepository, type LifecycleEmployee } from './lifecycle-repository';
import { appDoer, loadForWrite } from './lifecycle-support';

export type TransferBody = z.infer<typeof TransferSchema>;
export type LoanBody = z.infer<typeof LoanSchema>;

async function moveRowOf(moveId: string, employeeId: string, companyId: string): Promise<MoveRow> {
  const move = await lifecycleRepository.findMoveTop(companyId, employeeId, moveId);
  if (!move) throw new NotFoundError('Move not found');
  const names = await lifecycleRepository.siteNames([move.fromSiteId, move.toSiteId]);
  const dept = move.toDepartmentId ? await lifecycleRepository.findDepartment(companyId, move.toDepartmentId) : null;
  return {
    id: move.id,
    kind: move.kind,
    status: move.status,
    employeeId: move.employeeId,
    fromSite: { id: move.fromSiteId, name: names.get(move.fromSiteId) ?? '' },
    toSite: { id: move.toSiteId, name: names.get(move.toSiteId) ?? '' },
    toDepartment: dept ? { id: dept.id, name: dept.name } : null,
    startsOn: fromDateColumn(move.startsOn),
    endsOn: move.endsOn ? fromDateColumn(move.endsOn) : null,
  };
}

async function validateTransferTarget(ctx: ActorCtx, emp: LifecycleEmployee, body: TransferBody): Promise<void> {
  assertInScope(ctx.subject, 'employee.lifecycle', { userId: emp.userId, siteId: body.toSiteId, departmentId: body.toDepartmentId });
  if (!(await lifecycleRepository.findSite(ctx.companyId, body.toSiteId))) throw new ValidationError('That site is not available');
  const department = await lifecycleRepository.findDepartment(ctx.companyId, body.toDepartmentId);
  if (!department || department.siteId !== body.toSiteId) throw new ValidationError('That department is not at that site', 'DEPARTMENT_NOT_AT_SITE');
  if (department.status !== 'ACTIVE') throw new ValidationError('That department is retired');
  const positionId = body.toPositionId ?? emp.positionId;
  if (!positionId) throw new ValidationError('Choose a position');
  if (!department.positions.some((p) => p.positionId === positionId)) throw new ConflictError('That department does not offer this position', 'POSITION_NOT_OFFERED');
  if (body.toPositionId) {
    const position = await lifecycleRepository.findPosition(ctx.companyId, body.toPositionId);
    if (!position || !position.isActive) throw new ValidationError('That position is not available');
    if (emp.payType === 'DAILY_RATE' && !position.casualsAllowed) throw new ConflictError('This position does not take casuals', 'CASUALS_NOT_ALLOWED');
  }
  if (body.toReportsToId) {
    const boss = await lifecycleRepository.findActiveEmployee(ctx.companyId, body.toReportsToId);
    if (!boss || boss.id === emp.id) throw new ValidationError('That manager is not an active employee');
  }
}

async function previewOfTransfer(ctx: ActorCtx, emp: LifecycleEmployee, body: TransferBody, today: NairobiDate): Promise<MovePreview> {
  await validateTransferTarget(ctx, emp, body);
  const startsOn = parseNairobiDate(body.startsOn);
  const effectiveOn = startsOn < today ? today : startsOn;
  const head = await lifecycleRepository.headOf(body.toDepartmentId, toDateColumn(effectiveOn));
  const newHead = head && head.employee.id !== emp.id ? { employeeId: head.employee.id, name: head.employee.name } : null;
  let newReportsTo = newHead;
  if (body.toReportsToId) {
    const boss = await lifecycleRepository.findActiveEmployee(ctx.companyId, body.toReportsToId);
    newReportsTo = boss ? { employeeId: boss.id, name: boss.name } : null;
  }
  const oldHead = emp.departmentId ? await lifecycleRepository.headOf(emp.departmentId, toDateColumn(effectiveOn)) : null;
  const managers = [...(await employeesRepository.siteManagerUserIds(emp.siteId)), ...(await employeesRepository.siteManagerUserIds(body.toSiteId))];
  const userIds = [...new Set([...managers, head?.employee.userId, oldHead?.employee.userId, emp.userId].filter((u): u is string => typeof u === 'string'))];
  const names = new Map((await employeesRepository.findUserNames(userIds)).map((u) => [u.id, u.name]));
  const impacts = await collectImpacts({ kind: 'TRANSFER', employeeIds: [emp.id], siteId: emp.siteId, departmentId: emp.departmentId, effectiveOn });
  return { effectiveOn, newHead, newReportsTo, notified: userIds.map((userId) => ({ userId, name: names.get(userId) ?? '' })), impacts };
}

/** Transfer, send to another site (loan), and their cancel or early end. The scheduler completes what is dated ahead. */
export const movesService = {
  // ---- W15 and W16: transfer ---------------------------------------------------------------------------------
  async previewTransfer(subject: AccessSubject, id: string, body: TransferBody, now: Date = new Date()): Promise<MovePreview> {
    const ctx = await resolveActor(subject);
    const emp = await loadForWrite(ctx, id, 'employee.lifecycle');
    return previewOfTransfer(ctx, emp, body, todayOf(now));
  },

  async transfer(subject: AccessSubject, id: string, body: TransferBody, now: Date = new Date()): Promise<MoveRow> {
    const ctx = await resolveActor(subject);
    const today = todayOf(now);
    const emp = await loadForWrite(ctx, id, 'employee.lifecycle');
    if (emp.status === 'EXITED' || emp.status === 'NOTICE') throw new ConflictError('This person is leaving', 'ALREADY_EXITED');
    await validateTransferTarget(ctx, emp, body);
    const startsOn = parseNairobiDate(body.startsOn);
    if (startsOn < today) throw new ValidationError('A transfer cannot start in the past', 'EFFECTIVE_DATE_PAST');
    if (await lifecycleRepository.scheduledTransferTop(emp.id)) throw new ConflictError('A transfer is already scheduled', 'TRANSFER_SCHEDULED');

    const created = await runAudited(async (tx) => {
      const move = await lifecycleRepository.createMove(tx, {
        employeeId: emp.id,
        kind: 'TRANSFER',
        status: 'SCHEDULED',
        fromSiteId: emp.siteId,
        toSiteId: body.toSiteId,
        fromDepartmentId: emp.departmentId,
        toDepartmentId: body.toDepartmentId,
        toPositionId: body.toPositionId ?? null,
        toReportsToId: body.toReportsToId ?? null,
        startsOn: toDateColumn(startsOn),
        endsOn: null,
        summary: null,
        createdById: subject.id,
      });
      return { result: move, entries: [] };
    });

    if (startsOn <= today) {
      const move = await lifecycleRepository.findMoveTop(ctx.companyId, emp.id, created.id);
      if (move) await applyTransfer(move, today, now, appDoer(ctx), 'people.transferred');
    } else {
      await runAudited(async () => ({
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: emp.siteId,
            actor: ctx.auditActor,
            action: 'people.transferred',
            category: 'PEOPLE' as const,
            subjectType: 'Employee',
            subjectId: emp.id,
            subjectUserId: emp.userId,
            after: { kind: 'TRANSFER', scheduled: true, toSiteId: body.toSiteId, toDepartmentId: body.toDepartmentId, startsOn: body.startsOn },
          },
        ],
      }));
      const bosses = [...(await employeesRepository.siteManagerUserIds(emp.siteId)), ...(await employeesRepository.siteManagerUserIds(body.toSiteId))];
      await told([...bosses, emp.userId], 'employee.transfer_scheduled', { employeeId: emp.id });
    }
    return moveRowOf(created.id, emp.id, ctx.companyId);
  },

  // ---- W17: send to another site (loan) ----------------------------------------------------------------------
  async loan(subject: AccessSubject, id: string, body: LoanBody, now: Date = new Date()): Promise<MoveRow> {
    const ctx = await resolveActor(subject);
    const today = todayOf(now);
    const emp = await loadForWrite(ctx, id, 'employee.lifecycle');
    if (emp.status === 'EXITED' || emp.status === 'NOTICE') throw new ConflictError('This person is leaving', 'ALREADY_EXITED');
    if (emp.payType === 'DAILY_RATE') throw new ConflictError('A casual works where the head places them', 'CASUAL_CANNOT_BE_LOANED');
    if (body.toSiteId === emp.siteId) throw new ValidationError('That is already their site', 'SAME_SITE');
    if (!(await lifecycleRepository.findSite(ctx.companyId, body.toSiteId))) throw new ValidationError('That site is not available');
    const from = parseNairobiDate(body.from);
    if (from < today) throw new ValidationError('A loan cannot start in the past', 'EFFECTIVE_DATE_PAST');
    const until = body.until ? parseNairobiDate(body.until) : null;

    const created = await runAudited(async (tx) => {
      const move = await lifecycleRepository.createMove(tx, {
        employeeId: emp.id,
        kind: 'LOAN',
        status: from <= today ? 'ACTIVE' : 'SCHEDULED',
        fromSiteId: emp.siteId,
        toSiteId: body.toSiteId,
        fromDepartmentId: emp.departmentId,
        toDepartmentId: null,
        toPositionId: null,
        toReportsToId: null,
        startsOn: toDateColumn(from),
        endsOn: until ? toDateColumn(until) : null,
        summary: null,
        createdById: subject.id,
      });
      return {
        result: move,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: emp.siteId,
            actor: ctx.auditActor,
            action: 'people.loan_created',
            category: 'PEOPLE' as const,
            subjectType: 'Employee',
            subjectId: emp.id,
            subjectUserId: emp.userId,
            after: { hostSiteId: body.toSiteId, from: body.from, until: body.until },
          },
        ],
        events: [
          { name: 'employee.loaned' as const, occurredAt: now.toISOString(), payload: { employeeId: emp.id, userId: emp.userId, homeSiteId: emp.siteId, hostSiteId: body.toSiteId, from, until } },
        ],
      };
    });
    const bosses = [...(await employeesRepository.siteManagerUserIds(emp.siteId)), ...(await employeesRepository.siteManagerUserIds(body.toSiteId))];
    await told(bosses, 'employee.loaned', { employeeId: emp.id });
    return moveRowOf(created.id, emp.id, ctx.companyId);
  },

  /** W18: cancel a scheduled move. */
  async cancelMove(subject: AccessSubject, id: string, moveId: string, now: Date = new Date()): Promise<MoveRow> {
    const ctx = await resolveActor(subject);
    const emp = await loadForWrite(ctx, id, 'employee.lifecycle');
    const move = await lifecycleRepository.findMoveTop(ctx.companyId, emp.id, moveId);
    if (!move) throw new NotFoundError('Move not found');
    if (move.status !== 'SCHEDULED') throw new ConflictError('Only a move that has not started can be cancelled', 'MOVE_NOT_SCHEDULED');
    await runAudited(async (tx) => {
      const done = await lifecycleRepository.setMoveStatus(tx, move.id, 'SCHEDULED', { status: 'CANCELLED', cancelledAt: now });
      if (done.count === 0) throw new ConflictError('Only a move that has not started can be cancelled', 'MOVE_NOT_SCHEDULED');
      return {
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: emp.siteId,
            actor: ctx.auditActor,
            action: 'people.move_cancelled',
            category: 'PEOPLE' as const,
            subjectType: 'Employee',
            subjectId: emp.id,
            subjectUserId: emp.userId,
            after: { kind: move.kind },
          },
        ],
      };
    });
    return moveRowOf(move.id, emp.id, ctx.companyId);
  },

  /** W18: bring a person on loan back today. */
  async endMove(subject: AccessSubject, id: string, moveId: string, now: Date = new Date()): Promise<MoveRow> {
    const ctx = await resolveActor(subject);
    const today = todayOf(now);
    const emp = await loadForWrite(ctx, id, 'employee.lifecycle');
    const move = await lifecycleRepository.findMoveTop(ctx.companyId, emp.id, moveId);
    if (!move) throw new NotFoundError('Move not found');
    if (move.kind !== 'LOAN' || move.status !== 'ACTIVE') throw new ConflictError('Only a loan in progress can be ended', 'MOVE_NOT_ACTIVE');
    await endLoan(move, today, now, appDoer(ctx));
    return moveRowOf(move.id, emp.id, ctx.companyId);
  },
};
