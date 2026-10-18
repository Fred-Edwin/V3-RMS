import type { WorkforceKpiCell } from '../../../../_shared';
import { formatDayMonth } from '../../../_shared/lib/people-dates';
import type { DepartmentSummary, OrgOverview, SiteBlock } from '../types/org-types';

/** The words of the Organisation page (Paper Chapter 3 step 01). Pure, so the wording is tested. Copy never guesses a pronoun. */

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** The four numbers. "Heads on leave" arrives with Leave (slice 5), so it shows a dash and says so. */
export function overviewKpis(o: OrgOverview, casualPool: number | null, onGaps: () => void): WorkforceKpiCell[] {
  const { departments, gaps, organizations } = o.counts;
  return [
    { key: 'departments', label: 'DEPARTMENTS', value: String(departments), detail: `across ${plural(organizations, 'site')}` },
    { key: 'gaps', label: 'WITHOUT A HEAD', value: String(gaps), detail: 'approvals go to the Branch Manager', actionable: gaps > 0, onSelect: onGaps },
    { key: 'leave', label: 'HEADS ON LEAVE', value: '–', detail: 'arrives with Leave' },
    { key: 'casual', label: 'CASUAL POOLS', value: casualPool === null ? '–' : String(casualPool), detail: 'people, paid by the day, no login' },
  ];
}

export const siteSubline = (s: SiteBlock): string => `${plural(s.departments.length, 'department')} · ${plural(sitePeople(s), 'person', 'people')}`;
export const sitePeople = (s: SiteBlock): number => s.departments.reduce((sum, d) => sum + d.people, 0);

/** "1 gap" in amber, "Complete" in green. The Central Store never has heads, so it is never short of one. */
export function siteStatus(s: SiteBlock): { text: string; tone: 'warning' | 'success' } {
  return s.gaps > 0 ? { text: plural(s.gaps, 'gap'), tone: 'warning' } : { text: 'Complete', tone: 'success' };
}

export const siteHeading = (s: SiteBlock): string => `${plural(sitePeople(s), 'person', 'people')} · ${plural(s.departments.length, 'department')}`;

/** The site to open first: the first with a gap, else the first. */
export const firstSiteToShow = (o: OrgOverview, wanted: string | null): SiteBlock | undefined =>
  o.organizations.find((s) => s.id === wanted) ?? o.organizations.find((s) => s.gaps > 0) ?? o.organizations[0];

/** Who approves for a department today: the head, an acting head, or the Branch Manager for now. */
export function approvalsGoTo(d: DepartmentSummary, headsAllowed: boolean): { text: string; tone: 'default' | 'warning' } {
  if (!headsAllowed) return { text: 'The unit manager', tone: 'default' };
  if (d.actingHead) return { text: `${d.actingHead.name}, until ${d.actingHead.returnsOn ? formatDayMonth(d.actingHead.returnsOn) : 'the head is back'}`, tone: 'warning' };
  if (d.head) return { text: d.head.name, tone: 'default' };
  return { text: 'The Branch Manager, for now', tone: 'warning' };
}

/** The second line under a head's name, when someone covers. */
export function headNote(d: DepartmentSummary): string | null {
  if (!d.actingHead) return null;
  return d.head ? `${firstName(d.actingHead.name)} is acting` : null;
}

/** The department a KPI "Without a head" opens: the site that has the first gap. */
export const siteWithGap = (o: OrgOverview): SiteBlock | undefined => o.organizations.find((s) => s.gaps > 0);
