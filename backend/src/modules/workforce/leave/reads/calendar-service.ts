import type { z } from 'zod';
import { NotFoundError } from '../../../../utils/errors';
import { addDays, eachDay, nairobiToday, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { loadDepartmentCover } from '../applications/cover-service';
import { applicationsRepository } from '../data/applications-repository';
import { dbOf, peopleRepository } from '../data/people-repository';
import type { calendarQuery } from '../leave-validators';
import { roleWord } from '../leave-words';
import { viewerFor } from './read-scope';

const WEEKS = 3;
const PEOPLE_CAP = 200;

export interface CalendarView {
  from: NairobiDate;
  to: NairobiDate;
  people: { id: string; name: string; roleLabel: string; department: string | null; bars: { id: string; start: NairobiDate; end: NairobiDate; days: number; status: 'APPROVED' | 'WAITING'; typeLabel: string }[] }[];
  /** Only when one department is chosen: the team's cover per day. */
  coverRows: { date: NairobiDate; working: number; minimum: number | null; planned: boolean }[];
  clashes: { date: NairobiDate; applicationId: string }[];
}

/** C1: three weeks of leave bars. Scope as the Requests list; a department makes the cover rows and clash list appear. */
export async function leaveCalendar(subject: AccessSubject, query: z.infer<typeof calendarQuery>, now: Date = new Date()): Promise<CalendarView> {
  const viewer = await viewerFor(subject, 'leave.read', query.site);
  const from = query.from ?? nairobiToday(now);
  const to = addDays(from, WEEKS * 7 - 1);
  const scope = { companyId: viewer.companyId, ...(viewer.siteId ? { siteId: viewer.siteId } : {}) };
  const team = await peopleRepository.search({ ...scope, ...(query.dept ? { departmentIds: [query.dept] } : {}), take: PEOPLE_CAP });
  if (query.dept && team.length === 0) throw new NotFoundError('Not found');
  const apps = await applicationsRepository.liveBetween(dbOf(), { ...scope, employeeIds: team.map((p) => p.id) }, from, to);
  const byPerson = new Map<string, typeof apps>();
  for (const app of apps) byPerson.set(app.employeeId, [...(byPerson.get(app.employeeId) ?? []), app]);

  const people = team.filter((p) => byPerson.has(p.id)).map((p) => ({
    id: p.id, name: p.name, roleLabel: p.positionName ?? roleWord(p.role), department: p.departmentName,
    bars: (byPerson.get(p.id) ?? []).map((a) => ({ id: a.id, start: a.start, end: a.end, days: a.days, status: a.status as 'APPROVED' | 'WAITING', typeLabel: a.type.label })),
  }));

  let coverRows: CalendarView['coverRows'] = [];
  const clashes: CalendarView['clashes'] = [];
  const anchor = team[0];
  if (query.dept && anchor?.departmentId) {
    const cover = await loadDepartmentCover({ companyId: anchor.companyId, siteId: anchor.siteId, departmentId: query.dept, excludeId: null }, from, to, now);
    coverRows = cover.days.map((d) => ({ date: d.date, working: d.working, minimum: d.minimum, planned: d.planned }));
    const tight = new Set(cover.days.filter((d) => d.tight).map((d) => d.date));
    for (const app of apps) for (const day of eachDay(app.start < from ? from : app.start, app.end > to ? to : app.end)) if (tight.has(day)) clashes.push({ date: day, applicationId: app.id });
  }
  return { from, to, people, coverRows, clashes };
}
