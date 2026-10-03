import { prisma } from '../config/database';

export const branchRepository = {
  findAll: async () => {
    return prisma.site.findMany({
      orderBy: { createdAt: 'asc' },
    });
  },

  findActiveIds: async (): Promise<string[]> => {
    const rows = await prisma.site.findMany({
      where: { isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => row.id);
  },

  /**
   * Active branch orgs, hub excluded — the explicit enumeration the Central
   * Store dispatch queue's cross-org read is scoped against (never an
   * unscoped query across all orgs). See CENTRAL_STORE_SCOPING_DESIGN.md §4.
   */
  findActiveBranchIds: async (): Promise<string[]> => {
    const rows = await prisma.site.findMany({
      where: { isActive: true, isHub: false },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => row.id);
  },

  /** Active branch orgs (hub excluded) as id + name, oldest first — the "Whose levels" branch select. */
  findActiveBranchOptions: async (): Promise<Array<{ id: string; name: string }>> => {
    return prisma.site.findMany({
      where: { isActive: true, isHub: false },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
  },

  findById: async (id: string) => {
    return prisma.site.findUnique({
      where: { id },
    });
  },

  /** The company every new site joins. One company exists today; multi-company readiness picks it from the actor. */
  findDefaultCompanyId: async (): Promise<string | null> => {
    const company = await prisma.company.findFirst({
      where: { isActive: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    return company?.id ?? null;
  },

  create: async (data: {
    companyId: string;
    name: string;
    address: string;
    city: string;
    latitude: number;
    longitude: number;
  }) => {
    return prisma.site.create({
      data: { ...data, type: 'BRANCH' },
    });
  },

  update: async (
    id: string,
    data: Partial<{
      name: string;
      address: string;
      city: string;
      latitude: number;
      longitude: number;
      isActive: boolean;
    }>,
  ) => {
    return prisma.site.update({
      where: { id },
      data,
    });
  },

  updateProfile: async (
    id: string,
    data: Partial<{ phone: string; mpesaPaybill: string; accountNumber: string; googleReviewUrl: string; kraPIN: string }>,
  ) => {
    return prisma.site.update({
      where: { id },
      data: {
        phone: data.phone,
        mpesaPaybill: data.mpesaPaybill,
        accountNumber: data.accountNumber,
        googleReviewUrl: data.googleReviewUrl,
        kraPIN: data.kraPIN,
      },
    });
  },

  findHub: async () => {
    return prisma.site.findFirst({
      where: { isHub: true, isActive: true },
    });
  },

  setHub: async (id: string) => {
    return prisma.$transaction(async (tx) => {
      await tx.site.updateMany({
        where: { isHub: true },
        data: { isHub: false, type: 'BRANCH' },
      });

      return tx.site.update({
        where: { id },
        data: { isHub: true, type: 'CENTRAL_STORE' },
      });
    });
  },
};
