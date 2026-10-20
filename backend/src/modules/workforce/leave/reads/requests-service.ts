import type { z } from 'zod';
import { addDays, nairobiToday, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { anyTight } from '../engine/leave-cover';
import { loadCover } from '../applications/cover-service';
import { summaryOf, type ApplicationSummary } from '../applications/application-summary';
import { applicationsRepository, type ApplicationRow } from '../data/applications-repository';
import { dbOf, peopleRepository, type LeavePerson } from '../data/people-repository';
import { eachDay } from '../../_shared/time/nairobi-time';
import { managerMayCancel } from '../engine/leave-phase';
import { movesToHrAt, willMoveToHr } from '../engine/leave-routing';
import { COMING_UP_DAYS } from '../leave.constants';
import type { requestsQuery } from '../leave-validators';
import { nameAndRole, roleWord } from '../leave-words';
import type { Page } from './mine-service';
import { routedToMe, viewerFor, type LeaveViewer } from './read-scope';

const PEOPLE_CAP = 500;
const RECENT_DAYS = 30;
const NAMES_SHOWN = 8;

export interface RequestRow {
  application: ApplicationSummary;
  person: { id: string; name: string; roleLabel: string; department: string | null; site: string };
  /** For waiting requests only: whether the department would be below its minimum on a day of the request. Decided rows carry null. */
  rota: 'CLASH' | 'OK' | 'NOT_PLANNED' | null;
  routedToMe: boolean;
  can: { approve: boolean; decline: boolean; cancel: boolean };
  whyNot: string | null;
}

export interface RequestsKpis {
  needsYou: number;
  awayToday: { count: number; names: string[] };
  awayNext14: { people: number; names: string[] };
  daysThisMonth: { days: number; people: number };
}

const labelOf = (person: LeavePerson): string => nameAndRole(person.name, person.positionName, person.role);

/** People matching the department and name filters (null = no such filter, so every person in the viewer's scope). */
async function filteredIds(viewer: LeaveViewer, query: z.infer<typeof requestsQuery>): Promise<string[] | null> {
  if (!query.dept && !query.q) return null;
  const people = await peopleRepository.search({ companyId: viewer.companyId, ...(viewer.siteId ? { siteId: viewer.siteId } : {}), ...(query.dept ? { departmentIds: [query.dept] } : {}), ...(query.q ? { q: query.q } : {}), includeLeavers: true, take: PEOPLE_CAP });
  return people.map((person) => person.id);
}

async function kpis(viewer: LeaveViewer, subject: AccessSubject, waiting: ApplicationRow[], people: Map<string, LeavePerson>, now: Date): Promise<RequestsKpis> {
  const today = nairobiToday(now);
  const monthStart = `${today.slice(0, 8)}01` as NairobiDate;
  const filter = { companyId: viewer.companyId, ...(viewer.siteId ? { siteId: viewer.siteId } : {}) };
  const approved = await applicationsRepository.approvedBetween(dbOf(), filter, monthStart, addDays(today, COMING_UP_DAYS));
  const extra = await peopleRepository.byIds(viewer.companyId, [...new Set(approved.map((a) => a.employeeId))].filter((id) => !people.has(id)));
  for (const person of extra) people.set(person.id, person);
  const names = (apps: ApplicationRow[]): string[] => [...new Set(apps.map((a) => a.employeeId))].slice(0, NAMES_SHOWN).map((id) => (people.get(id) ? labelOf(people.get(id) as LeavePerson) : id));
  const awayToday = approved.filter((a) => a.start <= today && a.end >= today);
  const next = approved.filter((a) => a.end > today && a.start <= addDays(today, COMING_UP_DAYS));
  const monthEnd = `${today.slice(0, 8)}31` as NairobiDate;
  const days = approved.reduce((sum, a) => sum + eachDay(a.start < monthStart ? monthStart : a.start, a.end > monthEnd ? monthEnd : a.end).filter((d) => d.slice(0, 7) === today.slice(0, 7)).length, 0);
  return {
    needsYou: waiting.filter((a) => routedToMe(a, people.get(a.employeeId)?.userId ?? null, subject, now)).length,
    awayToday: { count: new Set(awayToday.map((a) => a.employeeId)).size, names: names(awayToday) },
    awayNext14: { people: new Set(next.map((a) => a.employeeId)).size, names: names(next) },
    daysThisMonth: { days, people: new Set(approved.filter((a) => a.end >= monthStart && a.start <= monthEnd).map((a) => a.employeeId)).size },
  };
}

async function rotaFlag(person: LeavePerson, app: ApplicationRow, now: Date): Promise<RequestRow['rota']> {
  if (app.status !== 'WAITING') return null;
  const cover = await loadCover(person, app.start, app.end, now);
  return anyTight(cover.days) ? 'CLASH' : cover.anyPlanned ? 'OK' : 'NOT_PLANNED';
}

/** D1: the requests the caller may see, with KPIs. A manager sees their own site; HR, the Director and the System Admin see all sites. */
export async function requestsList(subject: AccessSubject, query: z.infer<typeof requestsQuery>, now: Date = new Date()): Promise<Page<RequestRow> & { kpis: RequestsKpis }> {
  const viewer = await viewerFor(subject, 'leave.read', query.site);
  const today = nairobiToday(now);
  const ids = await filteredIds(viewer, query);
  const scope = { companyId: viewer.companyId, ...(viewer.siteId ? { siteId: viewer.siteId } : {}) };
  const waiting = await applicationsRepository.waiting(scope);
  const people = new Map((await peopleRepository.byIds(viewer.companyId, waiting.map((a) => a.employeeId))).map((p) => [p.id, p] as const));

  let rows: ApplicationRow[];
  let total: number;
  if (query.tab === 'needs-you') {
    const mine = waiting.filter((a) => routedToMe(a, people.get(a.employeeId)?.userId ?? null, subject, now) && (!ids || ids.includes(a.employeeId)));
    total = mine.length;
    rows = mine.slice((query.page - 1) * query.rows, query.page * query.rows);
  } else if (ids && ids.length === 0) {
    rows = [];
    total = 0;
  } else {
    const found = await applicationsRepository.page(
      { ...scope, ...(ids ? { employeeIds: ids } : {}), ...(query.status ? { statuses: query.status } : {}), ...(query.status ? {} : { recent: { since: new Date(now.getTime() - RECENT_DAYS * 86_400_000), today } }) },
      (query.page - 1) * query.rows,
      query.rows,
    );
    rows = found.rows;
    total = found.total;
  }

  for (const person of await peopleRepository.byIds(viewer.companyId, rows.map((a) => a.employeeId))) people.set(person.id, person);
  const out: RequestRow[] = [];
  for (const app of rows) {
    const person = people.get(app.employeeId);
    if (!person) continue;
    const mine = routedToMe(app, person.userId, subject, now);
    const holdsForHr = subject.role === 'HR_MANAGER' && willMoveToHr(app, now) && person.userId !== subject.id;
    out.push({
      application: summaryOf(app, now),
      person: { id: person.id, name: person.name, roleLabel: person.positionName ?? roleWord(person.role), department: person.departmentName, site: person.siteName },
      rota: await rotaFlag(person, app, now),
      routedToMe: mine,
      can: { approve: mine && app.start >= today, decline: mine, cancel: managerMayCancel(app, today) && person.userId !== subject.id && (subject.role === 'HR_MANAGER' || subject.siteId === app.siteId) },
      whyNot: holdsForHr ? `With the ${roleWord(app.routedToRole)}. It moves to HR on ${movesToHrAt(app.askedAt).toISOString()}.` : null,
    });
  }
  return { rows: out, total, page: query.page, pageSize: query.rows, kpis: await kpis(viewer, subject, waiting, people, now) };
}
