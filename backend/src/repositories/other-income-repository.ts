import { Prisma, type OtherIncomeCategory, type OtherIncomeEntry } from '@prisma/client';
import { prisma } from '../config/database';

// ── Shapes returned to service layer ─────────────────────────────────────────

export type OtherIncomeCategoryWithBranch = OtherIncomeCategory & {
  branch: { id: string; name: string } | null;
};

export type OtherIncomeEntryWithRelations = OtherIncomeEntry & {
  category: { id: string; name: string };
  branch: { id: string; name: string };
  recordedBy: { id: string; name: string };
};

export interface OtherIncomeEntryForReceipt {
  id: string;
  organizationId: string;
  amount: Prisma.Decimal;
  paymentMethod: string;
  mpesaCode: string | null;
  mpesaAmount: Prisma.Decimal | null;
  cashAmount: Prisma.Decimal | null;
  cardAmount: Prisma.Decimal | null;
  splitType: string | null;
  entryDate: Date;
  createdAt: Date;
  category: { name: string };
  branch: { name: string };
  recordedBy: { name: string };
  organization: {
    name: string;
    phone: string | null;
    mpesaPaybill: string | null;
    accountNumber: string | null;
    googleReviewUrl: string | null;
  };
}

export interface OtherIncomeCategoryDropdownItem {
  id: string;
  name: string;
  branchId: string | null;
  branchName: string | null;
}

export interface PaginatedOtherIncomeEntries {
  entries: OtherIncomeEntryWithRelations[];
  total: number;
}

// ── Shared includes ────────────────────────────────────────────────────────────

const categoryInclude = {
  branch: { select: { id: true, name: true } },
} as const;

const entryInclude = {
  category: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  recordedBy: { select: { id: true, name: true } },
} as const;

// ── Repository ────────────────────────────────────────────────────────────────

export const otherIncomeRepository = {
  // Categories ─────────────────────────────────────────────────────────────────

  findAllCategories: async (
    organizationId: string,
  ): Promise<OtherIncomeCategoryWithBranch[]> => {
    return prisma.otherIncomeCategory.findMany({
      where: { organizationId },
      include: categoryInclude,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  },

  /** All active categories for org-level roles (no branch filter) */
  findAllActiveCategories: async (
    organizationId: string,
  ): Promise<OtherIncomeCategoryDropdownItem[]> => {
    const rows = await prisma.otherIncomeCategory.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        branchId: true,
        branch: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      branchId: r.branchId,
      branchName: r.branch?.name ?? null,
    }));
  },

  /** Active categories visible to the given branch (branch-scoped + org-wide) */
  findActiveCategories: async (
    organizationId: string,
    branchId: string,
  ): Promise<OtherIncomeCategoryDropdownItem[]> => {
    const rows = await prisma.otherIncomeCategory.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { branchId: null },      // org-wide
          { branchId },            // this branch specifically
        ],
      },
      select: {
        id: true,
        name: true,
        branchId: true,
        branch: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      branchId: r.branchId,
      branchName: r.branch?.name ?? null,
    }));
  },

  findCategoryById: async (
    id: string,
    organizationId: string,
  ): Promise<OtherIncomeCategoryWithBranch | null> => {
    return prisma.otherIncomeCategory.findFirst({
      where: { id, organizationId },
      include: categoryInclude,
    });
  },

  createCategory: async (data: {
    organizationId: string;
    branchId: string | null;
    name: string;
  }): Promise<OtherIncomeCategoryWithBranch> => {
    return prisma.otherIncomeCategory.create({
      data: {
        organizationId: data.organizationId,
        branchId: data.branchId ?? null,
        name: data.name,
      },
      include: categoryInclude,
    });
  },

  updateCategory: async (
    id: string,
    organizationId: string,
    data: { name?: string; isActive?: boolean; branchId?: string | null },
  ): Promise<OtherIncomeCategoryWithBranch | null> => {
    try {
      return await prisma.otherIncomeCategory.update({
        where: { id, organizationId },
        data,
        include: categoryInclude,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return null;
      }
      throw e;
    }
  },

  // Entries ─────────────────────────────────────────────────────────────────────

  createEntry: async (data: {
    organizationId: string;
    branchId: string;
    categoryId: string;
    amount: string;
    paymentMethod: 'CASH' | 'MPESA' | 'CARD' | 'SPLIT';
    mpesaCode?: string;
    mpesaAmount?: string;
    cashAmount?: string;
    cardAmount?: string;
    splitType?: string;
    description: string | null;
    entryDate: Date;
    recordedById: string;
  }): Promise<OtherIncomeEntryWithRelations> => {
    return prisma.otherIncomeEntry.create({
      data: {
        organizationId: data.organizationId,
        branchId: data.branchId,
        categoryId: data.categoryId,
        amount: new Prisma.Decimal(data.amount),
        paymentMethod: data.paymentMethod,
        mpesaCode: data.mpesaCode ?? null,
        mpesaAmount: data.mpesaAmount ? new Prisma.Decimal(data.mpesaAmount) : null,
        cashAmount: data.cashAmount ? new Prisma.Decimal(data.cashAmount) : null,
        cardAmount: data.cardAmount ? new Prisma.Decimal(data.cardAmount) : null,
        splitType: data.splitType ?? null,
        description: data.description ?? null,
        entryDate: data.entryDate,
        recordedById: data.recordedById,
      },
      include: entryInclude,
    });
  },

  findEntries: async (
    organizationId: string | undefined,
    filters: {
      branchId?: string;
      recordedById?: string;
      categoryId?: string;
      startDate?: Date;
      endDate?: Date;
      page: number;
      perPage: number;
    },
  ): Promise<PaginatedOtherIncomeEntries> => {
    const where: Prisma.OtherIncomeEntryWhereInput = organizationId ? { organizationId } : {};

    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.recordedById) where.recordedById = filters.recordedById;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.startDate ?? filters.endDate) {
      where.entryDate = {};
      if (filters.startDate) where.entryDate.gte = filters.startDate;
      if (filters.endDate) where.entryDate.lte = filters.endDate;
    }

    const [total, entries] = await Promise.all([
      prisma.otherIncomeEntry.count({ where }),
      prisma.otherIncomeEntry.findMany({
        where,
        include: entryInclude,
        orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
    ]);

    return { entries, total };
  },

  findEntryById: async (
    id: string,
    organizationId?: string,
  ): Promise<OtherIncomeEntryWithRelations | null> => {
    return prisma.otherIncomeEntry.findFirst({
      where: { id, ...(organizationId ? { organizationId } : {}) },
      include: entryInclude,
    });
  },

  findEntryForReceipt: async (
    id: string,
    organizationId: string,
  ): Promise<OtherIncomeEntryForReceipt | null> => {
    return prisma.otherIncomeEntry.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        organizationId: true,
        amount: true,
        paymentMethod: true,
        mpesaCode: true,
        mpesaAmount: true,
        cashAmount: true,
        cardAmount: true,
        splitType: true,
        entryDate: true,
        createdAt: true,
        category: { select: { name: true } },
        branch: { select: { name: true } },
        recordedBy: { select: { name: true } },
        organization: {
          select: {
            name: true,
            phone: true,
            mpesaPaybill: true,
            accountNumber: true,
            googleReviewUrl: true,
          },
        },
      },
    });
  },

  deleteEntry: async (id: string): Promise<void> => {
    await prisma.otherIncomeEntry.delete({ where: { id } });
  },

  /** Sum other income for a given org + date range (used by report repository) */
  sumByCategory: async (
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ categoryId: string; categoryName: string; total: Prisma.Decimal }>> => {
    const rows = await prisma.otherIncomeEntry.findMany({
      where: {
        organizationId,
        entryDate: { gte: startDate, lte: endDate },
      },
      select: {
        amount: true,
        category: { select: { id: true, name: true } },
      },
    });

    const map = new Map<string, { categoryId: string; categoryName: string; total: Prisma.Decimal }>();
    for (const row of rows) {
      const key = row.category.id;
      const existing = map.get(key);
      if (existing) {
        existing.total = existing.total.add(row.amount);
      } else {
        map.set(key, { categoryId: key, categoryName: row.category.name, total: row.amount });
      }
    }
    return [...map.values()];
  },
};
