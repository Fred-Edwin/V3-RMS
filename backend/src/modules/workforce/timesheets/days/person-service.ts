import { NotFoundError } from '../../../../utils/errors';
import { instantAt, parseClockTime, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { personInScope } from '../../attendance/attendance-scope';
import { dayHistory, type DayHistory } from '../../attendance/fixes/history-service';
import { refreshPeriod } from '../assemble/assemble-service';
import { evidenceRepository } from '../overtime/evidence-repository';
import { overtimeRepository } from '../overtime/overtime-repository';
import { periodForViewer } from '../periods/periods-service';
import { requestsRepository } from '../requests/requests-repository';
import type { DayRow, OvertimeRow, PeriodRow, RequestRow } from '../timesheets.types';
import { timesheetDaysRepository } from './timesheet-days-repository';
import { weekView, type WeekView } from './weeks';

export interface PersonPeriodView {
  period: PeriodRow;
  person: { id: string; name: string; departmentName: string | null };
  days: DayRow[];
  weeks: WeekView[];
  overtime: OvertimeRow[];
  requests: RequestRow[];
}

/** One person's period: matching days approved by the system, the exceptions beside them (Chapter 8, step 2). */
export async function personPeriod(subject: AccessSubject, periodId: string, employeeId: string, now: Date = new Date()): Promise<PersonPeriodView> {
  const person = await personInScope(subject, 'timesheet.read', employeeId, 'read');
  const { period: found } = await periodForViewer(subject, periodId);
  if (found.siteId !== person.siteId) throw new NotFoundError('Not found');
  await refreshPeriod(found, now);
  const [days, overtime, weeks, requests] = await Promise.all([
    timesheetDaysRepository.allInPeriod(found.id, found.siteId),
    overtimeRepository.allInPeriod(found.id, found.siteId),
    timesheetDaysRepository.weeksOf(found.id, found.siteId, person.id),
    requestsRepository.ofPersonOnDates(found.siteId, person.id, found.start, found.end),
  ]);
  return {
    period: found,
    person: { id: person.id, name: person.name, departmentName: person.departmentName },
    days: days.filter(({ person: p }) => p.id === person.id).map(({ day }) => day),
    weeks: weeks.map((w) => weekView(w, found)),
    overtime: overtime.filter((item) => item.employeeId === person.id),
    requests,
  };
}

export interface DayDetailView {
  day: DayRow & { siteId: string };
  person: { id: string; name: string; departmentName: string | null };
  history: DayHistory;
  overtime: (OvertimeRow & { ordersValue: string | null }) | null;
  requests: RequestRow[];
}

/** One day with every clock event (replaced and removed ones included), its overtime evidence and any request on it. */
export async function dayDetail(subject: AccessSubject, dayId: string, now: Date = new Date()): Promise<DayDetailView> {
  const row = await timesheetDaysRepository.byIdAnywhere(dayId);
  if (!row) throw new NotFoundError('Day not found');
  const person = await personInScope(subject, 'timesheet.read', row.employeeId, 'read');
  const [history, item, requests] = await Promise.all([
    dayHistory(subject, { employeeId: row.employeeId, date: row.shiftDate }, now),
    overtimeRepository.byPersonDate(row.siteId, row.employeeId, row.shiftDate),
    requestsRepository.ofPersonOnDates(row.siteId, row.employeeId, row.shiftDate, row.shiftDate),
  ]);
  return {
    day: row,
    person: { id: person.id, name: person.name, departmentName: person.departmentName },
    history,
    overtime: item && { ...item, ordersValue: await ordersValueOf(row.siteId, row.shiftDate, person.userId, history) },
    requests,
  };
}

/** The takings of the orders taken in the extra time: shown to the manager as evidence, never stored, never pay. */
async function ordersValueOf(siteId: string, date: NairobiDate, userId: string | null, history: DayHistory): Promise<string | null> {
  const entry = history.entries.find((e) => e.afterEndMinutes > 0);
  if (!entry || !userId) return null;
  const endsAt = instantAt(date, parseClockTime(entry.endTime));
  return evidenceRepository.valueOfOrders(siteId, userId, endsAt, new Date(endsAt.getTime() + entry.afterEndMinutes * 60_000));
}
