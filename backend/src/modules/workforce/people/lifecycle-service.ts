import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../utils/errors';
import { logger } from '../../../utils/logger';
import { runAudited } from '../_shared/audit/audit-writer';
import { fromDateColumn, parseNairobiDate, toDateColumn, type NairobiDate } from '../_shared/time/nairobi-time';
import { assertInScope, inScope, scopeOf, type AccessSubject, type AccessTarget } from '../_shared/workforce-access';
import { getEffectiveRuleGroup } from '../rules/rules-service';
import { employeesRepository } from './employees-repository';
import { employeesService, todayOf } from './employees-service';
import {
  applyTransfer,
  finalizeExitFor,
  initialSnapshot,
  parseSnapshot,
  endLoan,
  startLoan,
  type Doer,
} from './lifecycle-engine';
import { lifecycleRepository, type LifecycleEmployee } from './lifecycle-repository';
import { accountGateway } from './people-account-gateway';
import { resolveActor, told, type ActorCtx } from './people-context';
import { addMonths, canUndoExit, probationEnd, undoUntil } from './people-dates';
import { collectImpacts } from './people-hooks';
import type { EmployeeFileView, MovePreview, MoveRow, ProbationView } from './people.types';
import type {
  ContractSchema,
  ExitChecklistSchema,
  ExitSchema,
  LoanSchema,
  ProbationDecisionSchema,
  ProbationNoteSchema,
  RehireSchema,
  TransferSchema,
} from './people-validators';

export type ContractBody = z.infer<typeof ContractSchema>;
export type ProbationDecisionBody = z.infer<typeof ProbationDecisionSchema>;
export type ProbationNoteBody = z.infer<typeof ProbationNoteSchema>;
export type TransferBody = z.infer<typeof TransferSchema>;
export type LoanBody = z.infer<typeof LoanSchema>;
export type ExitBody = z.infer<typeof ExitSchema>;
export type ExitChecklistBody = z.infer<typeof ExitChecklistSchema>;
export type RehireBody = z.infer<typeof RehireSchema>;

const appDoer = (ctx: ActorCtx): Doer => ({ actor: ctx.auditActor, channel: 'APP' });

const targetOf = (e: Pick<LifecycleEmployee, 'userId' | 'siteId' | 'departmentId' | 'department'>): AccessTarget => ({
  userId: e.userId,
  siteId: e.siteId,
  departmentId: e.departmentId,
  departmentTag: e.department?.key ?? null,
});

/** Loads the file for a write: out of scope answers 404 for someone who cannot even read it, else 403. */
async function loadForWrite(ctx: ActorCtx, id: string, capability: Parameters<typeof inScope>[1]): Promise<LifecycleEmployee> {
  const emp = await lifecycleRepository.findEmployeeTop(ctx.companyId, id);
  if (!emp) throw new NotFoundError('Employee not found');
  const target = targetOf(emp);
  if (!inScope(ctx.subject, capability, target)) {
    if (!inScope(ctx.subject, 'employee.read_basic', target)) throw new NotFoundError('Employee not found');
    throw new ForbiddenError('You do not have permission to perform this action');
  }
  return emp;
}

const iso = (d: Date | null): NairobiDate | null => (d ? fromDateColumn(d) : null);

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
    endsOn: iso(move.endsOn),
  };
}

export const lifecycleService = {
  // ---- W12: contract -------------------------------------------------------------------------------------------
  async createContract(subject: AccessSubject, id: string, body: ContractBody, now: Date = new Date()): Promise<{ id: string; startsOn: NairobiDate; endsOn: NairobiDate | null }> {
    const ctx = await resolveActor(subject);
    const today = todayOf(now);
    const emp = await loadForWrite(ctx, id, 'employee.write_sensitive');
    if (emp.status === 'EXITED') throw new ConflictError('This file is closed', 'ALREADY_EXITED');
    if (emp.payType === 'DAILY_RATE') throw new ConflictError('A casual has no contract', 'CASUAL_HAS_NO_CONTRACT');
    if (emp.contractStatus === 'ACTIVE') throw new ConflictError('There is already an active contract', 'CONTRACT_EXISTS');
    if (body.contractTypeId && !(await lifecycleRepository.findContractType(ctx.companyId, body.contractTypeId))) throw new ValidationError('That contract type is not available');

    const created = await runAudited(async (tx) => {
      const contract = await lifecycleRepository.createContract(tx, {
        employeeId: emp.id,
        contractTypeId: body.contractTypeId ?? null,
        startsOn: toDateColumn(parseNairobiDate(body.startsOn)),
        endsOn: body.endsOn ? toDateColumn(parseNairobiDate(body.endsOn)) : null,
        createdById: subject.id,
      });
      // A probation confirmation that was waiting for a signed contract completes now.
      const completes = emp.probationDecidedOn !== null && emp.probationConfirmedOn === null;
      await lifecycleRepository.updateEmployee(tx, emp.id, emp.companyId, { contractStatus: 'ACTIVE', ...(completes ? { probationConfirmedOn: toDateColumn(today) } : {}) });
      return {
        result: contract,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: emp.siteId,
            actor: ctx.auditActor,
            action: 'people.contract_created',
            category: 'PAY_SETUP' as const,
            subjectType: 'Employee',
            subjectId: emp.id,
            subjectUserId: emp.userId,
            after: { startsOn: body.startsOn, endsOn: body.endsOn ?? null, probationConfirmed: completes },
          },
        ],
      };
    });
    // The legacy leave bridge (slice 5 replaces it): a failure here must not undo a recorded contract.
    if (emp.userId && body.contractTypeId) {
      try {
        await accountGateway.assignLegacyContract(emp.userId, body.contractTypeId, subject.id);
      } catch (error) {
        logger.warn({ employeeId: emp.id, err: error instanceof Error ? error.message : 'unknown' }, 'legacy leave balances were not seeded from the contract');
      }
    }
    return { id: created.id, startsOn: parseNairobiDate(body.startsOn), endsOn: body.endsOn ? parseNairobiDate(body.endsOn) : null };
  },

  // ---- W13: probation decision ---------------------------------------------------------------------------------
  async decideProbation(subject: AccessSubject, id: string, body: ProbationDecisionBody, now: Date = new Date()): Promise<ProbationView | { next: 'EXIT'; suggestedLastDay: NairobiDate }> {
    const ctx = await resolveActor(subject);
    const today = todayOf(now);
    const emp = await loadForWrite(ctx, id, 'employee.lifecycle');
    if (emp.status === 'EXITED') throw new ConflictError('This file is closed', 'ALREADY_EXITED');
    if (!emp.probationEndsOn || emp.probationConfirmedOn) throw new ConflictError('There is no probation to decide', 'NO_PROBATION');
    const endsOn = fromDateColumn(emp.probationEndsOn);

    if (body.decision === 'END') {
      return { next: 'EXIT', suggestedLastDay: endsOn > today ? endsOn : today };
    }
    const rule = (await getEffectiveRuleGroup(emp.siteId, today, 'PROBATION')).values;

    if (body.decision === 'CONFIRM') {
      const completes = emp.contractStatus === 'ACTIVE';
      await runAudited(async (tx) => {
        await lifecycleRepository.updateEmployee(tx, emp.id, emp.companyId, {
          probationDecidedOn: toDateColumn(today),
          ...(completes ? { probationConfirmedOn: toDateColumn(today) } : {}),
        });
        return {
          result: null,
          entries: [
            {
              companyId: ctx.companyId,
              siteId: emp.siteId,
              actor: ctx.auditActor,
              action: 'people.probation_decided',
              category: 'PEOPLE' as const,
              subjectType: 'Employee',
              subjectId: emp.id,
              subjectUserId: emp.userId,
              after: { decision: 'CONFIRM', completed: completes },
            },
          ],
        };
      });
    } else {
      if (emp.probationExtensions >= rule.maxExtensions || body.months > rule.maxExtensionMonths) {
        throw new ConflictError('The probation cannot be extended any further', 'PROBATION_LIMIT');
      }
      const newEnd = addMonths(endsOn, body.months);
      await runAudited(async (tx) => {
        await lifecycleRepository.updateEmployee(tx, emp.id, emp.companyId, {
          probationEndsOn: toDateColumn(newEnd),
          probationExtensions: emp.probationExtensions + 1,
          probationDecidedOn: null,
        });
        return {
          result: null,
          entries: [
            {
              companyId: ctx.companyId,
              siteId: emp.siteId,
              actor: ctx.auditActor,
              action: 'people.probation_decided',
              category: 'PEOPLE' as const,
              subjectType: 'Employee',
              subjectId: emp.id,
              subjectUserId: emp.userId,
              after: { decision: 'EXTEND', months: body.months, newEndsOn: newEnd },
              reason: body.reason,
            },
          ],
        };
      });
      await told([emp.userId], 'probation.extended', { months: body.months, reason: body.reason });
    }
    const file = await employeesService.getFile(subject, id);
    if (!file.probation) throw new NotFoundError('Probation not found');
    return file.probation;
  },

  // ---- W14: probation note -----------------------------------------------------------------------------------
  async addProbationNote(subject: AccessSubject, id: string, body: ProbationNoteBody): Promise<ProbationView> {
    const ctx = await resolveActor(subject);
    const emp = await loadForWrite(ctx, id, 'probation.note');
    if (emp.status === 'EXITED') throw new ConflictError('This file is closed', 'ALREADY_EXITED');
    if (!emp.probationEndsOn || emp.probationConfirmedOn) throw new ConflictError('There is no probation to note', 'NO_PROBATION');
    const scope = scopeOf(subject, 'probation.note');
    const authorKind = scope === 'all' ? 'HR' : (subject.headOfDepartmentIds ?? []).includes(emp.departmentId ?? '') ? 'HEAD' : 'BRANCH_MANAGER';
    await runAudited(async (tx) => {
      await lifecycleRepository.addNote(tx, { employeeId: emp.id, authorId: subject.id, authorKind, verdict: body.verdict, note: body.note ?? null });
      return {
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: emp.siteId,
            actor: ctx.auditActor,
            action: 'people.probation_noted',
            category: 'PEOPLE' as const,
            subjectType: 'Employee',
            subjectId: emp.id,
            subjectUserId: emp.userId,
            after: { verdict: body.verdict, authorKind },
          },
        ],
      };
    });
    const file = await employeesService.getFile(subject, id);
    if (!file.probation) throw new NotFoundError('Probation not found');
    return file.probation;
  },

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

  // ---- W19 to W22: exit --------------------------------------------------------------------------------------
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

  async undoExit(subject: AccessSubject, id: string, now: Date = new Date()): Promise<EmployeeFileView & { notRestored: string[] }> {
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
        await lifecycleRepository.reopenSpell(tx, spell.id);
        await lifecycleRepository.setStatus(tx, emp.id, emp.companyId, snapshot.statusBefore as LifecycleEmployee['status'], {
          exitedOn: null,
          ...(finalized ? { contractStatus: snapshot.contractStatusBefore as LifecycleEmployee['contractStatus'] } : {}),
        });
        if (finalized) {
          if (snapshot.contractIds.length > 0) await lifecycleRepository.restoreContracts(tx, snapshot.contractIds);
          for (const head of snapshot.heads) {
            if (await lifecycleRepository.departmentHasHead(tx, head.departmentId, toDateColumn(today))) notRestored.push('HEAD_ROLE');
            else await lifecycleRepository.restoreHead(tx, { departmentId: head.departmentId, employeeId: emp.id, startsOn: toDateColumn(today) });
          }
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
          events: [{ name: 'employee.exit_undone' as const, occurredAt: now.toISOString(), payload: { employeeId: emp.id, userId: emp.userId, siteId: emp.siteId } }],
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

// ---- shared bits for transfer ---------------------------------------------------------------------------------------
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

/** Applies the moves and exits that are due. Used by the daily scheduler; kept here beside the flows it completes. */
export const lifecycleSweeps = {
  async startDueMoves(today: NairobiDate, now: Date): Promise<number> {
    let changed = 0;
    for (const move of await lifecycleRepository.dueStarts(toDateColumn(today))) {
      if (move.kind === 'TRANSFER') {
        if (await applyTransfer(move, today, now, { actor: { id: null, role: 'SYSTEM', name: 'System' }, channel: 'SYSTEM' }, 'people.transfer_applied')) changed += 1;
      } else if (await startLoan(move, now)) changed += 1;
    }
    return changed;
  },
  async endDueLoans(today: NairobiDate, now: Date): Promise<number> {
    let changed = 0;
    for (const move of await lifecycleRepository.dueLoanEnds(toDateColumn(today))) {
      if (await endLoan(move, today, now, { actor: { id: null, role: 'SYSTEM', name: 'System' }, channel: 'SYSTEM' })) changed += 1;
    }
    return changed;
  },
  async finalizeDueExits(today: NairobiDate, now: Date): Promise<number> {
    let changed = 0;
    for (const spell of await lifecycleRepository.dueExits(toDateColumn(today))) {
      const emp = await lifecycleRepository.findEmployeeTop(spell.employee.companyId, spell.employeeId);
      if (await finalizeExitFor(emp, today, now, { actor: { id: null, role: 'SYSTEM', name: 'System' }, channel: 'SYSTEM' })) changed += 1;
    }
    return changed;
  },
};

export type UndoResult = EmployeeFileView & { notRestored: string[] };
