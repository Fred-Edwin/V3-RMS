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
    siteId: string;
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
        siteId: data.siteId,
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

  findById: async (id: string, siteId?: string) => {
    return prisma.customerDiscountAuthRequest.findFirst({
      where: { id, ...(siteId ? { siteId } : {}) },
      include: authRequestInclude,
    });
  },

  findPendingByOrderId: async (orderId: string, siteId?: string) => {
    return prisma.customerDiscountAuthRequest.findFirst({
      where: { orderId, status: 'PENDING', ...(siteId ? { siteId } : {}) },
      include: authRequestInclude,
    });
  },

  findPendingBySite: async (siteId: string) => {
    return prisma.customerDiscountAuthRequest.findMany({
      where: { siteId, status: 'PENDING' },
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
    siteId: string,
    status: Exclude<CustomerDiscountAuthStatus, 'PENDING'>,
    resolvedById: string,
  ) => {
    const result = await prisma.customerDiscountAuthRequest.updateMany({
      where: { id, siteId, status: 'PENDING' },
      data: {
        status,
        resolvedById,
        resolvedAt: new Date(),
      },
    });

    if (result.count === 0) return null;

    return prisma.customerDiscountAuthRequest.findFirst({
      where: { id, siteId },
      include: authRequestInclude,
    });
  },
};
