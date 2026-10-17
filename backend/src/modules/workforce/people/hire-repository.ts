import type { ContractStatus, EmploymentStatus, PayoutMethod, PayType, Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { EMPLOYEE_NUMBER_PREFIX } from './people.constants';
import type { Db } from './employees-repository';

/** Reads and creates for hiring. Every query carries the company (directly or through the site). */
export interface NewEmployee {
  companyId: string;
  siteId: string;
  userId: string | null;
  employeeNumber: string;
  name: string;
  departmentId: string;
  positionId: string;
  reportsToId: string | null;
  status: EmploymentStatus;
  payType: PayType;
  contractStatus: ContractStatus;
  tracksTime: boolean;
  tracksTimeOverride: boolean;
  startDate: Date;
  probationEndsOn: Date | null;
  photoUrl: string | null;
  nationalId: string;
  kraPin: string | null;
  shaNumber: string | null;
  nssfNumber: string | null;
  helbNumber: string | null;
  personalPhone: string;
  personalEmail: string | null;
  hiredById: string;
  legacyProfileId: string | null;
}

export interface NewPayProfile {
  employeeId: string;
  amount: string | null;
  overtimeEligible: boolean;
  standardWeekHours: string | null;
  standardDayHours: string | null;
  payoutMethod: PayoutMethod | null;
  bankName: string | null;
  bankBranch: string | null;
  accountName: string | null;
  accountNumber: string | null;
  mpesaPhone: string | null;
  updatedById: string;
}

export const hireRepository = {
  findDepartment: (companyId: string, id: string) =>
    prisma.department.findFirst({ where: { id, site: { companyId } }, select: { id: true, siteId: true, status: true, key: true, site: { select: { type: true } } } }),

  findPosition: (companyId: string, id: string) =>
    prisma.position.findFirst({
      where: { id, companyId },
      select: { id: true, isActive: true, defaultTracksTime: true, casualsAllowed: true, departments: { select: { departmentId: true } } },
    }),

  findActiveEmployee: (companyId: string, id: string) =>
    prisma.employee.findFirst({ where: { id, companyId, status: { not: 'EXITED' } }, select: { id: true, siteId: true } }),

  /** Employee numbers are one series per company: lock the company, take the highest "W-####", add one. */
  async nextEmployeeNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${companyId}))`;
    const rows = await tx.$queryRaw<{ max: number | null }[]>`
      SELECT max(substring(employee_number FROM 3)::int) AS max
      FROM employees WHERE company_id = ${companyId} AND employee_number ~ '^W-[0-9]+$'`;
    const next = (rows[0]?.max ?? 0) + 1;
    return `${EMPLOYEE_NUMBER_PREFIX}${String(next).padStart(4, '0')}`;
  },

  createEmployee: (tx: Db, data: NewEmployee) => tx.employee.create({ data, select: { id: true } }),

  createPayProfile: (tx: Db, data: NewPayProfile) => tx.payProfile.create({ data, select: { id: true } }),

  createHirePayChange: (tx: Db, data: { employeeId: string; amount: string; effectiveFrom: Date; requestedById: string; now: Date }) =>
    tx.payChange.create({
      data: {
        employeeId: data.employeeId,
        amount: data.amount,
        effectiveFrom: data.effectiveFrom,
        reason: 'HIRING',
        status: 'APPROVED',
        requestedById: data.requestedById,
        decidedById: data.requestedById,
        decidedAt: data.now,
        decisionNote: 'Set at hire',
        appliedAt: data.now,
      },
      select: { id: true },
    }),

  createSpell: (tx: Db, data: { employeeId: string; startsOn: Date }) => tx.employmentSpell.create({ data, select: { id: true } }),

  /** Links a login (and the legacy profile the old code made) to a file. */
  linkLogin: (tx: Db, companyId: string, employeeId: string, data: { userId: string; legacyProfileId: string | null }) =>
    tx.employee.updateMany({
      where: { id: employeeId, companyId, userId: null },
      data: { userId: data.userId, ...(data.legacyProfileId ? { legacyProfileId: data.legacyProfileId } : {}) },
    }),

  createFileRequests: (tx: Db, data: { employeeId: string; kinds: readonly string[]; askedById: string }) =>
    tx.fileRequest.createMany({ data: data.kinds.map((kind) => ({ employeeId: data.employeeId, kind, askedById: data.askedById })) }),

  openFileRequestKinds: async (employeeId: string): Promise<string[]> => {
    const rows = await prisma.fileRequest.findMany({ where: { employeeId, resolvedAt: null }, select: { kind: true } });
    return rows.map((r) => r.kind);
  },
};
