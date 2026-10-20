import { AppError, ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { type AccessSubject } from '../../_shared/workforce-access';
import { nudgeUsers } from '../../notifications';
import { conductActor, conductEntry, directorUserIds, hrUserIds, issuedByHr, roleName, tellAbout, type ActorCtx } from '../_shared/conduct-context';
import { jobLabelOf } from '../_shared/conduct-load';
import { LEVEL_LABELS, noticeNumberLabel } from '../_shared/conduct-model';
import { conductNoticesRepository, type ConductNotice } from '../_shared/conduct-notices-repository';
import { conductPeopleRepository } from '../_shared/conduct-people-repository';
import type { WitnessBody } from './notices-validators';

/** The one fact a witness may see (S11): never the reason, the facts or the own line. */
export interface WitnessCard {
  noticeId: string;
  issuerRole: string;
  personRole: string;
  reason: string;
  date: string;
  answered: 'CONFIRMED' | 'DECLINED' | null;
}

/** The witness's own notice, or 404: anyone else asking never learns the notice exists. */
async function witnessedNotice(ctx: ActorCtx, subject: AccessSubject, id: string): Promise<ConductNotice> {
  const notice = await conductNoticesRepository.findById(ctx.companyId, id);
  if (!notice || notice.witnessId === null || notice.witnessId !== subject.id) throw new NotFoundError('We could not find that request.', 'NOTICE_NOT_FOUND');
  return notice;
}

const answeredOf = (notice: ConductNotice): WitnessCard['answered'] => (notice.witnessConfirmedAt ? 'CONFIRMED' : notice.witnessDeclinedAt ? 'DECLINED' : null);

export async function witnessCard(subject: AccessSubject, noticeId: string): Promise<WitnessCard> {
  const ctx = await conductActor(subject, 'notifications.own');
  const notice = await witnessedNotice(ctx, subject, noticeId);
  const person = await conductPeopleRepository.personById(ctx.companyId, notice.employeeId);
  return {
    noticeId: notice.id,
    issuerRole: notice.issuerRole,
    personRole: person ? jobLabelOf(person) : 'Staff',
    reason: notice.notSignedReason ?? 'REFUSED',
    date: (notice.notSignedRecordedAt ?? notice.issuedAt).toISOString(),
    answered: answeredOf(notice),
  };
}

/**
 * The witness confirms with their own code, or says "This is not right" (S11). Either way the notice stays valid; HR and the issuer
 * see "Witness not confirmed" when it is declined or silent for 3 days. Answering twice returns the first answer.
 */
export async function answerWitness(subject: AccessSubject, noticeId: string, body: WitnessBody, deviceLabel: string | null, now: Date = new Date()): Promise<{ answered: 'CONFIRMED' | 'DECLINED' }> {
  const ctx = await conductActor(subject, 'notifications.own');
  const notice = await witnessedNotice(ctx, subject, noticeId);
  const already = answeredOf(notice);
  if (already) return { answered: already };
  if (notice.status !== 'GIVEN_NOT_SIGNED') throw new ConflictError('There is nothing to confirm on this notice now.', 'NOTHING_TO_CONFIRM', { status: notice.status });
  if (body.confirmed) {
    if (body.code === undefined) throw new AppError(422, 'CODE_REQUIRED', 'Enter your code to confirm.');
    await verifySignerPin(subject.id, body.code, now.getTime(), 'CONDUCT_SIGN');
  }
  const answered = body.confirmed ? 'CONFIRMED' : 'DECLINED';
  const done = await runAudited<boolean>(async (tx) => {
    const updated = await conductNoticesRepository.patch(tx, ctx.companyId, notice.id, { witnessConfirmedAt: null, witnessDeclinedAt: null }, body.confirmed ? { witnessConfirmedAt: now } : { witnessDeclinedAt: now });
    if (!updated) return { result: false, entries: [] };
    await conductNoticesRepository.addEvent(tx, { noticeId: notice.id, at: now, kind: body.confirmed ? 'WITNESS_CONFIRMED' : 'WITNESS_DECLINED', actor: { id: subject.id, name: ctx.name, role: roleName(subject.role) } });
    return {
      result: true,
      entries: [conductEntry({ ctx, siteId: notice.siteId, action: body.confirmed ? 'conduct.witness_confirmed' : 'conduct.witness_declined', noticeId: notice.id, subjectUserId: notice.personUserId, after: { number: noticeNumberLabel(notice.number) }, deviceLabel })],
    };
  });
  if (!done) {
    const current = await conductNoticesRepository.findById(ctx.companyId, notice.id);
    return { answered: (current ? answeredOf(current) : null) ?? answered };
  }
  if (!body.confirmed) await tellWitnessUnconfirmed(ctx.companyId, notice);
  return { answered };
}

/** The issuer and HR (the Director when HR issued) are told once that the witness has not confirmed. */
export async function tellWitnessUnconfirmed(companyId: string, notice: ConductNotice): Promise<void> {
  const oversight = issuedByHr(notice) ? await directorUserIds(companyId) : await hrUserIds(companyId);
  const data = { level: LEVEL_LABELS[notice.level], number: noticeNumberLabel(notice.number), site: notice.siteName, noticeId: notice.id };
  await tellAbout([notice.issuerId, ...oversight], 'conduct.witness_unconfirmed', data, `conduct.witness_unconfirmed:${notice.id}`);
  nudgeUsers([notice.issuerId, ...oversight], 'workforce:needs-you');
}
