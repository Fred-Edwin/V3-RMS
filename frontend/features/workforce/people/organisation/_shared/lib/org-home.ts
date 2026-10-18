import type { OrgOverview } from '../types/org-types';

/**
 * The rows slice 1b adds to HR's "Needs your attention" on Home (Paper Chapter 1): one per department with no head and no acting head,
 * branches only (the Central Store never has heads). The title says which department; the line says where it is and who approves meanwhile.
 */
export interface GapRow {
  key: string;
  departmentId: string;
  title: string;
  detail: string;
  age: string;
  action: string;
}

export function gapRows(o: OrgOverview): GapRow[] {
  return o.organizations
    .filter((s) => s.headsAllowed)
    .flatMap((s) =>
      s.departments
        .filter((d) => d.isActive && d.hasGap)
        .map((d) => ({
          key: `no-head:${d.id}`,
          departmentId: d.id,
          title: `No head for ${d.name}`,
          detail: `${s.name} · approvals go to the Branch Manager for now`,
          age: 'NO HEAD',
          action: 'Assign head',
        }))
    );
}
