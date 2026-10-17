import { prisma } from '../../../../config/database';
import type { Db } from '../employees/employees-repository';

/** Reads and writes for the daily People tasks. Each result names its company so the audit entry is filed correctly. */
export const schedulerRepository = {
  /** Onboarding files whose start day has come. */
  dueActivations: (today: Date) =>
    prisma.employee.findMany({
      where: { status: 'ONBOARDING', startDate: { lte: today } },
      select: { id: true, companyId: true, siteId: true },
      orderBy: [{ companyId: 'asc' }, { id: 'asc' }],
    }),

  /** Only still-onboarding rows change, so a second run changes nothing. */
  activate: (db: Db, companyId: string, ids: readonly string[]) =>
    db.employee.updateMany({ where: { id: { in: [...ids] }, companyId, status: 'ONBOARDING' }, data: { status: 'ACTIVE' } }),
};
