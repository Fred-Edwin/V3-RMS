import { AppError, ConflictError, ForbiddenError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import { nudgeUsers } from '../../notifications';
import { conductActor, conductEntry, directorUserIds, hrUserIds, issuedByHr, roleName, tellAbout, type ActorCtx } from '../_shared/conduct-context';
import { loadReadable, jobLabelOf } from '../_shared/conduct-load';
import { recordableFrom } from '../_shared/conduct-dates';
import { hasLetter, LEVEL_LABELS, noticeNumberLabel } from '../_shared/conduct-model';
import { conductNoticesRepository, type ConductNotice } from '../_shared/conduct-notices-repository';
import { conductPeopleRepository } from '../_shared/conduct-people-repository';
import { statusesAllowing } from '../_shared/conduct-status';
import type { NotSignedBody } from './notices-validators';

export interface NotSignedResult {
  id: string;
  status: ConductNotice['status'];
  recordedAt: string;
  witnessAsked: boolean;
}

/** The issuer, or HR (any notice), may record it (S11). */
const mayRecord = (subject: AccessSubject, notice: ConductNotice): boolean => notice.issuerId === subject.id || scopeOf(subject, 'discipline.issue') === 'all';

/** The witness must be another person at the notice's site, with a live login, who is neither the issuer nor the subject (C13). */
async function assertWitness(ctx: ActorCtx, notice: ConductNotice, witnessId: string): Promise<void> {
  if (witnessId === notice.issuerId || witnessId === notice.personUserId) throw new AppError(422, 'WITNESS_NOT_ALLOWED', 'The witness must be another person.');
  const witness = await conductPeopleRepository.personByUserId(ctx.companyId, witnessId);
  if (!witness || !witness.userActive || witness.status === 'EXITED' || witness.siteId !== notice.siteId) {
    throw new AppError(422, 'WITNESS_NOT_ALLOWED', 'The witness must be a colleague at the same site.');
  }
}

/**
 * Records that the notice was not signed (S11): the reason, a witness, and the issuer's PIN. Open the day after the sign limit, or at
 * once for a person with no login. The notice stays in force marked "given, not signed"; the appeal days carry on. A witness who does
 * not confirm never voids the notice (C13).
 */
export async function recordNotSigned(subject: AccessSubject, noticeId: string, body: NotSignedBody, deviceLabel: string | null, now: Date = new Date()): Promise<NotSignedResult> {
  const ctx = await conductActor(subject, 'discipline.issue');
  const { notice, person } = await loadReadable(subject, ctx.companyId, noticeId);
  if (!mayRecord(subject, notice)) throw new ForbiddenError('Only the person who issued this notice can record this.', 'NOT_ISSUER');
  if (!hasLetter(notice.level)) throw new ConflictError('A verbal note has no signature to record.', 'NOT_SIGNABLE');
  if (notice.status === 'GIVEN_NOT_SIGNED') throw new ConflictError('This was already recorded.', 'ALREADY_RECORDED', { recordedAt: notice.notSignedRecordedAt?.toISOString() ?? null });
  if (notice.signedAt) throw new ConflictError('The person signed a moment ago.', 'ALREADY_SIGNED');
  if (!statusesAllowing('RECORD_NOT_SIGNED').includes(notice.status)) throw new ConflictError('This notice cannot change that way now.', 'INVALID_TRANSITION', { status: notice.status });

  const hasLogin = notice.personUserId !== null;
  if (hasLogin && body.reason === 'NO_LOGIN') throw new AppError(422, 'LOGIN_EXISTS', 'This person has a login, so they can sign.');
  if (!hasLogin && body.reason !== 'NO_LOGIN') throw new AppError(422, 'NO_LOGIN_ONLY', 'This person has no login: record that they have no login.');
  const opensAt = recordableFrom(notice.issuedAt, notice.ackDays);
  if (body.reason !== 'NO_LOGIN' && now < opensAt) throw new AppError(422, 'TOO_EARLY', 'You can record this once the days to sign have passed.', { from: opensAt.toISOString() });
  await assertWitness(ctx, notice, body.witnessId);
  await verifySignerPin(subject.id, body.pin, now.getTime());

  const recorded = await runAudited<ConductNotice | null>(async (tx) => {
    const updated = await conductNoticesRepository.transition(tx, ctx.companyId, notice.id, statusesAllowing('RECORD_NOT_SIGNED'), 'GIVEN_NOT_SIGNED', {
      notSignedRecordedAt: now,
      notSignedReason: body.reason,
      notSignedById: subject.id,
      witnessId: body.witnessId,
      witnessAskedAt: now,
    });
    if (!updated) return { result: null, entries: [] };
    await conductNoticesRepository.addEvent(tx, { noticeId: notice.id, at: now, kind: 'NOT_SIGNED_RECORDED', actor: { id: subject.id, name: ctx.name, role: roleName(subject.role) }, payload: { reason: body.reason } });
    return {
      result: updated,
      entries: [conductEntry({ ctx, siteId: notice.siteId, action: 'conduct.not_signed_recorded', noticeId: notice.id, subjectUserId: notice.personUserId, after: { number: noticeNumberLabel(notice.number), reason: body.reason, witnessId: body.witnessId }, deviceLabel })],
    };
  });
  if (!recorded) {
    const current = await conductNoticesRepository.findById(ctx.companyId, notice.id);
    if (current?.signedAt) throw new ConflictError('The person signed a moment ago.', 'ALREADY_SIGNED');
    if (current?.status === 'GIVEN_NOT_SIGNED') throw new ConflictError('This was already recorded.', 'ALREADY_RECORDED');
    throw new ConflictError('This notice changed a moment ago.', 'INVALID_TRANSITION', { status: current?.status ?? notice.status });
  }

  const data = { level: LEVEL_LABELS[notice.level], number: noticeNumberLabel(notice.number), issuerRole: roleName(subject.role), personRole: jobLabelOf(person), site: notice.siteName, noticeId: notice.id };
  const oversight = issuedByHr(notice) ? await directorUserIds(ctx.companyId) : await hrUserIds(ctx.companyId);
  await tellAbout([notice.personUserId], 'conduct.not_signed', data);
  await tellAbout([body.witnessId], 'conduct.witness_asked', data);
  await tellAbout(oversight, 'conduct.not_signed_oversight', data);
  nudgeUsers([body.witnessId, ...oversight], 'workforce:needs-you');
  return { id: recorded.id, status: recorded.status, recordedAt: now.toISOString(), witnessAsked: true };
}
