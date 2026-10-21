import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { nairobiToday, toDateColumn } from '../../_shared/time/nairobi-time';
import { inScope, type AccessSubject } from '../../_shared/workforce-access';
import { switchRepository } from '../../attendance/switch/switch-repository';
import { nudgeUsers } from '../../notifications';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { conductActor, conductEntry, directorUserIds, hrUserIds, roleName, tellAbout } from '../_shared/conduct-context';
import { newVerifyCode } from '../_shared/conduct-codes';
import { jobLabelOf } from '../_shared/conduct-load';
import { appealDeadline, validUntilOf } from '../_shared/conduct-dates';
import { hasLetter, hasTimesheetFacts, LEVEL_LABELS, noticeNumberLabel, type ConductLevel } from '../_shared/conduct-model';
import { asJson, conductNoticesRepository, type ConductNotice } from '../_shared/conduct-notices-repository';
import { conductPeopleRepository, type ConductPerson } from '../_shared/conduct-people-repository';
import type { FactsSnapshot } from '../_shared/conduct-snapshots';
import { factsRepository } from '../letters/facts-repository';
import { defaultMonthKey, selectFacts } from '../letters/facts-selection';
import { buildLetter } from '../letters/letter-fill';
import { assertLevelAllowed } from './issue-rules';
import type { IssueBody } from './notices-validators';

export interface IssuedNotice {
  id: string;
  number: string | null;
  level: ConductLevel;
  status: ConductNotice['status'];
}

const issuedView = (notice: ConductNotice): IssuedNotice => ({ id: notice.id, number: noticeNumberLabel(notice.number), level: notice.level, status: notice.status });

/** Looks the person up and refuses the cases a manager may not issue to. Out of scope answers 404; the caller themself answers 403. */
export async function personForIssue(subject: AccessSubject, companyId: string, personId: string): Promise<ConductPerson> {
  const person = await conductPeopleRepository.personById(companyId, personId);
  if (!person || person.status === 'EXITED') throw new NotFoundError('We could not find that person.', 'PERSON_NOT_FOUND');
  if (!inScope(subject, 'discipline.issue', { userId: person.userId, siteId: person.siteId, userRole: person.role })) throw new NotFoundError('We could not find that person.', 'PERSON_NOT_FOUND');
  if (person.userId !== null && person.userId === subject.id) throw new ForbiddenError('Nobody issues a notice to themself.', 'ISSUE_NOT_ALLOWED');
  if (!(await switchRepository.isEnabled(person.siteId))) throw new ConflictError('This site records conduct in the old HR screen until its new clock is switched on.', 'CONDUCT_NOT_ENABLED');
  return person;
}

/** The facts for a Lateness or Absence notice, or 422 NO_FACTS (the screen says "No unexcused lateness in {month}"). */
export async function factsFor(person: ConductPerson, about: IssueBody['about'], month: string | undefined, now: Date): Promise<FactsSnapshot | null> {
  if (!hasTimesheetFacts(about)) return null;
  const monthKey = month ?? defaultMonthKey(nairobiToday(now).slice(0, 7));
  const rows = await factsRepository.rowsForMonth({ siteId: person.siteId, employeeId: person.employeeId, monthKey });
  const facts = selectFacts(about === 'LATENESS' ? 'LATENESS' : 'ABSENCE', monthKey, rows);
  if (!facts) throw new AppError(422, 'NO_FACTS', `There are no unexcused days in ${monthKey}. Choose another month or add your own line.`, { monthKey });
  return facts;
}

/**
 * Issues a warning notice (S9): checks the person, the ladder and the facts, takes the issuer's PIN, then in ONE transaction takes
 * a lock on the person, re-checks the ladder, numbers the letter, freezes it, and writes the audit entry last. A retry with the same
 * idempotency key returns the first notice. Two managers issuing together: the second sees the first's notice in the ladder.
 */
export async function issueNotice(subject: AccessSubject, body: IssueBody, deviceLabel: string | null, now: Date = new Date()): Promise<IssuedNotice> {
  const ctx = await conductActor(subject, 'discipline.issue');
  const prior = await conductNoticesRepository.findByIdempotency(subject.id, body.idempotencyKey);
  if (prior) {
    if (prior.employeeId !== body.personId) throw new ConflictError('That request key was used for another notice.', 'IDEMPOTENCY_KEY_REUSED');
    return issuedView(prior);
  }
  const person = await personForIssue(subject, ctx.companyId, body.personId);
  assertLevelAllowed(await conductNoticesRepository.activeForEmployee(ctx.companyId, person.employeeId, now), body.level);
  const facts = await factsFor(person, body.about, body.factsMonth, now);
  const rules = (await getEffectiveRuleGroup(person.siteId, nairobiToday(now), 'CONDUCT')).values;
  const levelRule = rules.levels.find((l) => l.level === body.level);
  if (!levelRule) throw new ConflictError('The Rules have no entry for this level.', 'LEVEL_NOT_IN_RULES');
  await verifySignerPin(subject.id, body.pin, now.getTime());

  const validUntil = validUntilOf(now, levelRule.validForMonths);
  const issuerRole = roleName(subject.role);
  const letter = hasLetter(body.level)
    ? buildLetter({
        level: body.level as Exclude<ConductLevel, 'VERBAL_NOTE'>,
        about: body.about,
        personName: person.name,
        personRole: jobLabelOf(person),
        siteName: person.siteName,
        issuerName: ctx.name,
        issuerRole,
        facts,
        ownLine: body.ownLine,
        issuedAt: now,
        validUntil,
        appealDays: rules.appealWithinDays,
        appealBy: appealDeadline(now, rules.appealWithinDays),
        reducedFromFinalAt: null,
      })
    : null;

  let notice: ConductNotice;
  try {
    notice = await runAudited<ConductNotice>(async (tx) => {
      await conductNoticesRepository.lockPerson(tx, person.employeeId);
      assertLevelAllowed(await conductNoticesRepository.activeForEmployee(ctx.companyId, person.employeeId, now, tx), body.level);
      const number = hasLetter(body.level) ? await conductNoticesRepository.nextNumber(tx) : null;
      const created = await conductNoticesRepository.create(tx, {
        companyId: ctx.companyId,
        siteId: person.siteId,
        siteName: person.siteName,
        employeeId: person.employeeId,
        personUserId: person.userActive ? person.userId : null,
        issuerId: subject.id,
        issuerName: ctx.name,
        issuerRole,
        level: body.level,
        about: body.about,
        number,
        verifyCode: newVerifyCode(),
        letterVersion: letter?.letterVersion ?? 'verbal',
        ...(letter ? { letterSnapshot: asJson(letter) } : {}),
        ...(facts ? { factsSnapshot: asJson(facts) } : {}),
        ownLine: body.ownLine,
        issuedAt: now,
        ackDays: rules.acknowledgeWithinDays,
        appealDays: rules.appealWithinDays,
        validForMonths: levelRule.validForMonths,
        validUntil: toDateColumn(validUntil),
        status: hasLetter(body.level) ? 'ISSUED' : 'RECORDED',
        idempotencyKey: body.idempotencyKey,
      });
      await conductNoticesRepository.addEvent(tx, { noticeId: created.id, at: now, kind: 'ISSUED', actor: { id: subject.id, name: ctx.name, role: issuerRole }, payload: { level: body.level, number } });
      return {
        result: created,
        entries: [conductEntry({ ctx, siteId: person.siteId, action: 'conduct.issued', noticeId: created.id, subjectUserId: person.userId, after: { level: body.level, about: body.about, number, status: created.status, hasLogin: person.userActive }, deviceLabel })],
      };
    });
  } catch (error) {
    const raced = isUniqueViolation(error) ? await conductNoticesRepository.findByIdempotency(subject.id, body.idempotencyKey) : null;
    if (raced) return issuedView(raced);
    throw error;
  }
  await tellOnIssue(subject, ctx.companyId, notice, person, issuerRole);
  return issuedView(notice);
}

const isUniqueViolation = (error: unknown): boolean => typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';

/** The person is asked to sign; HR is told (the Director too when HR issued). The push never names the reason (C27). */
async function tellOnIssue(subject: AccessSubject, companyId: string, notice: ConductNotice, person: ConductPerson, issuerRole: string): Promise<void> {
  const data = { level: LEVEL_LABELS[notice.level], number: noticeNumberLabel(notice.number), issuerRole, personRole: jobLabelOf(person), site: person.siteName, noticeId: notice.id };
  const issuedByHr = subject.role === 'HR_MANAGER';
  const oversight = issuedByHr ? await directorUserIds(companyId) : await hrUserIds(companyId);
  await tellAbout([notice.personUserId], notice.level === 'VERBAL_NOTE' ? 'conduct.verbal_recorded' : 'conduct.issued', data);
  await tellAbout(oversight.filter((id) => id !== subject.id), 'conduct.issued_oversight', data);
  nudgeUsers([...(notice.personUserId ? [notice.personUserId] : []), ...oversight], 'workforce:needs-you');
}
