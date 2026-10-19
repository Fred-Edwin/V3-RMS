import type { Prisma, RuleGroup } from '@prisma/client';
import { ConflictError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { JsonValue } from '../../_shared/audit/audit.types';
import type { WorkforceEvent } from '../../_shared/events';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { toDateColumn } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { planChange } from '../plan/plan-build';
import { resolveNotice } from '../plan/plan-notice';
import type { ChangeRequest, PlannedChange } from '../plan/plan.types';
import { actorCompany } from '../resolve/rules-context';
import { readDb, rulesRepository, type RuleVersionRow } from '../resolve/rules-repository';
import type { RuleGroupCode } from '../rules-schemas';
import type { RuleChangeNotice } from '../rules.types';
import { requireGroup } from '../rules-values';
import { versionsRepository } from './versions-repository';
import { viewOf, type RuleVersionView } from './versions-view';
import type { CreateBody } from './versions-validators';

export interface CreatedVersion {
  version: RuleVersionView;
  notice: RuleChangeNotice;
  confirmed: string[]; // scopes confirmed in this same save
  waiting: string[]; // scopes that still wait for someone with the confirming right
  replay: boolean; // true when this was a retry of a save that had already happened
}

export const requestOf = (body: Pick<CreateBody, 'siteId' | 'effectiveFrom' | 'values' | 'useCompanyRuleFor' | 'expectedVersion'>): ChangeRequest => ({
  siteId: body.siteId,
  effectiveFrom: body.effectiveFrom as ChangeRequest['effectiveFrom'],
  values: body.values,
  useCompanyRuleFor: body.useCompanyRuleFor,
  expectedVersion: body.expectedVersion,
});

/** What a notification may carry: old and new for ordinary fields, nothing but the tab and the day when a pay field changed (D1). */
const changesFor = (plan: PlannedChange): { field: string; from: unknown; to: unknown }[] =>
  plan.pay ? [] : plan.changedFields.map((field) => ({ field, from: plan.before[field], to: plan.after[field] }));

const replayOf = async (actor: AccessSubject, group: RuleGroupCode, row: RuleVersionRow, siteId: string | null): Promise<CreatedVersion> => {
  if (row.createdById !== actor.id || row.group !== group || row.siteId !== siteId) {
    throw new ConflictError('That request key was already used for a different change', 'RULE_IDEMPOTENCY_KEY_REUSED');
  }
  return {
    version: await viewOf(row),
    notice: { recipients: [] },
    confirmed: row.confirmations.map((c) => c.scope),
    waiting: [],
    replay: true,
  };
};

/**
 * Save a change as a new version. Order matters: everything that can be refused for a reason the person can fix is checked
 * first (nothing is written, the PIN is not touched); then the PIN; then, under a lock on the scope's timeline, the plan is
 * made again (a second person may have saved in between) and the version, its confirmations, the audit entry and the event
 * are written together. A retry with the same `idempotencyKey` answers with the version already made.
 */
export async function createVersion(actor: AccessSubject, groupInput: string, body: CreateBody, now: Date = new Date()): Promise<CreatedVersion> {
  const group = requireGroup(groupInput);
  const request = requestOf(body);
  const key = body.idempotencyKey ?? null;
  const { companyId } = await actorCompany(actor);

  if (key) {
    const existing = await rulesRepository.findByKey(companyId, key);
    if (existing) return replayOf(actor, group, existing, request.siteId);
  }
  await planChange(actor, group, request, readDb, now);
  const signature = await verifySignerPin(actor.id, body.pin, now.getTime());

  const outcome = await runAudited<{ row: RuleVersionRow; plan: PlannedChange | null; notice: RuleChangeNotice }>(async (tx: Prisma.TransactionClient) => {
    await versionsRepository.lockScope(tx, companyId, group as RuleGroup, request.siteId);
    const raced = key ? await rulesRepository.findByKey(companyId, key, tx) : null;
    if (raced) return { result: { row: raced, plan: null, notice: { recipients: [] } }, entries: [] };

    const plan = await planChange(actor, group, request, tx, now);
    const notice = await resolveNotice(companyId, plan.siteId, actor, plan.audiences);
    const created = await versionsRepository.createVersion(tx, {
      companyId,
      siteId: plan.siteId,
      group: group as RuleGroup,
      version: plan.becomesVersion,
      effectiveFrom: toDateColumn(plan.effectiveFrom),
      values: plan.stored as Prisma.InputJsonValue,
      reason: body.reason,
      createdById: actor.id,
      createdByRole: actor.role,
      idempotencyKey: key,
    });
    const confirmations = [];
    for (const item of plan.confirmations) confirmations.push(await versionsRepository.createConfirmation(tx, { ruleVersionId: created.id, ...item }));

    const events: WorkforceEvent[] = [
      {
        name: 'rules.version_created',
        occurredAt: now.toISOString(),
        payload: { companyId, siteId: plan.siteId, group, version: plan.becomesVersion, effectiveFrom: plan.effectiveFrom, createdById: actor.id, notice, pay: plan.pay, changes: changesFor(plan) },
      },
    ];
    return {
      result: { row: { ...created, confirmations }, plan, notice },
      entries: [
        {
          companyId,
          siteId: plan.siteId,
          actor: { id: actor.id, role: actor.role, name: plan.actorName },
          action: 'rules.version_created',
          category: plan.category,
          subjectType: 'RuleVersion',
          subjectId: created.id,
          before: { fields: plan.before } as JsonValue,
          after: {
            group,
            version: plan.becomesVersion,
            effectiveFrom: plan.effectiveFrom,
            fields: plan.after,
            signature: { method: signature.method, signedAt: signature.signedAt.toISOString() },
          } as JsonValue,
          reason: body.reason,
        },
      ],
      events,
    };
  });

  if (outcome.plan === null) return replayOf(actor, group, outcome.row, request.siteId);
  return {
    version: await viewOf(outcome.row, now),
    notice: outcome.notice,
    confirmed: outcome.plan.confirmations.map((c) => c.scope),
    waiting: outcome.plan.waitingScopes,
    replay: false,
  };
}
