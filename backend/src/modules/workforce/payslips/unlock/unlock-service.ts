import { createHash, randomBytes } from 'node:crypto';
import { AppError, ConflictError, ForbiddenError } from '../../../../utils/errors';
import { comparePin, hashPin } from '../../../../utils/password';
import { runAudited } from '../../_shared/audit/audit-writer';
import { signerPinRepository } from '../../_shared/pin/signer-pin-repository';
import type { AccessSubject } from '../../_shared/workforce-access';
import { claimAlertWindow, insertAlertForEntry, tellAdminsOfAlert, type AlertFacts } from '../../security';
import { told } from '../../people/people-context';
import { payslipActor, payslipEntry } from '../payslips-context';
import { isDeviceConfirmed } from './device-source';
import { unlockRepository } from './unlock-repository';
import { HARD_CAP_MS, IDLE_MS, WINDOW_MS, pauseSeconds, shouldAlert, waitRemaining } from './unlock-rules';
import type { UnlockBody } from './unlock-validators';

export interface Unlocked {
  unlockToken: string;
  expiresAt: string;
  idleSeconds: number;
}

const hashOf = (token: string): string => createHash('sha256').update(token).digest('hex');

/** The token is random; only its hash is stored, so a copy of the table opens nothing. */
async function issue(tx: Parameters<typeof unlockRepository.createUnlock>[0], userId: string, deviceId: string, now: Date): Promise<Unlocked> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + HARD_CAP_MS);
  await unlockRepository.createUnlock(tx, { userId, deviceId, tokenHash: hashOf(token), createdAt: now, expiresAt });
  return { unlockToken: token, expiresAt: expiresAt.toISOString(), idleSeconds: IDLE_MS / 1000 };
}

type Outcome = { kind: 'OPEN'; unlocked: Unlocked } | { kind: 'WRONG'; count: number; alert: boolean } | { kind: 'SLOW'; wait: number };

/**
 * The payslip code (PD1 to PD4). The person's own 4-digit PIN; one right code opens My payslips on that phone. Every try is recorded
 * (who, which phone, right or wrong; never the digits). Nobody is ever locked out: from the 5th wrong try in 15 minutes a try is
 * answered only after a short, growing pause. The 3rd wrong try tells the System Admin and the person, once per window. One person
 * is handled at a time, so two phones guessing together cannot slip past the count.
 */
export async function unlock(subject: AccessSubject, body: UnlockBody, deviceLabel: string | null, now: Date = new Date()): Promise<Unlocked> {
  const ctx = await payslipActor(subject, 'me.payslip');
  const hash = await signerPinRepository.hashOf(subject.id);
  if (hash === null) throw new ConflictError('Choose your code first.', 'NO_CODE_SET');
  const confirmed = await isDeviceConfirmed(subject.id, body.deviceId);
  const alertFacts: AlertFacts = { companyId: ctx.companyId, siteId: subject.siteId, kind: 'WRONG_CODES', subjectUserId: subject.id, deviceLabel, at: now };
  const outcome = await runAudited<Outcome>(async (tx) => {
    await unlockRepository.lockPerson(tx, subject.id);
    const state = await unlockRepository.windowState(tx, subject.id, new Date(now.getTime() - WINDOW_MS));
    const wait = waitRemaining(state.wrong, state.lastWrongAt, now);
    if (wait > 0) return { result: { kind: 'SLOW', wait }, entries: [] };
    if (await comparePin(body.code, hash)) {
      await unlockRepository.addTry(tx, { userId: subject.id, deviceId: body.deviceId, success: true, confirmed: confirmed === true, alerted: false, createdAt: now });
      const unlocked = await issue(tx, subject.id, body.deviceId, now);
      return { result: { kind: 'OPEN', unlocked }, entries: [payslipEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payslip.code_tried', category: 'PAYSLIP_ACCESS', subjectType: 'User', subjectId: subject.id, subjectUserId: subject.id, after: { success: true, confirmed: confirmed === true, unconfirmed: confirmed === false }, deviceLabel })] };
    }
    const count = state.wrong + 1;
    const alert = shouldAlert(count, state.alerted);
    await unlockRepository.addTry(tx, { userId: subject.id, deviceId: body.deviceId, success: false, confirmed: confirmed === true, alerted: alert, createdAt: now });
    // 6a S1: the 3rd wrong code raises one System Admin alert per person and 15 minutes, written with its entry in this transaction.
    const raise = alert && (await claimAlertWindow(tx, subject.id, 'WRONG_CODES', now));
    return {
      result: { kind: 'WRONG', count, alert: raise },
      entries: [payslipEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payslip.code_tried', category: 'SECURITY', subjectType: 'User', subjectId: subject.id, subjectUserId: subject.id, after: { success: false, count, confirmed: confirmed === true }, deviceLabel })],
      afterWrite: async (inner, records) => {
        const first = records[0];
        if (raise && first) await insertAlertForEntry(inner, alertFacts, first.id);
      },
    };
  });

  if (outcome.kind === 'SLOW') throw new AppError(429, 'CODE_SLOWED', `Wait ${outcome.wait} seconds, then try again.`, { waitSeconds: outcome.wait });
  if (outcome.kind === 'WRONG') {
    if (outcome.alert) {
      await tellAdminsOfAlert(alertFacts);
      await told([subject.id], 'payslip.three_wrong_codes', { device: deviceLabel, at: now.toISOString() });
    }
    const next = pauseSeconds(outcome.count);
    throw new ForbiddenError('That code is not right.', 'CODE_WRONG', next > 0 ? { waitSeconds: next } : undefined);
  }
  // An unconfirmed phone is recorded and alerted when the payslip is opened (reads/open-audit.ts), not here.
  return outcome.unlocked;
}

/** A first code, while the person has none (PD1). Two taps set one. The new code opens My payslips at once. */
export async function setFirstCode(subject: AccessSubject, body: UnlockBody, deviceLabel: string | null, now: Date = new Date()): Promise<Unlocked> {
  const ctx = await payslipActor(subject, 'me.payslip');
  if (await unlockRepository.hasCode(subject.id)) throw new ConflictError('You already have a code.', 'CODE_EXISTS');
  const pinHash = await hashPin(body.code);
  return runAudited<Unlocked>(async (tx) => {
    await unlockRepository.lockPerson(tx, subject.id);
    if (!(await unlockRepository.setFirstPin(tx, subject.id, pinHash))) throw new ConflictError('You already have a code.', 'CODE_EXISTS');
    const unlocked = await issue(tx, subject.id, body.deviceId, now);
    return { result: unlocked, entries: [payslipEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payslip.code_set', category: 'SECURITY', subjectType: 'User', subjectId: subject.id, subjectUserId: subject.id, deviceLabel })] };
  });
}

/** Leaving My payslips, or the app going to the background, locks again (PD2). */
export async function lock(subject: AccessSubject, deviceId: string, now: Date = new Date()): Promise<void> {
  await payslipActor(subject, 'me.payslip');
  await unlockRepository.revoke(subject.id, deviceId, now);
}

export const tokenHash = hashOf;
