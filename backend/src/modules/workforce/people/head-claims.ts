import type { DepartmentTag } from '@prisma/client';
import type { NairobiDate } from '../_shared/time/nairobi-time';

export interface HeadRow {
  startsOn: NairobiDate;
  endsOn: NairobiDate | null;
  isActing: boolean;
  departmentInventoryTag: DepartmentTag | null;
}
export interface HeadClaims {
  isDepartmentHead: boolean;
  departmentTag: DepartmentTag | null;
}

/** A row is active on `today` when it has started and has not ended (an end date is the last day, inclusive). */
export const isActiveOn = (row: Pick<HeadRow, 'startsOn' | 'endsOn'>, today: NairobiDate): boolean =>
  row.startsOn <= today && (row.endsOn === null || row.endsOn >= today);

/**
 * The two claims other modules read. True only for a head of a department that has an inventory tag, so Inventory never
 * meets a head with no tag. A substantive head and an acting head both count.
 * (Slice 1b writes them through the gateway; 1a only defines the rule.)
 */
export const claimsFromHeadRows = (rows: readonly HeadRow[], today: NairobiDate): HeadClaims => {
  const tagged = rows.find((row) => isActiveOn(row, today) && row.departmentInventoryTag !== null);
  return tagged ? { isDepartmentHead: true, departmentTag: tagged.departmentInventoryTag } : { isDepartmentHead: false, departmentTag: null };
};
