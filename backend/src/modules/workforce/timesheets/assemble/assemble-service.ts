import { runAudited } from '../../_shared/audit/audit-writer';
import { addDays, nairobiToday, weekStart, type NairobiDate } from '../../_shared/time/nairobi-time';
import { attendanceRulesFor } from '../../attendance/days/day-rules';
import { daysRepository } from '../../attendance/days/days-repository';
import { switchRepository } from '../../attendance/switch/switch-repository';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { timesheetDaysRepository } from '../days/timesheet-days-repository';
import { overtimeRepository } from '../overtime/overtime-repository';
import { periodsRepository } from '../periods/periods-repository';
import { windowForDay } from '../periods/period-window';
import { SYSTEM_ACTOR, timesheetEntry } from '../timesheets-audit';
import type { PeriodRow } from '../timesheets.types';
import { evidenceFor, personDaysOf } from './assemble-load';
import { planTimesheet } from './assemble-plan';

/** A refresh of the same site within this many seconds is skipped: reads should not each re-count the whole period. */
const REFRESH_EVERY_SECONDS = 20;
const lastRefresh = new Map<string, number>();

/** The week and period rules for a site on a day, with the cut-off and period rules as the engine wants them. */
export const weekRulesFor = async (siteId: string, date: NairobiDate) => (await getEffectiveRuleGroup(siteId, date, 'WEEK_AND_BREAKS')).values;

/** The timesheet period that today falls in, created on first use. Null while the site is still on the old clock. */
export async function currentPeriod(siteId: string, now: Date): Promise<PeriodRow | null> {
  if (!(await switchRepository.isEnabled(siteId))) return null;
  const today = nairobiToday(now);
  return periodsRepository.ensure(siteId, windowForDay(today, await weekRulesFor(siteId, today)));
}

/**
 * Brings an open period up to date: builds each person's days from the rota and the clock events, lets the system
 * approve the ones that match, and stores the rest as exceptions with their reasons. Safe to repeat; it writes only what
 * changed. A closed period is never touched.
 */
export async function refreshPeriod(period: PeriodRow, now: Date, force = false): Promise<void> {
  if (period.state !== 'OPEN') return;
  const stamp = lastRefresh.get(period.id);
  if (!force && stamp !== undefined && now.getTime() - stamp < REFRESH_EVERY_SECONDS * 1000 && now.getTime() >= stamp) return;
  lastRefresh.set(period.id, now.getTime());

  const today = nairobiToday(now);
  const to = today < period.end ? today : period.end;
  if (to < period.start) return;

  const week = await weekRulesFor(period.siteId, to);
  // Weekly rules look at the whole Monday to Sunday week, so the days of a week that runs into the neighbouring period
  // are read too (never past today); only the days inside this period are built and written.
  const readFrom = weekStart(period.start, week.weekStartsOn);
  const readTo = [addDays(weekStart(period.end, week.weekStartsOn), 6), today].reduce((a, b) => (a < b ? a : b));
  const wideTo = readTo > to ? readTo : to;
  const [data, site, rules, overtime] = await Promise.all([
    daysRepository.loadDayData(period.siteId, readFrom, wideTo, null),
    daysRepository.siteFacts(period.siteId),
    attendanceRulesFor(period.siteId, to),
    getEffectiveRuleGroup(period.siteId, to, 'OVERTIME'),
  ]);
  if (!site) return;
  const ids = [...new Set([...data.entries.map((e) => e.employeeId), ...data.events.map((e) => e.employeeId)])];
  const people = await daysRepository.peopleByIds(period.siteId, ids);
  const allDays = personDaysOf(people, data, readFrom, wideTo, rules, now);
  const days = allDays.filter((day) => day.date >= period.start && day.date <= to);
  const neighbourDays = allDays.filter((day) => day.date < period.start || day.date > period.end);
  const [evidence, storedDays, storedOvertime] = await Promise.all([
    evidenceFor(period.siteId, days, rules.lateness.graceMinutes),
    timesheetDaysRepository.inRange(period.siteId, period.start, to),
    overtimeRepository.inRange(period.siteId, period.start, to),
  ]);

  const plan = planTimesheet({
    periodId: period.id,
    siteId: period.siteId,
    today,
    weekStartsOn: week.weekStartsOn,
    days,
    neighbourDays,
    evidence,
    storedDays,
    storedOvertime,
    rules: {
      graceMinutes: rules.lateness.graceMinutes,
      makeUpSameDay: rules.lateness.makeUpSameDay,
      serviceTailMinutes: overtime.values.serviceTailMinutes,
      weeklyCapMinutes: overtime.values.weeklyCapMinutes,
      branchBudgetMinutesPerPeriod: overtime.values.branchBudgetMinutesPerPeriod,
    },
  });
  if (plan.days.length === 0 && plan.overtime.length === 0 && plan.removals.length === 0) return;

  await runAudited(async (tx) => {
    for (const write of plan.days) await timesheetDaysRepository.upsert(tx, write);
    for (const write of plan.overtime) await overtimeRepository.upsert(tx, write);
    for (const removal of plan.removals) await overtimeRepository.removeUndecided(tx, period.siteId, removal.employeeId, removal.date);
    for (const w of plan.weeks) await timesheetDaysRepository.replaceWeeks(tx, period.id, period.siteId, w.employeeId, [w]);
    const entries =
      plan.newlyAutoApproved > 0
        ? [
            timesheetEntry({
              companyId: site.companyId,
              siteId: period.siteId,
              actor: SYSTEM_ACTOR,
              channel: 'SYSTEM',
              action: 'timesheet.auto_approved',
              subjectId: period.id,
              subjectType: 'TimesheetPeriod',
              after: { days: plan.newlyAutoApproved, period: period.label },
            }),
          ]
        : [];
    return { result: undefined, entries };
  });
}

/** The current period of a site, brought up to date. Null while the site is on the old clock. */
export async function currentPeriodFresh(siteId: string, now: Date, force = false): Promise<PeriodRow | null> {
  const period = await currentPeriod(siteId, now);
  if (period) await refreshPeriod(period, now, force);
  return period && ((await periodsRepository.find(siteId, period.id)) ?? period);
}
