import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import { dayLabel } from '../../notifications';
import type { NeedsYouContext, NeedsYouRow, NeedsYouSource } from '../../needs-you';import { loadCover } from '../applications/cover-service';
import { anyTight } from '../engine/leave-cover';
import { applicationsRepository } from '../data/applications-repository';
import { peopleRepository } from '../data/people-repository';
import { nameAndRole } from '../leave-words';
import { routedToMe } from './read-scope';

const DAY_MS = 86_400_000;

/** Waiting requests the caller decides now, oldest first. Only switched-on sites make rows (SD1). */
export async function waitingForMe(subject: AccessSubject, ctx: NeedsYouContext, withCover: boolean): Promise<NeedsYouRow[]> {
  const scope = scopeOf(subject, 'leave.approve');
  if (scope === null) return [];
  const waiting = (await applicationsRepository.waiting({ companyId: ctx.companyId, ...(scope === 'all' ? {} : subject.siteId ? { siteId: subject.siteId } : {}) })).filter((a) => ctx.enabledSiteIds.includes(a.siteId));
  const people = new Map((await peopleRepository.byIds(ctx.companyId, waiting.map((a) => a.employeeId))).map((p) => [p.id, p] as const));
  const mine = waiting.filter((a) => routedToMe(a, people.get(a.employeeId)?.userId ?? null, subject, ctx.now));
  const sites = new Map((await peopleRepository.sitesOf(ctx.companyId)).map((s) => [s.id, s.name] as const));
  const rows: NeedsYouRow[] = [];
  for (const app of mine) {
    const person = people.get(app.employeeId);
    if (!person) continue;
    const tight = withCover ? anyTight((await loadCover(person, app.start, app.end, ctx.now)).days) : false;
    rows.push({
      id: `leave:${app.id}`,
      kind: 'leave',
      text: `${app.type.label} · ${nameAndRole(person.name, person.positionName, person.role)} · ${dayLabel(app.start)} to ${dayLabel(app.end)}, ${app.days} ${app.days === 1 ? 'day' : 'days'}${tight ? ' · below minimum cover' : ''}`,
      opens: `/app/workforce/leave?tab=requests&open=${app.id}`,
      badge: 'workforce-leave',
      since: app.askedAt.toISOString(),
      siteId: app.siteId,
      siteName: sites.get(app.siteId) ?? null,
      waitingOnRole: app.routedToRole,
      personUserId: person.userId,
      canRemind: true,
    });
  }
  return rows;
}

/** Registered once at start-up (`registerLeaveNeedsYou`). Rows and the badge come from the same list, so they cannot disagree. */
export const leaveNeedsYouSource: NeedsYouSource = {
  id: 'leave',
  kinds: ['leave'],
  list: (subject, ctx) => waitingForMe(subject, ctx, true),
  count: async (subject, ctx) => ({ 'workforce-leave': (await waitingForMe(subject, ctx, false)).length }),
  async overdue(ctx) {
    const cutoff = ctx.now.getTime() - 3 * DAY_MS;
    const waiting = (await applicationsRepository.waiting({ companyId: ctx.companyId })).filter((a) => ctx.enabledSiteIds.includes(a.siteId) && a.askedAt.getTime() <= cutoff);
    const people = new Map((await peopleRepository.byIds(ctx.companyId, waiting.map((a) => a.employeeId))).map((p) => [p.id, p] as const));
    return waiting.flatMap((app) => {
      const p = people.get(app.employeeId);
      return p ? [{ id: `leave:${app.id}`, kind: 'leave', text: `${app.type.label} · ${nameAndRole(p.name, p.positionName, p.role)} · ${app.days} ${app.days === 1 ? 'day' : 'days'}`, opens: `/app/workforce/leave?tab=requests&open=${app.id}`, badge: 'workforce-leave' as const, since: app.askedAt.toISOString(), siteId: app.siteId, siteName: p.siteName, waitingOnRole: app.routedToRole, personUserId: p.userId, canRemind: true }] : [];
    });
  },
};
