import type { RuleGroup } from '@prisma/client';
import { ForbiddenError } from '../../../../utils/errors';
import { fromDateColumn, nairobiToday, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { scopeOf, workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { holdersOf } from '../access/access-who';
import { answerRows, type RowAnswer, type RowContext } from '../access/access-rows';
import { summariseChange } from '../history/history-summary';
import { actorCompany, assertCanReadSite } from '../resolve/rules-context';
import { rulesRepository, type RuleVersionRow } from '../resolve/rules-repository';
import { resolveGroup } from '../resolve/rules-resolve';
import { RULE_DEFAULTS } from '../rules-defaults';
import type { RuleGroupCode } from '../rules-schemas';
import { asValues, confirmCapabilityOf, isSiteGroup, pick, policyOf, requireGroup, requiredScopesOf, same, siteFieldsOf } from '../rules-values';
import type { EffectiveRuleGroup, LockedRuleGroup } from '../rules.types';

export interface PendingConfirmation {
  scope: string;
  versionId: string;
  version: number;
  effectiveFrom: NairobiDate;
  inForce: boolean; // false = the version is scheduled; the older confirmed value stays in use until the day
  whoCan: { role: string }[];
}

export interface RulesPage {
  group: RuleGroupCode;
  siteId: string | null; // the site being looked at; null = the company rule
  siteName: string | null;
  values: EffectiveRuleGroup['values'];
  companyValues: EffectiveRuleGroup['values'] | null; // only when looking at a site: what the company rule says
  version: number; // the company version in force (0 = the starting values)
  siteVersion: number | null;
  effectiveFrom: NairobiDate | null;
  isDefault: boolean;
  expectedVersion: number; // send with a save of the company rule (the newest number in that scope)
  expectedSiteVersion: number; // send with a save of this site's own rule
  scheduled: { id: string; version: number; effectiveFrom: NairobiDate; changedSummary: string } | null;
  pendingConfirmations: PendingConfirmation[];
  ownFields: string[]; // fields the viewed site has made its own
  rows: Record<string, RowAnswer>;
  sitesWithOwnRule: { siteId: string; siteName: string; summary: string }[];
  sites: { siteId: string; siteName: string }[]; // the sites this viewer may pick in "Applies to"
}

const confirmationInfo = (chain: RuleVersionRow[], group: RuleGroupCode, nameOf: (id: string) => string): RowContext['confirmed'] => {
  const known: RowContext['confirmed'] = new Map();
  for (const field of Object.values(policyOf(group))) {
    const scope = field.confirm?.scope;
    if (!scope || known.has(scope)) continue;
    for (const row of chain) {
      const found = row.confirmations.find((c) => c.scope === scope);
      if (found) {
        known.set(scope, { name: nameOf(found.confirmedById), role: found.confirmerRole, at: found.confirmedAt.toISOString() });
        break;
      }
    }
  }
  return known;
};

const pendingOf = (rows: (RuleVersionRow | null)[], group: RuleGroupCode, today: NairobiDate): PendingConfirmation[] => {
  const pending: PendingConfirmation[] = [];
  for (const row of rows) {
    if (!row || row.siteId !== null) continue;
    for (const scope of requiredScopesOf(group, asValues(row.values)).filter((s) => !row.confirmations.some((c) => c.scope === s))) {
      const capability = confirmCapabilityOf(group, scope);
      const from = fromDateColumn(row.effectiveFrom);
      pending.push({ scope, versionId: row.id, version: row.version, effectiveFrom: from, inForce: from <= today, whoCan: capability ? holdersOf(capability).map((h) => ({ role: h.role })) : [] });
    }
  }
  return pending;
};

/** One tab for one viewer: what is in force, what is coming, what waits for whom, and for every row whether Change is active, locked or Fixed. */
export async function getRulesPage(actor: AccessSubject, groupInput: string, requestedSiteId: string | null, now: Date = new Date()): Promise<RulesPage | LockedRuleGroup> {
  if (!workforceCan(actor, 'rules.read')) throw new ForbiddenError('You do not have permission to perform this action');
  const group = requireGroup(groupInput);
  if (group === 'STATUTORY' && !workforceCan(actor, 'payrun.read')) return { group, locked: true };
  const { companyId } = await actorCompany(actor);

  const unitOnly = scopeOf(actor, 'rules.read') === 'unit';
  const viewSiteId = requestedSiteId ?? (unitOnly ? actor.siteId : null);
  const site = viewSiteId ? await assertCanReadSite(actor, viewSiteId, companyId) : null;
  const siteScoped = isSiteGroup(group);
  const today = nairobiToday(now);
  const day = toDateColumn(today);
  const lookSiteId = siteScoped ? viewSiteId : null;

  const [resolved, companyResolved, chain, scopeLatest, siteLatest, scheduled, overrides, allSites] = await Promise.all([
    resolveGroup(companyId, viewSiteId, today, group),
    lookSiteId ? resolveGroup(companyId, null, today, group) : Promise.resolve(null),
    rulesRepository.findChainUpTo(companyId, group as RuleGroup, day),
    rulesRepository.latestOfScope(companyId, null, group as RuleGroup),
    lookSiteId ? rulesRepository.latestOfScope(companyId, lookSiteId, group as RuleGroup) : Promise.resolve(null),
    rulesRepository.findScheduled(companyId, lookSiteId, group as RuleGroup, day),
    siteScoped ? rulesRepository.findSiteOverrides(companyId, group as RuleGroup, day) : Promise.resolve([] as RuleVersionRow[]),
    rulesRepository.findSites(companyId),
  ]);
  const companyScheduled = lookSiteId ? await rulesRepository.findScheduled(companyId, null, group as RuleGroup, day) : scheduled;

  const siteOverride = lookSiteId ? (overrides.find((row) => row.siteId === lookSiteId) ?? null) : null;
  const ownFields = siteOverride ? Object.keys(asValues(siteOverride.values)).filter((key) => siteFieldsOf(group).includes(key)) : [];

  const ids = new Set<string>();
  for (const row of [...chain, ...overrides]) for (const c of row.confirmations) ids.add(c.confirmedById);
  const names = await rulesRepository.findUserNames(companyId, [...ids]);
  const nameOf = (id: string): string => names.get(id) ?? 'Unknown';

  const rows = answerRows(actor, group, {
    site: siteScoped && site && viewSiteId ? { id: viewSiteId, ...site } : null,
    ownFields: new Set(ownFields),
    confirmed: confirmationInfo(chain, group, nameOf),
    waiting: new Set([...resolved.pendingConfirmations, ...resolved.missingConfirmations]),
  });

  const visibleSites = allSites.filter((s) => !unitOnly || s.id === actor.siteId);
  // With no company version yet, the starting values are what is in force, so a scheduled change reads as a change against them.
  const inForceValues = lookSiteId ? asValues(siteOverride?.values) : asValues(chain[0]?.values ?? RULE_DEFAULTS[group]);
  const scheduledFields = scheduled ? Object.keys(asValues(scheduled.values)).filter((key) => !same(inForceValues[key], asValues(scheduled.values)[key])) : [];
  const sitesWithOwnRule = siteScoped
    ? overrides
        .filter((row, index, all) => row.siteId !== null && all.findIndex((other) => other.siteId === row.siteId) === index)
        .filter((row) => !unitOnly || row.siteId === actor.siteId)
        .flatMap((row) => {
          const name = allSites.find((s) => s.id === row.siteId)?.name;
          const keys = Object.keys(asValues(row.values));
          if (!name || !row.siteId || keys.length === 0) return [];
          const company = (companyResolved ?? resolved).values as unknown as Record<string, unknown>;
          return [{ siteId: row.siteId, siteName: name, summary: summariseChange(group, keys, company, pick(asValues(row.values), keys), workforceCan(actor, 'payrun.read')) }];
        })
    : [];

  return {
    group,
    siteId: viewSiteId,
    siteName: site?.name ?? null,
    values: resolved.values,
    companyValues: companyResolved?.values ?? null,
    version: resolved.companyVersion,
    siteVersion: resolved.siteVersion,
    effectiveFrom: resolved.effectiveFrom,
    isDefault: resolved.isDefault,
    expectedVersion: scopeLatest?.number ?? 0,
    expectedSiteVersion: siteLatest?.number ?? 0,
    scheduled: scheduled
      ? {
          id: scheduled.id,
          version: scheduled.version,
          effectiveFrom: fromDateColumn(scheduled.effectiveFrom),
          changedSummary: summariseChange(group, scheduledFields, inForceValues, asValues(scheduled.values), workforceCan(actor, 'payrun.read')),
        }
      : null,
    pendingConfirmations: pendingOf([chain[0] ?? null, companyScheduled], group, today),
    ownFields,
    rows,
    sitesWithOwnRule,
    sites: visibleSites.map((s) => ({ siteId: s.id, siteName: s.name })),
  };
}
