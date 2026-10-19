import type { Prisma } from '@prisma/client';
import { NotFoundError } from '../../../../utils/errors';
import { addDays, daysBetween, fromDateColumn, nairobiToday, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { inputsRepository } from '../calculate/inputs-repository';
import { getEffectiveRules } from '../../rules';
import { payAmountOn } from '../../people/people-door';
import { amountSegments, employedRanges, isMonthKey, monthWindow, previousMonthKey, type DayRange, type MonthWindow } from '../months/month-calendar';
import { payrollActor } from '../payroll-context';
import { loadSiteRows } from '../sites/site-rows';
import { estimateMonth, type Estimate, type EstimatePerson } from './estimate';
import { estimateRepository } from './estimate-repository';

const CHUNK = 20;

const clip = (ranges: readonly DayRange[], last: NairobiDate): DayRange[] => ranges.filter((r) => r.from <= last).map((r) => ({ from: r.from, to: r.to < last ? r.to : last }));

/** Works out the estimate of a month for the company from profiles, dates and authorised overtime only (P28), and stores it. */
export async function computeEstimate(companyId: string, monthKey: string, now: Date): Promise<Estimate & { asOf: string; dayOfMonth: number; daysInMonth: number; sites: { siteId: string; name: string; onNewSystem: boolean }[] }> {
  const window: MonthWindow = monthWindow(monthKey);
  const today = nairobiToday(now);
  const rows = await loadSiteRows(companyId, window, today, now);
  const onSystem = rows.filter((r) => r.timesheetState !== 'NOT_ON_NEW_SYSTEM');
  const siteIds = onSystem.map((r) => r.siteId);
  const yesterday = addDays(today, -1);
  const elapsedEnd = yesterday < window.first ? null : yesterday > window.last ? window.last : yesterday;
  const daysElapsed = elapsedEnd === null ? 0 : daysBetween(window.first, elapsedEnd) + 1;

  const [employees, periods, lastGross] = await Promise.all([
    inputsRepository.employees(companyId, siteIds, window),
    inputsRepository.periods(siteIds, window),
    estimateRepository.grossBySite(companyId, previousMonthKey(monthKey)),
  ]);
  const periodIds = periods.map((p) => p.id);
  const [overtime, absences] = await Promise.all([estimateRepository.overtimeSoFar(periodIds), estimateRepository.absentDays(periodIds)]);
  const firstSite = siteIds[0];
  const rules = firstSite ? await getEffectiveRules(firstSite, window.last) : null;
  const ordinary = rules?.OVERTIME.values.multipliers.ordinaryDay ?? null;
  const unpaidDayDivisor = rules?.LEAVE.values.unpaidDayDivisor ?? 30;

  const people: EstimatePerson[] = [];
  for (let i = 0; i < employees.length; i += CHUNK) {
    people.push(
      ...(await Promise.all(
        employees.slice(i, i + CHUNK).map(async (e): Promise<EstimatePerson> => {
          const spells = e.spells.map((s) => ({ startsOn: fromDateColumn(s.startsOn) as NairobiDate, endedOn: s.endedOn ? (fromDateColumn(s.endedOn) as NairobiDate) : null }));
          const ranges = employedRanges(window, spells);
          const month = await amountSegments(ranges, (date) => payAmountOn(e.id, date));
          const toDate = elapsedEnd === null ? { segments: [] } : await amountSegments(clip(ranges, elapsedEnd), (date) => payAmountOn(e.id, date));
          const ot = overtime.get(e.id);
          return {
            employeeId: e.id,
            siteId: e.siteId,
            payType: e.payType,
            monthSegments: month.segments,
            toDateSegments: toDate.segments,
            amountInForce: month.lastAmount,
            standardWeekHours: e.payProfile?.standardWeekHours?.toString() ?? null,
            overtimeEligible: e.payProfile?.overtimeEligible ?? false,
            authorisedOvertimeMinutes: ot?.authorised ?? 0,
            undecidedOvertimeMinutes: ot?.undecided ?? 0,
            absentDaysToDate: absences.get(e.id) ?? 0,
          };
        }),
      )),
    );
  }
  const estimate = estimateMonth({ daysInMonth: window.days, daysElapsed, unpaidDayDivisor, ordinaryMultiplier: ordinary, people, lastMonthGross: lastGross });
  const stored = { ...estimate, asOf: today, dayOfMonth: Math.min(daysElapsed + 1, window.days), daysInMonth: window.days, sites: rows.map((r) => ({ siteId: r.siteId, name: r.name, onNewSystem: r.timesheetState !== 'NOT_ON_NEW_SYSTEM' })) };
  await estimateRepository.save(companyId, monthKey, today, now, stored as unknown as Prisma.InputJsonValue);
  return stored;
}

/** The stored estimate (never computed in the request). Before the first nightly run it says so instead of inventing numbers. */
export async function readEstimate(subject: AccessSubject, monthKey: string) {
  const ctx = await payrollActor(subject, 'payroll.estimate.read');
  if (!isMonthKey(monthKey)) throw new NotFoundError('There is no payroll for that month', 'NO_PAYROLL_MONTH');
  const row = await estimateRepository.read(ctx.companyId, monthKey);
  if (!row) return { monthKey, ready: false as const, computedAt: null, estimate: null };
  return { monthKey, ready: true as const, computedAt: row.computedAt.toISOString(), estimate: row.data };
}
