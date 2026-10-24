import { fromDateColumn } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { dayLabel, roleLabel } from '../../notifications';
import { needsYouQueries } from '../needs-you-repository';
import { OVERDUE_DAYS, DAY_MS, sitesFor } from '../needs-you-scope';
import type { NeedsYouContext, NeedsYouRow, NeedsYouSource } from '../needs-you-types';
import { timeReads } from './time-repository';

type Person = { name: string; user: { id: string; role: string } | null };
const who = (p: Person): string => `${p.name}, ${roleLabel(p.user?.role ?? null)}`;

const WHAT: Record<string, string> = {
  CLOCK_TIME_WRONG: 'a clock time is wrong',
  WORKED_NOT_RECORDED: 'worked a shift that is not recorded',
  ROTA_WRONG: 'the shifts are wrong',
  OVERTIME_MISSING: 'overtime is missing',
  PAY_OTHER: 'a question about pay',
  CLOCKED_OUT_BY_MISTAKE: 'clocked out by mistake',
};

/** The Branch and Store Manager's role as a request names the one it waits on. */
const waitingRolesOf = (subject: AccessSubject): string[] => {
  const roles: string[] = [subject.role === 'MANAGER' ? 'BRANCH_MANAGER' : subject.role];
  if (subject.isDepartmentHead === true || (subject.headOfDepartmentIds?.length ?? 0) > 0) roles.push('DEPARTMENT_HEAD');
  return roles;
};

const hours = (minutes: number): string => `${Math.floor(minutes / 60)} h ${minutes % 60} m`;

/** Rows for the sites given. Shared by the card (the viewer's sites) and by Overdue (every enabled site). */
export async function timeRows(siteIds: readonly string[], waitingOn: { roles: readonly string[]; userId: string } | null, includeOvertime: boolean, includeRequests: boolean, includeClosed: boolean): Promise<NeedsYouRow[]> {
  if (siteIds.length === 0) return [];
  const [overtime, requests, closed, names] = await Promise.all([
    includeOvertime ? timeReads.overtimeUndecided(siteIds) : Promise.resolve([]),
    includeRequests ? timeReads.timeRequestsWaiting(siteIds, waitingOn) : Promise.resolve([]),
    includeClosed ? timeReads.shiftsClosedBySystem(siteIds) : Promise.resolve([]),
    needsYouQueries.siteNames(siteIds),
  ]);
  const site = (id: string) => ({ siteId: id, siteName: names.get(id) ?? null });
  const rows: NeedsYouRow[] = [];
  for (const o of overtime) {
    const limits = (o.limits ?? {}) as { overCapMinutes?: number };
    const over = limits.overCapMinutes ?? 0;
    rows.push({ id: `overtime:${o.id}`, kind: 'overtime', text: `${who(o.employee)} · ${over > 0 ? `${hours(over)} over the week` : `${o.needsMinutes} min after a closed shift, ${dayLabel(fromDateColumn(o.shiftDate))}`}`, opens: '/app/workforce/timesheets?tab=overtime', badge: 'workforce-timesheets', since: o.createdAt.toISOString(), ...site(o.siteId), waitingOnRole: 'BRANCH_MANAGER', personUserId: o.employee.user?.id ?? null, canRemind: true });
  }
  for (const r of requests) {
    rows.push({ id: `clock-fix:${r.id}`, kind: 'clock-fix', text: `${who(r.employee)} · ${WHAT[r.kind] ?? 'a problem'}, ${dayLabel(fromDateColumn(r.shiftDate))}`, opens: '/app/workforce/requests', badge: 'workforce-timesheets', since: (r.escalatedAt ?? r.createdAt).toISOString(), ...site(r.siteId), waitingOnRole: r.waitingOnRole, personUserId: r.employee.user?.id ?? null, canRemind: true });
  }
  for (const d of closed) {
    rows.push({ id: `shift-closed:${d.id}`, kind: 'shift-closed', text: `${who(d.employee)} · shift on ${dayLabel(fromDateColumn(d.shiftDate))} was closed by the system, please check`, opens: '/app/workforce/today', badge: 'workforce-timesheets', since: d.updatedAt.toISOString(), ...site(d.siteId), waitingOnRole: 'BRANCH_MANAGER', personUserId: d.employee.user?.id ?? null, canRemind: true });
  }
  return rows;
}

export const timeSource: NeedsYouSource = {
  id: 'time',
  kinds: ['overtime', 'clock-fix', 'shift-closed'],
  async list(subject: AccessSubject, ctx: NeedsYouContext) {
    const overtimeSites = sitesFor(subject, 'overtime.approve', ctx);
    const requestSites = sitesFor(subject, 'time_request.answer', ctx);
    const parts = await Promise.all([
      overtimeSites ? timeRows(overtimeSites, null, true, false, false) : [],
      requestSites ? timeRows(requestSites, { roles: waitingRolesOf(subject), userId: subject.id }, false, true, false) : [],
      overtimeSites ? timeRows(overtimeSites, null, false, false, true) : [],
    ]);
    return parts.flat();
  },
  async overdue(ctx: NeedsYouContext) {
    const cutoff = ctx.now.getTime() - OVERDUE_DAYS * DAY_MS;
    return (await timeRows(ctx.enabledSiteIds, null, true, true, true)).filter((r) => new Date(r.since).getTime() <= cutoff);
  },
};
