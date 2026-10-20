import { NotFoundError } from '../../../../utils/errors';
import { nairobiToday } from '../../_shared/time/nairobi-time';
import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { conductActor, roleName } from '../_shared/conduct-context';
import { validUntilOf } from '../_shared/conduct-dates';
import { suggestLevel } from '../_shared/conduct-ladder';
import { loadReadable } from '../_shared/conduct-load';
import { hasTimesheetFacts, LEVEL_LABELS, LEVEL_ORDER, type ConductLevel } from '../_shared/conduct-model';
import { conductNoticesRepository } from '../_shared/conduct-notices-repository';
import { conductPeopleRepository } from '../_shared/conduct-people-repository';
import { factsRepository } from '../letters/facts-repository';
import { defaultMonthKey, offeredMonths, selectFacts } from '../letters/facts-selection';
import { personForIssue } from './issue-service';
import type { DraftQuery } from './notices-validators';

export interface IssuePerson {
  id: string;
  name: string;
  department: string | null;
  employeeNumber: string;
  isMyTeam: boolean;
  hasLogin: boolean;
  activeNotices: { level: ConductLevel; validUntil: string }[];
}

/** Type-ahead for the Who field: 10 people at the caller's site (every site for HR), never the caller, never someone exited. */
export async function searchPeople(subject: AccessSubject, q: string, now: Date = new Date()): Promise<IssuePerson[]> {
  const ctx = await conductActor(subject, 'discipline.issue');
  const all = scopeOf(subject, 'discipline.issue') === 'all';
  const people = await conductPeopleRepository.searchPeople({ companyId: ctx.companyId, siteIds: all || !subject.siteId ? null : [subject.siteId], q, excludeUserId: subject.id, take: 10 });
  const mine = (await conductPeopleRepository.personByUserId(ctx.companyId, subject.id))?.employeeId ?? null;
  return Promise.all(
    people.map(async (person) => {
      const active = await conductNoticesRepository.activeForEmployee(ctx.companyId, person.employeeId, now);
      return {
        id: person.employeeId,
        name: person.name,
        department: person.department,
        employeeNumber: person.employeeNumber,
        isMyTeam: person.reportsToUserId === subject.id || (mine !== null && person.siteId === subject.siteId),
        hasLogin: person.userActive,
        activeNotices: active.map((n) => ({ level: n.level, validUntil: n.validUntil.toISOString().slice(0, 10) })),
      };
    }),
  );
}

export interface Draft {
  suggestedLevel: ConductLevel | null;
  finalAllowed: boolean;
  finalAlreadyActive: boolean;
  justIssued: boolean;
  hasLogin: boolean;
  facts: { kind: string; monthKey: string; count: number; minutes: number; days: { date: string; plannedIn: string | null; clockIn: string | null; minutesLate: number }[] } | null;
  months: string[];
  month: string;
  noFacts: boolean;
  validUntilByLevel: Record<ConductLevel, string>;
  ackDays: number;
  appealDays: number;
  levels: { level: ConductLevel; label: string; hasLetter: boolean }[];
}

/** What the issue panel needs once a person and a category are chosen (S9): the suggested level, the facts, the end dates. Reads only. */
export async function draftFor(subject: AccessSubject, query: DraftQuery, now: Date = new Date()): Promise<Draft> {
  const ctx = await conductActor(subject, 'discipline.issue');
  const person = await personForIssue(subject, ctx.companyId, query.personId);
  const active = await conductNoticesRepository.activeForEmployee(ctx.companyId, person.employeeId, now);
  const advice = suggestLevel(active);
  const today = nairobiToday(now);
  const month = query.month ?? defaultMonthKey(today.slice(0, 7));
  const facts = hasTimesheetFacts(query.about) ? selectFacts(query.about === 'LATENESS' ? 'LATENESS' : 'ABSENCE', month, await factsRepository.rowsForMonth({ siteId: person.siteId, employeeId: person.employeeId, monthKey: month })) : null;
  const rules = (await getEffectiveRuleGroup(person.siteId, today, 'CONDUCT')).values;
  const recent = await conductNoticesRepository.recentFor(ctx.companyId, person.employeeId, new Date(now.getTime() - 60_000));
  const ends: Record<ConductLevel, string> = { VERBAL_NOTE: '', WRITTEN_WARNING: '', FINAL_WRITTEN_WARNING: '' };
  for (const l of rules.levels) ends[l.level] = validUntilOf(now, l.validForMonths);
  return {
    suggestedLevel: advice.suggested,
    finalAllowed: advice.finalAllowed,
    finalAlreadyActive: advice.finalAlreadyActive,
    justIssued: recent !== null && recent.issuerId !== subject.id,
    hasLogin: person.userActive,
    facts: facts ? { kind: facts.kind, monthKey: facts.monthKey, count: facts.count, minutes: facts.minutes, days: facts.days.map((d) => ({ date: d.date, plannedIn: d.plannedIn, clockIn: d.clockIn, minutesLate: d.minutesLate })) } : null,
    months: offeredMonths(today.slice(0, 7)),
    month,
    noFacts: hasTimesheetFacts(query.about) && facts === null,
    validUntilByLevel: ends,
    ackDays: rules.acknowledgeWithinDays,
    appealDays: rules.appealWithinDays,
    levels: LEVEL_ORDER.map((level) => ({ level, label: LEVEL_LABELS[level], hasLetter: level !== 'VERBAL_NOTE' })),
  };
}

export interface WitnessOption {
  userId: string;
  name: string;
  roleLabel: string;
}

/** Colleagues at the notice's site who could stand as a witness: never the issuer and never the subject, with their role (S11). */
export async function witnessOptions(subject: AccessSubject, noticeId: string, q: string): Promise<WitnessOption[]> {
  const ctx = await conductActor(subject, 'discipline.issue');
  const { notice } = await loadReadable(subject, ctx.companyId, noticeId);
  if (notice.issuerId !== subject.id && scopeOf(subject, 'discipline.issue') !== 'all') throw new NotFoundError('We could not find that notice.', 'NOTICE_NOT_FOUND');
  const rows = await conductPeopleRepository.witnessCandidates({ companyId: ctx.companyId, siteId: notice.siteId, excludeUserIds: [notice.issuerId, ...(notice.personUserId ? [notice.personUserId] : [])], q, take: 10 });
  return rows.flatMap((row) => (row.userId ? [{ userId: row.userId, name: row.name, roleLabel: row.position?.name ?? roleName(row.user?.role ?? null) }] : []));
}
