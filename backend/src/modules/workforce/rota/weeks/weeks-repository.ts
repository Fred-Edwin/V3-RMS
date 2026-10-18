import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

/** Reads for the rota grid, the printed rota and "my shifts". Every query carries the site (and so the company). */
export type Db = Prisma.TransactionClient | typeof prisma;

const EMPLOYEE_SELECT = {
  id: true,
  name: true,
  userId: true,
  siteId: true,
  departmentId: true,
  payType: true,
  department: { select: { name: true } },
  position: { select: { name: true } },
  payProfile: { select: { standardWeekHours: true } },
} satisfies Prisma.EmployeeSelect;
export type GridEmployee = Prisma.EmployeeGetPayload<{ select: typeof EMPLOYEE_SELECT }>;

export interface GridEntry {
  id: string;
  employeeId: string;
  date: Date;
  templateId: string;
  overrideReason: string | null;
}

export const weeksRepository = {
  /** People who clock in at this site and are employed at some point of the week, optionally limited to departments. */
  employeesOnRota: (siteId: string, departmentIds: readonly string[] | null, from: Date, to: Date): Promise<GridEmployee[]> =>
    prisma.employee.findMany({
      where: {
        siteId,
        tracksTime: true,
        startDate: { lte: to },
        OR: [{ exitedOn: null }, { exitedOn: { gte: from } }],
        ...(departmentIds ? { departmentId: { in: [...departmentIds] } } : {}),
      },
      select: EMPLOYEE_SELECT,
      orderBy: { name: 'asc' },
    }),

  employeesByIds: (siteId: string, ids: readonly string[]): Promise<GridEmployee[]> =>
    prisma.employee.findMany({ where: { siteId, id: { in: [...ids] } }, select: EMPLOYEE_SELECT, orderBy: { name: 'asc' } }),

  entriesInRange: (siteId: string, from: Date, to: Date): Promise<GridEntry[]> =>
    prisma.rotaEntry.findMany({
      where: { siteId, date: { gte: from, lte: to } },
      select: { id: true, employeeId: true, date: true, templateId: true, overrideReason: true },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),

  /** Departments of a site that are open, with whoever heads each (a substantive head first) on the given day. */
  departmentsWithHeads: (siteId: string, ids: readonly string[] | null, today: Date) =>
    prisma.department.findMany({
      where: { siteId, status: 'ACTIVE', ...(ids ? { id: { in: [...ids] } } : {}) },
      select: {
        id: true,
        name: true,
        position: true,
        heads: {
          where: { startsOn: { lte: today }, OR: [{ endsOn: null }, { endsOn: { gte: today } }] },
          select: { isActing: true, employee: { select: { name: true } } },
          orderBy: { isActing: 'asc' },
        },
      },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    }),

  siteName: async (siteId: string): Promise<string | null> => (await prisma.site.findUnique({ where: { id: siteId }, select: { name: true } }))?.name ?? null,

  /** The login's own employee file, for "my shifts". */
  employeeOfUser: (userId: string) => prisma.employee.findUnique({ where: { userId }, select: { id: true, siteId: true, name: true } }),

  /** A person's own shifts in a range, with the shift's details. */
  shiftsOfEmployee: (employeeId: string, from: Date, to: Date) =>
    prisma.rotaEntry.findMany({
      where: { employeeId, date: { gte: from, lte: to } },
      select: {
        id: true,
        date: true,
        template: { select: { id: true, name: true, letter: true, colour: true, startTime: true, endTime: true, unpaidBreakMinutes: true } },
      },
      orderBy: [{ date: 'asc' }, { template: { startTime: 'asc' } }],
    }),
};
