import { prisma } from '../config/database';

const discountInclude = {
  createdBy: { select: { id: true, name: true } },
} as const;

export const discountRepository = {
  create: async (data: {
    organizationId: string | null;
    name: string;
    type: 'PERCENTAGE' | 'FIXED_AMOUNT';
    value: string;
    requiresApproval: boolean;
    createdById: string;
  }) => {
    return prisma.discount.create({
      data: {
        organizationId: data.organizationId ?? null,
        name: data.name,
        type: data.type,
        value: data.value,
        requiresApproval: data.requiresApproval,
        createdById: data.createdById,
      },
      include: discountInclude,
    });
  },

  findById: async (id: string) => {
    return prisma.discount.findUnique({ where: { id }, include: discountInclude });
  },

  /** Returns all discounts across all branches — used by Directors. */
  findAll: async (activeOnly = false) => {
    return prisma.discount.findMany({
      where: activeOnly ? { isActive: true } : {},
      include: discountInclude,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  },

  /**
   * Returns discounts visible to a branch.
   * Includes: discounts scoped to this branch + all-branch discounts (organizationId = null).
   * Optionally filters by isActive.
   */
  findByBranch: async (organizationId: string, activeOnly = false) => {
    return prisma.discount.findMany({
      where: {
        OR: [
          { organizationId },
          { organizationId: null },
        ],
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: discountInclude,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  },

  update: async (
    id: string,
    data: {
      organizationId?: string | null;
      name?: string;
      type?: 'PERCENTAGE' | 'FIXED_AMOUNT';
      value?: string;
      requiresApproval?: boolean;
      isActive?: boolean;
    },
  ) => {
    return prisma.discount.update({
      where: { id },
      data,
      include: discountInclude,
    });
  },

  /**
   * Soft-delete — sets isActive = false. Preserves audit history.
   */
  deactivate: async (id: string) => {
    return prisma.discount.update({
      where: { id },
      data: { isActive: false },
      include: discountInclude,
    });
  },
};
