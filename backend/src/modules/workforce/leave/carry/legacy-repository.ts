import type { LeaveStatus, LeaveType, Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';

type Db = Prisma.TransactionClient | typeof prisma;

/** The old leave tables, read for the switch-on carry. They are never edited (the only insert is the switch-off mirror). */
export const legacyLeaveRepository = {
  /** Old requests of a site that end today or later (any status), or were decided this year. */
  requests: (db: Db, siteId: string, today: NairobiDate, yearStart: NairobiDate) =>
    db.leaveRequest.findMany({
      where: { siteId, OR: [{ endDate: { gte: toDateColumn(today) } }, { status: { not: 'PENDING' }, reviewedAt: { gte: toDateColumn(yearStart) } }] },
      select: { id: true, employeeProfileId: true, leaveType: true, startDate: true, endDate: true, totalDays: true, reason: true, status: true, reviewedById: true, reviewedAt: true, cancelledAt: true, cancelledById: true, createdAt: true },
    }),

  /** Old balances of these people for the year. */
  balances: (db: Db, profileIds: readonly string[], year: number) =>
    db.leaveBalance.findMany({ where: { employeeProfileId: { in: [...profileIds] }, leaveYear: year }, select: { id: true, employeeProfileId: true, leaveType: true, totalDays: true, usedDays: true } }),

  /** The new-system people of a site with their old profile id, for the mapping. */
  people: (db: Db, siteId: string) =>
    db.employee.findMany({ where: { siteId, legacyProfileId: { not: null }, status: { not: 'EXITED' } }, select: { id: true, companyId: true, legacyProfileId: true, departmentId: true, user: { select: { role: true } }, site: { select: { type: true } } } }),

  /** Old rows already carried (or mirrored back), so a repeat adds nothing. */
  carriedIds: async (db: Db, ids: readonly string[]): Promise<Set<string>> =>
    new Set((await db.leaveApplication.findMany({ where: { legacyRequestId: { in: [...ids] } }, select: { legacyRequestId: true } })).map((r) => r.legacyRequestId as string)),

  /** A carried copy that is still waiting, to update when the old row was decided in the gap. */
  waitingCopies: (db: Db, ids: readonly string[]) =>
    db.leaveApplication.findMany({ where: { legacyRequestId: { in: [...ids] }, status: 'WAITING' }, select: { id: true, legacyRequestId: true, version: true } }),

  /** One carried copy; a repeat of the same old request id inserts nothing (returns 0). */
  copyIn: async (tx: Prisma.TransactionClient, data: Prisma.LeaveApplicationUncheckedCreateInput): Promise<number> => (await tx.leaveApplication.createMany({ data: [data], skipDuplicates: true })).count,

  /** Old profile ids of new-system people, for the switch-off mirror. */
  profileIds: async (tx: Prisma.TransactionClient, employeeIds: readonly string[]): Promise<Map<string, string | null>> =>
    new Map((await tx.employee.findMany({ where: { id: { in: [...employeeIds] } }, select: { id: true, legacyProfileId: true } })).map((e) => [e.id, e.legacyProfileId] as const)),

  /** After a mirror: the new request remembers the old row, so a later switch-on skips it. */
  linkLegacy: async (tx: Prisma.TransactionClient, applicationId: string, legacyRequestId: string): Promise<void> => {
    await tx.leaveApplication.update({ where: { id: applicationId }, data: { legacyRequestId } });
  },

  /** An old balance row to attach a mirrored request to. */
  balanceFor: (db: Db, profileId: string, leaveType: LeaveType, year: number) => db.leaveBalance.findFirst({ where: { employeeProfileId: profileId, leaveType, leaveYear: year }, select: { id: true } }),

  /** The switch-off mirror: one marked old row (insert only; the marker is the comment). */
  insertMirror: (tx: Prisma.TransactionClient, row: { profileId: string; balanceId: string; siteId: string; leaveType: LeaveType; start: NairobiDate; end: NairobiDate; days: number; reason: string; status: LeaveStatus; reviewedById: string | null; reviewedAt: Date | null }) =>
    tx.leaveRequest.create({
      data: { employeeProfileId: row.profileId, leaveBalanceId: row.balanceId, siteId: row.siteId, leaveType: row.leaveType, startDate: toDateColumn(row.start), endDate: toDateColumn(row.end), totalDays: row.days, reason: row.reason, status: row.status, reviewedById: row.reviewedById, reviewedAt: row.reviewedAt, reviewComment: 'Mirrored from the new leave system' },
      select: { id: true },
    }),
};
