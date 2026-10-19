import type { RuleGroup } from '@prisma/client';
import type { ZodType } from 'zod';
import { fromDateColumn, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { RULE_DEFAULTS } from '../rules-defaults';
import { RULE_SCHEMAS, type RuleGroupCode, type RuleValues } from '../rules-schemas';
import { asValues, fieldsOfScope, GROUPS, pick, requiredScopesOf, siteFieldsOf, withDerived, type Values } from '../rules-values';
import type { EffectiveRuleGroup, EffectiveRules, PayReadiness } from '../rules.types';
import { requireSite } from './rules-context';
import { rulesRepository, type RuleVersionRow } from './rules-repository';

const isConfirmed = (row: RuleVersionRow, scope: string): boolean => row.confirmations.some((c) => c.scope === scope);

/**
 * The company values in force. A pay field resolves to the newest version of it that is confirmed (D2): when the version
 * in force by date has a scope nobody has confirmed, the values of that scope come from the next older version whose
 * scope was confirmed, so an unchecked rate is never used while an old checked one exists.
 * If no version was ever confirmed the chosen values stay and `missing` says so; only payroll refuses on that.
 */
const companyValuesOf = (group: RuleGroupCode, chain: RuleVersionRow[]): { values: Values; required: string[]; pending: string[]; missing: string[] } => {
  const chosen = chain[0];
  if (!chosen) return { values: asValues(RULE_DEFAULTS[group]), required: [], pending: [], missing: [] };
  const values = { ...asValues(chosen.values) };
  const required = requiredScopesOf(group, values);
  const pending: string[] = [];
  const missing: string[] = [];
  for (const scope of required.filter((s) => !isConfirmed(chosen, s))) {
    const older = chain.slice(1).find((row) => isConfirmed(row, scope));
    if (!older) {
      missing.push(scope);
      continue;
    }
    pending.push(scope);
    Object.assign(values, pick(asValues(older.values), fieldsOfScope(group, scope)));
  }
  return { values, required, pending, missing };
};

/**
 * Resolution (the one rule): for a site and a date, per group, take the company version with the greatest
 * effectiveFrom not later than the date (ties: higher version, withdrawn ones skipped); if none, RULE_DEFAULTS. Then lay
 * over it the fields of the SITE's version chosen the same way, for the fields that group lets a site override. The merged
 * values are validated against the group's schema before they are returned.
 */
export async function resolveGroup<G extends RuleGroupCode>(companyId: string, siteId: string | null, date: NairobiDate, group: G): Promise<EffectiveRuleGroup<G>> {
  const day = toDateColumn(date);
  const chain = await rulesRepository.findChainUpTo(companyId, group as RuleGroup, day);
  const site = siteId ? await rulesRepository.findEffective(companyId, siteId, group as RuleGroup, day) : null;
  const company = companyValuesOf(group, chain);

  let merged: Values = company.values;
  if (site) merged = { ...merged, ...pick(asValues(site.values), siteFieldsOf(group)) };
  const values = (RULE_SCHEMAS[group] as unknown as ZodType<RuleValues[G]>).parse(withDerived(group, merged));

  const chosen = chain[0] ?? null;
  return {
    group,
    values,
    isDefault: chosen === null,
    companyVersion: chosen?.version ?? 0,
    siteVersion: site?.version ?? null,
    effectiveFrom: chosen ? fromDateColumn(chosen.effectiveFrom) : null,
    requiredConfirmations: company.required,
    missingConfirmations: company.missing,
    pendingConfirmations: company.pending,
  };
}

/** SYSTEM use only: no actor, nothing is hidden. HTTP callers go through the rules services, which hide what the caller may not read. */
export async function getEffectiveRules(siteId: string, date: NairobiDate): Promise<EffectiveRules> {
  const site = await requireSite(siteId);
  const groups = await Promise.all(GROUPS.map((group) => resolveGroup(site.companyId, siteId, date, group)));
  return Object.fromEntries(groups.map((group) => [group.group, group])) as unknown as EffectiveRules;
}

export async function getEffectiveRuleGroup<G extends RuleGroupCode>(siteId: string, date: NairobiDate, group: G): Promise<EffectiveRuleGroup<G>> {
  const site = await requireSite(siteId);
  return resolveGroup(site.companyId, siteId, date, group);
}

/** What payroll asks before using a pay field: no scope without any confirmed value AND, for STATUTORY, at least one table. */
export function isPayConfirmed(group: EffectiveRuleGroup): PayReadiness {
  const reasons: string[] = [];
  if (group.group === 'STATUTORY' && (group.values as RuleValues['STATUTORY']).tables.length === 0) reasons.push('Statutory tables are empty');
  for (const scope of group.missingConfirmations) reasons.push(`Waiting for confirmation: ${scope}`);
  return { ready: reasons.length === 0, reasons };
}
