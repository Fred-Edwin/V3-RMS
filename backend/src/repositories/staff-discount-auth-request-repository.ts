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
    siteId: string;
    orderId: string;
    requestedById: string;
    discountPercent: string;
    originalAmount: string;
    discountAmount: string;
  }) => {
    return prisma.staffDiscountAuthRequest.create({
      data: {
        siteId: data.siteId,
        orderId: data.orderId,
        requestedById: data.requestedById,
        discountPercent: data.discountPercent,
        originalAmount: data.originalAmount,
        discountAmount: data.discountAmount,
      },
      include: authRequestInclude,
    });
  },

  findById: async (id: string, siteId?: string) => {
    return prisma.staffDiscountAuthRequest.findFirst({
      where: { id, ...(siteId ? { siteId } : {}) },
      include: authRequestInclude,
    });
  },

  findPendingByOrderId: async (orderId: string, siteId?: string) => {
    return prisma.staffDiscountAuthRequest.findFirst({
      where: { orderId, status: 'PENDING', ...(siteId ? { siteId } : {}) },
      include: authRequestInclude,
    });
  },

  findPendingBySite: async (siteId: string) => {
    return prisma.staffDiscountAuthRequest.findMany({
      where: { siteId, status: 'PENDING' },
      include: authRequestInclude,
      orderBy: { createdAt: 'asc' },
    });
  },

  /** All pending requests across every branch — for directors, who approve staff
   *  discounts system-wide and have no organizationId to scope by. */
  findAllPending: async () => {
    return prisma.staffDiscountAuthRequest.findMany({
      where: { status: 'PENDING' },
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
    siteId: string,
    status: Exclude<StaffDiscountAuthStatus, 'PENDING'>,
    resolvedById: string,
  ) => {
    const result = await prisma.staffDiscountAuthRequest.updateMany({
      where: { id, siteId, status: 'PENDING' },
      data: {
        status,
        resolvedById,
        resolvedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return null;
    }

    return prisma.staffDiscountAuthRequest.findFirst({
      where: { id, siteId },
      include: authRequestInclude,
    });
  },

  /**
   * Atomic withdraw — only the requester may cancel, and only while PENDING.
   * Returns the updated record, or null if it was already resolved/cancelled
   * or the caller is not the requester.
   */
  cancelIfPending: async (id: string, requestedById: string) => {
    const result = await prisma.staffDiscountAuthRequest.updateMany({
      where: { id, requestedById, status: 'PENDING' },
      data: { status: 'CANCELLED', resolvedById: requestedById, resolvedAt: new Date() },
    });

    if (result.count === 0) {
      return null;
    }

    return prisma.staffDiscountAuthRequest.findFirst({
      where: { id },
      include: authRequestInclude,
    });
  },
};
