import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { fromDateColumn, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';

type Db = Prisma.TransactionClient | typeof prisma;

export interface RotaCell {
  employeeId: string;
  date: NairobiDate;
  templateName: string;
  overrideReason: string | null;
}

/** Rota cells of a department's people on a site over a range: the input of minimum cover and the rota strip. */
export const coverRepository = {
  cells: async (db: Db, siteId: string, departmentId: string, from: NairobiDate, to: NairobiDate): Promise<RotaCell[]> =>
    (
      await db.rotaEntry.findMany({
        where: { siteId, date: { gte: toDateColumn(from), lte: toDateColumn(to) }, employee: { departmentId } },
        select: { employeeId: true, date: true, overrideReason: true, template: { select: { name: true } } },
        orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
      })
    ).map((row) => ({ employeeId: row.employeeId, date: fromDateColumn(row.date), templateName: row.template.name, overrideReason: row.overrideReason })),

  /** Names of the people in a department who are active, for the strip rows. */
  team: async (db: Db, siteId: string, departmentId: string): Promise<{ id: string; name: string; positionName: string | null }[]> =>
    (
      await db.employee.findMany({
        where: { siteId, departmentId, status: { in: ['ACTIVE', 'ON_LEAVE'] } },
        select: { id: true, name: true, position: { select: { name: true } } },
        orderBy: { name: 'asc' },
      })
    ).map((row) => ({ id: row.id, name: row.name, positionName: row.position?.name ?? null })),
};
