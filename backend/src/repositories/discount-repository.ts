import { prisma } from '../config/database';

const discountInclude = {
  createdBy: { select: { id: true, name: true } },
} as const;

export const discountRepository = {
  create: async (data: {
    siteId: string | null;
    name: string;
    type: 'PERCENTAGE' | 'FIXED_AMOUNT';
    value: string;
    requiresApproval: boolean;
    createdById: string;
  }) => {
    return prisma.discount.create({
      data: {
        siteId: data.siteId ?? null,
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
  findByBranch: async (siteId: string, activeOnly = false) => {
    return prisma.discount.findMany({
      where: {
        OR: [
          { siteId },
          { siteId: null },
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
      siteId?: string | null;
      name?: string;
      type?: 'PERCENTAGE' | 'FIXED_AMOUNT';
      value?: string;
      requiresApproval?: boolean;
      isActive?: boolean;
    },
    actorSiteId?: string | null,
  ) => {
    // Directors (null organizationId) can update any discount.
    // Branch-scoped actors can only update discounts belonging to their org.
    const where = actorSiteId
      ? { id, OR: [{ siteId: actorSiteId }, { siteId: null }] }
      : { id };
    return prisma.discount.update({
      where,
      data,
      include: discountInclude,
    });
  },

  /**
   * Soft-delete — sets isActive = false. Preserves audit history.
   */
  deactivate: async (id: string, actorSiteId?: string | null) => {
    const where = actorSiteId
      ? { id, OR: [{ siteId: actorSiteId }, { siteId: null }] }
      : { id };
    return prisma.discount.update({
      where,
      data: { isActive: false },
      include: discountInclude,
    });
  },
};
