import { allStatus, ALL_DEPARTMENTS, departmentStatus, listedDepartments } from '../../_shared/lib/week-view';
import type { WeekView } from '../../_shared/types/rota-types';
import type { SideItem } from '../components/rota-side-list';

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The department rows of the left list: "All departments", then each department with its people, head and status. */
export function departmentItems(week: WeekView): SideItem[] {
  const all = allStatus(week);
  return [
    { id: ALL_DEPARTMENTS, title: 'All departments', sub: `${plural(week.totals.people, 'person', 'people')} · ${plural(week.totals.shifts, 'shift', 'shifts')}`, status: all.text, statusTone: all.tone },
    ...listedDepartments(week).map((d) => {
      const status = departmentStatus(week, d);
      return { id: d.id ?? '', title: d.name, sub: `${plural(d.people, 'person', 'people')} · ${d.headName ? `Head ${d.headName}` : 'No head'}`, status: status.text, statusTone: status.tone };
    }),
  ];
}

/** The site rows for HR and the Director: people counted from the Organisation read, the chosen site's own status from its week. */
export function siteItems(
  sites: readonly { id: string; name: string; departments: readonly { people: number }[] }[],
  chosenId: string | undefined,
  week: WeekView | null
): SideItem[] {
  return sites.map((s) => {
    const people = s.departments.reduce((sum, d) => sum + d.people, 0);
    const status = s.id === chosenId && week ? allStatus(week) : null;
    return { id: s.id, title: s.name, sub: plural(people, 'person', 'people'), status: status?.text, statusTone: status?.tone };
  });
}
