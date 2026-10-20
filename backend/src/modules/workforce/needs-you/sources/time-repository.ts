import { prisma } from '../../../../config/database';

const WHO = { select: { name: true, user: { select: { id: true, role: true } } } } as const;

/** What the Timesheets sources read: their own tables, scoped by site, nothing about pay. */
export const timeReads = {
  /** Overtime items a person still has to decide. */
  overtimeUndecided: (siteIds: readonly string[]) =>
    prisma.overtimeItem.findMany({
      where: { siteId: { in: [...siteIds] }, status: 'PENDING', period: { state: { not: 'APPROVED' } } },
      select: { id: true, siteId: true, shiftDate: true, needsMinutes: true, limits: true, createdAt: true, employee: WHO },
      orderBy: { createdAt: 'asc' },
      take: 500,
    }),

  /** Open Report a problem / clock fix requests. `waitingOn` filters the role (or the named person) the request waits on. */
  timeRequestsWaiting: (siteIds: readonly string[], waitingOn: { roles: readonly string[]; userId: string } | null) =>
    prisma.timeRequest.findMany({
      where: { siteId: { in: [...siteIds] }, state: 'WAITING', ...(waitingOn ? { OR: [{ waitingOnRole: { in: [...waitingOn.roles] } }, { waitingOnUserId: waitingOn.userId }] } : {}) },
      select: { id: true, siteId: true, kind: true, shiftDate: true, waitingOnRole: true, createdAt: true, escalatedAt: true, employee: WHO },
      orderBy: { createdAt: 'asc' },
      take: 500,
    }),

  /** Days the system closed that still need a look, in months nobody has approved yet. */
  shiftsClosedBySystem: (siteIds: readonly string[]) =>
    prisma.timesheetDay.findMany({
      where: { siteId: { in: [...siteIds] }, reasons: { has: 'AUTO_CLOSED' }, status: { in: ['NEEDS_LOOK', 'HELD'] }, period: { state: { not: 'APPROVED' } } },
      select: { id: true, siteId: true, shiftDate: true, updatedAt: true, employee: WHO },
      orderBy: { shiftDate: 'asc' },
      take: 500,
    }),

  /** Months that have ended and are not approved. The caller compares `endDate` with today (Nairobi). */
  monthsToApprove: (siteIds: readonly string[], endedBefore: Date) =>
    prisma.timesheetPeriod.findMany({
      where: { siteId: { in: [...siteIds] }, state: 'OPEN', approvedAt: null, endDate: { lt: endedBefore } },
      select: { id: true, siteId: true, startDate: true, endDate: true, cutoffAt: true, site: { select: { name: true } } },
      orderBy: { endDate: 'asc' },
      take: 200,
    }),

  headcountOf: async (periodIds: readonly string[]): Promise<Map<string, number>> => {
    if (periodIds.length === 0) return new Map();
    const rows = await prisma.timesheetDay.findMany({ where: { periodId: { in: [...periodIds] } }, distinct: ['periodId', 'employeeId'], select: { periodId: true, employeeId: true } });
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.periodId, (counts.get(r.periodId) ?? 0) + 1);
    return counts;
  },

  /** Casual sheets sent and waiting for their approver. */
  casualSheetsSent: (siteIds: readonly string[]) =>
    prisma.casualSheet.findMany({
      where: { siteId: { in: [...siteIds] }, status: 'SENT' },
      select: { id: true, siteId: true, departmentId: true, workDate: true, sentAt: true, createdAt: true, recordedById: true, _count: { select: { lines: true } } },
      orderBy: { sentAt: 'asc' },
      take: 200,
    }),

  siteNamesOf: async (ids: readonly string[]): Promise<Map<string, string>> => {
    if (ids.length === 0) return new Map();
    const rows = await prisma.site.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  },

  departmentNames: async (ids: readonly string[]): Promise<Map<string, string>> => {
    if (ids.length === 0) return new Map();
    const rows = await prisma.department.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  },
};
