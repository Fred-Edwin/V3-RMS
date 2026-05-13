import { CancellationRequestStatus, OrderStatus, type PrepStation } from '@prisma/client';
import type { Request } from 'express';
import { orderCancellationRequestRepository } from '../repositories/order-cancellation-request-repository';
import { orderRepository } from '../repositories/order-repository';
import { socketService } from '../sockets/socket-service';
import { incidentService } from './incident-service';
import type {
  OrderCancellationAuthRequestRecord,
  OrderCancellationDecision,
} from '../types/order-cancellation-auth.types';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

type Actor = NonNullable<Request['user']>;

const serializeCancellationRequest = (
  raw: Awaited<ReturnType<typeof orderCancellationRequestRepository.findById>>,
): OrderCancellationAuthRequestRecord => {
  if (!raw) {
    throw new NotFoundError('Order cancellation request not found');
  }

  return {
    id: raw.id,
    organizationId: raw.organizationId,
    orderId: raw.orderId,
    requestedById: raw.requestedById,
    reason: raw.reason,
    reasonDetail: raw.reasonDetail,
    previousStatus: raw.previousStatus,
    status: raw.status,
    resolvedById: raw.resolvedById,
    resolvedAt: raw.resolvedAt,
    resolutionNote: raw.resolutionNote,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    order: {
      id: raw.order.id,
      dailyNumber: raw.order.dailyNumber,
      status: raw.order.status,
      total: raw.order.total.toString(),
    },
    requestedBy: raw.requestedBy,
    resolvedBy: raw.resolvedBy,
  };
};

const resolveOrganizationId = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ForbiddenError('Branch context missing for this user');
  }
  return actor.organizationId;
};

export const orderCancellationAuthService = {
  listPending: async (actor: Actor): Promise<OrderCancellationAuthRequestRecord[]> => {
    const organizationId = resolveOrganizationId(actor);
    const records = await orderCancellationRequestRepository.findPendingByOrganization(organizationId);
    return records.map(serializeCancellationRequest);
  },

  getById: async (
    authRequestId: string,
    actor: Actor,
  ): Promise<OrderCancellationAuthRequestRecord> => {
    const authRequest = await orderCancellationRequestRepository.findById(authRequestId);
    if (!authRequest) {
      throw new NotFoundError('Order cancellation request not found');
    }

    const isRequester = authRequest.requestedById === actor.id;
    const isApprover = actor.role === 'MANAGER' || actor.role === 'DIRECTOR';
    if (!isRequester && !isApprover) {
      throw new ForbiddenError('Access denied');
    }
    if (actor.organizationId && authRequest.organizationId !== actor.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    return serializeCancellationRequest(authRequest);
  },

  getPendingByOrderId: async (
    orderId: string,
    actor: Actor,
  ): Promise<OrderCancellationAuthRequestRecord> => {
    const organizationId = resolveOrganizationId(actor);
    const authRequest = await orderCancellationRequestRepository.findPendingByOrderId(orderId, organizationId);
    if (!authRequest) {
      throw new NotFoundError('No pending cancellation request found for this order');
    }

    const isRequester = authRequest.requestedById === actor.id;
    const isApprover = actor.role === 'MANAGER' || actor.role === 'DIRECTOR';
    if (!isRequester && !isApprover) {
      throw new ForbiddenError('Access denied');
    }

    return serializeCancellationRequest(authRequest);
  },

  createRequest: async (
    orderId: string,
    reason: string,
    reasonDetail: string | null,
    actor: Actor,
  ): Promise<OrderCancellationAuthRequestRecord> => {
    const organizationId = resolveOrganizationId(actor);
    const order = await orderRepository.findById(orderId, organizationId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    if (order.createdById !== actor.id) {
      throw new ForbiddenError('Only the waiter who created this order can request cancellation');
    }
    const allowedStatuses: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.IN_PROGRESS, OrderStatus.READY];
    if (!allowedStatuses.includes(order.status)) {
      throw new ConflictError('Order cannot be cancelled in its current state.');
    }

    const existing = await orderCancellationRequestRepository.findPendingByOrderId(orderId, organizationId);
    if (existing) {
      throw new ConflictError('A cancellation approval request is already pending for this order');
    }

    const authRequest = await orderCancellationRequestRepository.createPendingForOrder({
      organizationId,
      orderId,
      requestedById: actor.id,
      reason,
      reasonDetail,
      previousStatus: order.status,
    });
    if (!authRequest) {
      throw new ConflictError('Order cannot be cancelled in its current state.');
    }

    socketService.emitOrderCancellationPending(actor.id, organizationId, {
      orderId,
      dailyNumber: order.dailyNumber,
      authRequestId: authRequest.id,
      requestedById: actor.id,
      reason,
    });

    logger.info(
      { authRequestId: authRequest.id, orderId, actorId: actor.id },
      'Order cancellation request created',
    );

    return serializeCancellationRequest(authRequest);
  },

  override: async (
    authRequestId: string,
    decision: OrderCancellationDecision,
    actor: Actor,
    resolutionNote: string | null,
  ): Promise<OrderCancellationAuthRequestRecord> => {
    if (actor.role !== 'MANAGER' && actor.role !== 'DIRECTOR') {
      throw new ForbiddenError('Only managers and directors can approve cancellation requests');
    }

    const authRequest = await orderCancellationRequestRepository.findById(authRequestId);
    if (!authRequest) {
      throw new NotFoundError('Order cancellation request not found');
    }
    if (actor.organizationId && authRequest.organizationId !== actor.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    const cancelReason = `${authRequest.reason}${authRequest.reasonDetail ? `: ${authRequest.reasonDetail}` : ''}`;
    const resolved = await orderCancellationRequestRepository.resolveIfPending({
      id: authRequestId,
      organizationId: authRequest.organizationId,
      decision,
      resolvedById: actor.id,
      resolutionNote,
      cancelReason,
    });

    if (!resolved) {
      const current = await orderCancellationRequestRepository.findById(authRequestId, authRequest.organizationId);
      if (!current) {
        throw new NotFoundError('Order cancellation request not found');
      }
      logger.info({ authRequestId }, 'Order cancellation resolution race: already resolved');
      return serializeCancellationRequest(current);
    }

    const stations = authRequest.order
      ? ((await orderRepository.findById(authRequest.orderId, authRequest.organizationId))?.prepTickets.map((ticket) => ticket.station) ?? [])
      : [];

    if (decision === CancellationRequestStatus.APPROVED) {
      const wasForceCancelled = authRequest.previousStatus !== OrderStatus.PENDING;
      if (wasForceCancelled) {
        socketService.emitOrderForceCancelled(
          authRequest.organizationId,
          stations as PrepStation[],
          authRequest.requestedById,
          {
            orderId: authRequest.orderId,
            dailyNumber: authRequest.order.dailyNumber,
            cancelledBy: actor.id,
          },
        );
      } else {
        socketService.emitOrderCancelled(authRequest.organizationId, stations as PrepStation[], {
          orderId: authRequest.orderId,
        });
      }

      incidentService.log({
        organizationId: authRequest.organizationId,
        orderId: authRequest.orderId,
        type: 'ORDER_CANCELLED',
        actorId: actor.id,
        details: {
          dailyNumber: authRequest.order.dailyNumber,
          requestedById: authRequest.requestedById,
          previousStatus: authRequest.previousStatus,
          reason: cancelReason,
          approvalRequestId: authRequest.id,
          forceCancelled: wasForceCancelled,
        },
      });
    } else {
      incidentService.log({
        organizationId: authRequest.organizationId,
        orderId: authRequest.orderId,
        type: 'ORDER_CANCELLATION_REJECTED',
        actorId: actor.id,
        details: {
          dailyNumber: authRequest.order.dailyNumber,
          requestedById: authRequest.requestedById,
          previousStatus: authRequest.previousStatus,
          reason: cancelReason,
          resolutionNote,
          approvalRequestId: authRequest.id,
        },
      });
    }

    socketService.emitOrderCancellationResolved(
      authRequest.requestedById,
      authRequest.organizationId,
      {
        orderId: authRequest.orderId,
        dailyNumber: authRequest.order.dailyNumber,
        authRequestId,
        approved: decision === CancellationRequestStatus.APPROVED,
        restoredStatus: decision === CancellationRequestStatus.REJECTED ? authRequest.previousStatus : undefined,
      },
    );

    logger.info({ authRequestId, decision, orderId: authRequest.orderId }, 'Order cancellation request resolved');

    return serializeCancellationRequest(resolved);
  },
};
