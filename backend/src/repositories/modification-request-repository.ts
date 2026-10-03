import { ModificationRequestStatus, type Prisma } from '@prisma/client';
import { prisma } from '../config/database';

const modRequestInclude = {
  requestedBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
} as const;

export type ModRequestWithRelations = Prisma.OrderModificationRequestGetPayload<{
  include: typeof modRequestInclude;
}>;

export const modificationRequestRepository = {
  create: async (data: {
    siteId: string;
    orderId: string;
    requestedById: string;
    description: string;
  }): Promise<ModRequestWithRelations> => {
    return prisma.orderModificationRequest.create({
      data: {
        siteId: data.siteId,
        orderId: data.orderId,
        requestedById: data.requestedById,
        description: data.description,
      },
      include: modRequestInclude,
    });
  },

  findById: async (id: string, siteId: string): Promise<ModRequestWithRelations | null> => {
    return prisma.orderModificationRequest.findFirst({
      where: { id, siteId },
      include: modRequestInclude,
    });
  },

  findPendingByOrder: async (orderId: string, siteId: string): Promise<ModRequestWithRelations | null> => {
    return prisma.orderModificationRequest.findFirst({
      where: {
        orderId,
        siteId,
        status: ModificationRequestStatus.PENDING,
      },
      include: modRequestInclude,
    });
  },

  findApprovedByOrder: async (orderId: string, siteId: string): Promise<ModRequestWithRelations | null> => {
    return prisma.orderModificationRequest.findFirst({
      where: {
        orderId,
        siteId,
        status: ModificationRequestStatus.APPROVED,
      },
      include: modRequestInclude,
      orderBy: { reviewedAt: 'desc' },
    });
  },

  findByOrder: async (orderId: string, siteId: string): Promise<ModRequestWithRelations[]> => {
    return prisma.orderModificationRequest.findMany({
      where: { orderId, siteId },
      include: modRequestInclude,
      orderBy: { createdAt: 'desc' },
    });
  },

  review: async (
    id: string,
    siteId: string,
    data: {
      status: ModificationRequestStatus;
      reviewedById: string;
      reviewNote?: string;
    },
  ): Promise<ModRequestWithRelations | null> => {
    const updated = await prisma.orderModificationRequest.updateMany({
      where: {
        id,
        siteId,
        status: ModificationRequestStatus.PENDING,
      },
      data: {
        status: data.status,
        reviewedById: data.reviewedById,
        reviewedAt: new Date(),
        reviewNote: data.reviewNote ?? null,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return prisma.orderModificationRequest.findFirst({
      where: { id, siteId },
      include: modRequestInclude,
    });
  },

  consumeApproved: async (orderId: string, siteId: string): Promise<boolean> => {
    const updated = await prisma.orderModificationRequest.updateMany({
      where: {
        orderId,
        siteId,
        status: ModificationRequestStatus.APPROVED,
      },
      data: {
        status: ModificationRequestStatus.REJECTED,
        reviewNote: 'Consumed by edit',
      },
    });

    return updated.count > 0;
  },
};
