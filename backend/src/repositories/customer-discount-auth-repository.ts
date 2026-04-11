import type { CustomerDiscountAuthStatus } from '@prisma/client';
import { prisma } from '../config/database';

const authRequestInclude = {
  order: {
    select: { id: true, dailyNumber: true, total: true },
  },
  discount: {
    select: { id: true, name: true, type: true, value: true },
  },
  requestedBy: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } },
} as const;

export const customerDiscountAuthRepository = {
  create: async (data: {
    organizationId: string;
    orderId: string;
    discountId: string;
    requestedById: string;
    discountPercent: string | null;
    discountFixed: string | null;
    originalAmount: string;
    discountAmount: string;
  }) => {
    return prisma.customerDiscountAuthRequest.create({
      data: {
        organizationId: data.organizationId,
        orderId: data.orderId,
        discountId: data.discountId,
        requestedById: data.requestedById,
        discountPercent: data.discountPercent,
        discountFixed: data.discountFixed,
        originalAmount: data.originalAmount,
        discountAmount: data.discountAmount,
      },
      include: authRequestInclude,
    });
  },

  findById: async (id: string) => {
    return prisma.customerDiscountAuthRequest.findUnique({
      where: { id },
      include: authRequestInclude,
    });
  },

  findPendingByOrderId: async (orderId: string) => {
    return prisma.customerDiscountAuthRequest.findFirst({
      where: { orderId, status: 'PENDING' },
      include: authRequestInclude,
    });
  },

  findPendingByOrganization: async (organizationId: string) => {
    return prisma.customerDiscountAuthRequest.findMany({
      where: { organizationId, status: 'PENDING' },
      include: authRequestInclude,
      orderBy: { createdAt: 'asc' },
    });
  },

  /**
   * Atomic status update — only transitions from PENDING.
   * Returns the updated record, or null on race condition.
   */
  resolveIfPending: async (
    id: string,
    status: Exclude<CustomerDiscountAuthStatus, 'PENDING'>,
    resolvedById: string,
  ) => {
    const result = await prisma.customerDiscountAuthRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status,
        resolvedById,
        resolvedAt: new Date(),
      },
    });

    if (result.count === 0) return null;

    return prisma.customerDiscountAuthRequest.findUnique({
      where: { id },
      include: authRequestInclude,
    });
  },
};
