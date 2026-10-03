import { Prisma, type OtherIncomeCategory, type OtherIncomeEntry } from '@prisma/client';
import { prisma } from '../config/database';

// ── Shapes returned to service layer ─────────────────────────────────────────

export type OtherIncomeCategoryWithBranch = OtherIncomeCategory & {
  branch: { id: string; name: string } | null;
};

export interface OtherIncomeEntryEditRecord {
  id: string;
  editedBy: { id: string; name: string };
  changes: Array<{ field: string; from: string | null; to: string | null }>;
  createdAt: Date;
}

export type OtherIncomeEntryWithRelations = OtherIncomeEntry & {
  category: { id: string; name: string };
  branch: { id: string; name: string };
  recordedBy: { id: string; name: string };
  edits: OtherIncomeEntryEditRecord[];
};

export interface OtherIncomeEntryForReceipt {
  id: string;
  siteId: string;
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
  site: {
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
  edits: {
    select: {
      id: true,
      changes: true,
      createdAt: true,
      editedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
} as const;

type RawEntryWithIncludes = OtherIncomeEntry & {
  category: { id: string; name: string };
  branch: { id: string; name: string };
  recordedBy: { id: string; name: string };
  edits: Array<{
    id: string;
    changes: Prisma.JsonValue;
    createdAt: Date;
    editedBy: { id: string; name: string };
  }>;
};

/** Normalise the raw Prisma row (Json `changes`) into our typed edit shape. */
const mapEntry = (row: RawEntryWithIncludes): OtherIncomeEntryWithRelations => ({
  ...row,
  edits: row.edits.map((e) => ({
    id: e.id,
    editedBy: e.editedBy,
    createdAt: e.createdAt,
    changes: Array.isArray(e.changes)
      ? (e.changes as OtherIncomeEntryEditRecord['changes'])
      : [],
  })),
});

// ── Repository ────────────────────────────────────────────────────────────────

export const otherIncomeRepository = {
  // Categories ─────────────────────────────────────────────────────────────────

  findAllCategories: async (
    siteId: string,
  ): Promise<OtherIncomeCategoryWithBranch[]> => {
    return prisma.otherIncomeCategory.findMany({
      where: { siteId },
      include: categoryInclude,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  },

  /** All active categories for org-level roles (no branch filter) */
  findAllActiveCategories: async (
    siteId: string,
  ): Promise<OtherIncomeCategoryDropdownItem[]> => {
    const rows = await prisma.otherIncomeCategory.findMany({
      where: { siteId, isActive: true },
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

  /**
   * Active categories across every organization, deduped by name — used for the
   * accountant's cross-branch history filter, where categories are picked by
   * label ("Events") rather than by a specific branch's category row.
   */
  findAllActiveCategoriesAcrossOrgs: async (): Promise<OtherIncomeCategoryDropdownItem[]> => {
    const rows = await prisma.otherIncomeCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, branchId: true },
      orderBy: { name: 'asc' },
    });
    const seen = new Map<string, OtherIncomeCategoryDropdownItem>();
    for (const r of rows) {
      if (!seen.has(r.name)) {
        seen.set(r.name, { id: r.id, name: r.name, branchId: null, branchName: null });
      }
    }
    return [...seen.values()];
  },

  /** Active categories visible to the given branch (branch-scoped + org-wide) */
  findActiveCategories: async (
    siteId: string,
    branchId: string,
  ): Promise<OtherIncomeCategoryDropdownItem[]> => {
    const rows = await prisma.otherIncomeCategory.findMany({
      where: {
        siteId,
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

  /** Looks up a category's name by id, regardless of organization — used to resolve
   *  the cross-branch accountant filter (see findAllActiveCategoriesAcrossOrgs). */
  findEntryCategoryName: async (id: string): Promise<string | null> => {
    const category = await prisma.otherIncomeCategory.findUnique({
      where: { id },
      select: { name: true },
    });
    return category?.name ?? null;
  },

  findCategoryById: async (
    id: string,
    siteId: string,
  ): Promise<OtherIncomeCategoryWithBranch | null> => {
    return prisma.otherIncomeCategory.findFirst({
      where: { id, siteId },
      include: categoryInclude,
    });
  },

  createCategory: async (data: {
    siteId: string;
    branchId: string | null;
    name: string;
  }): Promise<OtherIncomeCategoryWithBranch> => {
    return prisma.otherIncomeCategory.create({
      data: {
        siteId: data.siteId,
        branchId: data.branchId ?? null,
        name: data.name,
      },
      include: categoryInclude,
    });
  },

  updateCategory: async (
    id: string,
    siteId: string,
    data: { name?: string; isActive?: boolean; branchId?: string | null },
  ): Promise<OtherIncomeCategoryWithBranch | null> => {
    try {
      return await prisma.otherIncomeCategory.update({
        where: { id, siteId },
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
    siteId: string;
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
    const created = await prisma.otherIncomeEntry.create({
      data: {
        siteId: data.siteId,
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
    return mapEntry(created);
  },

  /**
   * Apply a correction to an entry, org-scoped. `data` fields that are undefined
   * are left untouched; `null` clears the column. The paired edit-audit row is
   * written in the same transaction. Returns null if no entry matched the scope.
   */
  updateEntry: async (
    id: string,
    siteId: string,
    data: {
      categoryId?: string;
      amount?: string;
      paymentMethod?: 'CASH' | 'MPESA' | 'CARD' | 'SPLIT';
      mpesaCode?: string | null;
      mpesaAmount?: string | null;
      cashAmount?: string | null;
      cardAmount?: string | null;
      splitType?: string | null;
      description?: string | null;
      entryDate?: Date;
    },
    audit: {
      editedById: string;
      changes: OtherIncomeEntryEditRecord['changes'];
    },
  ): Promise<OtherIncomeEntryWithRelations | null> => {
    const dec = (v: string | null | undefined): Prisma.Decimal | null | undefined =>
      v === undefined ? undefined : v === null ? null : new Prisma.Decimal(v);

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.otherIncomeEntry.update({
          where: { id, siteId },
          data: {
            categoryId: data.categoryId,
            amount: data.amount !== undefined ? new Prisma.Decimal(data.amount) : undefined,
            paymentMethod: data.paymentMethod,
            mpesaCode: data.mpesaCode,
            mpesaAmount: dec(data.mpesaAmount),
            cashAmount: dec(data.cashAmount),
            cardAmount: dec(data.cardAmount),
            splitType: data.splitType,
            description: data.description,
            entryDate: data.entryDate,
          },
          include: entryInclude,
        });
        await tx.otherIncomeEntryEdit.create({
          data: {
            entryId: id,
            editedById: audit.editedById,
            changes: audit.changes as unknown as Prisma.InputJsonValue,
          },
        });
        // Re-read so the returned row includes the just-written edit
        return tx.otherIncomeEntry.findUniqueOrThrow({
          where: { id },
          include: entryInclude,
        });
      });
      return mapEntry(updated);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return null;
      }
      throw e;
    }
  },

  findEntries: async (
    siteId: string | undefined,
    filters: {
      branchId?: string;
      recordedById?: string;
      categoryId?: string;
      /** Matches by category name across all branches — used instead of categoryId when no branch is selected. */
      categoryName?: string;
      startDate?: Date;
      endDate?: Date;
      page: number;
      perPage: number;
    },
  ): Promise<PaginatedOtherIncomeEntries> => {
    const where: Prisma.OtherIncomeEntryWhereInput = siteId ? { siteId } : {};

    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.recordedById) where.recordedById = filters.recordedById;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.categoryName) where.category = { name: filters.categoryName };
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

    return { entries: entries.map(mapEntry), total };
  },

  findEntryById: async (
    id: string,
    siteId?: string,
  ): Promise<OtherIncomeEntryWithRelations | null> => {
    const row = await prisma.otherIncomeEntry.findFirst({
      where: { id, ...(siteId ? { siteId } : {}) },
      include: entryInclude,
    });
    return row ? mapEntry(row) : null;
  },

  findEntryForReceipt: async (
    id: string,
    siteId: string,
  ): Promise<OtherIncomeEntryForReceipt | null> => {
    return prisma.otherIncomeEntry.findFirst({
      where: { id, siteId },
      select: {
        id: true,
        siteId: true,
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
        site: {
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

  deleteEntry: async (id: string, siteId: string): Promise<void> => {
    await prisma.otherIncomeEntry.deleteMany({ where: { id, siteId } });
  },

  /** Sum other income for a given org + date range (used by report repository) */
  sumByCategory: async (
    siteId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ categoryId: string; categoryName: string; total: Prisma.Decimal }>> => {
    const rows = await prisma.otherIncomeEntry.findMany({
      where: {
        siteId,
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

  /** Fetch all entries for a date range with entryDate included — caller groups by date */
  findByDateRange: async (
    siteId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ entryDate: Date; amount: Prisma.Decimal; category: { id: string; name: string } }>> => {
    return prisma.otherIncomeEntry.findMany({
      where: {
        siteId,
        entryDate: { gte: startDate, lte: endDate },
      },
      select: {
        entryDate: true,
        amount: true,
        category: { select: { id: true, name: true } },
      },
    });
  },
};
