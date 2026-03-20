import { prisma } from '../config/database';

export const branchRepository = {
  findAll: async () => {
    return prisma.organization.findMany({
      orderBy: { createdAt: 'asc' },
    });
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
    data: Partial<{ phone: string; mpesaPaybill: string; accountNumber: string; googleReviewUrl: string }>,
  ) => {
    return prisma.organization.update({
      where: { id },
      data: {
        phone: data.phone,
        mpesaPaybill: data.mpesaPaybill,
        accountNumber: data.accountNumber,
        googleReviewUrl: data.googleReviewUrl,
      },
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
