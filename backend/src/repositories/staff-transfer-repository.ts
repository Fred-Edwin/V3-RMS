import { prisma } from '../config/database';
import type { Prisma } from '@prisma/client';

export interface CreateTransferData {
  userId: string;
  fromOrganizationId: string | null;
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

      // Q4 (Phase 2 Session 1): a department head transferred between branches
      // cannot keep the head marker or department tag — both are scoped to the
      // branch they're leaving, and D-17 requires exactly one head per
      // (branch, department). The person keeps their real role; only the head
      // marker + tag are cleared, same as an explicit unassign.
      const currentUser = await tx.user.findUniqueOrThrow({ where: { id: data.userId } });

      await tx.user.update({
        where: { id: data.userId },
        data: {
          organizationId: data.toOrganizationId,
          ...(currentUser.isDepartmentHead
            ? { isDepartmentHead: false, departmentTag: null }
            : {}),
        },
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
