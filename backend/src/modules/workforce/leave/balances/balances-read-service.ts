import type { z } from 'zod';
import { NotFoundError } from '../../../../utils/errors';
import { nairobiToday, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { inScope, type AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import { summaryOf, type ApplicationSummary } from '../applications/application-summary';
import { applicationsRepository } from '../data/applications-repository';
import { ledgerRepository } from '../data/ledger-repository';
import { dbOf, peopleRepository, type LeavePerson } from '../data/people-repository';
import { leaveYearOf, yearEnd, yearStart } from '../engine/leave-days';
import type { balancesQuery } from '../leave-validators';
import { roleWord, spokenLabel } from '../leave-words';
import type { TypeBalance } from '../leave.types';
import type { Page } from '../reads/mine-service';
import { viewerFor } from '../reads/read-scope';
import { computeBalances, type PersonBalances } from './balance-service';

const PEOPLE_CAP = 500;

export interface BalanceRow {
  employeeId: string;
  name: string;
  roleLabel: string;
  department: string | null;
  siteName: string;
  annualLeft: number | null;
  annualBooked: number | null;
  sickUsed: number | null;
  note: { kind: 'NONE' | 'LOW' | 'ADJUSTED' | 'BOOKED' | 'NOT_ON_POLICY'; text: string };
  adjustedThisMonth: boolean;
}

const asOfFor = (year: number, today: NairobiDate): NairobiDate => (year === leaveYearOf(today) ? today : year < leaveYearOf(today) ? yearEnd(year) : yearStart(year));
const card = (balances: PersonBalances, code: string): TypeBalance | undefined => balances.cards.find((entry) => entry.typeCode === code);

function rowOf(person: LeavePerson, balances: PersonBalances, adjusted: boolean): BalanceRow {
  const annual = card(balances, 'ANNUAL');
  const sick = card(balances, 'SICK');
  const none = balances.cards.length === 0;
  const low = annual?.tone === 'RED';
  const note: BalanceRow['note'] = none
    ? { kind: 'NOT_ON_POLICY', text: person.isCasual ? 'Casual: leave starts with a contract' : 'Not on the leave policy' }
    : low ? { kind: 'LOW', text: 'Low balance' }
    : annual && annual.booked > 0 ? { kind: 'BOOKED', text: `${annual.booked} booked` }
    : adjusted ? { kind: 'ADJUSTED', text: 'Adjusted this month' }
    : { kind: 'NONE', text: '' };
  return {
    employeeId: person.id, name: person.name, roleLabel: person.positionName ?? roleWord(person.role), department: person.departmentName, siteName: person.siteName,
    annualLeft: annual?.left ?? null, annualBooked: annual?.booked ?? null, sickUsed: sick?.taken ?? null, note, adjustedThisMonth: adjusted,
  };
}

/** B1: everyone's balances in one list. Scope as the Requests list; at most 500 people are read, then filtered and paged in memory. */
export async function balancesList(subject: AccessSubject, query: z.infer<typeof balancesQuery>, now: Date = new Date()): Promise<Page<BalanceRow> & { kpis: { people: number; lowBalance: number; adjustedThisMonth: number; bookedDays: number }; sites: { id: string; name: string; people: number }[] }> {
  const viewer = await viewerFor(subject, 'leave.read', query.site);
  const today = nairobiToday(now);
  const year = query.year ?? leaveYearOf(today);
  const people = await peopleRepository.search({ companyId: viewer.companyId, ...(viewer.siteId ? { siteId: viewer.siteId } : {}), ...(query.dept ? { departmentIds: [query.dept] } : {}), ...(query.q ? { q: query.q } : {}), includeLeavers: query.leavers ?? false, take: PEOPLE_CAP });
  const monthStart = toDateColumn(`${today.slice(0, 8)}01` as NairobiDate);
  const [balances, adjusted] = await Promise.all([
    computeBalances(people, year, asOfFor(year, today), today),
    ledgerRepository.adjustedBetween(dbOf(), viewer.companyId, monthStart, new Date(monthStart.getTime() + 32 * 86_400_000)),
  ]);

  const all = people.map((person) => ({ person, row: rowOf(person, balances.get(person.id) as PersonBalances, adjusted.has(person.id)) }));
  const shown = all.filter(({ row }) => query.filter === 'all' || (query.filter === 'low' && row.note.kind === 'LOW') || (query.filter === 'adjusted' && row.adjustedThisMonth) || (query.filter === 'booked' && (row.annualBooked ?? 0) > 0));
  const sites = viewer.scope === 'all' ? await peopleRepository.sitesOf(viewer.companyId) : [];
  return {
    rows: shown.slice((query.page - 1) * query.rows, query.page * query.rows).map(({ row }) => row),
    total: shown.length, page: query.page, pageSize: query.rows,
    kpis: { people: all.length, lowBalance: all.filter(({ row }) => row.note.kind === 'LOW').length, adjustedThisMonth: all.filter(({ row }) => row.adjustedThisMonth).length, bookedDays: all.reduce((sum, { row }) => sum + (row.annualBooked ?? 0), 0) },
    sites: sites.map((site) => ({ id: site.id, name: site.name, people: all.filter(({ person }) => person.siteId === site.id).length })),
  };
}

export interface BalanceDrawer {
  person: { id: string; name: string; roleLabel: string; department: string | null; site: string; onPolicy: boolean; note: string | null };
  year: number;
  cards: (TypeBalance & { spoken: string })[];
  /** The kinds of leave HR may adjust for this person: every type with a balance, even one with no days yet (a card is shown only once days exist). */
  adjustable: { code: string; label: string }[];
  requests: ApplicationSummary[];
  adjustments: { at: string; typeCode: string; days: number; reasonCode: string | null; by: string | null }[];
}

/** B2: one person's balances, requests of the year and adjustment history. 404 when the person is out of the caller's scope. */
export async function balanceDrawer(subject: AccessSubject, employeeId: string, yearAsked: number | undefined, now: Date = new Date()): Promise<BalanceDrawer> {
  const ctx = await resolveActor(subject);
  const person = await peopleRepository.byId(ctx.companyId, employeeId);
  if (!person || !inScope(subject, 'leave.read', { userId: person.userId, siteId: person.siteId, departmentId: person.departmentId })) throw new NotFoundError('That person was not found', 'PERSON_NOT_FOUND');
  const year = yearAsked ?? leaveYearOf(nairobiToday(now));
  const balances = (await computeBalances([person], year, asOfFor(year, nairobiToday(now)), nairobiToday(now))).get(person.id) as PersonBalances;
  const [{ rows }, history] = await Promise.all([
    applicationsRepository.page({ companyId: ctx.companyId, employeeId: person.id, year }, 0, 50),
    ledgerRepository.history(dbOf(), person.id, 20),
  ]);
  const names = await peopleRepository.userNames(history.map((line) => line.byUser).filter((id): id is string => id !== null));
  return {
    person: { id: person.id, name: person.name, roleLabel: person.positionName ?? roleWord(person.role), department: person.departmentName, site: person.siteName, onPolicy: balances.cards.length > 0, note: person.isCasual ? 'Leave starts when the contract starts.' : null },
    year,
    cards: balances.cards.map((entry) => ({ ...entry, spoken: spokenLabel(entry) })),
    adjustable: balances.requestable.filter((entry) => entry.left !== null).map((entry) => ({ code: entry.code, label: entry.label })),
    requests: rows.map((row) => summaryOf(row, now)),
    adjustments: history.map((line) => ({ at: line.createdAt.toISOString(), typeCode: line.typeCode, days: line.days, reasonCode: line.reasonCode, by: line.byUser ? (names.get(line.byUser)?.name ?? null) : null })),
  };
}
