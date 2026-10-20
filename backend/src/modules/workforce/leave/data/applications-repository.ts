import type { LeaveApplicationStatus, Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { fromDateColumn, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { LeaveStageCode, LeaveStatusCode, TypeSnapshot } from '../leave.types';

type Db = Prisma.TransactionClient | typeof prisma;

/** One application with its dates as Nairobi dates. */
export interface ApplicationRow {
  id: string;
  companyId: string;
  siteId: string;
  employeeId: string;
  typeCode: string;
  type: TypeSnapshot;
  start: NairobiDate;
  end: NairobiDate;
  days: number;
  unpaidTailDays: number;
  note: string | null;
  status: LeaveStatusCode;
  stage: LeaveStageCode;
  routedToRole: string;
  askedAt: Date;
  withHrAt: Date | null;
  decidedAt: Date | null;
  decidedBy: string | null;
  deciderRole: string | null;
  decisionReasonCode: string | null;
  decisionNote: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  slipNumber: number | null;
  slipSnapshot: Prisma.JsonValue | null;
  slipHash: string | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  version: number;
  origin: 'NEW' | 'LEGACY';
  countedIn: 'CALENDAR_DAYS' | 'WORKING_DAYS';
}

type Db$Row = Prisma.LeaveApplicationGetPayload<Record<string, never>>;

export const toApplication = (row: Db$Row): ApplicationRow => ({
  id: row.id,
  companyId: row.companyId,
  siteId: row.siteId,
  employeeId: row.employeeId,
  typeCode: row.typeCode,
  type: row.typeSnapshot as unknown as TypeSnapshot,
  start: fromDateColumn(row.startDate),
  end: fromDateColumn(row.endDate),
  days: row.days,
  unpaidTailDays: row.unpaidTailDays,
  note: row.note,
  status: row.status,
  stage: row.stage,
  routedToRole: row.routedToRole,
  askedAt: row.askedAt,
  withHrAt: row.withHrAt,
  decidedAt: row.decidedAt,
  decidedBy: row.decidedBy,
  deciderRole: row.deciderRole,
  decisionReasonCode: row.decisionReasonCode,
  decisionNote: row.decisionNote,
  cancelledAt: row.cancelledAt,
  cancelledBy: row.cancelledBy,
  cancelReason: row.cancelReason,
  slipNumber: row.slipNumber,
  slipSnapshot: row.slipSnapshot,
  slipHash: row.slipHash,
  balanceBefore: row.balanceBefore,
  balanceAfter: row.balanceAfter,
  version: row.version,
  origin: row.origin,
  countedIn: row.countedIn,
});

export interface NewApplication {
  companyId: string;
  siteId: string;
  employeeId: string;
  typeCode: string;
  type: TypeSnapshot;
  start: NairobiDate;
  end: NairobiDate;
  days: number;
  unpaidTailDays: number;
  note: string | null;
  stage: LeaveStageCode;
  routedToRole: string;
  askedAt: Date;
  idempotencyKey: string | null;
}

export interface ListFilter {
  companyId: string;
  siteId?: string;
  statuses?: readonly LeaveStatusCode[];
  /** Department, name and head-of-department filters are resolved to people by the caller. */
  employeeIds?: readonly string[];
  employeeId?: string;
  year?: number;
  typeCode?: string;
  /** "Recent": waiting, or asked or decided since `since`, or not finished yet (ends on or after `today`). */
  recent?: { since: Date; today: NairobiDate };
}

const whereOf = (filter: ListFilter): Prisma.LeaveApplicationWhereInput => ({
  companyId: filter.companyId,
  ...(filter.siteId ? { siteId: filter.siteId } : {}),
  ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
  ...(filter.employeeIds ? { employeeId: { in: [...filter.employeeIds] } } : {}),
  ...(filter.statuses ? { status: { in: [...filter.statuses] as LeaveApplicationStatus[] } } : {}),
  ...(filter.typeCode ? { typeCode: filter.typeCode } : {}),
  ...(filter.recent
    ? { OR: [{ status: 'WAITING' as const }, { askedAt: { gte: filter.recent.since } }, { decidedAt: { gte: filter.recent.since } }, { endDate: { gte: toDateColumn(filter.recent.today) } }] }
    : {}),
  ...(filter.year ? { startDate: { gte: toDateColumn(`${filter.year}-01-01` as NairobiDate), lte: toDateColumn(`${filter.year}-12-31` as NairobiDate) } } : {}),
});

export const applicationsRepository = {
  create: async (tx: Prisma.TransactionClient, data: NewApplication): Promise<ApplicationRow> =>
    toApplication(
      await tx.leaveApplication.create({
        data: {
          companyId: data.companyId,
          siteId: data.siteId,
          employeeId: data.employeeId,
          typeCode: data.typeCode,
          typeSnapshot: data.type as unknown as Prisma.InputJsonValue,
          startDate: toDateColumn(data.start),
          endDate: toDateColumn(data.end),
          days: data.days,
          unpaidTailDays: data.unpaidTailDays,
          note: data.note,
          stage: data.stage,
          routedToRole: data.routedToRole,
          askedAt: data.askedAt,
          idempotencyKey: data.idempotencyKey,
        },
      }),
    ),

  byId: async (companyId: string, id: string, db: Db = prisma): Promise<ApplicationRow | null> => {
    const row = await db.leaveApplication.findFirst({ where: { id, companyId } });
    return row ? toApplication(row) : null;
  },

  byKey: async (employeeId: string, idempotencyKey: string, db: Db = prisma): Promise<ApplicationRow | null> => {
    const row = await db.leaveApplication.findFirst({ where: { employeeId, idempotencyKey } });
    return row ? toApplication(row) : null;
  },

  /** Serialises two people deciding the same request: a row lock for the rest of the transaction. */
  lock: async (tx: Prisma.TransactionClient, id: string): Promise<void> => {
    await tx.$queryRaw`SELECT "id" FROM "leave_applications" WHERE "id" = ${id} FOR UPDATE`;
  },

  /** Serialises everything one person does at once (two asks that overlap) for the rest of the transaction. */
  lockPerson: async (tx: Prisma.TransactionClient, employeeId: string): Promise<void> => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`leave:${employeeId}`}))`;
  },

  /** A request of the same person that shares a day with the range and is not finished with (waiting or approved). */
  overlapping: async (db: Db, employeeId: string, start: NairobiDate, end: NairobiDate, excludeId?: string): Promise<ApplicationRow | null> => {
    const row = await db.leaveApplication.findFirst({
      where: { employeeId, status: { in: ['WAITING', 'APPROVED'] }, startDate: { lte: toDateColumn(end) }, endDate: { gte: toDateColumn(start) }, ...(excludeId ? { id: { not: excludeId } } : {}) },
      orderBy: { startDate: 'asc' },
    });
    return row ? toApplication(row) : null;
  },

  /** Approved requests of the new system that touch a leave year, for balances. */
  approvedInYear: async (db: Db, employeeIds: readonly string[], year: number): Promise<ApplicationRow[]> =>
    (
      await db.leaveApplication.findMany({
        where: {
          employeeId: { in: [...employeeIds] },
          status: 'APPROVED',
          origin: 'NEW',
          startDate: { lte: toDateColumn(`${year}-12-31` as NairobiDate) },
          endDate: { gte: toDateColumn(`${year}-01-01` as NairobiDate) },
        },
      })
    ).map(toApplication),

  /** Approved leave overlapping a range, any origin: the rota, Today board and calendar show every approved day. */
  approvedBetween: async (db: Db, filter: { companyId: string; siteId?: string; employeeIds?: readonly string[] }, from: NairobiDate, to: NairobiDate): Promise<ApplicationRow[]> =>
    (
      await db.leaveApplication.findMany({
        where: {
          companyId: filter.companyId,
          ...(filter.siteId ? { siteId: filter.siteId } : {}),
          ...(filter.employeeIds ? { employeeId: { in: [...filter.employeeIds] } } : {}),
          status: 'APPROVED',
          startDate: { lte: toDateColumn(to) },
          endDate: { gte: toDateColumn(from) },
        },
        orderBy: { startDate: 'asc' },
      })
    ).map(toApplication),

  /** Approved leave of named people over a range (the rota's lookup). The people were already scoped by the rota caller. */
  approvedForPeople: async (employeeIds: readonly string[], from: NairobiDate, to: NairobiDate, db: Db = prisma): Promise<ApplicationRow[]> =>
    (await db.leaveApplication.findMany({ where: { employeeId: { in: [...employeeIds] }, status: 'APPROVED', startDate: { lte: toDateColumn(to) }, endDate: { gte: toDateColumn(from) } } })).map(toApplication),

  /** Waiting and approved-or-waiting rows overlapping a range, for the calendar bars. */
  liveBetween: async (db: Db, filter: ListFilter, from: NairobiDate, to: NairobiDate): Promise<ApplicationRow[]> =>
    (
      await db.leaveApplication.findMany({
        where: { ...whereOf({ ...filter, statuses: ['WAITING', 'APPROVED'] }), startDate: { lte: toDateColumn(to) }, endDate: { gte: toDateColumn(from) } },
        orderBy: [{ startDate: 'asc' }, { askedAt: 'asc' }],
      })
    ).map(toApplication),

  /** A page of requests, newest ask first (waiting ones are sorted to the top by the caller's filter). */
  page: async (filter: ListFilter, skip: number, take: number, db: Db = prisma): Promise<{ rows: ApplicationRow[]; total: number }> => {
    const where = whereOf(filter);
    const [rows, total] = await Promise.all([
      db.leaveApplication.findMany({ where, orderBy: [{ askedAt: 'desc' }, { id: 'asc' }], skip, take }),
      db.leaveApplication.count({ where }),
    ]);
    return { rows: rows.map(toApplication), total };
  },

  /** Every waiting request in scope. The set is small (open requests only); the caller narrows it by routing. */
  waiting: async (filter: { companyId: string; siteId?: string }, db: Db = prisma): Promise<ApplicationRow[]> =>
    (await db.leaveApplication.findMany({ where: { companyId: filter.companyId, ...(filter.siteId ? { siteId: filter.siteId } : {}), status: 'WAITING' }, orderBy: { askedAt: 'asc' } })).map(toApplication),

  /** Waiting requests with a site manager that are past the 72 hours and not yet marked, oldest first (the hourly job). */
  dueForHr: async (cutoff: Date, take: number, db: Db = prisma): Promise<ApplicationRow[]> =>
    (
      await db.leaveApplication.findMany({
        where: { status: 'WAITING', stage: 'MANAGER', withHrAt: null, routedToRole: { in: ['MANAGER', 'STORE_MANAGER'] }, askedAt: { lte: cutoff } },
        orderBy: { askedAt: 'asc' },
        take,
      })
    ).map(toApplication),

  /** Approved or waiting requests that have not ended, for a site's switch-off mirror (L5). */
  openForSite: async (siteId: string, today: NairobiDate, db: Db = prisma): Promise<ApplicationRow[]> =>
    (await db.leaveApplication.findMany({ where: { siteId, status: { in: ['WAITING', 'APPROVED'] }, endDate: { gte: toDateColumn(today) } } })).map(toApplication),

  /** The write that moves a request on, only if the version is still the one the caller saw. Returns false when it was not. */
  update: async (tx: Prisma.TransactionClient, id: string, expectedVersion: number, data: Prisma.LeaveApplicationUncheckedUpdateManyInput): Promise<boolean> => {
    const { count } = await tx.leaveApplication.updateMany({ where: { id, version: expectedVersion }, data: { ...data, version: { increment: 1 }, updatedAt: new Date() } });
    return count === 1;
  },

  /** The hourly job's mark: only while still waiting and unmarked, so a second run writes nothing. */
  markWithHr: async (tx: Prisma.TransactionClient, id: string, at: Date): Promise<boolean> => {
    const { count } = await tx.leaveApplication.updateMany({ where: { id, status: 'WAITING', withHrAt: null }, data: { stage: 'HR', withHrAt: at, version: { increment: 1 }, updatedAt: at } });
    return count === 1;
  },

  nextSlipNumber: async (tx: Prisma.TransactionClient): Promise<number> => {
    const rows = await tx.$queryRaw<{ n: number }[]>`SELECT nextval('public.leave_document_seq')::int AS n`;
    return rows[0]?.n ?? 0;
  },

  bySlipNumber: async (number: number, db: Db = prisma): Promise<ApplicationRow | null> => {
    const row = await db.leaveApplication.findFirst({ where: { slipNumber: number } });
    return row ? toApplication(row) : null;
  },

  /** Names of the people of these applications are looked up by the caller; this lists the people with leave this year. */
  peopleWithLeaveIn: async (companyId: string, year: number, db: Db = prisma): Promise<string[]> =>
    (await db.leaveApplication.findMany({ where: { companyId, status: { in: ['WAITING', 'APPROVED'] }, startDate: { lte: toDateColumn(`${year}-12-31` as NairobiDate) }, endDate: { gte: toDateColumn(`${year}-01-01` as NairobiDate) } }, distinct: ['employeeId'], select: { employeeId: true } })).map((row) => row.employeeId),
};
