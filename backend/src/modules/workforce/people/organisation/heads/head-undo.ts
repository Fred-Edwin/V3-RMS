import type { Prisma } from '@prisma/client';
import type { WorkforceEvent } from '../../../_shared/events';
import { toDateColumn, type NairobiDate } from '../../../_shared/time/nairobi-time';
import { headChangedEvent, syncHeadClaims } from './head-sync';
import { headsRepository } from './heads-repository';

export interface RestoredHeads {
  /** Departments whose head role could not come back because someone else holds it now. */
  notRestored: number;
  events: WorkforceEvent[];
}

/**
 * Undoing an exit puts back the head roles that finalising ended, but only where the department still has no
 * substantive head. Claims follow and `department.head_changed` is emitted for each restored role.
 */
export async function restoreHeadRows(
  tx: Prisma.TransactionClient,
  person: { id: string; userId: string | null; companyId: string },
  snapshotHeads: readonly { departmentId: string }[],
  today: NairobiDate,
  restoredById: string,
  now: Date,
): Promise<RestoredHeads> {
  const todayColumn = toDateColumn(today);
  const events: WorkforceEvent[] = [];
  let notRestored = 0;
  for (const head of snapshotHeads) {
    const rows = await headsRepository.activeRowsOfDepartment(head.departmentId, todayColumn, tx);
    if (rows.some((row) => !row.isActing)) {
      notRestored += 1;
      continue;
    }
    await headsRepository.createRow(tx, { departmentId: head.departmentId, employeeId: person.id, isActing: false, startsOn: todayColumn, endsOn: null, assignedById: restoredById });
    const department = await headsRepository.departmentOf(tx, person.companyId, head.departmentId);
    if (department) events.push(headChangedEvent(department, { previousUserId: null, newUserId: person.userId, effectiveOn: today }, now));
  }
  if (person.userId && snapshotHeads.length > notRestored) await syncHeadClaims(tx, person.companyId, person.userId, today);
  return { notRestored, events };
}
