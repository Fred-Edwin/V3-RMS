import { switchRepository } from '../../attendance/switch/switch-repository';
import type { AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import { waitingForMe } from './needs-you-source';

async function contextOf(subject: AccessSubject, now: Date) {
  const ctx = await resolveActor(subject);
  return { companyId: ctx.companyId, now, enabledSiteIds: await switchRepository.enabledSiteIds() };
}

/** N1 `GET /badge`: the number on the Leave menu link. Staff and anyone who decides nothing get 0. */
export async function leaveBadge(subject: AccessSubject, now: Date = new Date()): Promise<{ count: number }> {
  return { count: (await waitingForMe(subject, await contextOf(subject, now), false)).length };
}

/** N1 `GET /needs-you?limit`: the rows for Home, oldest first, with the full total. The card's only action is to open the Leave page. */
export async function leaveNeedsYou(subject: AccessSubject, limit: number, now: Date = new Date()) {
  const rows = await waitingForMe(subject, await contextOf(subject, now), true);
  return { rows: rows.slice(0, limit), total: rows.length };
}
