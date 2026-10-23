import type { Prisma } from '@prisma/client';
import { logger } from '../../../../utils/logger';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { AuditActor, AuditChannelCode, AuditEntryInput, JsonValue } from '../../_shared/audit/audit.types';
import type { WorkforceEvent } from '../../_shared/events';
import { fromDateColumn, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { employeesRepository } from '../employees/employees-repository';
import { endAllHeadRows } from '../organisation/heads/head-sync';
import { accountGateway } from '../people-account-gateway';
import { told } from '../people-context';
import { lifecycleRepository, type LifecycleEmployee, type MoveWithEmployee } from './lifecycle-repository';

/**
 * The steps that change a file without a person at the keyboard: a transfer taking effect, a loan starting or ending,
 * an exit being finalised. The services call them for immediate effect; the daily scheduler calls them for the rest.
 * Each is safe to run twice: it re-reads what it needs and does nothing when the state has already moved on.
 */
export interface Doer {
  actor: AuditActor;
  channel: AuditChannelCode;
}
export const SYSTEM_DOER: Doer = { actor: { id: null, role: 'SYSTEM', name: 'System' }, channel: 'SYSTEM' };

/** What was changed at finalise, so an undo can put it back. Never an amount or an ID number. */
export interface ExitSnapshot {
  statusBefore: string;
  contractStatusBefore: string;
  contractIds: string[];
  heads: { departmentId: string; startsOn: string }[];
  cancelledMoveIds: string[];
  loginDeactivated: boolean;
}

export const parseSnapshot = (value: unknown): ExitSnapshot | null => {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.statusBefore !== 'string') return null;
  const strings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string') : []);
  return {
    statusBefore: v.statusBefore,
    contractStatusBefore: typeof v.contractStatusBefore === 'string' ? v.contractStatusBefore : 'NONE',
    contractIds: strings(v.contractIds),
    heads: Array.isArray(v.heads)
      ? v.heads.flatMap((h) => {
          const r = h as Record<string, unknown>;
          return typeof r.departmentId === 'string' && typeof r.startsOn === 'string' ? [{ departmentId: r.departmentId, startsOn: r.startsOn }] : [];
        })
      : [],
    cancelledMoveIds: strings(v.cancelledMoveIds),
    loginDeactivated: v.loginDeactivated === true,
  };
};

const asJson = (snapshot: ExitSnapshot): Prisma.InputJsonValue => snapshot as unknown as Prisma.InputJsonValue;

/**
 * Ends the person's head rows (slice 1b: through the one head-claims writer, so the claims follow and
 * `department.head_changed` is emitted after commit). Returns the substantive roles for the exit snapshot.
 */
const endEmployeeHeads = async (
  tx: Prisma.TransactionClient,
  emp: Pick<LifecycleEmployee, 'id' | 'userId' | 'companyId'>,
  today: NairobiDate,
  doer: Doer,
  reason: string,
  now: Date,
): Promise<{ heads: { departmentId: string; startsOn: string }[]; events: WorkforceEvent[] }> => {
  const ended = await endAllHeadRows(tx, emp, today, doer.actor.id, reason, now);
  const heads = ended.rows.filter((h) => !h.isActing).map((h) => ({ departmentId: h.departmentId, startsOn: fromDateColumn(h.startsOn) }));
  return { heads, events: ended.events };
};

const entry = (companyId: string, siteId: string, doer: Doer, e: Pick<AuditEntryInput, 'action' | 'subjectId' | 'subjectUserId' | 'after' | 'reason'> & { subjectType?: string }): AuditEntryInput => ({
  companyId,
  siteId,
  actor: doer.actor,
  channel: doer.channel,
  category: 'PEOPLE',
  subjectType: e.subjectType ?? 'Employee',
  ...e,
});

// ---- transfer takes effect -----------------------------------------------------------------------------------------
export async function applyTransfer(move: MoveWithEmployee, today: NairobiDate, now: Date, doer: Doer, action: 'people.transferred' | 'people.transfer_applied'): Promise<boolean> {
  const emp = move.employee;
  if (move.status !== 'SCHEDULED') return false;
  if (emp.status === 'EXITED') {
    await runAudited(async (tx) => {
      await lifecycleRepository.setMoveStatus(tx, move.id, 'SCHEDULED', { status: 'CANCELLED', cancelledAt: now });
      return { result: null, entries: [entry(emp.companyId, move.fromSiteId, doer, { action: 'people.move_cancelled', subjectId: emp.id, subjectUserId: emp.userId, after: { kind: 'TRANSFER', why: 'exited' } })] };
    });
    return false;
  }

  // The login moves first through the legacy transfer code; if the Workforce side then fails, it is put back.
  const loginMoves = emp.userId !== null && move.fromSiteId !== move.toSiteId;
  if (loginMoves && emp.userId) await accountGateway.moveToSite(emp.userId, move.toSiteId, doer.actor.id ?? move.createdById, 'Workforce transfer');

  try {
    const newDepartment = move.toDepartmentId ? await lifecycleRepository.headOf(move.toDepartmentId, toDateColumn(today)) : null;
    await runAudited(async (tx) => {
      const claimed = await lifecycleRepository.setMoveStatus(tx, move.id, 'SCHEDULED', { status: 'DONE', appliedAt: now });
      if (claimed.count === 0) return { result: null, entries: [] }; // another run got there first
      const positionChanged = move.toPositionId !== null && move.toPositionId !== emp.positionId;
      const position = positionChanged && move.toPositionId ? await lifecycleRepository.findPosition(emp.companyId, move.toPositionId) : null;
      const reportsToId =
        move.toReportsToId ?? (newDepartment && newDepartment.employee.id !== emp.id ? newDepartment.employee.id : null);
      await lifecycleRepository.updateEmployee(tx, emp.id, emp.companyId, {
        siteId: move.toSiteId,
        departmentId: move.toDepartmentId,
        ...(move.toPositionId ? { positionId: move.toPositionId } : {}),
        reportsToId,
        ...(position && !emp.tracksTimeOverride ? { tracksTime: position.defaultTracksTime } : {}),
      });
      const endedHeads = await endEmployeeHeads(tx, emp, today, doer, 'TRANSFER', now);
      return {
        result: null,
        entries: [
          entry(emp.companyId, move.toSiteId, doer, {
            action,
            subjectId: emp.id,
            subjectUserId: emp.userId,
            after: { kind: 'TRANSFER', fromSiteId: move.fromSiteId, toSiteId: move.toSiteId, toDepartmentId: move.toDepartmentId, effectiveOn: fromDateColumn(move.startsOn), headRolesEnded: endedHeads.heads.length },
          }),
        ],
        events: [
          ...endedHeads.events,
          {
            name: 'employee.transferred',
            occurredAt: now.toISOString(),
            payload: {
              employeeId: emp.id,
              userId: emp.userId,
              fromSiteId: move.fromSiteId,
              toSiteId: move.toSiteId,
              fromDepartmentId: move.fromDepartmentId,
              toDepartmentId: move.toDepartmentId,
              effectiveOn: fromDateColumn(move.startsOn),
            },
          } satisfies WorkforceEvent,
        ],
      };
    });
  } catch (error) {
    if (loginMoves && emp.userId) {
      try {
        await accountGateway.moveToSite(emp.userId, move.fromSiteId, doer.actor.id ?? move.createdById, 'Workforce transfer rolled back');
      } catch (rollbackError) {
        logger.error({ err: rollbackError, employeeId: emp.id }, 'could not put the login back after a failed transfer');
      }
    }
    throw error;
  }
  const bosses = [...(await employeesRepository.siteManagerUserIds(move.fromSiteId)), ...(await employeesRepository.siteManagerUserIds(move.toSiteId))];
  await told([...bosses, emp.userId], 'employee.transferred', { employeeId: emp.id, name: emp.name });
  return true;
}

// ---- loans start and end --------------------------------------------------------------------------------------------
export async function startLoan(move: MoveWithEmployee, now: Date): Promise<boolean> {
  if (move.status !== 'SCHEDULED') return false;
  if (move.employee.status === 'EXITED') {
    await runAudited(async (tx) => {
      await lifecycleRepository.setMoveStatus(tx, move.id, 'SCHEDULED', { status: 'CANCELLED', cancelledAt: now });
      return { result: null, entries: [entry(move.employee.companyId, move.fromSiteId, SYSTEM_DOER, { action: 'people.move_cancelled', subjectId: move.employee.id, subjectUserId: move.employee.userId, after: { kind: 'LOAN', why: 'exited' } })] };
    });
    return false;
  }
  const result = await runAudited(async (tx) => ({ result: await lifecycleRepository.setMoveStatus(tx, move.id, 'SCHEDULED', { status: 'ACTIVE', appliedAt: now }), entries: [] }));
  return result.count > 0;
}

export async function endLoan(move: MoveWithEmployee, today: NairobiDate, now: Date, doer: Doer): Promise<boolean> {
  if (move.status !== 'ACTIVE') return false;
  return runAudited(async (tx) => {
    const done = await lifecycleRepository.setMoveStatus(tx, move.id, 'ACTIVE', { status: 'DONE', appliedAt: now, ...(move.endsOn === null || fromDateColumn(move.endsOn) > today ? { endsOn: toDateColumn(today) } : {}) });
    if (done.count === 0) return { result: false, entries: [] };
    return {
      result: true,
      entries: [entry(move.employee.companyId, move.fromSiteId, doer, { action: 'people.loan_ended', subjectId: move.employee.id, subjectUserId: move.employee.userId, after: { hostSiteId: move.toSiteId } })],
    };
  });
}

// ---- exit is finalised -----------------------------------------------------------------------------------------------
/** The state recorded when the exit was written, before anything else changes. */
export const initialSnapshot = (emp: Pick<LifecycleEmployee, 'status' | 'contractStatus'>): ExitSnapshot => ({
  statusBefore: emp.status,
  contractStatusBefore: emp.contractStatus,
  contractIds: [],
  heads: [],
  cancelledMoveIds: [],
  loginDeactivated: false,
});

export async function finalizeExit(employeeId: string, companyId: string, today: NairobiDate, now: Date, doer: Doer): Promise<boolean> {
  return finalizeExitFor(await lifecycleRepository.findEmployeeTop(companyId, employeeId), today, now, doer);
}

export async function finalizeExitFor(emp: LifecycleEmployee | null, today: NairobiDate, now: Date, doer: Doer): Promise<boolean> {
  if (!emp || emp.status === 'EXITED') return false;
  const spell = await lifecycleRepository.currentSpellTop(emp.id);
  if (!spell || !spell.endedOn || spell.finalizedAt) return false;
  const snapshot = parseSnapshot(spell.exitSnapshot) ?? initialSnapshot(emp);

  // The login stops first (and is put back if the file cannot be closed).
  let deactivated = false;
  if (emp.userId && (await lifecycleRepository.userIsActive(emp.userId))) {
    await accountGateway.setActive(emp.userId, false);
    deactivated = true;
  }
  try {
    await runAudited(async (tx) => {
      const contracts = await lifecycleRepository.activeContracts(tx, emp.id);
      if (contracts.length > 0) await lifecycleRepository.endContracts(tx, contracts.map((c) => c.id));
      const { heads, events: headEvents } = await endEmployeeHeads(tx, emp, today, doer, 'EXIT', now);
      const moveIds = await lifecycleRepository.scheduledMoveIds(tx, emp.id);
      if (moveIds.length > 0) await lifecycleRepository.cancelMoves(tx, moveIds, now);
      await lifecycleRepository.setStatus(tx, emp.id, emp.companyId, 'EXITED', contracts.length > 0 ? { contractStatus: 'ENDED' } : {});
      const done: ExitSnapshot = { ...snapshot, contractIds: contracts.map((c) => c.id), heads, cancelledMoveIds: moveIds, loginDeactivated: deactivated };
      const claimed = await lifecycleRepository.setSnapshot(tx, spell.id, now, asJson(done));
      if (claimed.count === 0) throw new Error('exit already finalised');
      return {
        result: null,
        entries: [
          entry(emp.companyId, emp.siteId, doer, {
            action: 'people.exit_finalized',
            subjectId: emp.id,
            subjectUserId: emp.userId,
            after: { lastDay: fromDateColumn(spell.endedOn!), contractsEnded: contracts.length, headRolesEnded: heads.length, movesCancelled: moveIds.length, loginStopped: deactivated } as JsonValue,
          }),
        ],
        events: [
          ...headEvents,
          { name: 'employee.exit_finalized', occurredAt: now.toISOString(), payload: { employeeId: emp.id, userId: emp.userId, siteId: emp.siteId, lastDay: fromDateColumn(spell.endedOn!) } } satisfies WorkforceEvent,
        ],
      };
    });
  } catch (error) {
    if (deactivated && emp.userId) {
      try {
        await accountGateway.setActive(emp.userId, true);
      } catch (rollbackError) {
        logger.error({ err: rollbackError, employeeId: emp.id }, 'could not restart the login after a failed exit');
      }
    }
    if (error instanceof Error && error.message === 'exit already finalised') return false;
    throw error;
  }
  return true;
}
