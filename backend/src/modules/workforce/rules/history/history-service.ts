import type { RuleGroup } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { fromDateColumn, nairobiToday, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { scopeOf, workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { mayEditTab } from '../access/access-who';
import { AUDIENCE_ROLE, toldAudiencesOf } from '../plan/plan-notice';
import { actorCompany, assertCanReadSite } from '../resolve/rules-context';
import { rulesRepository } from '../resolve/rules-repository';
import { RULE_DEFAULTS } from '../rules-defaults';
import type { RuleGroupCode } from '../rules-schemas';
import { asValues, isSiteGroup, requireGroup } from '../rules-values';
import type { LockedRuleGroup } from '../rules.types';
import { toViews, type RuleVersionView } from '../versions/versions-view';
import { summariseChange } from './history-summary';

export interface HistoryItem extends RuleVersionView {
  changedSummary: string; // plain words; figures of pay fields only for roles that read pay (D1)
  told: { role: string }[]; // who is told when this tab changes (the tab's table in the access table)
}

export interface HistoryPage {
  group: RuleGroupCode;
  siteId: string | null;
  siteName: string | null;
  items: HistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  sites: { siteId: string | null; siteName: string }[]; // the Site select: the company rule, then each site with an own rule (a Branch Manager: their own site)
  canWithdraw: { versionId: string; version: number } | null; // the scheduled version this viewer may withdraw (the newest one, only before its day)
}

export interface HistoryQuery {
  siteId: string | null;
  page: number;
  pageSize: number;
}

const toldRoles = (group: RuleGroupCode): { role: string }[] => [...new Set(toldAudiencesOf(group).map((audience) => AUDIENCE_ROLE[audience]))].map((role) => ({ role }));

/**
 * Every change to a tab, newest first, one page at a time. Needs rules.read; STATUTORY comes back locked without payrun.read.
 * A holder limited to one site reads the company rule and their own site, and nothing else (another site is a 404).
 */
export async function listHistory(actor: AccessSubject, groupInput: string, query: HistoryQuery, now: Date = new Date()): Promise<HistoryPage | LockedRuleGroup> {
  if (!workforceCan(actor, 'rules.read')) throw new ForbiddenError('You do not have permission to perform this action');
  const group = requireGroup(groupInput);
  if (group === 'STATUTORY' && !workforceCan(actor, 'payrun.read')) return { group, locked: true };
  const { companyId } = await actorCompany(actor);
  const site = query.siteId ? await assertCanReadSite(actor, query.siteId, companyId) : null;
  if (query.siteId && !isSiteGroup(group)) throw new NotFoundError('This tab has no site rules');

  const { rows, total } = await rulesRepository.listVersionsPage(companyId, group as RuleGroup, query.siteId, (query.page - 1) * query.pageSize, query.pageSize);
  const pageRows = rows.slice(0, query.pageSize);
  const previousOf = (row: (typeof rows)[number]) => rows.find((candidate) => candidate.version === row.version - 1) ?? null;
  const views = await toViews(companyId, group, query.siteId, pageRows, previousOf, now);
  const mayReadPay = workforceCan(actor, 'payrun.read');
  const told = toldRoles(group);

  const items = views.map((view, index): HistoryItem => {
    const row = pageRows[index];
    const previous = row ? previousOf(row) : null;
    const before = previous ? asValues(previous.values) : query.siteId ? {} : asValues(RULE_DEFAULTS[group]);
    return { ...view, changedSummary: summariseChange(group, view.changedFields, before, asValues(view.values), mayReadPay), told };
  });

  // Only the newest live version of a scope can be withdrawn (a later one holds a full copy of it), and only before its day.
  const today = nairobiToday(now);
  const latest = await rulesRepository.latestOfScope(companyId, query.siteId, group as RuleGroup);
  const newest = latest?.live && fromDateColumn(latest.live.effectiveFrom) > today ? await rulesRepository.findByNumber(companyId, query.siteId, group as RuleGroup, latest.live.version) : null;
  const withdrawable = newest && mayEditTab(actor, group, query.siteId) ? newest : null;

  return {
    group,
    siteId: query.siteId,
    siteName: site?.name ?? null,
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    sites: await sitesWithOwnRule(actor, companyId, group, query.siteId, now),
    canWithdraw: withdrawable ? { versionId: withdrawable.id, version: withdrawable.version } : null,
  };
}

const sitesWithOwnRule = async (actor: AccessSubject, companyId: string, group: RuleGroupCode, current: string | null, now: Date): Promise<HistoryPage['sites']> => {
  const company = { siteId: null, siteName: 'Company rule' };
  if (!isSiteGroup(group)) return [company];
  const today: NairobiDate = nairobiToday(now);
  const sites = new Map((await rulesRepository.findSites(companyId)).map((s) => [s.id, s.name]));
  const owned = new Set<string>(current ? [current] : []);
  if (scopeOf(actor, 'rules.read') === 'unit') {
    if (actor.siteId) owned.add(actor.siteId); // a holder limited to one site sees their own site, never the others
  } else {
    for (const row of await rulesRepository.findSiteOverrides(companyId, group as RuleGroup, toDateColumn(today))) if (row.siteId) owned.add(row.siteId);
  }
  return [company, ...[...owned].filter((id) => sites.has(id)).map((id) => ({ siteId: id, siteName: sites.get(id) ?? '' }))];
};
