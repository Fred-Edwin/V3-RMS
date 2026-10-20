import type { Prisma } from '@prisma/client';
import { nairobiToday, type NairobiDate } from '../../_shared/time/nairobi-time';
import { applicationsRepository } from '../data/applications-repository';
import { ledgerRepository } from '../data/ledger-repository';
import { dbOf, type Db, type LeavePerson } from '../data/people-repository';
import { balanceOf, toneOf } from '../engine/leave-balance';
import { leaveYearOf, yearEnd, yearStart } from '../engine/leave-days';
import { entitlementFor, isLimited, perYearOf } from '../engine/leave-entitlement';
import type { LeaveRules, LeaveTypeRule, RulesAt, TypeBalance } from '../leave.types';
import { ensureCarryOver } from './carry-over';
import { datesNeeded, loadRulesAt } from './rules-loader';

/** A type the person may ask for, with what the request screen needs to know about it. */
export interface RequestableType {
  code: string;
  label: string;
  paid: boolean;
  /** Days left now; null for a type without a limit (unpaid). */
  left: number | null;
  requiresReason: boolean;
  approvedBy: 'MANAGER' | 'HR';
  sickNoteAfterDays: number | null;
  /** May a shortfall be sent as an unpaid tail? Not for unpaid, Maternity or Paternity (L12). */
  tailAllowed: boolean;
}

export interface PersonBalances {
  year: number;
  /** Casual workers (probation, no contract) have no leave until their contract starts: an empty, well-formed answer. */
  casual: boolean;
  cards: TypeBalance[];
  requestable: RequestableType[];
}

const EMPTY = (year: number, casual: boolean): PersonBalances => ({ year, casual, cards: [], requestable: [] });

/** The figure the bar is measured against: the whole year's grant (a joiner's prorated grant, a monthly type's full year). */
const fullYearFigure = (rules: LeaveRules, type: LeaveTypeRule, person: LeavePerson, year: number, rulesAt: RulesAt): number =>
  entitlementFor({ code: type.code, year, startDate: person.startDate, exitDate: person.exitedOn, asOf: yearEnd(year), rulesAt }) || (type.accrual === 'MONTHLY' ? 0 : perYearOf(rules, type));

/**
 * Balances for many people in one year (spec section 3). One rules lookup per distinct date and site, one ledger query, one query
 * for approved requests. `asOf` is the day the figures are read for (today for the current year, 31 December for a closed one).
 */
export async function computeBalances(people: readonly LeavePerson[], year: number, asOf: NairobiDate, today: NairobiDate, tx?: Prisma.TransactionClient): Promise<Map<string, PersonBalances>> {
  const db: Db = dbOf(tx);
  const result = new Map<string, PersonBalances>();
  const live = people.filter((person) => !person.isCasual && leaveYearOf(person.startDate) <= year && (person.exitedOn === null || leaveYearOf(person.exitedOn) >= year));
  for (const person of people) if (!live.includes(person)) result.set(person.id, EMPTY(year, person.isCasual));
  if (live.length === 0) return result;

  const rulesBySite = new Map<string, RulesAt>();
  for (const siteId of new Set(live.map((person) => person.siteId))) {
    const starts = live.filter((person) => person.siteId === siteId).map((person) => person.startDate);
    rulesBySite.set(siteId, await loadRulesAt(siteId, datesNeeded(year, asOf, starts)));
  }
  const rulesAtOf = (siteId: string): RulesAt => rulesBySite.get(siteId) as RulesAt;

  await ensureCarryOver({ people: live, year, rulesAtOf, db, closingOf: (group, previous) => closingBalances(group, previous, today, tx) });

  const ids = live.map((person) => person.id);
  const [ledger, approved] = await Promise.all([ledgerRepository.forYear(db, ids, year), applicationsRepository.approvedInYear(db, ids, year)]);

  for (const person of live) {
    const rulesAt = rulesAtOf(person.siteId);
    const rules = rulesAt(asOf);
    const mine = ledger.filter((line) => line.employeeId === person.id);
    const cards: TypeBalance[] = [];
    const requestable: RequestableType[] = [];
    for (const type of rules.leaveTypes) {
      const lines = mine.filter((line) => line.typeCode === type.code).map((line) => ({ kind: line.kind, days: line.days, asOf: line.asOf }));
      const opening = lines.find((line) => line.kind === 'OPENING');
      const entitlement = entitlementFor({ code: type.code, year, startDate: person.startDate, exitDate: person.exitedOn, asOf, rulesAt, openingMonth: opening ? Number(opening.asOf.slice(5, 7)) : null });
      const own = approved.filter((app) => app.employeeId === person.id && app.typeCode === type.code).map((app) => ({ start: app.start, end: app.end, days: app.days, unpaidTailDays: app.unpaidTailDays }));
      const figures = balanceOf({ year, today, entitlement, ledger: lines, approved: own });
      const limited = isLimited(type);
      const perYear = limited ? Math.max(fullYearFigure(rules, type, person, year, rulesAt), figures.credited) : null;
      const showCard = limited && (type.accrual === 'PER_EVENT' ? figures.credited > 0 : (perYear ?? 0) > 0 || figures.credited > 0);
      if (showCard) {
        cards.push({
          typeCode: type.code, label: type.label, paid: type.paid, perYear,
          credited: figures.credited, taken: figures.taken, booked: figures.booked, left: figures.left,
          tone: toneOf(figures.left, perYear),
          builds: type.accrual === 'MONTHLY' && type.perMonthDays ? { perMonth: type.perMonthDays } : null,
        });
      }
      const askable = !limited || type.accrual !== 'PER_EVENT' || figures.left > 0;
      if (askable) {
        requestable.push({
          code: type.code, label: type.label, paid: type.paid, left: limited ? figures.left : null,
          requiresReason: type.requiresReason, approvedBy: type.approvedBy, sickNoteAfterDays: type.sickNoteAfterDays,
          tailAllowed: type.paid && type.accrual !== 'PER_EVENT',
        });
      }
    }
    result.set(person.id, { year, casual: false, cards, requestable });
  }
  return result;
}

/** Days left at the end of a closed year per person and type: the number carry-over is cut from. */
async function closingBalances(people: readonly LeavePerson[], year: number, today: NairobiDate, tx?: Prisma.TransactionClient): Promise<Map<string, Map<string, number>>> {
  const computed = await computeBalances(people, year, yearEnd(year), today, tx);
  return new Map([...computed].map(([id, balances]) => [id, new Map(balances.cards.map((card) => [card.typeCode, card.left] as const))] as const));
}

/** Balances of one person for the current or a past year. */
export async function balancesOf(person: LeavePerson, year: number, now: Date, tx?: Prisma.TransactionClient): Promise<PersonBalances> {
  const today = nairobiToday(now);
  const asOf = year === leaveYearOf(today) ? today : year < leaveYearOf(today) ? yearEnd(year) : yearStart(year);
  return (await computeBalances([person], year, asOf, today, tx)).get(person.id) ?? EMPTY(year, person.isCasual);
}
