import { prisma } from '../../../../config/database';
import { toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { Db } from '../../attendance/days/days-repository';
import { toRequestRow } from '../requests/requests-repository';
import type { DayReason, RequestRow } from '../timesheets.types';

export interface MonthStats {
  periodId: string;
  workedMinutes: number;
  headcount: number;
  /** Days that are not settled, with their reasons: the caller applies the needs-you rule (never copied into SQL). */
  open: { status: 'NEEDS_LOOK' | 'HELD'; reasons: DayReason[] }[];
  pendingOvertime: number;
  waitingRequests: Pick<RequestRow, 'state' | 'waitingOnRole' | 'escalatedAt'>[];
  /** Days of the open month for "so far". */
  days: { shiftDate: NairobiDate; status: 'MATCHED' | 'AUTO_APPROVED' | 'NEEDS_LOOK' | 'APPROVED' | 'HELD'; reasons: DayReason[]; workedMinutes: number; scheduledMinutes: number }[];
}

/** Per-month figures for the months list (a handful of months at a time), by aggregates, never by loading every day. */
export const monthsRepository = {
  stats: async (periods: readonly { id: string; siteId: string; start: NairobiDate; end: NairobiDate }[], withDays: ReadonlySet<string>, db: Db = prisma): Promise<Map<string, MonthStats>> => {
    const result = new Map<string, MonthStats>();
    for (const period of periods) {
      const where = { periodId: period.id, siteId: period.siteId };
      const [worked, people, open, pending, requests, days] = await Promise.all([
        db.timesheetDay.aggregate({ where, _sum: { workedMinutes: true } }),
        db.timesheetDay.findMany({ where, distinct: ['employeeId'], select: { employeeId: true } }),
        db.timesheetDay.findMany({ where: { ...where, status: { in: ['NEEDS_LOOK', 'HELD'] } }, select: { status: true, reasons: true } }),
        db.overtimeItem.count({ where: { ...where, status: 'PENDING' } }),
        db.timeRequest.findMany({ where: { siteId: period.siteId, state: 'WAITING', shiftDate: { gte: toDateColumn(period.start), lte: toDateColumn(period.end) } }, select: { state: true, waitingOnRole: true, escalatedAt: true } }),
        withDays.has(period.id) ? db.timesheetDay.findMany({ where, select: { shiftDate: true, status: true, reasons: true, workedMinutes: true, scheduledMinutes: true } }) : Promise.resolve([]),
      ]);
      result.set(period.id, {
        periodId: period.id,
        workedMinutes: worked._sum.workedMinutes ?? 0,
        headcount: people.length,
        open: open.map((row) => ({ status: row.status as 'NEEDS_LOOK' | 'HELD', reasons: row.reasons as DayReason[] })),
        pendingOvertime: pending,
        waitingRequests: requests,
        days: days.map((row) => ({ shiftDate: row.shiftDate.toISOString().slice(0, 10) as NairobiDate, status: row.status, reasons: row.reasons as DayReason[], workedMinutes: row.workedMinutes, scheduledMinutes: row.scheduledMinutes })),
      });
    }
    return result;
  },

  /** Requests about days of the month that are still waiting (for the needs-you count and the people table). */
  waitingRequests: async (siteId: string, from: NairobiDate, to: NairobiDate, db: Db = prisma): Promise<RequestRow[]> =>
    (await db.timeRequest.findMany({ where: { siteId, state: 'WAITING', shiftDate: { gte: toDateColumn(from), lte: toDateColumn(to) } } })).map(toRequestRow),

  /** Every request about the month's days, answered or not (the person's days and the decided-by lines). */
  requestsInRange: async (siteId: string, from: NairobiDate, to: NairobiDate, db: Db = prisma): Promise<RequestRow[]> =>
    (await db.timeRequest.findMany({ where: { siteId, shiftDate: { gte: toDateColumn(from), lte: toDateColumn(to) } } })).map(toRequestRow),
};
