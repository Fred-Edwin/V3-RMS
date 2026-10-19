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

  /** The payroll months that include the site and are not paid. (Part 2 adds the PAID state; until then every month holds the site.) */
  async unpaidMonthKeys(siteId: string): Promise<string[]> {
    const rows = await prisma.payrollMonth.findMany({ where: { includedSiteIds: { has: siteId } }, select: { monthKey: true, state: true }, orderBy: { monthKey: 'asc' } });
    return rows.filter((row) => (row.state as string) !== 'PAID').map((row) => row.monthKey);
  },
};
