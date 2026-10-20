import { AppError, ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { nairobiDateOf } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { nudgeUsers } from '../../notifications';
import { conductActor, conductEntry, directorUserIds, hrUserIds, issuedByHr, roleName, tellAbout, type ActorCtx } from '../_shared/conduct-context';
import { jobLabelOf } from '../_shared/conduct-load';
import { signLimitDate } from '../_shared/conduct-dates';
import { LEVEL_LABELS, noticeNumberLabel } from '../_shared/conduct-model';
import { conductNoticesRepository, type ConductNotice } from '../_shared/conduct-notices-repository';
import { conductPeopleRepository } from '../_shared/conduct-people-repository';
import { statusesAllowing, tryNextStatus } from '../_shared/conduct-status';
import type { SignBody } from './notices-validators';

export interface SignResult {
  id: string;
  status: ConductNotice['status'];
  signedAt: string;
  alreadySigned: boolean;
}

const resultOf = (notice: ConductNotice, alreadySigned: boolean): SignResult => ({ id: notice.id, status: notice.status, signedAt: (notice.signedAt ?? new Date()).toISOString(), alreadySigned });

/** The person's own notice, or 404: another person's id never confirms the notice exists. */
async function ownNotice(ctx: ActorCtx, subject: AccessSubject, id: string): Promise<ConductNotice> {
  const notice = await conductNoticesRepository.findById(ctx.companyId, id);
  if (!notice || notice.personUserId === null || notice.personUserId !== subject.id) throw new NotFoundError('We could not find that notice.', 'NOTICE_NOT_FOUND');
  return notice;
}

/** A wrong receipt code is written down (device, never the digits) before the answer goes back (spec section 13). */
async function writeFailedTry(ctx: ActorCtx, notice: ConductNotice, deviceLabel: string | null): Promise<void> {
  await runAudited<void>(async () => ({
    result: undefined,
    entries: [conductEntry({ ctx, siteId: notice.siteId, action: 'conduct.sign_try_failed', noticeId: notice.id, subjectUserId: notice.personUserId, after: { number: noticeNumberLabel(notice.number) }, deviceLabel })],
  }));
}

/**
 * The person signs that they received the notice (S5), with their own code through the shared pause door (CONDUCT_SIGN): wrong tries
 * are recorded and slowed, never locked; the 3rd wrong try tells the System Admin. Late signing after "not signed" is allowed and
 * keeps both records (C12). Signing never extends the appeal days. The same request twice answers the first.
 */
export async function signNotice(subject: AccessSubject, noticeId: string, body: SignBody, deviceLabel: string | null, now: Date = new Date()): Promise<SignResult> {
  const ctx = await conductActor(subject, 'discipline.read_own');
  const notice = await ownNotice(ctx, subject, noticeId);
  if (notice.signedAt) return resultOf(notice, true);
  if (tryNextStatus(notice.status, 'SIGN') === null) throw new ConflictError('This notice cannot be signed now.', 'NOT_SIGNABLE', { status: notice.status });
  try {
    await verifySignerPin(subject.id, body.code, now.getTime(), 'CONDUCT_SIGN');
  } catch (error) {
    if (error instanceof AppError && error.code === 'PIN_INVALID') await writeFailedTry(ctx, notice, deviceLabel);
    throw error;
  }

  const late = notice.status === 'GIVEN_NOT_SIGNED' || nairobiDateOf(now) > signLimitDate(notice.issuedAt, notice.ackDays);
  const signed = await runAudited<ConductNotice | null>(async (tx) => {
    const updated = await conductNoticesRepository.transition(tx, ctx.companyId, notice.id, statusesAllowing('SIGN'), 'SIGNED', { signedAt: now, signedDeviceId: body.deviceId });
    if (!updated) return { result: null, entries: [] };
    await conductNoticesRepository.addEvent(tx, { noticeId: notice.id, at: now, kind: late ? 'SIGNED_LATE' : 'SIGNED', actor: { id: subject.id, name: ctx.name, role: roleName(subject.role) }, payload: { deviceId: body.deviceId } });
    return {
      result: updated,
      entries: [conductEntry({ ctx, siteId: notice.siteId, action: 'conduct.signed', noticeId: notice.id, subjectUserId: notice.personUserId, after: { number: noticeNumberLabel(notice.number), level: notice.level, late }, deviceLabel })],
    };
  });
  if (!signed) {
    const current = await conductNoticesRepository.findById(ctx.companyId, notice.id);
    if (current?.signedAt) return resultOf(current, true);
    throw new ConflictError('This notice changed a moment ago.', 'NOT_SIGNABLE', { status: current?.status ?? notice.status });
  }
  await tellOnSigned(ctx, signed);
  return resultOf(signed, false);
}

/** The issuer and HR are told; when HR issued, the Director is told in HR's place (spec section 11). */
async function tellOnSigned(ctx: ActorCtx, notice: ConductNotice): Promise<void> {
  const person = await conductPeopleRepository.personById(ctx.companyId, notice.employeeId);
  const oversight = issuedByHr(notice) ? await directorUserIds(ctx.companyId) : await hrUserIds(ctx.companyId);
  const data = { level: LEVEL_LABELS[notice.level], number: noticeNumberLabel(notice.number), personRole: person ? jobLabelOf(person) : 'Staff', site: notice.siteName, noticeId: notice.id };
  await tellAbout([notice.issuerId, ...oversight], 'conduct.signed', data);
  nudgeUsers([notice.issuerId, ...oversight], 'workforce:needs-you');
}
