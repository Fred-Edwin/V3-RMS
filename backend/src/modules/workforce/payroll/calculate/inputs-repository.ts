import { prisma } from '../../../../config/database';
import { fromDateColumn, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { MonthWindow } from '../months/month-calendar';

/** Reads for one calculation. Every query names the sites (all of the company's) it may see; nothing here decides anything. */
export const inputsRepository = {
  /** Sites of the company whose attendance switch is on, with the moment it was switched on. */
  async switchedSites(companyId: string) {
    const rows = await prisma.attendanceSiteSwitch.findMany({
      where: { enabled: true, site: { companyId, isActive: true } },
      select: { siteId: true, enabledAt: true, site: { select: { name: true } } },
    });
    return rows.map((row) => ({ siteId: row.siteId, name: row.site.name, enabledAt: row.enabledAt }));
  },

  /** Sites that appeared in an earlier or this payroll month (they never go back to the old run). */
  async sitesEverInPayroll(companyId: string, upToMonthKey: string): Promise<string[]> {
    const rows = await prisma.payrollMonth.findMany({ where: { companyId, monthKey: { lte: upToMonthKey }, NOT: { includedSiteIds: { isEmpty: true } } }, select: { includedSiteIds: true } });
    return [...new Set(rows.flatMap((row) => row.includedSiteIds))];
  },

  async siteNames(companyId: string, siteIds: readonly string[]): Promise<Map<string, string>> {
    const rows = await prisma.site.findMany({ where: { companyId, id: { in: [...siteIds] } }, select: { id: true, name: true } });
    return new Map(rows.map((row) => [row.id, row.name]));
  },

  /** The sites' timesheet months for the calendar month (a month period starts on its first day). */
  async periods(siteIds: readonly string[], window: MonthWindow) {
    return prisma.timesheetPeriod.findMany({
      where: { siteId: { in: [...siteIds] }, startDate: toDateColumn(window.first) },
      select: { id: true, siteId: true, state: true, approvedAt: true, approvedById: true, documentNumber: true, approvedSnapshot: true },
    });
  },

  /** People of these sites with a spell that overlaps the month, with what pay needs. One query, no per-person reads. */
  async employees(companyId: string, siteIds: readonly string[], window: MonthWindow) {
    return prisma.employee.findMany({
      where: {
        companyId,
        siteId: { in: [...siteIds] },
        status: { not: 'ONBOARDING' },
        spells: { some: { startsOn: { lte: toDateColumn(window.last) }, OR: [{ endedOn: null }, { endedOn: { gte: toDateColumn(window.first) } }] } },
      },
      select: {
        id: true,
        siteId: true,
        userId: true,
        name: true,
        employeeNumber: true,
        payType: true,
        kraPin: true,
        nssfNumber: true,
        shaNumber: true,
        department: { select: { name: true } },
        spells: { select: { startsOn: true, endedOn: true } },
        payProfile: { select: { amount: true, overtimeEligible: true, standardWeekHours: true, standardDayHours: true, payoutMethod: true, bankName: true, accountNumber: true, updatedAt: true } },
      },
      orderBy: [{ siteId: 'asc' }, { name: 'asc' }],
    });
  },

  /** The approved days of these timesheet months: what the lateness, holiday and rest-day rules need. */
  async approvedDays(periodIds: readonly string[]) {
    const rows = await prisma.timesheetDay.findMany({
      where: { periodId: { in: [...periodIds] }, status: { in: ['AUTO_APPROVED', 'APPROVED'] } },
      select: { employeeId: true, shiftDate: true, workedMinutes: true, scheduledMinutes: true, minutesLate: true, minutesAfterGrace: true, lateExcused: true },
      orderBy: [{ employeeId: 'asc' }, { shiftDate: 'asc' }],
    });
    return rows.map((row) => ({ ...row, shiftDate: fromDateColumn(row.shiftDate) as NairobiDate }));
  },

  async authorisedOvertime(periodIds: readonly string[]) {
    const rows = await prisma.overtimeItem.findMany({
      where: { periodId: { in: [...periodIds] }, authorisedMinutes: { gt: 0 } },
      select: { employeeId: true, shiftDate: true, authorisedMinutes: true },
    });
    return rows.map((row) => ({ ...row, shiftDate: fromDateColumn(row.shiftDate) as NairobiDate }));
  },

  /** Last month's net and bank fingerprint per person, from the previous month's current run. */
  async previousMonth(companyId: string, monthKey: string) {
    const month = await prisma.payrollMonth.findUnique({ where: { companyId_monthKey: { companyId, monthKey } }, select: { currentRunId: true } });
    if (!month?.currentRunId) return [];
    return prisma.payrollPayslip.findMany({ where: { runId: month.currentRunId }, select: { employeeId: true, net: true, input: true } });
  },

  /** Who confirmed the company's statutory tables of a version, and when (the Rules door does not expose it). */
  async statutoryConfirmation(companyId: string, version: number): Promise<{ confirmedById: string; confirmedAt: Date } | null> {
    const row = await prisma.ruleVersion.findFirst({ where: { companyId, siteId: null, group: 'STATUTORY', version }, select: { confirmations: { where: { scope: 'statutory' }, select: { confirmedById: true, confirmedAt: true }, take: 1 } } });
    return row?.confirmations[0] ?? null;
  },

  /** The lines HR added that are still in force. */
  async activeAdjustments(monthId: string) {
    return prisma.payrollAdjustment.findMany({ where: { monthId, removedAt: null }, orderBy: { createdAt: 'asc' } });
  },

  async leftOut(monthId: string) {
    return prisma.payrollLeftOut.findMany({ where: { monthId }, select: { employeeId: true, byId: true } });
  },

  /** People who already had a payslip in an earlier payroll month. */
  async hadPayslipBefore(companyId: string, beforeMonthKey: string, employeeIds: readonly string[]): Promise<Set<string>> {
    const rows = await prisma.payrollPayslip.findMany({ where: { employeeId: { in: [...employeeIds] }, run: { month: { companyId, monthKey: { lt: beforeMonthKey } } } }, select: { employeeId: true }, distinct: ['employeeId'] });
    return new Set(rows.map((row) => row.employeeId));
  },

  /** People left out of an earlier payroll month (they get an ARREARS line). */
  async leftOutEarlier(companyId: string, beforeMonthKey: string, employeeIds: readonly string[]): Promise<Set<string>> {
    const rows = await prisma.payrollLeftOut.findMany({ where: { employeeId: { in: [...employeeIds] }, month: { companyId, monthKey: { lt: beforeMonthKey } } }, select: { employeeId: true } });
    return new Set(rows.map((row) => row.employeeId));
  },

  /** Users who already have an old payslip for this period at a site outside the new Payroll (E10: moved between systems). */
  async legacyPayslipUsers(userIds: readonly string[], payPeriod: string, excludeSiteIds: readonly string[]): Promise<Set<string>> {
    const rows = await prisma.payslip.findMany({ where: { payPeriod, userId: { in: [...userIds] }, siteId: { notIn: [...excludeSiteIds] } }, select: { userId: true } });
    return new Set(rows.map((row) => row.userId));
  },

  /** A cheap fingerprint of what a calculation reads, to tell HR that something changed after it was calculated. */
  async fingerprint(companyId: string, siteIds: readonly string[], window: MonthWindow): Promise<string> {
    const [people, profiles, changes, periods, adjustments] = await Promise.all([
      prisma.employee.aggregate({ where: { companyId, siteId: { in: [...siteIds] } }, _count: true, _max: { updatedAt: true } }),
      prisma.payProfile.aggregate({ where: { employee: { companyId, siteId: { in: [...siteIds] } } }, _max: { updatedAt: true } }),
      prisma.payChange.aggregate({ where: { status: 'APPROVED', employee: { companyId, siteId: { in: [...siteIds] } } }, _count: true, _max: { decidedAt: true } }),
      prisma.timesheetPeriod.aggregate({ where: { siteId: { in: [...siteIds] }, startDate: toDateColumn(window.first) }, _max: { approvedAt: true } }),
      prisma.payrollAdjustment.aggregate({ where: { month: { companyId, monthKey: window.monthKey } }, _count: true, _max: { createdAt: true, removedAt: true } }),
    ]);
    return [people._count, people._max.updatedAt?.toISOString(), profiles._max.updatedAt?.toISOString(), changes._count, changes._max.decidedAt?.toISOString(), periods._max.approvedAt?.toISOString(), adjustments._count, adjustments._max.createdAt?.toISOString(), adjustments._max.removedAt?.toISOString()].join('|');
  },
};
