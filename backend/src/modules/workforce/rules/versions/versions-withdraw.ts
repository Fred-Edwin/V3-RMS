import type { Prisma, RuleGroup } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { JsonValue } from '../../_shared/audit/audit.types';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { fromDateColumn, nairobiToday } from '../../_shared/time/nairobi-time';
import { scopeOf, workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { mayEditTab } from '../access/access-who';
import { audiencesFor, resolveNotice } from '../plan/plan-notice';
import { actorCompany } from '../resolve/rules-context';
import { rulesRepository, type RuleVersionRow } from '../resolve/rules-repository';
import type { RuleGroupCode } from '../rules-schemas';
import { policyOf } from '../rules-values';
import { versionsRepository } from './versions-repository';
import { changedAgainst, viewOf, type RuleVersionView } from './versions-view';
import type { WithdrawBody } from './versions-validators';

export interface WithdrawnVersion {
  version: RuleVersionView;
  replay: boolean; // true when it was already withdrawn: nothing was written
}

/** What this person may not see does not exist for them: a version of another company, or of another site for a holder limited to one site, is a 404. */
const loadVisible = async (actor: AccessSubject, companyId: string, versionId: string): Promise<RuleVersionRow> => {
  const row = await rulesRepository.findVersion(companyId, versionId);
  const unitOnly = scopeOf(actor, 'rules.read') === 'unit';
  if (!row || (unitOnly && row.siteId !== null && row.siteId !== actor.siteId)) throw new NotFoundError('Rule version not found');
  return row;
};

/**
 * Cancel a version that has not started. The row stays in the history as "Withdrawn" and the resolver skips it. Only the
 * newest version of its scope can be withdrawn (later ones were built on it), only before its start day, and only by
 * someone who may change that tab. Needs a reason and the signer's PIN; the same people who were told of it are told.
 */
export async function withdrawVersion(actor: AccessSubject, versionId: string, body: WithdrawBody, now: Date = new Date()): Promise<WithdrawnVersion> {
  if (!workforceCan(actor, 'rules.read')) throw new ForbiddenError('You do not have permission to perform this action');
  const { companyId, name: actorName } = await actorCompany(actor);
  const row = await loadVisible(actor, companyId, versionId);
  const group = row.group as RuleGroupCode;
  if (!mayEditTab(actor, group, row.siteId)) throw new ForbiddenError('You cannot change this tab', 'RULE_FIELD_NOT_EDITABLE');
  if (row.withdrawal) return { version: await viewOf(row, now), replay: true };

  const today = nairobiToday(now);
  if (fromDateColumn(row.effectiveFrom) <= today) throw new ConflictError('This version has already started and cannot be withdrawn', 'RULE_VERSION_STARTED');
  const signature = await verifySignerPin(actor.id, body.pin, now.getTime());

  const done = await runAudited<{ row: RuleVersionRow; replay: boolean }>(async (tx: Prisma.TransactionClient) => {
    await versionsRepository.lockScope(tx, companyId, row.group as RuleGroup, row.siteId);
    const fresh = await rulesRepository.findVersion(companyId, versionId, tx);
    if (!fresh) throw new NotFoundError('Rule version not found');
    if (fresh.withdrawal) return { result: { row: fresh, replay: true }, entries: [] };
    if (fromDateColumn(fresh.effectiveFrom) <= today) throw new ConflictError('This version has already started and cannot be withdrawn', 'RULE_VERSION_STARTED');
    const latest = await rulesRepository.latestOfScope(companyId, fresh.siteId, fresh.group, tx);
    if (latest?.live && latest.live.version !== fresh.version) {
      throw new ConflictError(`Version ${latest.live.version} was made after this one. Withdraw version ${latest.live.version} first.`, 'RULE_VERSION_NOT_LATEST', { latestVersion: latest.live.version });
    }

    const withdrawal = await versionsRepository.createWithdrawal(tx, { ruleVersionId: fresh.id, withdrawnById: actor.id, withdrawnByRole: actor.role, reason: body.reason });
    const previous = fresh.version > 1 ? await rulesRepository.findByNumber(companyId, fresh.siteId, fresh.group, fresh.version - 1, tx) : null;
    const changed = changedAgainst(group, fresh.siteId, fresh, previous);
    const policy = policyOf(group);
    const minimumCoverOnly = group === 'LEAVE' && changed.length > 0 && changed.every((field) => field === 'minimumCover');
    const notice = await resolveNotice(companyId, fresh.siteId, actor, audiencesFor(group, fresh.siteId, actor, minimumCoverOnly));
    return {
      result: { row: { ...fresh, withdrawal }, replay: false },
      entries: [
        {
          companyId,
          siteId: fresh.siteId,
          actor: { id: actor.id, role: actor.role, name: actorName },
          action: 'rules.version_withdrawn',
          category: changed.some((field) => policy[field]?.pay === true) ? 'RULES_PAY' : 'RULES_OPERATING',
          subjectType: 'RuleVersion',
          subjectId: fresh.id,
          after: {
            group,
            version: fresh.version,
            effectiveFrom: fromDateColumn(fresh.effectiveFrom),
            signature: { method: signature.method, signedAt: signature.signedAt.toISOString() },
          } as JsonValue,
          reason: body.reason,
        },
      ],
      events: [
        {
          name: 'rules.version_withdrawn',
          occurredAt: now.toISOString(),
          payload: { versionId: fresh.id, companyId, siteId: fresh.siteId, group, version: fresh.version, effectiveFrom: fromDateColumn(fresh.effectiveFrom), withdrawnById: actor.id, notice },
        },
      ],
    };
  });
  return { version: await viewOf(done.row, now), replay: done.replay };
}
