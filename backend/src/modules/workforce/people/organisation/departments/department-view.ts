import { addDays, fromDateColumn } from '../../../_shared/time/nairobi-time';
import type { HeadRowRecord } from '../heads/heads-repository';
import type { DepartmentSummary, HeadView } from '../org.types';
import type { DepartmentRecord } from './departments-repository';

/** Pure builders for what the Organisation screens show. No queries here. */
export const headViewOf = (row: HeadRowRecord): HeadView => ({
  employeeId: row.employee.id,
  userId: row.employee.userId,
  name: row.employee.name,
  isActing: row.isActing,
  since: fromDateColumn(row.startsOn),
  // The acting row ends the day before the head is back, so the return day is the day after its last day.
  returnsOn: row.isActing && row.endsOn ? addDays(fromDateColumn(row.endsOn), 1) : null,
});

export function summaryOf(dept: DepartmentRecord, people: number, rows: readonly HeadRowRecord[]): DepartmentSummary {
  const mine = rows.filter((row) => row.departmentId === dept.id);
  const head = mine.find((row) => !row.isActing);
  const acting = mine.find((row) => row.isActing);
  return {
    id: dept.id,
    siteId: dept.siteId,
    name: dept.name,
    inventoryTag: dept.key,
    description: dept.description,
    isActive: dept.status === 'ACTIVE',
    people,
    head: head ? headViewOf(head) : null,
    actingHead: acting ? headViewOf(acting) : null,
    // "No head", the same rule as Home (attention-repository): a branch department with people, covered by neither a head nor an acting head.
    hasGap: !dept.site.isHub && dept.status === 'ACTIVE' && people > 0 && !head && !acting,
  };
}
