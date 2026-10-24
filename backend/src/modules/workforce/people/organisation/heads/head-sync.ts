import type { Prisma } from '@prisma/client';
import type { WorkforceEvent } from '../../../_shared/events';
import { addDays, fromDateColumn, toDateColumn, type NairobiDate } from '../../../_shared/time/nairobi-time';
import { claimsFromHeadRows, isActiveOn, type HeadClaims, type HeadRow } from '../../rules/head-claims';
import { accountGateway } from '../../people-account-gateway';
import { headsRepository, type HeadRowRecord } from './heads-repository';

/**
 * The one place a head change reaches `User.isDepartmentHead` and `departmentTag` (contract 5.4). Every flow that changes
 * a head row (assign, end, exit, transfer, undo, the nightly reconcile) calls `syncHeadClaims` inside its own
 * transaction, so the rows and the claims cannot drift apart.
 */
const toHeadRow = (row: HeadRowRecord): HeadRow => ({
  startsOn: fromDateColumn(row.startsOn),
  endsOn: row.endsOn ? fromDateColumn(row.endsOn) : null,
  isActing: row.isActing,
  departmentInventoryTag: row.department.key,
});

/** The claims a person should carry today, plus the department the tag came from (the legacy `departmentId` mirror). */
export function claimsOf(rows: readonly HeadRowRecord[], today: NairobiDate): HeadClaims & { departmentId: string | null } {
  const claims = claimsFromHeadRows(rows.map(toHeadRow), today);
  if (!claims.isDepartmentHead) return { ...claims, departmentId: null };
  const source = rows.find((row) => isActiveOn(toHeadRow(row), today) && row.department.key === claims.departmentTag);
  return { ...claims, departmentId: source?.departmentId ?? null };
}

/** Recomputes one login's claims from their head rows and writes them if they differ. Returns whether anything changed. */
export async function syncHeadClaims(tx: Prisma.TransactionClient, companyId: string, userId: string, today: NairobiDate): Promise<boolean> {
  const [rows, current] = await Promise.all([headsRepository.rowsOfUser(tx, companyId, userId, toDateColumn(today)), headsRepository.readClaims(tx, userId)]);
  if (!current) return false;
  const wanted = claimsOf(rows, today);
  // The department mirror is only owned while the person is a head; a person with no claim keeps whatever department they have.
  const same = current.isDepartmentHead === wanted.isDepartmentHead && current.departmentTag === wanted.departmentTag && (!wanted.isDepartmentHead || current.departmentId === wanted.departmentId);
  if (same) return false;
  await accountGateway.setHeadClaims(tx, userId, { isDepartmentHead: wanted.isDepartmentHead, departmentTag: wanted.departmentTag, departmentId: wanted.isDepartmentHead ? wanted.departmentId : undefined });
  return true;
}

/** The `department.head_changed` event (5.3): `previous` is the person whose row ended, `next` the person whose row started. */
export const headChangedEvent = (
  department: { id: string; siteId: string; key: HeadRowRecord['department']['key'] },
  change: { previousUserId: string | null; newUserId: string | null; effectiveOn: NairobiDate },
  now: Date,
): WorkforceEvent => ({
  name: 'department.head_changed',
  occurredAt: now.toISOString(),
  payload: {
    siteId: department.siteId,
    departmentId: department.id,
    departmentTag: department.key,
    previousHeadUserId: change.previousUserId,
    newHeadUserId: change.newUserId,
    effectiveOn: change.effectiveOn,
  },
});

/** The last day a row covers when it ends today: yesterday. */
const lastDayWhenEndedOn = (today: NairobiDate): NairobiDate => addDays(today, -1);

/**
 * Ends one head row as of today. A row that started today is removed (it never counted for a full day); any other row
 * gets yesterday as its last day. An acting row that was already due to end sooner is left alone.
 */
export async function endRowToday(tx: Prisma.TransactionClient, row: HeadRowRecord, today: NairobiDate, endedById: string | null, reason: string): Promise<void> {
  const todayColumn = toDateColumn(today);
  if (row.startsOn >= todayColumn) {
    await headsRepository.removeRow(tx, row.id, todayColumn);
    return;
  }
  const lastDay = toDateColumn(lastDayWhenEndedOn(today));
  if (row.endsOn === null) await headsRepository.endRow(tx, row.id, lastDay, endedById, reason);
  else await headsRepository.endActingRow(tx, row.id, lastDay, endedById, reason);
}

export interface EndedHeads {
  rows: HeadRowRecord[];
  events: WorkforceEvent[];
}

/**
 * Ends every head row a person holds (exit or transfer), syncs their claims and returns the events to emit after commit.
 * Used by the People lifecycle so a leaver or mover never keeps a head claim.
 */
export async function endAllHeadRows(
  tx: Prisma.TransactionClient,
  person: { id: string; userId: string | null; companyId: string },
  today: NairobiDate,
  endedById: string | null,
  reason: string,
  now: Date,
): Promise<EndedHeads> {
  const rows = await headsRepository.activeRowsOfEmployee(person.id, toDateColumn(today), tx);
  for (const row of rows) await endRowToday(tx, row, today, endedById, reason);
  if (person.userId) await syncHeadClaims(tx, person.companyId, person.userId, today);
  const events = rows.map((row) => headChangedEvent({ id: row.departmentId, siteId: row.department.siteId, key: row.department.key }, { previousUserId: person.userId, newUserId: null, effectiveOn: today }, now));
  return { rows, events };
}
