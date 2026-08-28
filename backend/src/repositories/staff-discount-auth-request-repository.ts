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

  findById: async (id: string, organizationId?: string) => {
    return prisma.staffDiscountAuthRequest.findFirst({
      where: { id, ...(organizationId ? { organizationId } : {}) },
      include: authRequestInclude,
    });
  },

  findPendingByOrderId: async (orderId: string, organizationId?: string) => {
    return prisma.staffDiscountAuthRequest.findFirst({
      where: { orderId, status: 'PENDING', ...(organizationId ? { organizationId } : {}) },
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
    organizationId: string,
    status: Exclude<StaffDiscountAuthStatus, 'PENDING'>,
    resolvedById: string,
  ) => {
    const result = await prisma.staffDiscountAuthRequest.updateMany({
      where: { id, organizationId, status: 'PENDING' },
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
      where: { id, organizationId },
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
