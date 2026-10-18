import { prisma } from '../../../../config/database';
import { toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';

/** Who is told when the phone closes a shift: the department's heads on the day, and the site's Branch Managers. */
export const alertsRepository = {
  closeAlertRecipients: async (siteId: string, departmentId: string | null, date: NairobiDate): Promise<string[]> => {
    const day = toDateColumn(date);
    const [managers, heads] = await Promise.all([
      prisma.user.findMany({ where: { siteId, role: 'MANAGER', isActive: true }, select: { id: true } }),
      departmentId
        ? prisma.departmentHead.findMany({
            where: { departmentId, startsOn: { lte: day }, OR: [{ endsOn: null }, { endsOn: { gte: day } }] },
            select: { employee: { select: { userId: true } } },
          })
        : Promise.resolve([]),
    ]);
    return [...managers.map((m) => m.id), ...heads.map((h) => h.employee.userId).filter((id): id is string => id !== null)];
  },
};
