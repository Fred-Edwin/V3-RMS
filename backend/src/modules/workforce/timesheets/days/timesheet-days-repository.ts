import type { Prisma, TimesheetDay, TimesheetStatus } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { fromDateColumn, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { Db } from '../../attendance/days/days-repository';
import type { DayReason, DayRow } from '../timesheets.types';
import type { DecisionChange } from './day-merge';

export const toDayRow = (row: TimesheetDay): DayRow => ({
  id: row.id,
  periodId: row.periodId,
  employeeId: row.employeeId,
  shiftDate: fromDateColumn(row.shiftDate),
  status: row.status,
  reasons: row.reasons as DayReason[],
  scheduledMinutes: row.scheduledMinutes,
  workedMinutes: row.workedMinutes,
  minutesLate: row.minutesLate,
  minutesAfterGrace: row.minutesAfterGrace,
  leftEarlyMinutes: row.leftEarlyMinutes,
  afterEndMinutes: row.afterEndMinutes,
  evidenceHash: row.evidenceHash,
  lateExcused: row.lateExcused,
  decidedById: row.decidedById,
  decidedAt: row.decidedAt,
  decisionReason: row.decisionReason,
  carriedFromPeriodId: row.carriedFromPeriodId,
});

export interface DayWrite {
  periodId: string;
  siteId: string;
  employeeId: string;
  shiftDate: NairobiDate;
  status: TimesheetStatus;
  reasons: DayReason[];
  scheduledMinutes: number;
  workedMinutes: number;
  minutesLate: number;
  minutesAfterGrace: number;
  leftEarlyMinutes: number;
  afterEndMinutes: number;
  evidenceHash: string;
  decision: DecisionChange;
}

export interface DayFilter {
  search?: string | undefined;
  departmentId?: string | undefined;
  status?: TimesheetStatus | readonly TimesheetStatus[] | undefined;
}

const filterWhere = (periodId: string, siteId: string, filter: DayFilter): Prisma.TimesheetDayWhereInput => ({
  periodId,
  siteId,
  ...(filter.status ? { status: Array.isArray(filter.status) ? { in: [...filter.status] } : (filter.status as TimesheetStatus) } : {}),
  employee: {
    ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
    ...(filter.search ? { name: { contains: filter.search, mode: 'insensitive' as const } } : {}),
  },
});

/** Rows of `timesheet_days` and `timesheet_weeks`. Every query carries the site. */
export const timesheetDaysRepository = {
  inRange: async (siteId: string, from: NairobiDate, to: NairobiDate, db: Db = prisma): Promise<DayRow[]> =>
    (await db.timesheetDay.findMany({ where: { siteId, shiftDate: { gte: toDateColumn(from), lte: toDateColumn(to) } } })).map(toDayRow),

  /** By id wherever it is, with its site; the caller checks the viewer's scope (404 if not). */
  byIdAnywhere: async (id: string, db: Db = prisma): Promise<(DayRow & { siteId: string }) | null> => {
    const row = await db.timesheetDay.findUnique({ where: { id } });
    return row ? { ...toDayRow(row), siteId: row.siteId } : null;
  },

  byPersonDate: async (siteId: string, employeeId: string, date: NairobiDate, db: Db = prisma): Promise<DayRow | null> => {
    const row = await db.timesheetDay.findFirst({ where: { siteId, employeeId, shiftDate: toDateColumn(date) } });
    return row ? toDayRow(row) : null;
  },

  ofPerson: async (siteId: string, employeeId: string, from: NairobiDate, to: NairobiDate, db: Db = prisma): Promise<DayRow[]> =>
    (await db.timesheetDay.findMany({ where: { siteId, employeeId, shiftDate: { gte: toDateColumn(from), lte: toDateColumn(to) } }, orderBy: { shiftDate: 'asc' } })).map(toDayRow),

  /** One page of a period's days with the person, newest exceptions first by date. */
  page: async (periodId: string, siteId: string, filter: DayFilter, skip: number, take: number, db: Db = prisma) => {
    const where = filterWhere(periodId, siteId, filter);
    const [rows, total] = await Promise.all([
      db.timesheetDay.findMany({
        where,
        include: { employee: { select: { id: true, name: true, departmentId: true, department: { select: { name: true } } } } },
        orderBy: [{ shiftDate: 'asc' }, { employee: { name: 'asc' } }],
        skip,
        take,
      }),
      db.timesheetDay.count({ where }),
    ]);
    return { rows: rows.map((row) => ({ day: toDayRow(row), person: row.employee })), total };
  },

  /** Every day of a period, for the totals, the people table and the report. */
  allInPeriod: async (periodId: string, siteId: string, db: Db = prisma) =>
    (
      await db.timesheetDay.findMany({
        where: { periodId, siteId },
        include: { employee: { select: { id: true, name: true, departmentId: true, department: { select: { name: true } } } } },
        orderBy: [{ shiftDate: 'asc' }],
      })
    ).map((row) => ({ day: toDayRow(row), person: row.employee })),

  upsert: async (tx: Db, write: DayWrite): Promise<void> => {
    const { decision, shiftDate, ...rest } = write;
    const data = { ...rest, shiftDate: toDateColumn(shiftDate) };
    const change =
      decision === 'KEEP'
        ? {}
        : decision === 'CLEAR'
          ? { decidedById: null, decidedAt: null, decisionReason: null, lateExcused: false }
          : { decidedById: decision.by, decidedAt: decision.at, decisionReason: decision.reason };
    await tx.timesheetDay.upsert({
      where: { employeeId_shiftDate: { employeeId: write.employeeId, shiftDate: data.shiftDate } },
      create: { ...data, ...(typeof decision === 'object' ? change : {}) },
      update: { ...data, carriedFromPeriodId: null, ...change },
    });
  },

  /** A person's decision on a day. */
  decide: (tx: Db, id: string, data: { status: TimesheetStatus; decidedById: string; decidedAt: Date; decisionReason: string | null; lateExcused?: boolean }) =>
    tx.timesheetDay.update({ where: { id }, data }),

  /** The closing period hands its open days to the next period; they stay held until someone answers. */
  carry: (tx: Db, ids: readonly string[], toPeriodId: string, fromPeriodId: string) =>
    tx.timesheetDay.updateMany({ where: { id: { in: [...ids] } }, data: { periodId: toPeriodId, carriedFromPeriodId: fromPeriodId, status: 'HELD' } }),

  replaceWeeks: async (tx: Db, periodId: string, siteId: string, employeeId: string, weeks: readonly { weekStart: NairobiDate; status: TimesheetStatus; scheduledMinutes: number; workedMinutes: number }[]) => {
    for (const week of weeks) {
      const weekStart = toDateColumn(week.weekStart);
      await tx.timesheetWeek.upsert({
        where: { employeeId_weekStart_periodId: { employeeId, weekStart, periodId } },
        create: { periodId, siteId, employeeId, weekStart, status: week.status, scheduledMinutes: week.scheduledMinutes, workedMinutes: week.workedMinutes },
        update: { status: week.status, scheduledMinutes: week.scheduledMinutes, workedMinutes: week.workedMinutes },
      });
    }
  },

  deleteWeeks: (tx: Db, periodId: string, employeeId: string) => tx.timesheetWeek.deleteMany({ where: { periodId, employeeId } }),

  weeksOf: (periodId: string, siteId: string, employeeId: string, db: Db = prisma) =>
    db.timesheetWeek.findMany({ where: { periodId, siteId, employeeId }, orderBy: { weekStart: 'asc' } }),

  weekCounts: async (periodId: string, siteId: string, db: Db = prisma): Promise<Record<string, number>> => {
    const rows = await db.timesheetWeek.groupBy({ by: ['status'], where: { periodId, siteId }, _count: true });
    return Object.fromEntries(rows.map((row) => [row.status, row._count]));
  },
};
