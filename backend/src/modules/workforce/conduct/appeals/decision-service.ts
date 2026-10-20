import { ConflictError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { WorkforceEvent } from '../../_shared/events';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { daysBetween, nairobiDateOf, nairobiToday, toDateColumn } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { nudgeUsers } from '../../notifications';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { newVerifyCode } from '../_shared/conduct-codes';
import { conductActor, conductEntry, roleName, tellAbout, type ActorCtx } from '../_shared/conduct-context';
import { validUntilOf } from '../_shared/conduct-dates';
import { loadReadable, jobLabelOf, type LoadedNotice } from '../_shared/conduct-load';
import { hasLetter, LEVEL_LABELS, noticeNumberLabel, type ConductLevel, type DecisionOutcome } from '../_shared/conduct-model';
import { asJson, conductNoticesRepository, type ConductNotice } from '../_shared/conduct-notices-repository';
import type { FactsSnapshot } from '../_shared/conduct-snapshots';
import { buildLetter } from '../letters/letter-fill';
import type { DecisionBody } from '../notices/notices-validators';
import { assertMayDecide, planDecision, type DecisionPlan } from './decision-rules';
import { decisionsRepository } from './decisions-repository';

export interface DecisionResult {
  id: string;
  status: ConductNotice['status'];
  outcome: DecisionOutcome;
  newNoticeId: string | null;
  version: number;
  alreadyDecided: boolean;
}

export interface DecisionPreview {
  outcome: DecisionOutcome;
  from: ConductLevel;
  to: ConductLevel | null;
  /** Whole days from the appeal to today (null when nobody appealed). */
  daysTaken: number | null;
  endsOn: string | null;
  oldNotice: 'KEPT' | 'REPLACED' | 'WITHDRAWN';
}

const load = async (subject: AccessSubject, id: string): Promise<{ loaded: LoadedNotice; ctx: ActorCtx }> => {
  const ctx = await conductActor(subject, 'discipline.decide');
  return { loaded: await loadReadable(subject, ctx.companyId, id), ctx };
};

/** What a decision would do, for the dialog's key-value rows (S13). Reads only; nothing is written. */
export async function previewDecision(subject: AccessSubject, noticeId: string, outcome: DecisionOutcome, now: Date = new Date()): Promise<DecisionPreview> {
  const { loaded } = await load(subject, noticeId);
  const { notice } = loaded;
  assertMayDecide({ id: subject.id, role: subject.role }, notice);
  const plan = planDecision(notice, outcome);
  let endsOn: string | null = notice.validUntil.toISOString().slice(0, 10);
  if (plan.move === 'WITHDRAW') endsOn = null;
  if (plan.targetLevel) {
    const rules = (await getEffectiveRuleGroup(notice.siteId, nairobiToday(now), 'CONDUCT')).values;
    endsOn = validUntilOf(now, rules.levels.find((l) => l.level === plan.targetLevel)?.validForMonths ?? 3);
  }
  return {
    outcome,
    from: notice.level,
    to: plan.targetLevel,
    daysTaken: notice.appealedAt ? Math.max(0, daysBetween(nairobiDateOf(notice.appealedAt), nairobiToday(now))) : null,
    endsOn,
    oldNotice: plan.next === 'KEPT' ? 'KEPT' : plan.next === 'REPLACED' ? 'REPLACED' : 'WITHDRAWN',
  };
}

/** The replacing notice a reduction creates: same facts and own line, the lower level, a fresh clock, no receipt signing and no new appeal (C17). */
async function createReplacement(
  tx: Parameters<typeof conductNoticesRepository.create>[0],
  args: { old: ConductNotice; plan: DecisionPlan; loaded: LoadedNotice; deciderId: string; deciderName: string; deciderRole: string; key: string; now: Date },
): Promise<ConductNotice> {
  const { old, plan, loaded, now } = args;
  const target = plan.targetLevel as ConductLevel;
  const rules = (await getEffectiveRuleGroup(old.siteId, nairobiToday(now), 'CONDUCT')).values;
  const months = rules.levels.find((l) => l.level === target)?.validForMonths ?? old.validForMonths;
  const validUntil = validUntilOf(now, months);
  const facts = (old.factsSnapshot ?? null) as FactsSnapshot | null;
  const letter = hasLetter(target)
    ? buildLetter({
        level: target as Exclude<ConductLevel, 'VERBAL_NOTE'>,
        about: old.about,
        personName: loaded.person.name,
        personRole: jobLabelOf(loaded.person),
        siteName: old.siteName,
        issuerName: args.deciderName,
        issuerRole: args.deciderRole,
        facts,
        ownLine: old.ownLine,
        issuedAt: now,
        validUntil,
        appealDays: 0,
        appealBy: null,
        reducedFromFinalAt: old.level === 'FINAL_WRITTEN_WARNING' ? now : null,
      })
    : null;
  return conductNoticesRepository.create(tx, {
    companyId: old.companyId,
    siteId: old.siteId,
    siteName: old.siteName,
    employeeId: old.employeeId,
    personUserId: old.personUserId,
    issuerId: args.deciderId,
    issuerName: args.deciderName,
    issuerRole: args.deciderRole,
    level: target,
    about: old.about,
    number: hasLetter(target) ? await conductNoticesRepository.nextNumber(tx) : null,
    verifyCode: newVerifyCode(),
    letterVersion: letter?.letterVersion ?? 'verbal',
    ...(letter ? { letterSnapshot: asJson(letter) } : {}),
    ...(facts ? { factsSnapshot: asJson(facts) } : {}),
    ownLine: old.ownLine,
    issuedAt: now,
    ackDays: 0,
    appealDays: 0,
    validForMonths: months,
    validUntil: toDateColumn(validUntil),
    status: 'RECORDED',
    replacesNoticeId: old.id,
    idempotencyKey: `decision:${args.key}`,
  });
}

/**
 * HR decides an appeal, or changes a notice with none (S13, C19). Keep, Reduce (a new linked notice; the old letter gains a decision
 * page as version 2, never edited) or Withdraw. HR decides what managers issued; the Director decides what HR issued; nobody decides
 * their own. The issuer's PIN signs it. Two deciders at once: the compare-and-set lets one win, the other gets 409 ALREADY_DECIDED.
 */
export async function decideNotice(subject: AccessSubject, noticeId: string, body: DecisionBody, deviceLabel: string | null, now: Date = new Date()): Promise<DecisionResult> {
  const actor = await conductActor(subject, 'discipline.decide');
  const prior = await decisionsRepository.byKey(subject.id, body.idempotencyKey);
  if (prior && prior.noticeId === noticeId) {
    const current = await conductNoticesRepository.findById(actor.companyId, noticeId);
    return { id: noticeId, status: current?.status ?? 'KEPT', outcome: prior.outcome as DecisionOutcome, newNoticeId: prior.newNoticeId, version: prior.version, alreadyDecided: true };
  }
  const { loaded, ctx } = await load(subject, noticeId);
  const { companyId, name } = ctx;
  const { notice } = loaded;
  assertMayDecide({ id: subject.id, role: subject.role }, notice);
  const plan = planDecision(notice, body.outcome);
  await verifySignerPin(subject.id, body.pin, now.getTime());

  const version = notice.documentVersion + 1;
  const deciderRole = roleName(subject.role);
  const event: WorkforceEvent = { name: 'conduct.appeal_decided', payload: { siteId: notice.siteId, appealId: notice.id, employeeId: notice.employeeId }, occurredAt: now.toISOString() };

  const decided = await runAudited<{ updated: ConductNotice; replacement: ConductNotice | null } | null>(async (tx) => {
    const updated = await conductNoticesRepository.transition(tx, companyId, notice.id, [notice.status], plan.next, { decidedAt: now, documentVersion: version });
    if (!updated) return { result: null, entries: [] };
    const replacement = plan.move === 'REDUCE' ? await createReplacement(tx, { old: notice, plan, loaded, deciderId: subject.id, deciderName: name, deciderRole, key: body.idempotencyKey, now }) : null;
    const linked = replacement ? ((await conductNoticesRepository.patch(tx, companyId, notice.id, {}, { replacedById: replacement.id })) ?? updated) : updated;
    await decisionsRepository.create(tx, { noticeId: notice.id, version, outcome: body.outcome, viaAppeal: plan.viaAppeal, reason: body.reason, decidedById: subject.id, decidedByName: name, decidedByRole: deciderRole, decidedAt: now, newNoticeId: replacement?.id ?? null, idempotencyKey: body.idempotencyKey });
    await conductNoticesRepository.addEvent(tx, { noticeId: notice.id, at: now, kind: plan.viaAppeal ? 'DECIDED' : 'CHANGED', actor: { id: subject.id, name, role: deciderRole }, payload: { outcome: body.outcome, version, newNoticeId: replacement?.id ?? null } });
    if (replacement) await conductNoticesRepository.addEvent(tx, { noticeId: replacement.id, at: now, kind: 'ISSUED', actor: { id: subject.id, name, role: deciderRole }, payload: { level: replacement.level, number: replacement.number, replaces: notice.id } });
    return {
      result: { updated: linked, replacement },
      entries: [
        conductEntry({
          ctx,
          siteId: notice.siteId,
          action: plan.viaAppeal ? 'conduct.decided' : 'conduct.changed_by_hr',
          noticeId: notice.id,
          subjectUserId: notice.personUserId,
          after: { number: noticeNumberLabel(notice.number), outcome: body.outcome, from: notice.status, to: plan.next, newNumber: replacement ? noticeNumberLabel(replacement.number) : null },
          reason: body.reason,
          deviceLabel,
        }),
      ],
      ...(plan.viaAppeal ? { events: [event] } : {}),
    };
  });
  if (!decided) {
    const status = (await conductNoticesRepository.findById(companyId, notice.id))?.status ?? notice.status;
    const settled = status === 'KEPT' || status === 'REPLACED' || status === 'WITHDRAWN';
    throw new ConflictError(settled ? 'This was just decided. Nothing was changed.' : 'This notice changed a moment ago.', settled ? 'ALREADY_DECIDED' : 'INVALID_TRANSITION', { status });
  }
  await tellOnDecision(notice, plan);
  return { id: notice.id, status: decided.updated.status, outcome: body.outcome, newNoticeId: decided.replacement?.id ?? null, version, alreadyDecided: false };
}

/** The person and the issuer are told by role; the reason is read inside the notice, never in the push or the lock screen (C27). */
async function tellOnDecision(notice: ConductNotice, plan: DecisionPlan): Promise<void> {
  const data = { level: LEVEL_LABELS[notice.level], number: noticeNumberLabel(notice.number), outcome: plan.move === 'KEEP' ? 'kept' : plan.move === 'WITHDRAW' ? 'withdrawn' : 'reduced', site: notice.siteName, noticeId: notice.id };
  const kind = plan.viaAppeal ? 'conduct.appeal_decided' : 'conduct.changed';
  await tellAbout([notice.personUserId], kind, data);
  await tellAbout([notice.issuerId], plan.viaAppeal ? 'conduct.appeal_decided_issuer' : 'conduct.changed_issuer', data);
  nudgeUsers([...(notice.personUserId ? [notice.personUserId] : []), notice.issuerId], 'workforce:needs-you');
}
