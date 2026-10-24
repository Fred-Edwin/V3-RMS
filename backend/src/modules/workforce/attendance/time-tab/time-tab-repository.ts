import { prisma } from '../../../../config/database';
import { fromDateColumn, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';

/** Reads only the Time tab needs. Every query carries the site (or the person, who belongs to one site). */
export const timeTabRepository = {
  /** Overtime a person may be paid for, per day: covered without a decision, approved, or approved in part. Declined is zero. */
  approvedOvertimeByDay: async (siteId: string, employeeId: string, from: NairobiDate, to: NairobiDate): Promise<Map<NairobiDate, number>> => {
    const rows = await prisma.overtimeItem.findMany({
      where: { siteId, employeeId, shiftDate: { gte: toDateColumn(from), lte: toDateColumn(to) }, status: { in: ['AUTO_AUTHORISED', 'APPROVED', 'APPROVED_PART'] } },
      select: { shiftDate: true, authorisedMinutes: true },
    });
    const byDay = new Map<NairobiDate, number>();
    for (const row of rows) {
      const day = fromDateColumn(row.shiftDate);
      byDay.set(day, (byDay.get(day) ?? 0) + row.authorisedMinutes);
    }
    return byDay;
  },

  /** The days the person is employed (start day and, if they left, the last day). Outside them there is no "Day off" to show. */
  employedBetween: async (siteId: string, employeeId: string): Promise<{ from: NairobiDate | null; to: NairobiDate | null }> => {
    const row = await prisma.employee.findFirst({ where: { id: employeeId, siteId }, select: { startDate: true, exitedOn: true } });
    return { from: row?.startDate ? fromDateColumn(row.startDate) : null, to: row?.exitedOn ? fromDateColumn(row.exitedOn) : null };
  },

  /** The position name that goes in "Faith Njeri · Branch Manager" (null when the file has none). */
  positionName: async (siteId: string, employeeId: string): Promise<string | null> =>
    (await prisma.employee.findFirst({ where: { id: employeeId, siteId }, select: { position: { select: { name: true } } } }))?.position?.name ?? null,

  /** The site's name, for "The clock is off at Nyeri Town". */
  siteName: async (siteId: string): Promise<string | null> => (await prisma.site.findUnique({ where: { id: siteId }, select: { name: true } }))?.name ?? null,
};
