import type { Prisma, TimeRequest, TimeRequestKind, TimeRequestState } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { fromDateColumn, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { Db } from '../../attendance/days/days-repository';
import type { RequestRow } from '../timesheets.types';

const asObject = (value: Prisma.JsonValue | null): Record<string, unknown> => (value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

export const toRequestRow = (row: TimeRequest): RequestRow => ({
  id: row.id,
  siteId: row.siteId,
  employeeId: row.employeeId,
  kind: row.kind,
  shiftDate: fromDateColumn(row.shiftDate),
  state: row.state,
  note: row.note,
  recorded: asObject(row.recorded),
  requested: asObject(row.requested),
  waitingOnRole: row.waitingOnRole,
  waitingOnUserId: row.waitingOnUserId,
  escalatedAt: row.escalatedAt,
  decidedById: row.decidedById,
  decidedAt: row.decidedAt,
  decisionReason: row.decisionReason,
  answerAfter: row.answerAfter === null ? null : asObject(row.answerAfter),
  appliedEventId: row.appliedEventId,
  createdAt: row.createdAt,
});

export interface NewRequest {
  siteId: string;
  employeeId: string;
  kind: TimeRequestKind;
  shiftDate: NairobiDate;
  note: string;
  recorded: Record<string, unknown>;
  requested: Record<string, unknown>;
  waitingOnRole: string;
  waitingOnUserId: string | null;
}

export interface RequestFilter {
  states: readonly TimeRequestState[];
  departmentIds: readonly string[] | null;
  employeeId?: string | undefined;
  search?: string | undefined;
}

/** Rows of `time_requests`. Every query carries the site (or the person, for the person's own list). */
export const requestsRepository = {
  create: async (tx: Db, data: NewRequest): Promise<RequestRow> =>
    toRequestRow(
      await tx.timeRequest.create({
        data: { ...data, shiftDate: toDateColumn(data.shiftDate), recorded: data.recorded as Prisma.InputJsonValue, requested: data.requested as Prisma.InputJsonValue },
      }),
    ),

  /** By id wherever it is; the caller checks the viewer's scope (404 if not). */
  findAnywhere: async (id: string, db: Db = prisma): Promise<RequestRow | null> => {
    const row = await db.timeRequest.findUnique({ where: { id } });
    return row ? toRequestRow(row) : null;
  },

  ofPerson: async (employeeId: string, states: readonly TimeRequestState[], take: number, db: Db = prisma): Promise<RequestRow[]> =>
    (await db.timeRequest.findMany({ where: { employeeId, state: { in: [...states] } }, orderBy: { createdAt: 'desc' }, take })).map(toRequestRow),

  ofPersonOnDates: async (siteId: string, employeeId: string, from: NairobiDate, to: NairobiDate, db: Db = prisma): Promise<RequestRow[]> =>
    (await db.timeRequest.findMany({ where: { siteId, employeeId, shiftDate: { gte: toDateColumn(from), lte: toDateColumn(to) } }, orderBy: { createdAt: 'desc' } })).map(toRequestRow),

  /** A person's open request of that kind for that day (one at a time, so a double tap makes one). */
  openOfKind: async (employeeId: string, kind: TimeRequestKind, date: NairobiDate, db: Db = prisma): Promise<RequestRow | null> => {
    const row = await db.timeRequest.findFirst({ where: { employeeId, kind, shiftDate: toDateColumn(date), state: 'WAITING' } });
    return row ? toRequestRow(row) : null;
  },

  /** The manager's inbox: one page for a site, oldest waiting first. */
  page: async (siteId: string, filter: RequestFilter, skip: number, take: number, db: Db = prisma) => {
    const where: Prisma.TimeRequestWhereInput = {
      siteId,
      state: { in: [...filter.states] },
      ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
      employee: {
        ...(filter.departmentIds ? { departmentId: { in: [...filter.departmentIds] } } : {}),
        ...(filter.search ? { name: { contains: filter.search, mode: 'insensitive' as const } } : {}),
      },
    };
    const [rows, total] = await Promise.all([
      db.timeRequest.findMany({ where, include: { employee: { select: { id: true, name: true, userId: true, departmentId: true, department: { select: { name: true } } } } }, orderBy: { createdAt: 'asc' }, skip, take }),
      db.timeRequest.count({ where }),
    ]);
    return { rows: rows.map((row) => ({ request: toRequestRow(row), person: row.employee })), total };
  },

  /** Claims the answer only while the request is still waiting (a second tap changes nothing). */
  answer: async (tx: Db, id: string, data: { state: 'APPROVED' | 'DECLINED'; decidedById: string; decidedAt: Date; decisionReason: string | null; answerAfter: Record<string, unknown>; appliedEventId: string | null }): Promise<boolean> =>
    (await tx.timeRequest.updateMany({ where: { id, state: 'WAITING' }, data: { ...data, answerAfter: data.answerAfter as Prisma.InputJsonValue } })).count === 1,

  withdraw: async (tx: Db, id: string, employeeId: string): Promise<boolean> =>
    (await tx.timeRequest.updateMany({ where: { id, employeeId, state: 'WAITING' }, data: { state: 'WITHDRAWN' } })).count === 1,

  /** Waiting requests older than the cut that have not moved to HR yet (all branches whose new clock is on). */
  staleWaiting: async (olderThan: Date, db: Db = prisma): Promise<RequestRow[]> =>
    (
      await db.timeRequest.findMany({
        where: { state: 'WAITING', escalatedAt: null, createdAt: { lt: olderThan }, site: { attendanceSwitch: { enabled: true } } },
        orderBy: { createdAt: 'asc' },
        take: 500,
      })
    ).map(toRequestRow),

  escalate: async (tx: Db, id: string, at: Date, hr: { userId: string | null }): Promise<boolean> =>
    (await tx.timeRequest.updateMany({ where: { id, state: 'WAITING', escalatedAt: null }, data: { escalatedAt: at, waitingOnRole: 'HR_MANAGER', waitingOnUserId: hr.userId } })).count === 1,

  /** Who a request is routed to: the people holding that role at the site (an HR Manager or System Admin has no site). */
  approverCandidates: async (siteId: string | null, roles: readonly ('MANAGER' | 'STORE_MANAGER' | 'HR_MANAGER' | 'SYSTEM_ADMIN' | 'ACCOUNTANT')[], db: Db = prisma) =>
    db.user.findMany({
      where: { isActive: true, deletedAt: null, role: { in: [...roles] }, ...(siteId ? { siteId } : {}) },
      select: { id: true, name: true, role: true },
      orderBy: { createdAt: 'asc' },
      take: 20,
    }),
};
