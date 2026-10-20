import { NotFoundError } from '../../../../utils/errors';
import { scopeOf, workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { decisionsRepository, type ConductDecision } from '../appeals/decisions-repository';
import { outcomesFor } from '../appeals/decision-rules';
import { datesNamedInText } from '../appeals/named-dates';
import { conductActor } from '../_shared/conduct-context';
import { overdueDays, recordableFrom } from '../_shared/conduct-dates';
import { dayMonthYear, shortDayTime } from '../_shared/conduct-format';
import { jobLabelOf, loadReadable } from '../_shared/conduct-load';
import { ABOUT_LABELS, appealReasonLabel, hasLetter, LEVEL_LABELS, noticeNumberLabel, type AppealReasonKey } from '../_shared/conduct-model';
import type { ConductNotice } from '../_shared/conduct-notices-repository';
import { conductPeopleRepository } from '../_shared/conduct-people-repository';
import { isSubject } from '../_shared/conduct-scope';
import type { FactsSnapshot } from '../_shared/conduct-snapshots';
import { verbalNoteLine } from '../letters/letter-fill';
import { effectiveStatus, staffStatusWord, STATUS_WORDS, subjectActions, titleOf } from './notice-view';
import { buildSteps, type DecisionLine, type NoticeStep } from './steps';

export interface StaffDetail {
  view: 'STAFF';
  id: string;
  title: string;
  level: string;
  number: string | null;
  aboutLabel: string;
  issuerRole: string;
  issuedAt: string;
  status: string;
  statusWord: string;
  factsLine: string | null;
  verbalLine: string | null;
  ackDays: number;
  appealDays: number;
  validUntil: string;
  steps: NoticeStep[];
  actions: { canSign: boolean; canAppeal: boolean; canDownload: boolean; downloadVersion: number };
  appeal: { appealedAt: string; reasonLabel: string; text: string } | null;
  decision: { outcome: string; reason: string; decidedAt: string; decidedByLabel: 'HR' | 'Director' } | null;
  replacedById: string | null;
  replacesNoticeId: string | null;
}

export interface DeskDetail {
  view: 'DESK';
  id: string;
  personId: string;
  personName: string;
  jobLabel: string;
  siteName: string;
  title: string;
  level: string;
  number: string | null;
  aboutLabel: string;
  issuedAt: string;
  issuerLabel: string;
  status: string;
  statusWord: string;
  ownLine: string;
  verbalLine: string | null;
  facts: { kind: string; monthKey: string; count: number; minutes: number; rows: { date: string; plannedIn: string | null; clockIn: string | null; minutesLate: number; excused: boolean; named: boolean }[] } | null;
  checkedForYou: string[];
  signedLine: string;
  appealLine: string;
  witness: { askedAt: string; state: 'WAITING' | 'CONFIRMED' | 'DECLINED' | 'NOT_CONFIRMED' } | null;
  appeal: { appealedAt: string; reasonKey: string; reasonLabel: string; text: string; dueBy: string; overdueDays: number } | null;
  decisions: { version: number; outcome: string; reason: string; decidedAt: string; decidedBy: string }[];
  validUntil: string;
  months: number;
  version: number;
  actions: { canRecordNotSigned: boolean; recordableFrom: string | null; canDecide: boolean; outcomes: string[]; canChange: boolean; canOpenAsIssued: boolean };
  updatedAt: string;
}

const decisionLine = (decision: ConductDecision | undefined): DecisionLine | null => (decision ? { outcome: decision.outcome as DecisionLine['outcome'], decidedAt: decision.decidedAt } : null);

function signedLine(notice: ConductNotice, personName: string, witnessName: string | null): string {
  if (!hasLetter(notice.level)) return 'No letter: recorded on the file';
  if (notice.signedAt) return `Signed by ${personName}, ${shortDayTime(notice.signedAt)}${notice.notSignedRecordedAt ? ' (late)' : ''}`;
  if (notice.notSignedRecordedAt) return `Given, not signed. Recorded ${shortDayTime(notice.notSignedRecordedAt)}${witnessName ? `, witness ${witnessName}` : ''}`;
  return `Not yet. Asked ${shortDayTime(notice.issuedAt)}`;
}

async function staffDetail(notice: ConductNotice, now: Date): Promise<StaffDetail> {
  const decisions = await decisionsRepository.forNotice(notice.id);
  const latest = decisions[decisions.length - 1];
  const status = effectiveStatus(notice, now);
  const facts = notice.factsSnapshot as FactsSnapshot | null;
  const actions = subjectActions(notice, now);
  return {
    view: 'STAFF',
    id: notice.id,
    title: titleOf(notice),
    level: notice.level,
    number: noticeNumberLabel(notice.number),
    aboutLabel: ABOUT_LABELS[notice.about],
    issuerRole: notice.issuerRole,
    issuedAt: notice.issuedAt.toISOString(),
    status,
    statusWord: staffStatusWord(status),
    factsLine: facts ? `${facts.count} days, ${facts.minutes} minutes in total: ${facts.days.map((d) => Number(d.date.slice(8, 10))).join(', ')}. Your timesheets are attached.` : null,
    verbalLine: hasLetter(notice.level) ? null : verbalNoteLine(notice.issuedAt, notice.issuerRole, notice.ownLine),
    ackDays: notice.ackDays,
    appealDays: notice.appealDays,
    validUntil: notice.validUntil.toISOString().slice(0, 10),
    steps: buildSteps(notice, decisionLine(latest), now),
    actions: { ...actions, downloadVersion: notice.documentVersion },
    appeal: notice.appealedAt ? { appealedAt: notice.appealedAt.toISOString(), reasonLabel: appealReasonLabel((notice.appealReasonKey ?? 'OTHER') as AppealReasonKey, notice.about), text: notice.appealText ?? '' } : null,
    decision: latest ? { outcome: latest.outcome, reason: latest.reason, decidedAt: latest.decidedAt.toISOString(), decidedByLabel: latest.decidedByRole === 'Director' ? 'Director' : 'HR' } : null,
    replacedById: notice.replacedById,
    replacesNoticeId: notice.replacesNoticeId,
  };
}

async function deskDetail(subject: AccessSubject, notice: ConductNotice, personName: string, jobLabel: string, now: Date): Promise<DeskDetail> {
  const decisions = await decisionsRepository.forNotice(notice.id);
  const status = effectiveStatus(notice, now);
  const facts = notice.factsSnapshot as FactsSnapshot | null;
  const named = notice.appealText && facts ? datesNamedInText(notice.appealText, facts.monthKey) : [];
  const witness = notice.witnessId ? (await conductPeopleRepository.usersByIds([notice.witnessId]))[0] : undefined;
  const witnessState = !notice.witnessId ? null : notice.witnessConfirmedAt ? 'CONFIRMED' : notice.witnessDeclinedAt ? 'DECLINED' : notice.witnessAskedAt && now.getTime() - notice.witnessAskedAt.getTime() > 3 * 86_400_000 ? 'NOT_CONFIRMED' : 'WAITING';
  const mayDecide = workforceCan(subject, 'discipline.decide') && outcomesFor({ status: notice.status, level: notice.level }).length > 0 && notice.issuerId !== subject.id && notice.personUserId !== subject.id && (subject.role === 'DIRECTOR') === (notice.issuerRole === 'HR');
  const opensAt = hasLetter(notice.level) ? recordableFrom(notice.issuedAt, notice.ackDays) : null;
  const mayRecord = (notice.issuerId === subject.id || scopeOf(subject, 'discipline.issue') === 'all') && notice.status === 'ISSUED' && !notice.signedAt;
  const decidedBy = decisions.map((d) => `${d.decidedByName}, ${d.decidedByRole}`);
  return {
    view: 'DESK',
    id: notice.id,
    personId: notice.employeeId,
    personName,
    jobLabel,
    siteName: notice.siteName,
    title: `${personName} · ${LEVEL_LABELS[notice.level]}`,
    level: notice.level,
    number: noticeNumberLabel(notice.number),
    aboutLabel: ABOUT_LABELS[notice.about],
    issuedAt: notice.issuedAt.toISOString(),
    issuerLabel: `${notice.issuerName}, ${notice.issuerRole}`,
    status,
    statusWord: STATUS_WORDS[status],
    ownLine: notice.ownLine,
    verbalLine: hasLetter(notice.level) ? null : verbalNoteLine(notice.issuedAt, notice.issuerRole, notice.ownLine),
    facts: facts ? { kind: facts.kind, monthKey: facts.monthKey, count: facts.count, minutes: facts.minutes, rows: facts.days.map((d) => ({ date: d.date, plannedIn: d.plannedIn, clockIn: d.clockIn, minutesLate: d.minutesLate, excused: d.excused, named: named.includes(d.date) })) } : null,
    checkedForYou: facts ? [facts.days.every((d) => !d.excused) ? `None of these ${facts.kind === 'LATENESS' ? 'arrivals' : 'absences'} was excused.` : 'Some days were excused.'] : [],
    signedLine: signedLine(notice, personName, witness ? `${witness.name}, ${witness.role}` : null),
    appealLine: notice.appealedAt ? `Appealed ${shortDayTime(notice.appealedAt)}` : notice.appealDays > 0 ? 'None' : 'No appeal on this notice',
    witness: notice.witnessId && notice.witnessAskedAt ? { askedAt: notice.witnessAskedAt.toISOString(), state: witnessState ?? 'WAITING' } : null,
    appeal: notice.appealedAt
      ? { appealedAt: notice.appealedAt.toISOString(), reasonKey: notice.appealReasonKey ?? 'OTHER', reasonLabel: appealReasonLabel((notice.appealReasonKey ?? 'OTHER') as AppealReasonKey, notice.about), text: notice.appealText ?? '', dueBy: (notice.appealDecisionDueBy ?? now).toISOString(), overdueDays: notice.appealDecisionDueBy && notice.status === 'APPEALED' ? overdueDays(notice.appealDecisionDueBy, now) : 0 }
      : null,
    decisions: decisions.map((d, i) => ({ version: d.version, outcome: d.outcome, reason: d.reason, decidedAt: d.decidedAt.toISOString(), decidedBy: decidedBy[i] ?? '' })),
    validUntil: dayMonthYear(notice.validUntil),
    months: notice.validForMonths,
    version: notice.documentVersion,
    actions: {
      canRecordNotSigned: mayRecord && hasLetter(notice.level),
      recordableFrom: opensAt && notice.personUserId !== null ? opensAt.toISOString() : null,
      canDecide: mayDecide && notice.status === 'APPEALED',
      outcomes: mayDecide ? outcomesFor({ status: notice.status, level: notice.level }) : [],
      canChange: mayDecide && notice.status !== 'APPEALED',
      canOpenAsIssued: subject.role === 'HR_MANAGER' || subject.role === 'DIRECTOR' || notice.issuerId === subject.id,
    },
    updatedAt: notice.updatedAt.toISOString(),
  };
}

/**
 * One notice (S2 for the person, S8/S12 for managers, HR and the Director). The person gets the stepper, their own appeal and the
 * decision with "HR" as the decider (never the name); readers get the facts, the own line, the appeal block and the actions they may
 * take. A notice outside the reader's scope is 404. Nothing here changes data.
 */
export async function noticeDetail(subject: AccessSubject, noticeId: string, now: Date = new Date()): Promise<StaffDetail | DeskDetail> {
  const ctx = await conductActor(subject, workforceCan(subject, 'discipline.read') ? 'discipline.read' : 'discipline.read_own');
  const { notice, person } = await loadReadable(subject, ctx.companyId, noticeId);
  if (isSubject(subject, notice)) return staffDetail(notice, now);
  if (!workforceCan(subject, 'discipline.read')) throw new NotFoundError('We could not find that notice.', 'NOTICE_NOT_FOUND');
  return deskDetail(subject, notice, person.name, jobLabelOf(person), now);
}
