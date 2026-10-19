import type { RuleGroup } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { nairobiToday, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { scopeOf, workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { actorCompany, requireSite } from '../resolve/rules-context';
import { rulesRepository, type Db } from '../resolve/rules-repository';
import { RULE_DEFAULTS } from '../rules-defaults';
import type { RuleNoticeAudience } from '../rules-field-policy';
import type { RuleGroupCode } from '../rules-schemas';
import { asValues, confirmCapabilityOf, fieldsOf, fieldsOfScope, policyOf, requiredScopesOf, same, siteFieldsOf } from '../rules-values';
import { assertStartAllowed, assertWeekStartDay, defaultStartFor, earliestStartFor } from './plan-dates';
import { normaliseChange } from './plan-input';
import { approvedMonths } from './plan-months';
import { audiencesFor } from './plan-notice';
import type { ChangeRequest, ConfirmationToCreate, PlannedChange } from './plan.types';

const refuse = (message: string): ForbiddenError => new ForbiddenError(message, 'RULE_FIELD_NOT_EDITABLE');

/** Every changed field needs its edit capability; a holder limited to their own site may only write their own site's override. */
const assertMayChange = (actor: AccessSubject, group: RuleGroupCode, siteId: string | null, changed: string[]): void => {
  const policy = policyOf(group);
  for (const field of changed) {
    const capability = policy[field]?.edit ?? null;
    const scope = capability ? scopeOf(actor, capability) : null;
    if (!capability || scope === null) throw refuse(`You cannot change ${field}`);
    if (scope !== 'all' && !(siteId !== null && siteId === actor.siteId && policy[field]?.site === true)) {
      throw refuse('You can change your own branch’s override only');
    }
  }
};

/** The company's confirmations for the new version: carried forward when the scope is untouched, given by the editor when they hold the right. */
const confirmationsFor = (
  actor: AccessSubject,
  group: RuleGroupCode,
  required: string[],
  changed: string[],
  previous: Awaited<ReturnType<typeof rulesRepository.findEffective>>,
): { create: ConfirmationToCreate[]; waiting: string[] } => {
  const create: ConfirmationToCreate[] = [];
  for (const scope of required) {
    const untouched = fieldsOfScope(group, scope).every((field) => !changed.includes(field));
    const earlier = previous?.confirmations.find((c) => c.scope === scope);
    if (untouched && earlier) {
      create.push({ scope, confirmedById: earlier.confirmedById, confirmerRole: earlier.confirmerRole, note: `Carried forward from version ${previous?.version}` });
      continue;
    }
    const capability = confirmCapabilityOf(group, scope);
    if (!untouched && capability && workforceCan(actor, capability)) create.push({ scope, confirmedById: actor.id, confirmerRole: actor.role, note: null });
  }
  const done = new Set(create.map((c) => c.scope));
  return { create, waiting: required.filter((scope) => !done.has(scope)) };
};

/** The earliest allowed day and the one the dialog suggests (D9, D10). Never throws; the dialog shows these before anything is typed. */
export async function startWindow(companyId: string, group: RuleGroupCode, siteId: string | null, changed: string[], now: Date, db: Db): Promise<{ earliest: NairobiDate; suggested: NairobiDate; latestVersion: number }> {
  const today = nairobiToday(now);
  const latest = await rulesRepository.latestOfScope(companyId, siteId, group as RuleGroup, db);
  const earliest = await earliestStartFor(companyId, group, today, latest?.live?.effectiveFrom ?? null, now);
  const wanted = defaultStartFor(group, changed.length > 0 ? changed : fieldsOf(group), today);
  return { earliest, suggested: wanted < earliest ? earliest : wanted, latestVersion: latest?.number ?? 0 };
}

/**
 * Everything a save or a preview decides, with no writes: validation, the start-day rules, stale and clash refusals, what
 * actually changes, who may change it, the confirmations, and who is told. Throws the specific AppError the dialog shows.
 * `db` is the transaction when create runs it under the scope lock.
 */
export async function planChange(actor: AccessSubject, group: RuleGroupCode, request: ChangeRequest, db: Db, now: Date = new Date()): Promise<PlannedChange> {
  if (!workforceCan(actor, 'rules.read')) throw new ForbiddenError('You do not have permission to perform this action');
  const { companyId, name: actorName } = await actorCompany(actor);
  const siteId = request.siteId;
  if (siteId) {
    const site = await requireSite(siteId);
    if (site.companyId !== companyId) throw new NotFoundError('Site not found');
  }
  // A holder limited to one site can write that site's override and nothing else (the company rule, another site): refused outright.
  if (scopeOf(actor, 'rules.read') === 'unit' && siteId !== actor.siteId) throw refuse('You can change your own branch’s override only');

  const holdsAnEditRight = Object.values(policyOf(group)).some((field) => field.edit !== null && workforceCan(actor, field.edit));
  if (!holdsAnEditRight) throw refuse('You cannot change this tab');

  const today = nairobiToday(now);
  const day = toDateColumn(request.effectiveFrom);
  const [companyRow, siteRow, latest] = await Promise.all([
    rulesRepository.findEffective(companyId, null, group as RuleGroup, day, db),
    siteId ? rulesRepository.findEffective(companyId, siteId, group as RuleGroup, day, db) : Promise.resolve(null),
    rulesRepository.latestOfScope(companyId, siteId, group as RuleGroup, db),
  ]);

  // Two people at once (D8): the screen saw an older newest version than the one stored now.
  if (request.expectedVersion !== undefined && latest && latest.number > request.expectedVersion) {
    throw new ConflictError('Someone changed this rule a moment ago', 'RULE_STALE', { latestVersion: latest.number });
  }

  const floor = group === 'STATUTORY' ? await approvedMonths().firstOpenMonthStart(companyId, now) : today;
  assertStartAllowed({ group, effectiveFrom: request.effectiveFrom, today, floor, latestLive: latest?.live ?? null });

  const inForce = { company: companyRow ? asValues(companyRow.values) : asValues(RULE_DEFAULTS[group]), site: siteRow ? asValues(siteRow.values) : {} };
  const { stored, before, after } = normaliseChange(group, request, inForce);

  const policy = policyOf(group);
  const keys = (siteId ? siteFieldsOf(group) : fieldsOf(group)).filter((field) => policy[field]?.derived !== true);
  const changed = keys.filter((field) => !same(before[field], after[field]));
  if (siteId) {
    const had = new Set(Object.keys(inForce.site).filter((key) => keys.includes(key)));
    for (const key of keys) if (had.has(key) !== (key in stored) && !changed.includes(key)) changed.push(key);
  }
  if (changed.length === 0) throw new ConflictError('Nothing differs from the rule already in force', 'RULE_NO_CHANGE');
  if (changed.includes('weekStartsOn')) assertWeekStartDay(request.effectiveFrom, Number(after.weekStartsOn));

  assertMayChange(actor, group, siteId, changed);

  const required = siteId ? [] : requiredScopesOf(group, stored);
  const { create, waiting } = confirmationsFor(actor, group, required, changed, companyRow);

  const audiences: Set<RuleNoticeAudience> = audiencesFor(group, siteId, actor, group === 'LEAVE' && changed.every((f) => f === 'minimumCover'));
  for (const scope of waiting) {
    const capability = confirmCapabilityOf(group, scope);
    audiences.add(capability === 'rules.confirm.holiday_list' ? 'DIRECTOR_TO_CONFIRM' : 'ACCOUNTANT_TO_CONFIRM');
  }

  const pick = (values: Record<string, unknown>) => Object.fromEntries(changed.map((field) => [field, values[field]]));
  const window = await startWindow(companyId, group, siteId, changed, now, db);
  const pay = changed.some((field) => policy[field]?.pay === true);
  return {
    companyId,
    actorName,
    group,
    siteId,
    effectiveFrom: request.effectiveFrom,
    stored,
    changedFields: changed,
    before: pick(before),
    after: pick(after),
    becomesVersion: (latest?.number ?? 0) + 1,
    latestVersion: latest?.number ?? 0,
    requiredScopes: required,
    confirmations: create,
    waitingScopes: waiting,
    audiences,
    category: pay ? 'RULES_PAY' : 'RULES_OPERATING',
    pay,
    approvedMonthsAffected: await approvedMonths().isMonthApproved(companyId, request.effectiveFrom),
    earliestEffectiveFrom: window.earliest,
    defaultEffectiveFrom: window.suggested,
  };
}
