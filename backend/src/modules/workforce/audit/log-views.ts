import { NotFoundError } from '../../../utils/errors';
import { runAudited } from '../_shared/audit/audit-writer';
import { workforceCan, type AccessSubject } from '../_shared/workforce-access';
import { resolveActor, type ActorCtx } from '../people/people-context';
import { auditReadRepository } from './audit-read-repository';

/** One `audit.log_viewed` per reader per 10 minutes (SD9): a click on every page would flood the log. */
export const LOG_VIEW_WINDOW_MS = 10 * 60 * 1000;
const VIEWERS_SHOWN = 10;
const VIEWERS_LOOKBACK_DAYS = 30;

export type LogView = 'list' | 'detail' | 'facets' | 'actors';

/**
 * Called by every read of the company log. The mark and the entry are one transaction, so a reader is either recorded as viewing
 * or not counted as having viewed. A failure to record fails the read: a log nobody can prove was read is not allowed.
 */
export async function noteLogViewed(ctx: ActorCtx, view: LogView, now: Date = new Date()): Promise<void> {
  await runAudited<void>(async (tx) => {
    const fresh = await auditReadRepository.claimViewMark(tx, ctx.subject.id, now, LOG_VIEW_WINDOW_MS);
    return {
      result: undefined,
      entries: fresh
        ? [{ companyId: ctx.companyId, siteId: ctx.subject.siteId ?? null, actor: ctx.auditActor, action: 'audit.log_viewed', category: 'LOG_ACCESS', subjectType: 'AuditLog', subjectId: ctx.companyId, after: { view } }]
        : [],
    };
  });
}

export interface Viewer {
  userId: string;
  name: string;
  role: string;
  lastAt: string;
}

/** "Who looked at this log" (A5): the Director only. Everyone else gets a 403 here and a 404 from the route. */
export async function logViewers(subject: AccessSubject, now: Date = new Date()): Promise<Viewer[]> {
  if (!workforceCan(subject, 'audit.read.log_access')) throw new NotFoundError('We could not find that page.', 'NOT_FOUND');
  const ctx = await resolveActor(subject);
  const since = new Date(now.getTime() - VIEWERS_LOOKBACK_DAYS * 86_400_000);
  const rows = await auditReadRepository.viewers(ctx.companyId, subject.id, since, VIEWERS_SHOWN);
  return rows.map((r) => ({ userId: r.actor_id, name: r.actor_name, role: r.actor_role, lastAt: r.last_at.toISOString() }));
}
