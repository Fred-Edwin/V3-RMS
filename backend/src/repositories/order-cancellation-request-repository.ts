import { CancellationRequestStatus, OrderStatus, PrepTicketStatus, type Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import type { OrderCancellationDecision } from '../types/order-cancellation-auth.types';

const cancellationRequestInclude = {
  order: {
    select: { id: true, dailyNumber: true, status: true, total: true },
  },
  requestedBy: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } },
} as const;

export type OrderCancellationRequestPrismaRecord = Prisma.OrderCancellationRequestGetPayload<{
  include: typeof cancellationRequestInclude;
}>;

export const orderCancellationRequestRepository = {
  createPendingForOrder: async (data: {
    organizationId: string;
    orderId: string;
    requestedById: string;
    reason: string;
    reasonDetail: string | null;
    previousStatus: OrderStatus;
  }): Promise<OrderCancellationRequestPrismaRecord | null> => {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id: data.orderId,
          organizationId: data.organizationId,
          status: data.previousStatus,
        },
        data: {
          status: OrderStatus.AWAITING_CANCELLATION_APPROVAL,
        },
      });

      if (updated.count === 0) {
        return null;
      }

      return tx.orderCancellationRequest.create({
        data: {
          organizationId: data.organizationId,
          orderId: data.orderId,
          requestedById: data.requestedById,
          reason: data.reason,
          reasonDetail: data.reasonDetail,
          previousStatus: data.previousStatus,
        },
        include: cancellationRequestInclude,
      });
    });
  },

  findById: async (
    id: string,
    organizationId?: string,
  ): Promise<OrderCancellationRequestPrismaRecord | null> => {
    return prisma.orderCancellationRequest.findFirst({
      where: { id, ...(organizationId ? { organizationId } : {}) },
      include: cancellationRequestInclude,
    });
  },

  findPendingByOrderId: async (
    orderId: string,
    organizationId?: string,
  ): Promise<OrderCancellationRequestPrismaRecord | null> => {
    return prisma.orderCancellationRequest.findFirst({
      where: {
        orderId,
        status: CancellationRequestStatus.PENDING,
        ...(organizationId ? { organizationId } : {}),
      },
      include: cancellationRequestInclude,
    });
  },

  findPendingByOrganization: async (
    organizationId: string,
  ): Promise<OrderCancellationRequestPrismaRecord[]> => {
    return prisma.orderCancellationRequest.findMany({
      where: { organizationId, status: CancellationRequestStatus.PENDING },
      include: cancellationRequestInclude,
      orderBy: { createdAt: 'asc' },
    });
  },

  resolveIfPending: async (data: {
    id: string;
    organizationId: string;
    decision: OrderCancellationDecision;
    resolvedById: string;
    resolutionNote: string | null;
    cancelReason: string;
  }): Promise<OrderCancellationRequestPrismaRecord | null> => {
    return prisma.$transaction(async (tx) => {
      const request = await tx.orderCancellationRequest.findFirst({
        where: {
          id: data.id,
          organizationId: data.organizationId,
          status: CancellationRequestStatus.PENDING,
        },
        include: cancellationRequestInclude,
      });

      if (!request) {
        return null;
      }

      const resolvedAt = new Date();

      await tx.orderCancellationRequest.updateMany({
        where: {
          id: data.id,
          organizationId: data.organizationId,
          status: CancellationRequestStatus.PENDING,
        },
        data: {
          status: data.decision,
          resolvedById: data.resolvedById,
          resolvedAt,
          resolutionNote: data.resolutionNote,
        },
      });

      if (data.decision === CancellationRequestStatus.APPROVED) {
        await tx.order.updateMany({
          where: {
            id: request.orderId,
            organizationId: data.organizationId,
            status: OrderStatus.AWAITING_CANCELLATION_APPROVAL,
          },
          data: {
            status: OrderStatus.CANCELLED,
            cancelReason: data.cancelReason,
            cancelledById: data.resolvedById,
          },
        });

        await tx.prepTicket.updateMany({
          where: {
            orderId: request.orderId,
            organizationId: data.organizationId,
            status: { notIn: [PrepTicketStatus.REJECTED] },
          },
          data: {
            status: PrepTicketStatus.REJECTED,
            claimedById: null,
            claimedAt: null,
          },
        });
      } else {
        await tx.order.updateMany({
          where: {
            id: request.orderId,
            organizationId: data.organizationId,
            status: OrderStatus.AWAITING_CANCELLATION_APPROVAL,
          },
          data: {
            status: request.previousStatus,
          },
        });
      }

      return tx.orderCancellationRequest.findFirst({
        where: { id: data.id, organizationId: data.organizationId },
        include: cancellationRequestInclude,
      });
    });
  },
};
