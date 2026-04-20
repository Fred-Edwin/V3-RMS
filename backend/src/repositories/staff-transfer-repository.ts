import { prisma } from '../config/database';
import type { Prisma } from '@prisma/client';

export interface CreateTransferData {
  userId: string;
  fromOrganizationId: string;
  toOrganizationId: string;
  authorizedById: string;
  notes?: string;
}

export const staffTransferRepository = {
  async create(data: CreateTransferData) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const transfer = await tx.staffTransfer.create({
        data: {
          userId: data.userId,
          fromOrganizationId: data.fromOrganizationId,
          toOrganizationId: data.toOrganizationId,
          authorizedById: data.authorizedById,
          notes: data.notes,
        },
        include: {
          user: { select: { id: true, name: true, role: true } },
          fromOrganization: { select: { id: true, name: true } },
          toOrganization: { select: { id: true, name: true } },
          authorizedBy: { select: { id: true, name: true, role: true } },
        },
      });

      await tx.user.update({
        where: { id: data.userId },
        data: { organizationId: data.toOrganizationId },
      });

      return transfer;
    });
  },

  async listByUser(userId: string) {
    return prisma.staffTransfer.findMany({
      where: { userId },
      orderBy: { transferredAt: 'desc' },
      include: {
        fromOrganization: { select: { id: true, name: true } },
        toOrganization: { select: { id: true, name: true } },
        authorizedBy: { select: { id: true, name: true, role: true } },
      },
    });
  },
};
