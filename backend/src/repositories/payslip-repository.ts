import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import type { BulkUpsertRowInput } from '../validators/payslip-schemas';

export interface PayslipLineItemStored {
  label: string;
  amount: string;
}

const payslipInclude = {
  organization: {
    select: {
      id: true,
      name: true,
      kraPIN: true,
    },
  },
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
      employeeProfile: {
        select: {
          jobTitle: true,
          kraPIN: true,
          bankName: true,
          accountNumber: true,
          accountName: true,
          bankBranch: true,
        },
      },
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      role: true,
    },
  },
} as const;

export type PayslipWithRelations = Prisma.PayslipGetPayload<{
  include: typeof payslipInclude;
}>;

export interface PayslipListFilters {
  organizationIds: string[];
  payPeriod?: string;
  userId?: string;
  isLocked?: boolean;
  page: number;
  perPage: number;
}

export interface PayslipTargetUser {
  id: string;
  name: string;
  role: UserRole;
  organizationId: string | null;
  isActive: boolean;
}

const toJson = (items: PayslipLineItemStored[] | null): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
  if (items === null) return Prisma.JsonNull;
  return items as unknown as Prisma.InputJsonValue;
};

const toDecimal = (value: string | null | undefined): Prisma.Decimal | null =>
  value != null ? new Prisma.Decimal(value) : null;

export const payslipRepository = {
  findTargetUserById: async (userId: string): Promise<PayslipTargetUser | null> => {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        organizationId: true,
        isActive: true,
      },
    });
  },

  findById: async (id: string, organizationIds: string[]): Promise<PayslipWithRelations | null> => {
    return prisma.payslip.findFirst({
      where: {
        id,
        organizationId: { in: organizationIds },
      },
      include: payslipInclude,
    });
  },

  list: async (filters: PayslipListFilters): Promise<{ items: PayslipWithRelations[]; total: number }> => {
    const where: Prisma.PayslipWhereInput = {
      organizationId: { in: filters.organizationIds },
      // Hide payslips of deactivated staff — they should not appear anywhere in the UI.
      // Historical payslip rows are preserved in the DB and reappear if the user is reactivated.
      user: { is: { isActive: true } },
      ...(filters.payPeriod ? { payPeriod: filters.payPeriod } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.isLocked !== undefined ? { isLocked: filters.isLocked } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.payslip.count({ where }),
      prisma.payslip.findMany({
        where,
        include: payslipInclude,
        orderBy: [{ payPeriod: 'desc' }, { createdAt: 'desc' }],
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
    ]);

    return { items, total };
  },

  listMine: async (
    userId: string,
    organizationIds: string[],
    page: number,
    perPage: number,
  ): Promise<{ items: PayslipWithRelations[]; total: number }> => {
    return payslipRepository.list({
      organizationIds,
      userId,
      page,
      perPage,
    });
  },

  listByBranch: async (
    branchId: string,
    organizationIds: string[],
    filters: Omit<PayslipListFilters, 'organizationIds'>,
  ): Promise<{ items: PayslipWithRelations[]; total: number }> => {
    return payslipRepository.list({
      organizationIds: organizationIds.filter((id) => id === branchId),
      page: filters.page,
      perPage: filters.perPage,
      payPeriod: filters.payPeriod,
      userId: filters.userId,
      isLocked: filters.isLocked,
    });
  },

  bulkUpsert: async (
    rows: BulkUpsertRowInput[],
    organizationId: string,
    payPeriod: string,
    createdById: string,
    computedRows: Array<{ totalDeductions: Prisma.Decimal; netPay: Prisma.Decimal }>,
  ): Promise<{ saved: PayslipWithRelations[]; skipped: string[] }> => {
    const skipped: string[] = [];
    const savedIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const computed = computedRows[i]!;

        // Check if existing payslip is locked — skip if so
        const existing = await tx.payslip.findUnique({
          where: {
            organizationId_userId_payPeriod: {
              organizationId,
              userId: row.userId,
              payPeriod,
            },
          },
          select: { id: true, isLocked: true },
        });

        if (existing?.isLocked) {
          skipped.push(row.userId);
          continue;
        }

        const otherDeductions = row.otherDeductions
          ? (row.otherDeductions as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull;

        const upserted = await tx.payslip.upsert({
          where: {
            organizationId_userId_payPeriod: {
              organizationId,
              userId: row.userId,
              payPeriod,
            },
          },
          create: {
            organizationId,
            userId: row.userId,
            payPeriod,
            payDate: new Date(row.payDate),
            grossPay: new Prisma.Decimal(row.grossPay),
            paye: new Prisma.Decimal(row.paye),
            sha: new Prisma.Decimal(row.sha),
            nssfTier1: new Prisma.Decimal(row.nssfTier1),
            nssfTier2: new Prisma.Decimal(row.nssfTier2),
            housingLevy: new Prisma.Decimal(row.housingLevy),
            helb: toDecimal(row.helb),
            advance: toDecimal(row.advance),
            incentives: toDecimal(row.incentives),
            overtime: toDecimal(row.overtime),
            allowances: toDecimal(row.allowances),
            otherDeductions,
            totalDeductions: computed.totalDeductions,
            netPay: computed.netPay,
            createdById,
          },
          update: {
            payDate: new Date(row.payDate),
            grossPay: new Prisma.Decimal(row.grossPay),
            paye: new Prisma.Decimal(row.paye),
            sha: new Prisma.Decimal(row.sha),
            nssfTier1: new Prisma.Decimal(row.nssfTier1),
            nssfTier2: new Prisma.Decimal(row.nssfTier2),
            housingLevy: new Prisma.Decimal(row.housingLevy),
            helb: toDecimal(row.helb),
            advance: toDecimal(row.advance),
            incentives: toDecimal(row.incentives),
            overtime: toDecimal(row.overtime),
            allowances: toDecimal(row.allowances),
            otherDeductions,
            totalDeductions: computed.totalDeductions,
            netPay: computed.netPay,
          },
          select: { id: true },
        });

        savedIds.push(upserted.id);
      }
    });

    const saved = await prisma.payslip.findMany({
      where: { id: { in: savedIds } },
      include: payslipInclude,
    });

    return { saved, skipped };
  },

  publishPeriod: async (organizationId: string, payPeriod: string): Promise<number> => {
    const result = await prisma.payslip.updateMany({
      where: { organizationId, payPeriod },
      data: { isLocked: true },
    });
    return result.count;
  },

  revertPeriod: async (organizationId: string, payPeriod: string): Promise<number> => {
    const result = await prisma.payslip.updateMany({
      where: { organizationId, payPeriod },
      data: { isLocked: false },
    });
    return result.count;
  },
};
