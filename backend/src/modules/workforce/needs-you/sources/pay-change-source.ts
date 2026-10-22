import { payChangeReads } from './pay-change-repository';
import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import type { NeedsYouRow, NeedsYouSource } from '../needs-you-types';

/**
 * Pay changes HR has sent and nobody has decided yet (the Director's "Pay changes" group). Only a person who holds
 * `payprofile.approve` sees them. The words name the person and the start date, never the amount.
 */
export const payChangeSource: NeedsYouSource = {
  id: 'pay-change',
  kinds: ['pay-change'],
  async list(subject: AccessSubject, ctx): Promise<NeedsYouRow[]> {
    if (scopeOf(subject, 'payprofile.approve') === null) return [];
    const pending = await payChangeReads.pending(ctx.companyId);
    return pending.map((p) => ({
      id: `pay-change:${p.id}`,
      kind: 'pay-change',
      text: `${p.employee.name} · new pay from ${p.effectiveFrom.toISOString().slice(0, 10)}`,
      opens: `/app/workforce/employees/${p.employeeId}`,
      badge: null,
      since: p.requestedAt.toISOString(),
      siteId: p.employee.siteId,
      siteName: p.employee.site.name,
      waitingOnRole: 'DIRECTOR',
      personUserId: p.employee.user?.id ?? null,
      canRemind: false,
    }));
  },
};
