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
    siteId: string;
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
          siteId: data.siteId,
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
          siteId: data.siteId,
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
    siteId?: string,
  ): Promise<OrderCancellationRequestPrismaRecord | null> => {
    return prisma.orderCancellationRequest.findFirst({
      where: { id, ...(siteId ? { siteId } : {}) },
      include: cancellationRequestInclude,
    });
  },

  findPendingByOrderId: async (
    orderId: string,
    siteId?: string,
  ): Promise<OrderCancellationRequestPrismaRecord | null> => {
    return prisma.orderCancellationRequest.findFirst({
      where: {
        orderId,
        status: CancellationRequestStatus.PENDING,
        ...(siteId ? { siteId } : {}),
      },
      include: cancellationRequestInclude,
    });
  },

  findPendingBySite: async (
    siteId: string,
  ): Promise<OrderCancellationRequestPrismaRecord[]> => {
    return prisma.orderCancellationRequest.findMany({
      where: { siteId, status: CancellationRequestStatus.PENDING },
      include: cancellationRequestInclude,
      orderBy: { createdAt: 'asc' },
    });
  },

  resolveIfPending: async (data: {
    id: string;
    siteId: string;
    decision: OrderCancellationDecision;
    resolvedById: string;
    resolutionNote: string | null;
    cancelReason: string;
  }): Promise<OrderCancellationRequestPrismaRecord | null> => {
    return prisma.$transaction(async (tx) => {
      const request = await tx.orderCancellationRequest.findFirst({
        where: {
          id: data.id,
          siteId: data.siteId,
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
          siteId: data.siteId,
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
            siteId: data.siteId,
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
            siteId: data.siteId,
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
            siteId: data.siteId,
            status: OrderStatus.AWAITING_CANCELLATION_APPROVAL,
          },
          data: {
            status: request.previousStatus,
          },
        });
      }

      return tx.orderCancellationRequest.findFirst({
        where: { id: data.id, siteId: data.siteId },
        include: cancellationRequestInclude,
      });
    });
  },
};
