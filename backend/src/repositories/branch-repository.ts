import { prisma } from '../config/database';

export const branchRepository = {
  findAll: async () => {
    return prisma.organization.findMany({
      orderBy: { createdAt: 'asc' },
    });
  },

  findActiveIds: async (): Promise<string[]> => {
    const rows = await prisma.organization.findMany({
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
    const rows = await prisma.organization.findMany({
      where: { isActive: true, isHub: false },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => row.id);
  },

  findById: async (id: string) => {
    return prisma.organization.findUnique({
      where: { id },
    });
  },

  create: async (data: {
    name: string;
    address: string;
    city: string;
    latitude: number;
    longitude: number;
  }) => {
    return prisma.organization.create({
      data,
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
    return prisma.organization.update({
      where: { id },
      data,
    });
  },

  updateProfile: async (
    id: string,
    data: Partial<{ phone: string; mpesaPaybill: string; accountNumber: string; googleReviewUrl: string; kraPIN: string }>,
  ) => {
    return prisma.organization.update({
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
    return prisma.organization.findFirst({
      where: { isHub: true, isActive: true },
    });
  },

  setHub: async (id: string) => {
    return prisma.$transaction(async (tx) => {
      await tx.organization.updateMany({
        where: { isHub: true },
        data: { isHub: false },
      });

      return tx.organization.update({
        where: { id },
        data: { isHub: true },
      });
    });
  },
};
