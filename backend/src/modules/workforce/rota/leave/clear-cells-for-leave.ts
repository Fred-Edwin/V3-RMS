import type { Prisma } from '@prisma/client';
import type { AuditActor, AuditEntryInput } from '../../_shared/audit/audit.types';
import { fromDateColumn, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { changeBatcher } from '../changes/change-batcher';
import { cellsRepository } from '../cells/cells-repository';

export interface ClearForLeaveArgs {
  companyId: string;
  siteId: string;
  employeeId: string;
  userId: string | null;
  /** "Name, Role" for the audit line; never a figure. */
  personLabel: string;
  from: NairobiDate;
  to: NairobiDate;
  applicationId: string;
  actor: AuditActor;
}

export interface ClearedForLeave {
  removed: number;
  dates: NairobiDate[];
  /** One `rota.cells_changed` entry for the caller's `runAudited` (null when the person had no shifts on those days). */
  entry: AuditEntryInput | null;
}

/**
 * The rota door Leave uses when it approves (spec section 6): the person's shifts on the approved days are removed, so the rota shows
 * Leave. It runs in the caller's transaction and returns the audit entry for the caller to write last. Call `noteLeaveCellsCleared`
 * after the commit to queue the batched "your shifts changed" notice.
 */
export async function clearCellsForLeave(tx: Prisma.TransactionClient, args: ClearForLeaveArgs): Promise<ClearedForLeave> {
  const rows = await cellsRepository.entriesFor(tx, [args.employeeId], toDateColumn(args.from), toDateColumn(args.to));
  if (rows.length === 0) return { removed: 0, dates: [], entry: null };
  await cellsRepository.deleteEntries(tx, rows.map((row) => row.id));
  const dates = [...new Set(rows.map((row) => fromDateColumn(row.date)))].sort();
  const entry: AuditEntryInput = {
    companyId: args.companyId,
    siteId: args.siteId,
    actor: args.actor,
    category: 'TIME',
    subjectType: 'RotaCells',
    subjectId: args.siteId,
    action: 'rota.cells_changed',
    before: null,
    after: { cells: rows.length, people: 1, leaveOverrides: 0, listed: dates.slice(0, 20).map((date) => ({ person: args.personLabel, date, from: 'Shift', to: 'Leave' })), leaveApplication: args.applicationId },
    reason: 'Leave approved',
  };
  return { removed: rows.length, dates, entry };
}

/** After the commit: queue the one batched notice for the person's changed days. */
export function noteLeaveCellsCleared(args: { siteId: string; employeeId: string; userId: string | null; dates: readonly NairobiDate[]; changedById: string }): void {
  changeBatcher.record(args.dates.map((date) => ({ siteId: args.siteId, employeeId: args.employeeId, userId: args.userId, date, changedById: args.changedById })));
}
