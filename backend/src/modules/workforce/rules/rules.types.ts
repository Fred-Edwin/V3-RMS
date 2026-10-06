import type { NairobiDate } from '../_shared/time/nairobi-time';
import type { RuleGroupCode, RuleValues } from './rules-schemas';

export interface EffectiveRuleGroup<G extends RuleGroupCode = RuleGroupCode> {
  group: G;
  values: RuleValues[G]; // company values with the site override's fields laid over them
  isDefault: boolean; // no version exists for the company: RULE_DEFAULTS, version 0
  companyVersion: number; // 0 for defaults
  siteVersion: number | null; // the override that supplied any fields
  effectiveFrom: NairobiDate | null; // of the company version; null for defaults
  requiredConfirmations: string[]; // scopes this version needs (e.g. 'overtime.multipliers')
  missingConfirmations: string[]; // the ones nobody has confirmed yet
}

export type EffectiveRules = { [G in RuleGroupCode]: EffectiveRuleGroup<G> };

/** Who is told about a new version (6.2). The service resolves audiences to people; delivery is a later slice. */
export interface RuleChangeNotice {
  recipients: { userId: string; audience: string }[];
}

/** What payroll asks before using a pay field: required confirmations all present AND, for STATUTORY, at least one table. */
export interface PayReadiness {
  ready: boolean;
  reasons: string[]; // plain words, e.g. 'Statutory tables are empty'
}

export interface LockedRuleGroup {
  group: RuleGroupCode;
  locked: true;
}
