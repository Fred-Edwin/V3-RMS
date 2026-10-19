import { ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import { rulesRepository } from './rules-repository';

/** Who is asking and which company and site they mean. Shared by every rules service. */

export const requireSite = async (siteId: string): Promise<{ id: string; companyId: string; name: string; type: 'BRANCH' | 'CENTRAL_STORE' }> => {
  const site = await rulesRepository.findSite(siteId);
  if (!site) throw new NotFoundError('Site not found');
  return site;
};

/** The actor's company: through their own site, or (a System Admin has none) the one active company. */
export const actorCompany = async (actor: AccessSubject): Promise<{ companyId: string; name: string }> => {
  const user = await rulesRepository.findUser(actor.id);
  const companyId = user?.site?.companyId ?? (await rulesRepository.findOnlyCompanyId());
  if (!companyId) throw new ForbiddenError('Your account is not linked to a company', 'RULE_COMPANY_UNKNOWN');
  return { companyId, name: user?.name ?? 'Unknown' };
};

/**
 * Reading a site's rules. A site of another company, or (for a holder limited to their own site) any other site, answers
 * 404 so its existence is not confirmed.
 */
export const assertCanReadSite = async (actor: AccessSubject, siteId: string, companyId: string): Promise<{ name: string; type: 'BRANCH' | 'CENTRAL_STORE' }> => {
  const site = await requireSite(siteId);
  if (site.companyId !== companyId) throw new NotFoundError('Site not found');
  if (scopeOf(actor, 'rules.read') === 'unit' && actor.siteId !== siteId) throw new NotFoundError('Site not found');
  return { name: site.name, type: site.type };
};
