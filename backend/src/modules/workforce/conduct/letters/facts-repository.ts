import { prisma } from '../../../../config/database';
import { fromDateColumn, nairobiClockOf, toDateColumn, parseNairobiDate } from '../../_shared/time/nairobi-time';
import type { TimesheetFactRow } from './facts-selection';

const lastDayOf = (monthKey: string): string => {
  const [y, m] = monthKey.split('-').map(Number) as [number, number];
  return String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0');
};

/**
 * One month of a person's timesheet days that were late or absent, with the planned start (the rota shift) and the first clock-in.
 * Read only; the timesheets own these rows. `siteId` is the person's site on the day of issue.
 */
export const factsRepository = {
  async rowsForMonth(args: { siteId: string; employeeId: string; monthKey: string }): Promise<TimesheetFactRow[]> {
    const from = parseNairobiDate(`${args.monthKey}-01`);
    const to = parseNairobiDate(`${args.monthKey}-${lastDayOf(args.monthKey)}`);
    const days = await prisma.timesheetDay.findMany({
      where: { siteId: args.siteId, employeeId: args.employeeId, shiftDate: { gte: toDateColumn(from), lte: toDateColumn(to) }, OR: [{ reasons: { has: 'LATE' } }, { reasons: { has: 'ABSENT' } }] },
      select: { shiftDate: true, reasons: true, lateExcused: true, status: true, minutesLate: true },
      orderBy: { shiftDate: 'asc' },
    });
    if (days.length === 0) return [];
    const dates = days.map((day) => day.shiftDate);
    const [entries, clocks] = await Promise.all([
      prisma.rotaEntry.findMany({ where: { siteId: args.siteId, employeeId: args.employeeId, date: { in: dates } }, select: { date: true, template: { select: { startTime: true } } }, orderBy: { template: { startTime: 'asc' } } }),
      prisma.clockEvent.findMany({ where: { siteId: args.siteId, employeeId: args.employeeId, shiftDate: { in: dates }, type: 'IN' }, select: { shiftDate: true, occurredAt: true }, orderBy: { occurredAt: 'asc' } }),
    ]);
    const planned = new Map<string, string>();
    for (const entry of entries) if (!planned.has(fromDateColumn(entry.date))) planned.set(fromDateColumn(entry.date), entry.template.startTime);
    const clockIn = new Map<string, string>();
    for (const event of clocks) if (!clockIn.has(fromDateColumn(event.shiftDate))) clockIn.set(fromDateColumn(event.shiftDate), nairobiClockOf(event.occurredAt));
    return days.map((day) => {
      const date = fromDateColumn(day.shiftDate);
      return { date, reasons: day.reasons, lateExcused: day.lateExcused, status: day.status, minutesLate: day.minutesLate, plannedIn: planned.get(date) ?? null, clockIn: clockIn.get(date) ?? null };
    });
  },
};
