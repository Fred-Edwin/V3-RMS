import { ForbiddenError } from '../../../../utils/errors';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import { workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { GROUPS } from '../rules-values';
import type { EffectiveRuleGroup, LockedRuleGroup } from '../rules.types';
import { actorCompany, assertCanReadSite } from './rules-context';
import { resolveGroup } from './rules-resolve';

/** Every group in force for a site on a date. Needs rules.read; STATUTORY comes back locked unless the caller holds payroll.read. */
export async function getEffective(actor: AccessSubject, siteId: string, date: NairobiDate): Promise<{ groups: (EffectiveRuleGroup | LockedRuleGroup)[] }> {
  if (!workforceCan(actor, 'rules.read')) throw new ForbiddenError('You do not have permission to perform this action');
  const { companyId } = await actorCompany(actor);
  await assertCanReadSite(actor, siteId, companyId);
  const canSeePay = workforceCan(actor, 'payroll.read');
  const groups = await Promise.all(
    GROUPS.map(async (group): Promise<EffectiveRuleGroup | LockedRuleGroup> => {
      if (group === 'STATUTORY' && !canSeePay) return { group, locked: true };
      return resolveGroup(companyId, siteId, date, group);
    }),
  );
  return { groups };
}
