import type { HouseAccountAuthStatus } from '@prisma/client';
import { prisma } from '../config/database';

const authRequestInclude = {
  order: {
    select: { id: true, dailyNumber: true, total: true },
  },
  houseAccount: {
    select: {
      id: true,
      user: { select: { id: true, name: true } },
    },
  },
  requestedBy: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } },
} as const;

export const houseAccountAuthRequestRepository = {
  create: async (data: {
    organizationId: string;
    orderId: string;
    houseAccountId: string;
    requestedById: string;
    amount: string;
    bullmqJobId: string;
    expiresAt: Date;
  }) => {
    return prisma.houseAccountAuthRequest.create({
      data: {
        organizationId: data.organizationId,
        orderId: data.orderId,
        houseAccountId: data.houseAccountId,
        requestedById: data.requestedById,
        amount: data.amount,
        bullmqJobId: data.bullmqJobId,
        expiresAt: data.expiresAt,
      },
      include: authRequestInclude,
    });
  },

  findById: async (id: string, organizationId?: string) => {
    return prisma.houseAccountAuthRequest.findFirst({
      where: { id, ...(organizationId ? { organizationId } : {}) },
      include: authRequestInclude,
    });
  },

  findPendingByOrderId: async (orderId: string, organizationId?: string) => {
    return prisma.houseAccountAuthRequest.findFirst({
      where: { orderId, status: 'PENDING', ...(organizationId ? { organizationId } : {}) },
      include: authRequestInclude,
    });
  },

  /**
   * Atomic status update — only transitions from PENDING.
   * Returns the updated record, or null if the request was already resolved
   * (race condition: timeout fired at the same moment as a holder action).
   */
  resolveIfPending: async (
    id: string,
    organizationId: string,
    status: Exclude<HouseAccountAuthStatus, 'PENDING'>,
    resolvedById: string,
  ) => {
    const result = await prisma.houseAccountAuthRequest.updateMany({
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

    return prisma.houseAccountAuthRequest.findFirst({
      where: { id, organizationId },
      include: authRequestInclude,
    });
  },

  findPendingByOrganization: async (organizationId: string) => {
    return prisma.houseAccountAuthRequest.findMany({
      where: { organizationId, status: 'PENDING' },
      include: authRequestInclude,
      orderBy: { createdAt: 'asc' },
    });
  },

  /** For directors with no organizationId — find pending requests on their own house account. */
  findPendingByHolderUserId: async (userId: string) => {
    return prisma.houseAccountAuthRequest.findMany({
      where: {
        status: 'PENDING',
        houseAccount: { userId },
      },
      include: authRequestInclude,
      orderBy: { createdAt: 'asc' },
    });
  },

  updateBullmqJobId: async (id: string, organizationId: string, bullmqJobId: string) => {
    return prisma.houseAccountAuthRequest.updateMany({
      where: { id, organizationId },
      data: { bullmqJobId },
    });
  },
};
