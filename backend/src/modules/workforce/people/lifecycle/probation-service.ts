import type { z } from 'zod';
import { ConflictError, NotFoundError, ValidationError } from '../../../../utils/errors';
import { logger } from '../../../../utils/logger';
import { runAudited } from '../../_shared/audit/audit-writer';
import { fromDateColumn, parseNairobiDate, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { employeesService } from '../employees/employees-service';
import { accountGateway } from '../people-account-gateway';
import { resolveActor, told, todayOf } from '../people-context';
import { addMonths } from '../people-dates';
import type { ProbationView } from '../people.types';
import type { ContractSchema, ProbationDecisionSchema, ProbationNoteSchema } from '../people-validators';
import { lifecycleRepository } from './lifecycle-repository';
import { loadForWrite } from './lifecycle-support';

export type ContractBody = z.infer<typeof ContractSchema>;
export type ProbationDecisionBody = z.infer<typeof ProbationDecisionSchema>;
export type ProbationNoteBody = z.infer<typeof ProbationNoteSchema>;

/** The contract record and the probation decision. A confirmation made before a contract exists completes when one does. */
export const probationService = {
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
    return probationOf(subject, id);
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
    return probationOf(subject, id);
  },
};

async function probationOf(subject: AccessSubject, id: string): Promise<ProbationView> {
  const file = await employeesService.getFile(subject, id);
  if (!file.probation) throw new NotFoundError('Probation not found');
  return file.probation;
}
