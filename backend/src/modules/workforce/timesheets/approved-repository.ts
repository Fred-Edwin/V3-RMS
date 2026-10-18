import { prisma } from '../../../config/database';
import { toDateColumn, type NairobiDate } from '../_shared/time/nairobi-time';

/** Read-only sums over approved days and authorised overtime for one person at their site. */
export const approvedRepository = {
  minutes: async (siteId: string, employeeId: string, from: NairobiDate, to: NairobiDate): Promise<{ workedMinutes: number; overtimeApprovedMinutes: number }> => {
    const range = { gte: toDateColumn(from), lte: toDateColumn(to) };
    const [days, overtime] = await Promise.all([
      prisma.timesheetDay.aggregate({ where: { siteId, employeeId, shiftDate: range, status: { in: ['AUTO_APPROVED', 'APPROVED'] } }, _sum: { workedMinutes: true } }),
      prisma.overtimeItem.aggregate({ where: { siteId, employeeId, shiftDate: range, status: { in: ['APPROVED', 'AUTO_AUTHORISED'] } }, _sum: { authorisedMinutes: true } }),
    ]);
    return { workedMinutes: days._sum.workedMinutes ?? 0, overtimeApprovedMinutes: overtime._sum.authorisedMinutes ?? 0 };
  },
};
