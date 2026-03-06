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
    organizationId: string;
    orderId: string;
    requestedById: string;
    description: string;
  }): Promise<ModRequestWithRelations> => {
    return prisma.orderModificationRequest.create({
      data: {
        organizationId: data.organizationId,
        orderId: data.orderId,
        requestedById: data.requestedById,
        description: data.description,
      },
      include: modRequestInclude,
    });
  },

  findById: async (id: string, organizationId: string): Promise<ModRequestWithRelations | null> => {
    return prisma.orderModificationRequest.findFirst({
      where: { id, organizationId },
      include: modRequestInclude,
    });
  },

  findPendingByOrder: async (orderId: string, organizationId: string): Promise<ModRequestWithRelations | null> => {
    return prisma.orderModificationRequest.findFirst({
      where: {
        orderId,
        organizationId,
        status: ModificationRequestStatus.PENDING,
      },
      include: modRequestInclude,
    });
  },

  findApprovedByOrder: async (orderId: string, organizationId: string): Promise<ModRequestWithRelations | null> => {
    return prisma.orderModificationRequest.findFirst({
      where: {
        orderId,
        organizationId,
        status: ModificationRequestStatus.APPROVED,
      },
      include: modRequestInclude,
      orderBy: { reviewedAt: 'desc' },
    });
  },

  findByOrder: async (orderId: string, organizationId: string): Promise<ModRequestWithRelations[]> => {
    return prisma.orderModificationRequest.findMany({
      where: { orderId, organizationId },
      include: modRequestInclude,
      orderBy: { createdAt: 'desc' },
    });
  },

  review: async (
    id: string,
    organizationId: string,
    data: {
      status: ModificationRequestStatus;
      reviewedById: string;
      reviewNote?: string;
    },
  ): Promise<ModRequestWithRelations | null> => {
    const updated = await prisma.orderModificationRequest.updateMany({
      where: {
        id,
        organizationId,
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
      where: { id, organizationId },
      include: modRequestInclude,
    });
  },

  consumeApproved: async (orderId: string, organizationId: string): Promise<boolean> => {
    const updated = await prisma.orderModificationRequest.updateMany({
      where: {
        orderId,
        organizationId,
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
