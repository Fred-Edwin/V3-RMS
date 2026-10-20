import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { MonthFacts } from './publication';

type Tx = Prisma.TransactionClient;

const withLines = { lines: { orderBy: { position: 'asc' as const } } };
export type StoredPayslip = Prisma.PayrollPayslipGetPayload<{ include: typeof withLines }>;

export interface EmployeeFacts {
  id: string;
  companyId: string;
  siteId: string;
  userId: string | null;
  name: string;
  employeeNumber: string;
  startDate: Date;
  exitedOn: Date | null;
  kraPin: string | null;
  nssfNumber: string | null;
  shaNumber: string | null;
  position: string | null;
  siteName: string;
  payoutMethod: string | null;
  bankName: string | null;
  accountNumber: string | null;
}

const employeeSelect = {
  id: true, companyId: true, siteId: true, userId: true, name: true, employeeNumber: true, startDate: true, exitedOn: true, kraPin: true, nssfNumber: true, shaNumber: true,
  position: { select: { name: true } }, site: { select: { name: true } }, payProfile: { select: { payoutMethod: true, bankName: true, accountNumber: true } },
} satisfies Prisma.EmployeeSelect;

const flat = (e: Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>): EmployeeFacts => ({
  id: e.id, companyId: e.companyId, siteId: e.siteId, userId: e.userId, name: e.name, employeeNumber: e.employeeNumber, startDate: e.startDate, exitedOn: e.exitedOn,
  kraPin: e.kraPin, nssfNumber: e.nssfNumber, shaNumber: e.shaNumber, position: e.position?.name ?? null, siteName: e.site.name,
  payoutMethod: e.payProfile?.payoutMethod ?? null, bankName: e.payProfile?.bankName ?? null, accountNumber: e.payProfile?.accountNumber ?? null,
});

/** Reads of what a person's payslips are made of. Insert-only tables; nothing here writes except the opener's daily digest. */
export const readsRepository = {
  employeeOfUser: async (userId: string): Promise<EmployeeFacts | null> => {
    const e = await prisma.employee.findUnique({ where: { userId }, select: employeeSelect });
    return e ? flat(e) : null;
  },
  employeeById: async (companyId: string, id: string): Promise<EmployeeFacts | null> => {
    const e = await prisma.employee.findFirst({ where: { id, companyId }, select: employeeSelect });
    return e ? flat(e) : null;
  },

  /** Months that have a calculated run, newest first. Whether staff may see one is decided by the publication source, not here. */
  months: (companyId: string): Promise<(MonthFacts & { currentRunId: string | null; approvedAt: Date | null; approvedById: string | null })[]> =>
    prisma.payrollMonth.findMany({ where: { companyId, currentRunId: { not: null } }, select: { id: true, monthKey: true, state: true, currentRunId: true, approvedAt: true, approvedById: true }, orderBy: { monthKey: 'desc' }, take: 60 }),

  /** Every version of the person's payslips in the given runs (version 1 first). */
  payslipsOf: (employeeId: string, runIds: readonly string[]): Promise<StoredPayslip[]> =>
    prisma.payrollPayslip.findMany({ where: { employeeId, runId: { in: [...runIds] } }, include: withLines, orderBy: [{ createdAt: 'asc' }, { version: 'asc' }] }),

  /** One payslip row by its id, with the lines; the caller decides whether the person may see it. */
  payslipById: (id: string): Promise<StoredPayslip | null> => prisma.payrollPayslip.findUnique({ where: { id }, include: withLines }),

  monthOf: (id: string) => prisma.payrollMonth.findUnique({ where: { id }, select: { id: true, companyId: true, monthKey: true, state: true, currentRunId: true, approvedAt: true, approvedById: true } }),

  names: async (ids: readonly string[]) => new Map((await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, role: true } })).map((u) => [u.id, u])),

  // ---- the old payslip system (PD12) ------------------------------------------------------------------------------------
  legacyPublishedCount: (userId: string): Promise<number> => prisma.payslip.count({ where: { userId, isLocked: true } }),
  siteSwitch: (siteId: string) => prisma.attendanceSiteSwitch.findUnique({ where: { siteId }, select: { enabled: true } }),
  siteInPayroll: async (siteId: string): Promise<boolean> => (await prisma.payrollMonth.count({ where: { includedSiteIds: { has: siteId } } })) > 0,

  // ---- the Director's daily digest of other people's openings (PD5) -----------------------------------------------------
  /** Counts one more opening by this person today. Returns the new count; 1 means the first of the day. */
  async bumpDigest(tx: Tx, companyId: string, openerId: string, day: NairobiDate, at: Date = new Date()): Promise<number> {
    const row = await tx.payslipOpenDigest.upsert({
      where: { openerId_day: { openerId, day: toDateColumn(day) } },
      create: { companyId, openerId, day: toDateColumn(day), openCount: 1, firstAt: at, lastAt: at },
      update: { openCount: { increment: 1 }, lastAt: at },
      select: { openCount: true },
    });
    return row.openCount;
  },
  digestOfDay: (companyId: string, day: NairobiDate) => prisma.payslipOpenDigest.findMany({ where: { companyId, day: toDateColumn(day) }, orderBy: { openCount: 'desc' } }),
  /** Segment 6b: the last days at once (the Director's card), newest day first, then by count. */
  digestOfRange: (companyId: string, from: NairobiDate, to: NairobiDate) =>
    prisma.payslipOpenDigest.findMany({ where: { companyId, day: { gte: toDateColumn(from), lte: toDateColumn(to) } }, orderBy: [{ day: 'desc' }, { openCount: 'desc' }] }),
};
