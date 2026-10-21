import { prisma } from '../../../../config/database';
import { toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';

export interface TeamPersonRow {
  id: string;
  name: string;
  positionName: string | null;
  departmentName: string | null;
}

export interface TeamShiftRow {
  employeeId: string;
  startTime: string;
  endTime: string;
}

/** Reads for My team. Every query carries the site; a head's departments narrow it further. No pay, ID or contract column is selected. */
export const teamRepository = {
  people: async (siteId: string, date: NairobiDate, departmentIds: readonly string[] | null, q: string | undefined): Promise<TeamPersonRow[]> => {
    const day = toDateColumn(date);
    const rows = await prisma.employee.findMany({
      where: {
        siteId,
        status: { not: 'EXITED' },
        startDate: { lte: day },
        ...(departmentIds ? { departmentId: { in: [...departmentIds] } } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { position: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
      },
      select: { id: true, name: true, position: { select: { name: true } }, department: { select: { name: true } } },
      orderBy: { name: 'asc' },
      take: 500,
    });
    return rows.map((r) => ({ id: r.id, name: r.name, positionName: r.position?.name ?? null, departmentName: r.department?.name ?? null }));
  },

  shiftsOn: async (siteId: string, date: NairobiDate, employeeIds: readonly string[]): Promise<TeamShiftRow[]> => {
    if (employeeIds.length === 0) return [];
    const rows = await prisma.rotaEntry.findMany({
      where: { siteId, date: toDateColumn(date), employeeId: { in: [...employeeIds] } },
      select: { employeeId: true, template: { select: { startTime: true, endTime: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({ employeeId: r.employeeId, startTime: r.template.startTime, endTime: r.template.endTime }));
  },
};
