import { fromDateColumn, nairobiToday, toDateColumn } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { dayLabel, monthName, plural } from '../../notifications';
import { reachesCompany, DAY_MS, OVERDUE_DAYS, sitesFor } from '../needs-you-scope';
import type { NeedsYouContext, NeedsYouRow, NeedsYouSource } from '../needs-you-types';
import { timeReads } from './time-reads';

const monthKeyOf = (endDate: Date): string => fromDateColumn(endDate).slice(0, 7);

/** Months that ended and no one approved yet, for these sites. `forSite` names the site for a head-office reader. */
export async function monthRows(siteIds: readonly string[], ctx: NeedsYouContext, forSite: boolean): Promise<NeedsYouRow[]> {
  if (siteIds.length === 0) return [];
  const today = toDateColumn(nairobiToday(ctx.now));
  const periods = await timeReads.monthsToApprove(siteIds, today);
  const heads = await timeReads.headcountOf(periods.map((p) => p.id));
  return periods.map((p) => ({
    id: `month:${p.id}`,
    kind: 'month',
    text: `Approve ${monthName(monthKeyOf(p.endDate))}${forSite ? ` for ${p.site.name}` : ''} · ${plural(heads.get(p.id) ?? 0, 'person', 'people')}`,
    opens: '/app/workforce/timesheets',
    badge: 'workforce-timesheets' as const,
    since: new Date(fromDateColumn(p.endDate) + 'T21:00:00Z').toISOString(), // the month ended at midnight Nairobi on its last day
    siteId: p.siteId,
    siteName: p.site.name,
    waitingOnRole: 'BRANCH_MANAGER',
    personUserId: null,
    canRemind: true,
  }));
}

/** Casual pay sheets sent and waiting. A sheet a person recorded themselves is not theirs to approve (nobody approves their own). */
export async function casualRows(siteIds: readonly string[], viewerId: string | null): Promise<NeedsYouRow[]> {
  if (siteIds.length === 0) return [];
  const sheets = (await timeReads.casualSheetsSent(siteIds)).filter((s) => s.recordedById !== viewerId);
  const [departments, sites] = await Promise.all([timeReads.departmentNames(sheets.map((s) => s.departmentId)), timeReads.siteNamesOf(sheets.map((s) => s.siteId))]);
  return sheets.map((s) => ({
    id: `casual-pay:${s.id}`,
    kind: 'casual-pay',
    text: `${departments.get(s.departmentId) ?? 'Department'} casuals, ${dayLabel(fromDateColumn(s.workDate))} · ${plural(s._count.lines, 'worker', 'workers')}`,
    opens: `/app/workforce/casual?sheet=${s.id}`,
    badge: 'workforce-timesheets' as const,
    since: (s.sentAt ?? s.createdAt).toISOString(),
    siteId: s.siteId,
    siteName: sites.get(s.siteId) ?? null,
    waitingOnRole: 'BRANCH_MANAGER',
    personUserId: null,
    canRemind: true,
  }));
}

export const monthSource: NeedsYouSource = {
  id: 'month-and-casual',
  kinds: ['month', 'casual-pay'],
  async list(subject: AccessSubject, ctx: NeedsYouContext) {
    const monthSites = sitesFor(subject, 'timesheet.close', ctx);
    const casualSites = sitesFor(subject, 'casual.approve', ctx);
    const [months, casual] = await Promise.all([monthSites ? monthRows(monthSites, ctx, reachesCompany(subject, 'timesheet.close')) : [], casualSites ? casualRows(casualSites, subject.id) : []]);
    return [...months, ...casual];
  },
  async overdue(ctx: NeedsYouContext) {
    const cutoff = ctx.now.getTime() - OVERDUE_DAYS * DAY_MS;
    // A site that has not approved 3 days after its month ended (the 4th), SD37, and a casual sheet waiting 3 days.
    const [months, casual] = await Promise.all([monthRows(ctx.enabledSiteIds, ctx, true), casualRows(ctx.enabledSiteIds, null)]);
    return [...months, ...casual].filter((r) => new Date(r.since).getTime() <= cutoff);
  },
};
