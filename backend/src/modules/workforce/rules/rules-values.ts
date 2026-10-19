import { NotFoundError } from '../../../utils/errors';
import type { Capability } from '../_shared/workforce-access';
import { RULE_DEFAULTS } from './rules-defaults';
import { RULE_FIELD_POLICY, type FieldPolicy } from './rules-field-policy';
import { RULE_SCHEMAS, type RuleGroupCode } from './rules-schemas';

/** Small pure helpers over a group's stored values and its field policy. No database, no actor. */
export type Values = Record<string, unknown>;

export const GROUPS = Object.keys(RULE_SCHEMAS) as RuleGroupCode[];

const sortDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortDeep((value as Values)[key])]),
    );
  }
  return value;
};

/** Equal as data, whatever the key order. */
export const same = (a: unknown, b: unknown): boolean => JSON.stringify(sortDeep(a)) === JSON.stringify(sortDeep(b));
export const asValues = (value: unknown): Values => (value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Values) : {});
export const pick = (values: Values, keys: string[]): Values => Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]]));

export const policyOf = (group: RuleGroupCode): Record<string, FieldPolicy> => RULE_FIELD_POLICY[group];
export const fieldsOf = (group: RuleGroupCode): string[] => Object.keys(policyOf(group));
export const siteFieldsOf = (group: RuleGroupCode): string[] => fieldsOf(group).filter((field) => policyOf(group)[field]?.site === true);
export const isSiteGroup = (group: RuleGroupCode): boolean => siteFieldsOf(group).length > 0;

/** Fields the server computes on every write (D14: holidays are on when a pay rate is set). */
export const withDerived = (group: RuleGroupCode, values: Values): Values => (group === 'HOLIDAYS' ? { ...values, enabled: values.payMultiplier !== null && values.payMultiplier !== undefined } : values);

/** The scopes (e.g. 'overtime.multipliers') that need someone's confirmation: confirm-fields that differ from the code default. */
export const requiredScopesOf = (group: RuleGroupCode, values: Values): string[] => {
  const defaults = asValues(RULE_DEFAULTS[group]);
  const scopes = new Set<string>();
  for (const [field, policy] of Object.entries(policyOf(group))) {
    if (policy.confirm && !same(values[field], defaults[field])) scopes.add(policy.confirm.scope);
  }
  return [...scopes];
};

export const fieldsOfScope = (group: RuleGroupCode, scope: string): string[] =>
  Object.entries(policyOf(group))
    .filter(([, policy]) => policy.confirm?.scope === scope)
    .map(([field]) => field);

export const confirmCapabilityOf = (group: RuleGroupCode, scope: string): Capability | null => {
  for (const policy of Object.values(policyOf(group))) if (policy.confirm?.scope === scope) return policy.confirm.capability;
  return null;
};

export const requireGroup = (group: string): RuleGroupCode => {
  if (!(group in RULE_SCHEMAS)) throw new NotFoundError('Unknown rule group');
  return group as RuleGroupCode;
};
