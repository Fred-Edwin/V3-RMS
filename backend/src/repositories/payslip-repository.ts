import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../config/database';

export interface PayslipLineItemStored {
  label: string;
  amount: string;
}

const payslipInclude = {
  organization: {
    select: {
      id: true,
      name: true,
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

export interface CreatePayslipRepositoryInput {
  organizationId: string;
  userId: string;
  payPeriod: string;
  payDate: Date;
  basicSalary: Prisma.Decimal;
  houseAllowance: Prisma.Decimal | null;
  transportAllowance: Prisma.Decimal | null;
  otherAllowances: PayslipLineItemStored[] | null;
  paye: Prisma.Decimal;
  nssf: Prisma.Decimal;
  housingLevy: Prisma.Decimal;
  helb: Prisma.Decimal | null;
  otherDeductions: PayslipLineItemStored[] | null;
  grossPay: Prisma.Decimal;
  totalDeductions: Prisma.Decimal;
  netPay: Prisma.Decimal;
  createdById: string;
}

export interface UpdatePayslipRepositoryInput extends Omit<CreatePayslipRepositoryInput, 'createdById'> {}

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

  create: async (input: CreatePayslipRepositoryInput): Promise<PayslipWithRelations> => {
    return prisma.payslip.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        payPeriod: input.payPeriod,
        payDate: input.payDate,
        basicSalary: input.basicSalary,
        houseAllowance: input.houseAllowance,
        transportAllowance: input.transportAllowance,
        otherAllowances: toJson(input.otherAllowances),
        paye: input.paye,
        nssf: input.nssf,
        housingLevy: input.housingLevy,
        helb: input.helb,
        otherDeductions: toJson(input.otherDeductions),
        grossPay: input.grossPay,
        totalDeductions: input.totalDeductions,
        netPay: input.netPay,
        createdById: input.createdById,
      },
      include: payslipInclude,
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
      organizationIds: organizationIds.filter((organizationId) => organizationId === branchId),
      page: filters.page,
      perPage: filters.perPage,
      payPeriod: filters.payPeriod,
      userId: filters.userId,
      isLocked: filters.isLocked,
    });
  },

  update: async (
    id: string,
    organizationId: string,
    input: UpdatePayslipRepositoryInput,
  ): Promise<PayslipWithRelations | null> => {
    const updated = await prisma.payslip.updateMany({
      where: {
        id,
        organizationId,
      },
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        payPeriod: input.payPeriod,
        payDate: input.payDate,
        basicSalary: input.basicSalary,
        houseAllowance: input.houseAllowance,
        transportAllowance: input.transportAllowance,
        otherAllowances: toJson(input.otherAllowances),
        paye: input.paye,
        nssf: input.nssf,
        housingLevy: input.housingLevy,
        helb: input.helb,
        otherDeductions: toJson(input.otherDeductions),
        grossPay: input.grossPay,
        totalDeductions: input.totalDeductions,
        netPay: input.netPay,
      },
    });

    if (updated.count === 0) return null;

    return prisma.payslip.findFirst({
      where: {
        id,
        organizationId: input.organizationId,
      },
      include: payslipInclude,
    });
  },

  lock: async (id: string, organizationId: string): Promise<PayslipWithRelations | null> => {
    const updated = await prisma.payslip.updateMany({
      where: {
        id,
        organizationId,
        isLocked: false,
      },
      data: {
        isLocked: true,
      },
    });

    if (updated.count === 0) return null;

    return prisma.payslip.findFirst({
      where: {
        id,
        organizationId,
      },
      include: payslipInclude,
    });
  },
};
