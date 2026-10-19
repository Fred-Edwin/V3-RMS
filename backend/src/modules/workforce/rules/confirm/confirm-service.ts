import type { Prisma, RuleGroup } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { JsonValue } from '../../_shared/audit/audit.types';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { fromDateColumn } from '../../_shared/time/nairobi-time';
import { workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { actorCompany } from '../resolve/rules-context';
import { rulesRepository, type RuleVersionRow } from '../resolve/rules-repository';
import type { RuleGroupCode } from '../rules-schemas';
import { asValues, confirmCapabilityOf, requiredScopesOf } from '../rules-values';
import { versionsRepository } from '../versions/versions-repository';
import { viewOf, type RuleVersionView } from '../versions/versions-view';
import type { ConfirmBody } from './confirm-validators';

export interface ConfirmedVersion {
  version: RuleVersionView;
  replay: boolean; // true when this scope was already confirmed: nothing was written
}

/**
 * Confirm a part of a version that needs a second person (overtime multipliers, the holiday list, the holiday pay rate,
 * statutory tables). The capability comes from the scope, never from a role list. Idempotent per (version, scope): confirming
 * twice answers with the first confirmation. Needs the signer's PIN. Writes `rules.version_confirmed` in the same transaction.
 */
export async function confirmVersion(actor: AccessSubject, versionId: string, body: ConfirmBody, now: Date = new Date()): Promise<ConfirmedVersion> {
  if (!workforceCan(actor, 'rules.read')) throw new ForbiddenError('You do not have permission to perform this action');
  const { companyId, name: actorName } = await actorCompany(actor);
  const row = await rulesRepository.findVersion(companyId, versionId);
  if (!row) throw new NotFoundError('Rule version not found');
  const group = row.group as RuleGroupCode;

  const capability = confirmCapabilityOf(group, body.scope);
  if (!capability || !workforceCan(actor, capability)) throw new ForbiddenError('You cannot confirm this', 'RULE_CONFIRM_NOT_ALLOWED');
  if (row.withdrawal) throw new ConflictError('This version was withdrawn', 'RULE_VERSION_WITHDRAWN');
  if (row.siteId !== null || !requiredScopesOf(group, asValues(row.values)).includes(body.scope)) {
    throw new ConflictError('This version does not need that confirmation', 'RULE_CONFIRM_NOT_REQUIRED');
  }
  if (row.confirmations.some((c) => c.scope === body.scope)) return { version: await viewOf(row, now), replay: true };

  const signature = await verifySignerPin(actor.id, body.pin, now.getTime());
  const done = await runAudited<{ row: RuleVersionRow; replay: boolean }>(async (tx: Prisma.TransactionClient) => {
    await versionsRepository.lockScope(tx, companyId, row.group as RuleGroup, null);
    const fresh = await rulesRepository.findVersion(companyId, versionId, tx);
    if (!fresh || fresh.withdrawal) throw new ConflictError('This version was withdrawn', 'RULE_VERSION_WITHDRAWN');
    if (fresh.confirmations.some((c) => c.scope === body.scope)) return { result: { row: fresh, replay: true }, entries: [] };

    const created = await versionsRepository.createConfirmation(tx, { ruleVersionId: fresh.id, scope: body.scope, confirmedById: actor.id, confirmerRole: actor.role, note: body.note ?? null });
    return {
      result: { row: { ...fresh, confirmations: [...fresh.confirmations, created] }, replay: false },
      entries: [
        {
          companyId,
          siteId: null,
          actor: { id: actor.id, role: actor.role, name: actorName },
          action: 'rules.version_confirmed',
          category: 'RULES_PAY',
          subjectType: 'RuleVersion',
          subjectId: fresh.id,
          after: {
            group,
            version: fresh.version,
            effectiveFrom: fromDateColumn(fresh.effectiveFrom),
            scope: body.scope,
            signature: { method: signature.method, signedAt: signature.signedAt.toISOString() },
          } as JsonValue,
          reason: body.note ?? null,
        },
      ],
      events: [{ name: 'rules.version_confirmed', occurredAt: now.toISOString(), payload: { versionId: fresh.id, group, scope: body.scope, confirmedById: actor.id } }],
    };
  });
  return { version: await viewOf(done.row, now), replay: done.replay };
}
