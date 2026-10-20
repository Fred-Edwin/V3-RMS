import { runAudited } from '../../_shared/audit/audit-writer';
import type { AccessSubject } from '../../_shared/workforce-access';
import { claimAlertWindow, insertAlertForEntry, tellAdminsOfAlert, type AlertFacts } from '../alerts/alerts-raise';
import { devicesRepository } from '../devices/devices-repository';
import { securityActor, securityEntry } from '../security-context';
import { forgetSession } from './reset-gate';
import { sessionRepository } from './session-repository';

export interface WasntMeInput {
  /** The browser's own device id (never stored; only its hash is). */
  deviceId?: string | undefined;
  /** The entry in "Activity on my record" the person is answering, when they came from there. */
  entryId?: string | undefined;
  idempotencyKey: string;
}

export interface WasntMeContext {
  deviceLabel?: string | null;
  placeLabel?: string | null;
}

/**
 * "This wasn't me" (6a S3). One transaction: raise the flag (every older session is refused, a new password is required), end the
 * refresh tokens, revoke open payslip unlocks, clear the code (the payslip code and the signing PIN are the same PIN), remove every
 * phone, and write the entry with its System Admin alert. Idempotent by state: pressing it again while the flag is up writes nothing.
 * Back end B's "Activity on my record" answer NOT_ME calls this same function.
 */
export async function wasntMe(subject: AccessSubject, input: WasntMeInput, ctx: WasntMeContext = {}, now: Date = new Date()): Promise<{ alreadyDone: boolean }> {
  const actor = await securityActor(subject, 'security.phones.own');
  let facts: AlertFacts | null = null;
  const done = await runAudited<boolean>(async (tx) => {
    const raised = await sessionRepository.raiseFlag(tx, subject.id, now);
    if (!raised) return { result: false, entries: [] };
    await sessionRepository.deleteRefreshTokens(tx, subject.id);
    await sessionRepository.revokeUnlocks(tx, subject.id, now);
    await sessionRepository.clearCode(tx, subject.id);
    await devicesRepository.removeAll(tx, subject.id, now);
    const free = await claimAlertWindow(tx, subject.id, 'WASNT_ME', now);
    const entry = securityEntry({
      companyId: actor.companyId,
      actor: actor.auditActor,
      action: 'security.wasnt_me',
      subjectType: 'User',
      subjectId: subject.id,
      subjectUserId: subject.id,
      after: input.entryId ? { answeredEntry: input.entryId } : null,
      deviceLabel: ctx.deviceLabel ?? null,
      placeLabel: ctx.placeLabel ?? null,
    });
    facts = { companyId: actor.companyId, siteId: subject.siteId ?? null, kind: 'WASNT_ME', subjectUserId: subject.id, deviceLabel: ctx.deviceLabel ?? null, placeLabel: ctx.placeLabel ?? null, at: now };
    return {
      result: true,
      entries: [entry],
      afterWrite: async (inner, records) => {
        const first = records[0];
        if (free && first) await insertAlertForEntry(inner, facts as AlertFacts, first.id);
      },
    };
  });
  forgetSession(subject.id);
  if (done && facts) await tellAdminsOfAlert(facts);
  return { alreadyDone: !done };
}
