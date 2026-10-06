import type { Prisma, RuleGroup, UserRole } from '@prisma/client';
import type { ZodType } from 'zod';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../utils/errors';
import { runAudited } from '../_shared/audit/audit-writer';
import type { AuditCategoryCode, JsonValue } from '../_shared/audit/audit.types';
import type { WorkforceEvent } from '../_shared/events';
import { fromDateColumn, nairobiToday, parseNairobiDate, toDateColumn, type NairobiDate } from '../_shared/time/nairobi-time';
import { scopeOf, workforceCan, type AccessSubject, type Capability } from '../_shared/workforce-access';
import { RULE_DEFAULTS } from './rules-defaults';
import { RULE_FIELD_POLICY, type RuleNoticeAudience } from './rules-field-policy';
import { rulesRepository, type RuleVersionRow } from './rules-repository';
import { RULE_SCHEMAS, RULE_SITE_SCHEMAS, type RuleGroupCode, type RuleValues } from './rules-schemas';
import type { EffectiveRuleGroup, EffectiveRules, LockedRuleGroup, PayReadiness, RuleChangeNotice } from './rules.types';

type Values = Record<string, unknown>;

export interface CreateRuleVersionInput {
  group: RuleGroupCode;
  siteId: string | null; // null = company default
  effectiveFrom: NairobiDate;
  values: unknown; // full group for a company default; the overridable fields for a site
  reason: string; // required, 1 to 500 characters
  signature?: { method: 'PIN'; signedAt: Date }; // verified by the (slice 4) endpoint, recorded in the audit entry
}

export interface RuleVersionView {
  id: string;
  group: RuleGroupCode;
  siteId: string | null;
  version: number;
  effectiveFrom: NairobiDate;
  createdAt: string;
  createdBy: { id: string; name: string; role: string };
  reason: string;
  values: unknown;
  changedFields: string[]; // against the previous version of the same scope
  requiredConfirmations: string[];
  confirmations: { scope: string; by: { id: string; name: string }; at: string; note: string | null }[];
}

export interface RulesService {
  /** Read: needs rules.read. Unit holders read their own site only. STATUTORY comes back locked unless the caller holds payrun.read. */
  getEffective(actor: AccessSubject, siteId: string, date: NairobiDate): Promise<{ groups: (EffectiveRuleGroup | LockedRuleGroup)[] }>;
  listVersions(actor: AccessSubject, group: RuleGroupCode, siteId: string | null): Promise<RuleVersionView[] | LockedRuleGroup>;
  /** Write: per-field capabilities, scope, effective-date rules and audit as in contract 6.2 and 6.3. Runs through runAudited. */
  createVersion(actor: AccessSubject, input: CreateRuleVersionInput): Promise<{ version: RuleVersionView; notice: RuleChangeNotice }>;
  /** Needs the capability the scope names (6.2). Idempotent per (version, scope). Writes rules.version_confirmed. */
  confirmVersion(actor: AccessSubject, versionId: string, scope: string, note?: string): Promise<RuleVersionView>;
}

const GROUPS = Object.keys(RULE_SCHEMAS) as RuleGroupCode[];
const PAY_CONFIRM_CAPABILITIES: Capability[] = ['rules.confirm.pay_rates', 'rules.confirm.statutory'];

// ---------------------------------------------------------------------------------------------- small helpers

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
const same = (a: unknown, b: unknown): boolean => JSON.stringify(sortDeep(a)) === JSON.stringify(sortDeep(b));
const asValues = (value: unknown): Values => (value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Values) : {});

const policyOf = (group: RuleGroupCode): Record<string, { edit: Capability; site: boolean; confirm?: { scope: string; capability: Capability } }> => RULE_FIELD_POLICY[group];
const fieldsOf = (group: RuleGroupCode): string[] => Object.keys(policyOf(group));
const siteFieldsOf = (group: RuleGroupCode): string[] => fieldsOf(group).filter((field) => policyOf(group)[field]?.site === true);
const pick = (values: Values, keys: string[]): Values => Object.fromEntries(keys.filter((key) => key in values).map((key) => [key, values[key]]));

/** The scopes (e.g. 'overtime.multipliers') that need someone's confirmation: confirm-fields that differ from the code default. */
const requiredScopesOf = (group: RuleGroupCode, values: Values): string[] => {
  const defaults = asValues(RULE_DEFAULTS[group]);
  const scopes = new Set<string>();
  for (const [field, policy] of Object.entries(policyOf(group))) {
    if (policy.confirm && !same(values[field], defaults[field])) scopes.add(policy.confirm.scope);
  }
  return [...scopes];
};

const fieldsOfScope = (group: RuleGroupCode, scope: string): string[] =>
  Object.entries(policyOf(group))
    .filter(([, policy]) => policy.confirm?.scope === scope)
    .map(([field]) => field);

const confirmCapabilityOf = (group: RuleGroupCode, scope: string): Capability | null => {
  for (const policy of Object.values(policyOf(group))) if (policy.confirm?.scope === scope) return policy.confirm.capability;
  return null;
};

const requireGroup = (group: string): RuleGroupCode => {
  if (!(group in RULE_SCHEMAS)) throw new NotFoundError('Unknown rule group');
  return group as RuleGroupCode;
};

const requireSite = async (siteId: string): Promise<{ id: string; companyId: string }> => {
  const site = await rulesRepository.findSite(siteId);
  if (!site) throw new NotFoundError('Site not found');
  return site;
};

/** The actor's company: through their own site, or (a System Admin has none) the one active company. */
const actorCompany = async (actor: AccessSubject): Promise<{ companyId: string; name: string }> => {
  const user = await rulesRepository.findUser(actor.id);
  const companyId = user?.site?.companyId ?? (await rulesRepository.findOnlyCompanyId());
  if (!companyId) throw new ForbiddenError('Your account is not linked to a company', 'RULE_COMPANY_UNKNOWN');
  return { companyId, name: user?.name ?? 'Unknown' };
};

// ---------------------------------------------------------------------------------------------- resolution

/**
 * Resolution (the one rule): for a site and a date, per group, take the company version with the greatest
 * effectiveFrom not later than the date (ties: higher version); if none, RULE_DEFAULTS. Then lay over it the fields of
 * the SITE's version chosen the same way, for the fields that group lets a site override. The merged values are
 * validated against the group's schema before they are returned.
 */
async function resolveGroup<G extends RuleGroupCode>(companyId: string, siteId: string | null, date: NairobiDate, group: G): Promise<EffectiveRuleGroup<G>> {
  const day = toDateColumn(date);
  const company = await rulesRepository.findEffective(companyId, null, group as RuleGroup, day);
  const site = siteId ? await rulesRepository.findEffective(companyId, siteId, group as RuleGroup, day) : null;

  let merged: Values = company ? asValues(company.values) : asValues(RULE_DEFAULTS[group]);
  if (site) merged = { ...merged, ...pick(asValues(site.values), siteFieldsOf(group)) };
  const values = (RULE_SCHEMAS[group] as unknown as ZodType<RuleValues[G]>).parse(merged);

  const required = company ? requiredScopesOf(group, merged) : [];
  const confirmed = new Set((company?.confirmations ?? []).map((c) => c.scope));
  return {
    group,
    values,
    isDefault: company === null,
    companyVersion: company?.version ?? 0,
    siteVersion: site?.version ?? null,
    effectiveFrom: company ? fromDateColumn(company.effectiveFrom) : null,
    requiredConfirmations: required,
    missingConfirmations: required.filter((scope) => !confirmed.has(scope)),
  };
}

/** SYSTEM use only: no actor, nothing is hidden. HTTP callers go through rulesService, which hides what the caller may not read. */
export async function getEffectiveRules(siteId: string, date: NairobiDate): Promise<EffectiveRules> {
  const site = await requireSite(siteId);
  const groups = await Promise.all(GROUPS.map((group) => resolveGroup(site.companyId, siteId, date, group)));
  return Object.fromEntries(groups.map((group) => [group.group, group])) as unknown as EffectiveRules;
}

export async function getEffectiveRuleGroup<G extends RuleGroupCode>(siteId: string, date: NairobiDate, group: G): Promise<EffectiveRuleGroup<G>> {
  const site = await requireSite(siteId);
  return resolveGroup(site.companyId, siteId, date, group);
}

/** What payroll asks before using a pay field: required confirmations all present AND, for STATUTORY, at least one table. */
export function isPayConfirmed(group: EffectiveRuleGroup): PayReadiness {
  const reasons: string[] = [];
  if (group.group === 'STATUTORY' && (group.values as RuleValues['STATUTORY']).tables.length === 0) reasons.push('Statutory tables are empty');
  for (const scope of group.missingConfirmations) reasons.push(`Waiting for confirmation: ${scope}`);
  return { ready: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------------------------- views

const buildViews = async (companyId: string, rows: RuleVersionRow[], group: RuleGroupCode, siteId: string | null): Promise<RuleVersionView[]> => {
  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.createdById);
    for (const confirmation of row.confirmations) ids.add(confirmation.confirmedById);
  }
  const names = await rulesRepository.findUserNames(companyId, [...ids]);
  const nameOf = (id: string): string => names.get(id) ?? 'Unknown';
  const keys = siteId ? siteFieldsOf(group) : fieldsOf(group);
  const defaults = asValues(RULE_DEFAULTS[group]);

  return rows.map((row, index) => {
    const values = asValues(row.values);
    const previous = rows[index + 1];
    const before = previous ? asValues(previous.values) : defaults;
    return {
      id: row.id,
      group,
      siteId: row.siteId,
      version: row.version,
      effectiveFrom: fromDateColumn(row.effectiveFrom),
      createdAt: row.createdAt.toISOString(),
      createdBy: { id: row.createdById, name: nameOf(row.createdById), role: row.createdByRole },
      reason: row.reason,
      values: row.values,
      changedFields: keys.filter((key) => !same(before[key], values[key])),
      requiredConfirmations: siteId ? [] : requiredScopesOf(group, values),
      confirmations: row.confirmations.map((c) => ({ scope: c.scope, by: { id: c.confirmedById, name: nameOf(c.confirmedById) }, at: c.confirmedAt.toISOString(), note: c.note })),
    };
  });
};

// ---------------------------------------------------------------------------------------------- reads

const assertCanReadSite = async (actor: AccessSubject, siteId: string, companyId: string): Promise<void> => {
  const site = await requireSite(siteId);
  if (site.companyId !== companyId) throw new NotFoundError('Site not found');
  if (scopeOf(actor, 'rules.read') === 'unit' && actor.siteId !== siteId) throw new ForbiddenError('You can read the rules of your own branch only');
};

async function getEffective(actor: AccessSubject, siteId: string, date: NairobiDate): Promise<{ groups: (EffectiveRuleGroup | LockedRuleGroup)[] }> {
  if (!workforceCan(actor, 'rules.read')) throw new ForbiddenError('You do not have permission to perform this action');
  const { companyId } = await actorCompany(actor);
  await assertCanReadSite(actor, siteId, companyId);
  const canSeePay = workforceCan(actor, 'payrun.read');
  const groups = await Promise.all(
    GROUPS.map(async (group): Promise<EffectiveRuleGroup | LockedRuleGroup> => {
      if (group === 'STATUTORY' && !canSeePay) return { group, locked: true };
      return resolveGroup(companyId, siteId, date, group);
    }),
  );
  return { groups };
}

async function listVersions(actor: AccessSubject, group: RuleGroupCode, siteId: string | null): Promise<RuleVersionView[] | LockedRuleGroup> {
  if (!workforceCan(actor, 'rules.read')) throw new ForbiddenError('You do not have permission to perform this action');
  requireGroup(group);
  if (group === 'STATUTORY' && !workforceCan(actor, 'payrun.read')) return { group, locked: true };
  const { companyId } = await actorCompany(actor);
  if (siteId) await assertCanReadSite(actor, siteId, companyId);
  const rows = await rulesRepository.listVersions(companyId, group as RuleGroup, siteId);
  return buildViews(companyId, rows, group, siteId);
}

// ---------------------------------------------------------------------------------------------- writes

const AUDIENCE_ROLES: Record<RuleNoticeAudience, UserRole[]> = {
  DIRECTOR: ['DIRECTOR'],
  DIRECTOR_TO_CONFIRM: ['DIRECTOR'],
  ALL_BRANCH_MANAGERS: ['MANAGER'],
  BRANCH_MANAGER_OF_SITE: ['MANAGER'],
  ACCOUNTANT_TO_CONFIRM: ['ACCOUNTANT'],
};

const resolveNotice = async (companyId: string, siteId: string | null, actor: AccessSubject, audiences: Set<RuleNoticeAudience>): Promise<RuleChangeNotice> => {
  const recipients: { userId: string; audience: string }[] = [];
  const seen = new Set<string>();
  for (const audience of audiences) {
    const users = await rulesRepository.findActiveUsers(companyId, AUDIENCE_ROLES[audience], audience === 'BRANCH_MANAGER_OF_SITE' ? siteId : null);
    for (const user of users) {
      const key = `${user.id}:${audience}`;
      if (user.id === actor.id || seen.has(key)) continue;
      seen.add(key);
      recipients.push({ userId: user.id, audience });
    }
  }
  return { recipients };
};

async function createVersion(actor: AccessSubject, input: CreateRuleVersionInput): Promise<{ version: RuleVersionView; notice: RuleChangeNotice }> {
  const group = requireGroup(input.group);
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < 1 || reason.length > 500) throw new ValidationError('Say why, in 1 to 500 characters', 'RULE_REASON_REQUIRED');
  const effectiveFrom = parseNairobiDate(input.effectiveFrom);
  const siteId = input.siteId;
  const policy = policyOf(group);

  const { companyId, name: actorName } = await actorCompany(actor);
  if (siteId) {
    const site = await requireSite(siteId);
    if (site.companyId !== companyId) throw new NotFoundError('Site not found');
  }

  // 1. Validate the values for this scope.
  let newValues: Values;
  if (siteId) {
    const siteSchema = (RULE_SITE_SCHEMAS as Partial<Record<RuleGroupCode, ZodType<unknown>>>)[group];
    if (!siteSchema) throw new ValidationError('This group is company-wide: a branch cannot override it', 'RULE_SITE_FIELD_NOT_OVERRIDABLE');
    const allowed = siteFieldsOf(group);
    const extra = Object.keys(asValues(input.values)).filter((key) => !allowed.includes(key));
    if (extra.length > 0) throw new ValidationError(`A branch cannot override: ${extra.join(', ')}`, 'RULE_SITE_FIELD_NOT_OVERRIDABLE');
    newValues = asValues(siteSchema.parse(input.values));
  } else {
    newValues = asValues(RULE_SCHEMAS[group].parse(input.values));
  }

  // 2. Dates: not in the past, and not before a version that is already stored.
  if (effectiveFrom < nairobiToday(new Date())) throw new ValidationError('A rule cannot start in the past', 'RULE_BACKDATED');
  const latest = await rulesRepository.latestOfScope(companyId, siteId, group as RuleGroup);
  if (latest && effectiveFrom < fromDateColumn(latest.effectiveFrom)) {
    throw new ConflictError(`A version already starts on ${fromDateColumn(latest.effectiveFrom)}; choose that date or later`, 'RULE_FUTURE_VERSION_EXISTS', {
      latestEffectiveFrom: fromDateColumn(latest.effectiveFrom),
    });
  }

  // 3. What actually changes against what is in force on that date.
  const current = await resolveGroup(companyId, siteId, effectiveFrom, group);
  const currentValues = current.values as unknown as Values;
  const keys = siteId ? siteFieldsOf(group) : fieldsOf(group);
  const changed = keys.filter((key) => !same(currentValues[key], newValues[key]));
  if (changed.length === 0) throw new ConflictError('Nothing differs from the rule already in force', 'RULE_NO_CHANGE');

  // 4. Authority: every changed field needs its edit capability, and a branch-scope holder only their own branch's override.
  for (const field of changed) {
    const capability = policy[field]?.edit;
    const scope = capability ? scopeOf(actor, capability) : null;
    if (!capability || scope === null) throw new ForbiddenError(`You cannot change ${field}`, 'RULE_FIELD_NOT_EDITABLE');
    if (scope !== 'all' && !(siteId !== null && siteId === actor.siteId)) {
      throw new ForbiddenError('You can change your own branch’s override only', 'RULE_FIELD_NOT_EDITABLE');
    }
  }

  // 5. Confirmations: carried forward when the scope is untouched, given by the editor when they hold the right.
  const required = siteId ? [] : requiredScopesOf(group, newValues);
  const previous = siteId ? null : await rulesRepository.findEffective(companyId, null, group as RuleGroup, toDateColumn(effectiveFrom));
  const previousValues = previous ? asValues(previous.values) : null;
  const toCreate: { scope: string; confirmedById: string; confirmerRole: string; note: string | null }[] = [];
  for (const scope of required) {
    const fields = fieldsOfScope(group, scope);
    const untouched = fields.every((field) => !changed.includes(field));
    const earlier = previous?.confirmations.find((c) => c.scope === scope);
    if (untouched && previousValues && earlier) {
      toCreate.push({ scope, confirmedById: earlier.confirmedById, confirmerRole: earlier.confirmerRole, note: `Carried forward from version ${previous?.version}` });
      continue;
    }
    const capability = confirmCapabilityOf(group, scope);
    if (!untouched && capability && workforceCan(actor, capability)) toCreate.push({ scope, confirmedById: actor.id, confirmerRole: actor.role, note: null });
  }
  const confirmedScopes = new Set(toCreate.map((c) => c.scope));
  const missing = required.filter((scope) => !confirmedScopes.has(scope));

  // 6. Who is told (contract 6.2).
  const audiences = new Set<RuleNoticeAudience>();
  const actorUnitOnly = changed.every((field) => scopeOf(actor, policy[field]?.edit as Capability) === 'unit');
  if (actorUnitOnly) {
    audiences.add('DIRECTOR');
  } else if (group === 'STATUTORY') {
    audiences.add('DIRECTOR');
  } else {
    audiences.add(siteId ? 'BRANCH_MANAGER_OF_SITE' : 'ALL_BRANCH_MANAGERS');
    if (actor.role !== 'DIRECTOR') audiences.add('DIRECTOR');
  }
  for (const scope of missing) {
    const capability = confirmCapabilityOf(group, scope);
    audiences.add(capability && PAY_CONFIRM_CAPABILITIES.includes(capability) ? 'ACCOUNTANT_TO_CONFIRM' : 'DIRECTOR_TO_CONFIRM');
  }
  const notice = await resolveNotice(companyId, siteId, actor, audiences);

  // 7. Write the version, its confirmations and the audit entry in one transaction.
  const category: AuditCategoryCode = changed.some((field) => {
    const capability = policy[field]?.confirm?.capability;
    return capability !== undefined && PAY_CONFIRM_CAPABILITIES.includes(capability);
  })
    ? 'RULES_PAY'
    : 'RULES_OPERATING';
  const fieldsBefore = pick(currentValues, changed);
  const fieldsAfter = pick(newValues, changed);

  const row = await runAudited<RuleVersionRow>(async (tx: Prisma.TransactionClient) => {
    const number = ((await rulesRepository.latestOfScope(companyId, siteId, group as RuleGroup, tx))?.version ?? 0) + 1;
    const created = await rulesRepository.createVersion(tx, {
      companyId,
      siteId,
      group: group as RuleGroup,
      version: number,
      effectiveFrom: toDateColumn(effectiveFrom),
      values: newValues as Prisma.InputJsonValue,
      reason,
      createdById: actor.id,
      createdByRole: actor.role,
    });
    const confirmations = [];
    for (const item of toCreate) confirmations.push(await rulesRepository.createConfirmation(tx, { ruleVersionId: created.id, ...item }));
    const events: WorkforceEvent[] = [
      {
        name: 'rules.version_created',
        occurredAt: new Date().toISOString(),
        payload: { companyId, siteId, group, version: number, effectiveFrom, createdById: actor.id, notice },
      },
    ];
    return {
      result: { ...created, confirmations },
      entries: [
        {
          companyId,
          siteId,
          actor: { id: actor.id, role: actor.role, name: actorName },
          action: 'rules.version_created',
          category,
          subjectType: 'RuleVersion',
          subjectId: created.id,
          before: { fields: fieldsBefore } as JsonValue,
          after: {
            group,
            version: number,
            effectiveFrom,
            fields: fieldsAfter,
            ...(input.signature ? { signature: { method: input.signature.method, signedAt: input.signature.signedAt.toISOString() } } : {}),
          } as JsonValue,
          reason,
        },
      ],
      events,
    };
  });

  const [version] = await buildViews(companyId, [row], group, siteId);
  if (!version) throw new Error('Version view could not be built');
  return { version: { ...version, changedFields: changed }, notice };
}

async function confirmVersion(actor: AccessSubject, versionId: string, scope: string, note?: string): Promise<RuleVersionView> {
  const { companyId, name: actorName } = await actorCompany(actor);
  const row = await rulesRepository.findVersion(companyId, versionId);
  if (!row) throw new NotFoundError('Rule version not found');
  const group = row.group as RuleGroupCode;
  const siteId = row.siteId;

  const required = siteId ? [] : requiredScopesOf(group, asValues(row.values));
  if (!required.includes(scope)) throw new ConflictError('This version does not need that confirmation', 'RULE_CONFIRM_NOT_REQUIRED');
  const capability = confirmCapabilityOf(group, scope);
  if (!capability || !workforceCan(actor, capability)) throw new ForbiddenError('You cannot confirm this', 'RULE_CONFIRM_NOT_ALLOWED');

  if (row.confirmations.some((c) => c.scope === scope)) {
    const [existing] = await buildViews(companyId, [row], group, siteId);
    if (!existing) throw new Error('Version view could not be built');
    return existing;
  }

  const confirmation = await runAudited<RuleVersionRow>(async (tx) => {
    const created = await rulesRepository.createConfirmation(tx, { ruleVersionId: row.id, scope, confirmedById: actor.id, confirmerRole: actor.role, note: note ?? null });
    return {
      result: { ...row, confirmations: [...row.confirmations, created] },
      entries: [
        {
          companyId,
          siteId,
          actor: { id: actor.id, role: actor.role, name: actorName },
          action: 'rules.version_confirmed',
          category: 'RULES_PAY',
          subjectType: 'RuleVersion',
          subjectId: row.id,
          after: { group, version: row.version, scope },
          reason: note ?? null,
        },
      ],
      events: [
        {
          name: 'rules.version_confirmed',
          occurredAt: new Date().toISOString(),
          payload: { versionId: row.id, group, scope, confirmedById: actor.id },
        },
      ],
    };
  });
  const [view] = await buildViews(companyId, [confirmation], group, siteId);
  if (!view) throw new Error('Version view could not be built');
  return view;
}

export const rulesService: RulesService = { getEffective, listVersions, createVersion, confirmVersion };
