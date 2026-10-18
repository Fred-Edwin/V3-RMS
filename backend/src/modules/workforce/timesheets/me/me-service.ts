import { NotFoundError } from '../../../../utils/errors';
import { addDays, nairobiToday, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { daysRepository } from '../../attendance/days/days-repository';
import { switchRepository } from '../../attendance/switch/switch-repository';
import { currentPeriodFresh, refreshPeriod } from '../assemble/assemble-service';
import { timesheetDaysRepository } from '../days/timesheet-days-repository';
import { overtimeRepository } from '../overtime/overtime-repository';
import { periodsRepository } from '../periods/periods-repository';
import { requestsRepository } from '../requests/requests-repository';
import type { DayRow, OvertimeRow, PeriodRow, RequestRow } from '../timesheets.types';
import type { MyRotaQuery, MyTimeQuery } from './me-validators';

export interface MyTimeView {
  /** False while the branch is still on the old clock. */
  enabled: boolean;
  period: PeriodRow | null;
  periods: PeriodRow[];
  days: (DayRow & { overtime: Pick<OvertimeRow, 'status' | 'authorisedMinutes' | 'needsMinutes' | 'rawMinutes'> | null; requests: Pick<RequestRow, 'id' | 'kind' | 'state'>[] })[];
  weeks: { weekStart: string; status: string; scheduledMinutes: number; workedMinutes: number }[];
  /** Hours only. Overtime still waiting is shown as pending and is not paid until someone authorises it. */
  totals: { plannedMinutes: number; workedMinutes: number; lateMinutes: number; overtimeAuthorisedMinutes: number; overtimePendingMinutes: number };
  openRequests: number;
}

/** My time (Chapter 9, step 1): the signed-in person's own period, day by day, with where each day stands. Own record only. */
export async function myTime(subject: AccessSubject, query: MyTimeQuery, now: Date = new Date()): Promise<MyTimeView> {
  const person = await daysRepository.personByUserId(subject.id);
  const empty: MyTimeView = { enabled: false, period: null, periods: [], days: [], weeks: [], totals: { plannedMinutes: 0, workedMinutes: 0, lateMinutes: 0, overtimeAuthorisedMinutes: 0, overtimePendingMinutes: 0 }, openRequests: 0 };
  if (!person || !person.tracksTime || !(await switchRepository.isEnabled(person.siteId))) return empty;

  let period: PeriodRow | null;
  if (query.periodId) {
    period = await periodsRepository.find(person.siteId, query.periodId);
    if (!period) throw new NotFoundError('Period not found');
    await refreshPeriod(period, now);
    period = (await periodsRepository.find(person.siteId, period.id)) ?? period;
  } else {
    period = await currentPeriodFresh(person.siteId, now);
  }
  if (!period) return empty;

  const [days, items, weeks, requests, periods] = await Promise.all([
    timesheetDaysRepository.allInPeriod(period.id, period.siteId),
    overtimeRepository.allInPeriod(period.id, period.siteId),
    timesheetDaysRepository.weeksOf(period.id, period.siteId, person.id),
    requestsRepository.ofPersonOnDates(period.siteId, person.id, period.start, period.end),
    periodsRepository.list(period.siteId, 6),
  ]);
  const mineDays = days.filter(({ person: p }) => p.id === person.id).map(({ day }) => day);
  const mineItems = items.filter((item) => item.employeeId === person.id);
  return {
    enabled: true,
    period,
    periods,
    days: mineDays.map((day) => {
      const item = mineItems.find((i) => i.shiftDate === day.shiftDate) ?? null;
      return {
        ...day,
        overtime: item && { status: item.status, authorisedMinutes: item.authorisedMinutes, needsMinutes: item.needsMinutes, rawMinutes: item.rawMinutes },
        requests: requests.filter((r) => r.shiftDate === day.shiftDate).map((r) => ({ id: r.id, kind: r.kind, state: r.state })),
      };
    }),
    weeks: weeks.map((w) => ({ weekStart: w.weekStart.toISOString().slice(0, 10), status: w.status, scheduledMinutes: w.scheduledMinutes, workedMinutes: w.workedMinutes })),
    totals: {
      plannedMinutes: mineDays.reduce((sum, d) => sum + d.scheduledMinutes, 0),
      workedMinutes: mineDays.reduce((sum, d) => sum + d.workedMinutes, 0),
      lateMinutes: mineDays.reduce((sum, d) => sum + d.minutesLate, 0),
      overtimeAuthorisedMinutes: mineItems.reduce((sum, i) => sum + i.authorisedMinutes, 0),
      overtimePendingMinutes: mineItems.filter((i) => i.status === 'PENDING').reduce((sum, i) => sum + i.needsMinutes, 0),
    },
    openRequests: requests.filter((r) => r.state === 'WAITING').length,
  };
}

export interface MyRotaView {
  enabled: boolean;
  from: NairobiDate;
  to: NairobiDate;
  shifts: { entryId: string; date: NairobiDate; name: string; colour: string; startTime: string; endTime: string; unpaidBreakMinutes: number }[];
}

/** My rota (Chapter 9, step 1): my own shifts for the days ahead (default today and the next 13 days). The rota has no publish step. */
export async function myRota(subject: AccessSubject, query: MyRotaQuery, now: Date = new Date()): Promise<MyRotaView> {
  const today = nairobiToday(now);
  const from = query.from ?? today;
  const to = query.to ?? addDays(from, 13);
  const person = await daysRepository.personByUserId(subject.id);
  if (!person) return { enabled: false, from, to, shifts: [] };
  const data = await daysRepository.loadDayData(person.siteId, from, to, [person.id]);
  return {
    enabled: true,
    from,
    to,
    shifts: data.entries
      .filter((e) => e.employeeId === person.id)
      .map((e) => ({ entryId: e.id, date: e.date, name: e.templateName, colour: e.colour, startTime: e.startTime, endTime: e.endTime, unpaidBreakMinutes: e.unpaidBreakMinutes })),
  };
}
