import { prisma } from '../../../../config/database';
import type { SiteCoverage } from './rollout-rules';

export const rolloutRepository = {
  /** The switch row and the earliest payroll month that includes the site. Two small indexed reads. */
  async coverage(siteId: string): Promise<SiteCoverage> {
    const [switchRow, first] = await Promise.all([
      prisma.attendanceSiteSwitch.findUnique({ where: { siteId }, select: { enabled: true, enabledAt: true } }),
      prisma.payrollMonth.findFirst({ where: { includedSiteIds: { has: siteId } }, orderBy: { monthKey: 'asc' }, select: { monthKey: true } }),
    ]);
    return { switchEnabled: switchRow?.enabled ?? false, switchEnabledAt: switchRow?.enabledAt ?? null, firstPayrollMonth: first?.monthKey ?? null };
  },

  /** The payroll months that include the site and are not paid (any state before PAID holds the site's clock on). */
  async unpaidMonthKeys(siteId: string): Promise<string[]> {
    const rows = await prisma.payrollMonth.findMany({ where: { includedSiteIds: { has: siteId }, state: { not: 'PAID' } }, select: { monthKey: true }, orderBy: { monthKey: 'asc' } });
    return rows.map((row) => row.monthKey);
  },
};
