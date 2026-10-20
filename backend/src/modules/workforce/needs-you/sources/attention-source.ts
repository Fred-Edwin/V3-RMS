import { addDays, fromDateColumn, nairobiToday, toDateColumn } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { dayLabel } from '../../notifications';
import { reachesCompany } from '../needs-you-scope';
import type { NeedsYouContext, NeedsYouRow } from '../needs-you-types';
import { attentionReads } from './attention-repository';

const PROBATION_WARNING_DAYS = 14;

/**
 * "Needs your attention" (HR): housekeeping that is not a decision waiting on someone: finish hiring, probation ends soon, a
 * department with no head. A separate small list because the Home card `workforce.hr-attention` keeps these rows (6b N1).
 * Same row shape as the card; `kind` is `attention-*`, no badge. People data, so it does not depend on the attendance switch.
 */
export async function attentionRows(subject: AccessSubject, ctx: NeedsYouContext): Promise<NeedsYouRow[]> {
  if (!reachesCompany(subject, 'org.write_heads')) return [];
  const endsBy = toDateColumn(addDays(nairobiToday(ctx.now), PROBATION_WARNING_DAYS));
  const [onboarding, probation, headless] = await Promise.all([attentionReads.onboarding(ctx.companyId), attentionReads.probationEnding(ctx.companyId, endsBy), attentionReads.departmentsWithoutHead(ctx.companyId)]);
  const row = (id: string, kind: string, text: string, opens: string, since: Date, siteId: string, siteName: string): NeedsYouRow => ({ id, kind, text, opens, badge: null, since: since.toISOString(), siteId, siteName, waitingOnRole: 'HR_MANAGER', personUserId: null, canRemind: false });
  return [
    ...onboarding.map((e) => row(`attention-hiring:${e.id}`, 'attention-hiring', `Finish hiring ${e.name}`, `/app/workforce/employees/${e.id}`, e.createdAt, e.siteId, e.site.name)),
    ...probation.flatMap((e) => (e.probationEndsOn ? [row(`attention-probation:${e.id}`, 'attention-probation', `${e.name}'s probation ends ${dayLabel(fromDateColumn(e.probationEndsOn))}`, `/app/workforce/employees/${e.id}`, e.probationEndsOn, e.siteId, e.site.name)] : [])),
    ...headless.map((d) => row(`attention-no-head:${d.id}`, 'attention-no-head', `${d.name} at ${d.site.name} has no head`, '/app/workforce/organisation', d.createdAt, d.siteId, d.site.name)),
  ].sort((a, b) => a.since.localeCompare(b.since));
}
