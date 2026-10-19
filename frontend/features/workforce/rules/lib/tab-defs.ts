import type { RuleGroupCode } from '../types/rules-types';

/** The ten tabs, in Paper's order. The slug is what the address says (`?tab=lateness`). */
export interface TabDef {
  slug: string;
  group: RuleGroupCode;
  label: string;
  /** The page title is "Rules · <title>". */
  title: string;
}

export const TABS: readonly TabDef[] = [
  { slug: 'lateness', group: 'LATENESS', label: 'Lateness', title: 'Lateness' },
  { slug: 'overtime', group: 'OVERTIME', label: 'Overtime', title: 'Overtime' },
  { slug: 'attendance', group: 'ATTENDANCE', label: 'Attendance', title: 'Attendance' },
  { slug: 'leave', group: 'LEAVE', label: 'Leave', title: 'Leave' },
  { slug: 'probation', group: 'PROBATION', label: 'Probation', title: 'Probation' },
  { slug: 'casual', group: 'CASUAL_WORK', label: 'Casual work', title: 'Casual work' },
  { slug: 'conduct', group: 'CONDUCT', label: 'Conduct', title: 'Conduct' },
  { slug: 'statutory', group: 'STATUTORY', label: 'Statutory', title: 'Statutory' },
  { slug: 'holidays', group: 'HOLIDAYS', label: 'Holidays', title: 'Holidays and pay' },
  { slug: 'week', group: 'WEEK_AND_BREAKS', label: 'Week and breaks', title: 'Week and breaks' },
];

export const DEFAULT_TAB = TABS[0] as TabDef;

export const tabOfSlug = (slug: string | null | undefined): TabDef => TABS.find((t) => t.slug === slug) ?? DEFAULT_TAB;
export const tabOfGroup = (group: RuleGroupCode): TabDef => TABS.find((t) => t.group === group) ?? DEFAULT_TAB;

/** Only these three tabs let a site have an own rule (Lateness, Overtime, minimum cover on Leave). */
export const SITE_GROUPS: readonly RuleGroupCode[] = ['LATENESS', 'OVERTIME', 'LEAVE'];

export const rulesHref = (slug: string, organizationId?: string | null): string => `/app/workforce/rules?tab=${slug}${organizationId ? `&site=${organizationId}` : ''}`;
export const historyHref = (slug: string, organizationId?: string | null): string => `/app/workforce/rules/history?tab=${slug}${organizationId ? `&site=${organizationId}` : ''}`;
export const WHO_EDITS_HREF = '/app/workforce/rules/who-edits-what';
