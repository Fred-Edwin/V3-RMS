import type { StaffDiscountAuthStatus } from '@prisma/client';
import { prisma } from '../config/database';

const authRequestInclude = {
  order: {
    select: { id: true, dailyNumber: true, total: true },
  },
  requestedBy: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } },
} as const;

export const staffDiscountAuthRequestRepository = {
  create: async (data: {
    organizationId: string;
    orderId: string;
    requestedById: string;
    discountPercent: string;
    originalAmount: string;
    discountAmount: string;
  }) => {
    return prisma.staffDiscountAuthRequest.create({
      data: {
        organizationId: data.organizationId,
        orderId: data.orderId,
        requestedById: data.requestedById,
        discountPercent: data.discountPercent,
        originalAmount: data.originalAmount,
        discountAmount: data.discountAmount,
      },
      include: authRequestInclude,
    });
  },

  findById: async (id: string) => {
    return prisma.staffDiscountAuthRequest.findUnique({
      where: { id },
      include: authRequestInclude,
    });
  },

  findPendingByOrderId: async (orderId: string) => {
    return prisma.staffDiscountAuthRequest.findFirst({
      where: { orderId, status: 'PENDING' },
      include: authRequestInclude,
    });
  },

  findPendingByOrganization: async (organizationId: string) => {
    return prisma.staffDiscountAuthRequest.findMany({
      where: { organizationId, status: 'PENDING' },
      include: authRequestInclude,
      orderBy: { createdAt: 'asc' },
    });
  },

  /**
   * Atomic status update — only transitions from PENDING.
   * Returns the updated record, or null if the request was already resolved
   * (race condition: two managers acting simultaneously).
   */
  resolveIfPending: async (
    id: string,
    status: Exclude<StaffDiscountAuthStatus, 'PENDING'>,
    resolvedById: string,
  ) => {
    const result = await prisma.staffDiscountAuthRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status,
        resolvedById,
        resolvedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return null;
    }

    return prisma.staffDiscountAuthRequest.findUnique({
      where: { id },
      include: authRequestInclude,
    });
  },
};
