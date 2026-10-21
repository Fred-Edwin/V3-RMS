import { ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { WorkforceEvent } from '../../_shared/events';
import type { AccessSubject } from '../../_shared/workforce-access';
import { nudgeUsers } from '../../notifications';
import { conductActor, conductEntry, directorUserIds, hrUserIds, issuedByHr, roleName, tellAbout, type ActorCtx } from '../_shared/conduct-context';
import { appealDeadline, decisionDueBy } from '../_shared/conduct-dates';
import { jobLabelOf } from '../_shared/conduct-load';
import { HR_DECISION_DAYS, LEVEL_LABELS, noticeNumberLabel } from '../_shared/conduct-model';
import { conductNoticesRepository, type ConductNotice } from '../_shared/conduct-notices-repository';
import { indexNotice } from '../documents/notice-index';
import { conductPeopleRepository } from '../_shared/conduct-people-repository';
import { APPEALABLE_STATUSES } from '../_shared/conduct-status';
import type { AppealBody } from '../notices/notices-validators';

export interface AppealResult {
  id: string;
  status: ConductNotice['status'];
  appealedAt: string;
  decisionDueBy: string;
  alreadySent: boolean;
}

const resultOf = (notice: ConductNotice, alreadySent: boolean): AppealResult => ({
  id: notice.id,
  status: notice.status,
  appealedAt: (notice.appealedAt ?? new Date()).toISOString(),
  decisionDueBy: (notice.appealDecisionDueBy ?? new Date()).toISOString(),
  alreadySent,
});

async function ownNotice(ctx: ActorCtx, subject: AccessSubject, id: string): Promise<ConductNotice> {
  const notice = await conductNoticesRepository.findById(ctx.companyId, id);
  if (!notice || notice.personUserId === null || notice.personUserId !== subject.id) throw new NotFoundError('We could not find that notice.', 'NOTICE_NOT_FOUND');
  return notice;
}

/** Whether an earlier APPEALED event carries this request key (a double tap or a retry returns the first answer, spec section 9). */
async function sentWithKey(noticeId: string, key: string): Promise<boolean> {
  const events = await conductNoticesRepository.eventsOf(noticeId);
  return events.some((event) => event.kind === 'APPEALED' && (event.payload as { key?: string } | null)?.key === key);
}

/**
 * The staff member appeals their own notice to HR (S6). One appeal per notice; never on a notice a reduction created; inside the
 * appeal days (23:59 Nairobi on the Nth day after issue), signed or not. The notice stands until HR (or the Director, for a notice HR
 * issued) decides. No PIN: an appeal is the person's own act inside their own login (C15, logged for the owner).
 */
export async function appealNotice(subject: AccessSubject, noticeId: string, body: AppealBody, deviceLabel: string | null, now: Date = new Date()): Promise<AppealResult> {
  const ctx = await conductActor(subject, 'discipline.read_own');
  const notice = await ownNotice(ctx, subject, noticeId);
  if (notice.appealedAt) {
    if (await sentWithKey(notice.id, body.idempotencyKey)) return resultOf(notice, true);
    throw new ConflictError('You have already appealed this notice.', 'ALREADY_APPEALED');
  }
  if (notice.replacesNoticeId !== null || notice.appealDays <= 0 || !APPEALABLE_STATUSES.includes(notice.status)) {
    throw new ConflictError('This notice cannot be appealed.', 'NOT_APPEALABLE', { status: notice.status });
  }
  const closes = appealDeadline(notice.issuedAt, notice.appealDays);
  if (now > closes) throw new ConflictError('The days to appeal have ended. Speak to HR.', 'APPEAL_WINDOW_CLOSED', { closedAt: closes.toISOString() });

  const dueBy = decisionDueBy(now, HR_DECISION_DAYS);
  const event: WorkforceEvent = { name: 'conduct.appeal_sent', payload: { siteId: notice.siteId, appealId: notice.id, employeeId: notice.employeeId }, occurredAt: now.toISOString() };
  const sent = await runAudited<ConductNotice | null>(async (tx) => {
    const updated = await conductNoticesRepository.transition(tx, ctx.companyId, notice.id, APPEALABLE_STATUSES, 'APPEALED', {
      appealedAt: now,
      appealReasonKey: body.reasonKey,
      appealText: body.text,
      appealDecisionDueBy: dueBy,
    });
    if (!updated) return { result: null, entries: [] };
    await indexNotice(tx, updated);
    await conductNoticesRepository.addEvent(tx, { noticeId: notice.id, at: now, kind: 'APPEALED', actor: { id: subject.id, name: ctx.name, role: roleName(subject.role) }, payload: { key: body.idempotencyKey, reasonKey: body.reasonKey } });
    return {
      result: updated,
      entries: [conductEntry({ ctx, siteId: notice.siteId, action: 'conduct.appealed', noticeId: notice.id, subjectUserId: notice.personUserId, after: { number: noticeNumberLabel(notice.number), reasonKey: body.reasonKey }, reason: body.text, deviceLabel })],
      events: [event],
    };
  });
  if (!sent) {
    const current = await conductNoticesRepository.findById(ctx.companyId, notice.id);
    if (current?.appealedAt && (await sentWithKey(current.id, body.idempotencyKey))) return resultOf(current, true);
    if (current?.appealedAt) throw new ConflictError('You have already appealed this notice.', 'ALREADY_APPEALED');
    throw new ConflictError('This notice changed a moment ago.', 'NOT_APPEALABLE', { status: current?.status ?? notice.status });
  }
  await tellOnAppeal(ctx.companyId, sent);
  return resultOf(sent, false);
}

/** HR is told (the Director when HR issued) and the issuer is told. The reason text stays inside the notice (C27). */
async function tellOnAppeal(companyId: string, notice: ConductNotice): Promise<void> {
  const person = await conductPeopleRepository.personById(companyId, notice.employeeId);
  const deciders = issuedByHr(notice) ? await directorUserIds(companyId) : await hrUserIds(companyId);
  const data = { level: LEVEL_LABELS[notice.level], number: noticeNumberLabel(notice.number), personRole: person ? jobLabelOf(person) : 'Staff', site: notice.siteName, noticeId: notice.id };
  await tellAbout(deciders, 'conduct.appeal_sent', data);
  await tellAbout([notice.issuerId], 'conduct.appeal_sent_issuer', data);
  nudgeUsers([...deciders, notice.issuerId], 'workforce:needs-you');
}
