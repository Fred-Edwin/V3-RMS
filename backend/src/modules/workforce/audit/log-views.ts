import { runAudited } from '../_shared/audit/audit-writer';
import type { ActorCtx } from '../people/people-context';
import { auditReadRepository } from './audit-read-repository';

/** One `audit.log_viewed` per reader per 10 minutes (SD9): a click on every page would flood the log. */
export const LOG_VIEW_WINDOW_MS = 10 * 60 * 1000;

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
