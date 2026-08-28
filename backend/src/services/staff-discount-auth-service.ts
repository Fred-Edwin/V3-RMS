import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { staffDiscountAuthRequestRepository } from '../repositories/staff-discount-auth-request-repository';
import { orderRepository } from '../repositories/order-repository';
import { socketService } from '../sockets/socket-service';
import { fcmService } from './fcm-service';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import type {
  StaffDiscountAuthRequestRecord,
  StaffDiscountDecision,
} from '../types/staff-discount-auth.types';
import { STAFF_DISCOUNT_PERCENT } from '../types/staff-discount-auth.types';

type Actor = NonNullable<Request['user']>;

const serializeAuthRequest = (
  raw: Awaited<ReturnType<typeof staffDiscountAuthRequestRepository.findById>>,
): StaffDiscountAuthRequestRecord => {
  if (!raw) throw new NotFoundError('Staff discount auth request not found');
  return {
    id: raw.id,
    organizationId: raw.organizationId,
    orderId: raw.orderId,
    requestedById: raw.requestedById,
    discountPercent: raw.discountPercent.toString(),
    originalAmount: raw.originalAmount.toString(),
    discountAmount: raw.discountAmount.toString(),
    status: raw.status,
    resolvedById: raw.resolvedById,
    resolvedAt: raw.resolvedAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    order: {
      id: raw.order.id,
      dailyNumber: raw.order.dailyNumber,
      total: raw.order.total.toString(),
    },
    requestedBy: raw.requestedBy,
    resolvedBy: raw.resolvedBy,
  };
};

export const staffDiscountAuthService = {
  /**
   * Returns pending staff-discount requests the actor may approve.
   * Staff discounts are approved by DIRECTORS only. Directors are a system-level
   * role with no organizationId, so they see every branch's pending requests.
   */
  listPending: async (actor: Actor): Promise<StaffDiscountAuthRequestRecord[]> => {
    if (actor.role === 'DIRECTOR') {
      const records = await staffDiscountAuthRequestRepository.findAllPending();
      return records.map(serializeAuthRequest);
    }
    return [];
  },

  /**
   * Returns the pending discount auth request for a given order (used by the order card).
   */
  getPendingByOrderId: async (
    orderId: string,
    organizationId: string,
  ): Promise<StaffDiscountAuthRequestRecord> => {
    const authRequest = await staffDiscountAuthRequestRepository.findPendingByOrderId(orderId, organizationId);
    if (!authRequest || authRequest.organizationId !== organizationId) {
      throw new NotFoundError('No pending staff discount request found for this order');
    }
    return serializeAuthRequest(authRequest);
  },

  /**
   * Returns a specific auth request by ID.
   */
  getById: async (
    authRequestId: string,
    actor: Actor,
  ): Promise<StaffDiscountAuthRequestRecord> => {
    const authRequest = await staffDiscountAuthRequestRepository.findById(authRequestId);
    if (!authRequest) throw new NotFoundError('Staff discount auth request not found');

    const isRequester = authRequest.requestedById === actor.id;
    const isApprover = actor.role === 'DIRECTOR';
    if (!isRequester && !isApprover) throw new ForbiddenError('Access denied');

    return serializeAuthRequest(authRequest);
  },

  /**
   * Called by order-service when a waiter submits a payment with applyStaffDiscount: true.
   * Creates a pending auth request and sets the order to AWAITING_AUTHORIZATION.
   */
  createAuthRequest: async (
    orderId: string,
    organizationId: string,
    actor: Actor,
  ): Promise<StaffDiscountAuthRequestRecord> => {
    const order = await orderRepository.findById(orderId, organizationId);
    if (!order) throw new NotFoundError('Order not found');

    if (order.status !== 'READY') {
      throw new ConflictError('Order must be in READY status to apply a staff discount');
    }

    if (order.createdById !== actor.id) {
      throw new ForbiddenError('Staff discount can only be applied to your own orders');
    }

    // Prevent duplicate pending requests
    const existing = await staffDiscountAuthRequestRepository.findPendingByOrderId(orderId, organizationId);
    if (existing) {
      throw new ConflictError('A staff discount approval request is already pending for this order');
    }

    // Calculate discount using Decimal arithmetic to avoid floating-point errors
    const originalAmount = order.total;
    const discountPercent = new Prisma.Decimal(STAFF_DISCOUNT_PERCENT);
    const discountAmount = originalAmount.mul(discountPercent).div(100).toDecimalPlaces(2);

    const authRequest = await staffDiscountAuthRequestRepository.create({
      organizationId,
      orderId,
      requestedById: actor.id,
      discountPercent: discountPercent.toString(),
      originalAmount: originalAmount.toString(),
      discountAmount: discountAmount.toString(),
    });

    await orderRepository.updateStatus(orderId, organizationId, 'AWAITING_AUTHORIZATION');

    socketService.emitStaffDiscountAuthPending(actor.id, organizationId, {
      orderId,
      dailyNumber: order.dailyNumber,
      authRequestId: authRequest.id,
      originalAmount: originalAmount.toString(),
      discountAmount: discountAmount.toString(),
    });

    // Notify all directors via FCM so it reaches them even with the app closed.
    // Fire-and-forget — must never block or fail the request.
    void fcmService
      .sendStaffDiscountAuthPushToDirectors({
        orderId,
        dailyNumber: order.dailyNumber,
        requesterName: authRequest.requestedBy.name,
        originalAmount: originalAmount.toString(),
        discountedAmount: originalAmount.sub(discountAmount).toDecimalPlaces(2).toString(),
      })
      .catch((error: unknown) => {
        logger.warn({ error, orderId }, 'Staff discount director push failed');
      });

    logger.info(
      { authRequestId: authRequest.id, orderId, actorId: actor.id, discountAmount: discountAmount.toString() },
      'Staff discount auth request created',
    );

    return serializeAuthRequest(authRequest);
  },

  /**
   * Director approves or rejects the discount request. Staff discounts are a
   * director-only authorization — managers cannot approve them (client policy,
   * 2026-08-28). Directors are system-level with no organizationId, so no branch
   * scope check applies; a director may resolve any branch's request.
   */
  managerApprove: async (
    authRequestId: string,
    decision: StaffDiscountDecision,
    actor: Actor,
  ): Promise<StaffDiscountAuthRequestRecord> => {
    if (actor.role !== 'DIRECTOR') {
      throw new ForbiddenError('Only directors can approve staff discount requests');
    }

    const authRequest = await staffDiscountAuthRequestRepository.findById(authRequestId);
    if (!authRequest) throw new NotFoundError('Staff discount auth request not found');

    return staffDiscountAuthService._applyDecision(authRequest, decision, actor.id);
  },

  /**
   * The waiter who requested the discount withdraws it while it is still PENDING.
   * Sets the request to CANCELLED and returns the order to READY so the waiter
   * can proceed (pay full price, or request again). No-ops safely if a director
   * already resolved it in the meantime.
   */
  withdraw: async (
    authRequestId: string,
    actor: Actor,
  ): Promise<StaffDiscountAuthRequestRecord> => {
    const authRequest = await staffDiscountAuthRequestRepository.findById(authRequestId);
    if (!authRequest) throw new NotFoundError('Staff discount auth request not found');

    if (authRequest.requestedById !== actor.id) {
      throw new ForbiddenError('Only the waiter who requested the discount can withdraw it');
    }

    const cancelled = await staffDiscountAuthRequestRepository.cancelIfPending(
      authRequest.id,
      actor.id,
    );

    if (!cancelled) {
      // Already approved / rejected / cancelled — return the current state, no order change.
      const current = await staffDiscountAuthRequestRepository.findById(authRequest.id);
      if (!current) throw new NotFoundError('Staff discount auth request not found');
      if (current.status === 'PENDING') {
        // Shouldn't happen (cancelIfPending is atomic on requester+PENDING), but be safe.
        throw new ConflictError('Could not withdraw the discount request. Please refresh and try again.');
      }
      logger.info({ authRequestId: authRequest.id, status: current.status }, 'Staff discount withdraw: already resolved');
      return serializeAuthRequest(current);
    }

    // Return the order to READY at full price.
    await orderRepository.updateStatus(cancelled.orderId, cancelled.organizationId, 'READY');

    // Reuse the resolved event so the director dashboard drops the pending card
    // and the waiter's order card unlocks. approved:false, no discountedTotal.
    socketService.emitStaffDiscountAuthResolved(actor.id, cancelled.organizationId, {
      orderId: cancelled.orderId,
      dailyNumber: cancelled.order.dailyNumber,
      approved: false,
    });

    logger.info(
      { authRequestId: authRequest.id, orderId: cancelled.orderId, actorId: actor.id },
      'Staff discount auth request withdrawn by requester',
    );

    return serializeAuthRequest(cancelled);
  },

  /**
   * Internal — shared resolution logic.
   */
  _applyDecision: async (
    authRequest: NonNullable<Awaited<ReturnType<typeof staffDiscountAuthRequestRepository.findById>>>,
    decision: StaffDiscountDecision,
    resolvedById: string,
  ): Promise<StaffDiscountAuthRequestRecord> => {
    const { organizationId, orderId, requestedById } = authRequest;

    const resolved = await staffDiscountAuthRequestRepository.resolveIfPending(
      authRequest.id,
      organizationId,
      decision,
      resolvedById,
    );

    if (!resolved) {
      // Race condition: already resolved by another path
      const current = await staffDiscountAuthRequestRepository.findById(authRequest.id, organizationId);
      if (!current) throw new NotFoundError('Staff discount auth request not found');
      logger.info({ authRequestId: authRequest.id }, 'Staff discount resolution race: already resolved');
      return serializeAuthRequest(current);
    }

    let discountedTotal: string | undefined;

    if (decision === 'APPROVED') {
      // Apply the discount to the order total atomically
      const discountedOrder = await orderRepository.applyDiscount(
        orderId,
        organizationId,
        authRequest.discountPercent.toString(),
        authRequest.discountAmount.toString(),
        resolvedById,
      );

      if (!discountedOrder) {
        // Order no longer in AWAITING_AUTHORIZATION — log and proceed without erroring
        logger.warn(
          { orderId, authRequestId: authRequest.id },
          'Staff discount approved but order is no longer AWAITING_AUTHORIZATION',
        );
      } else {
        discountedTotal = discountedOrder.total.toString();
      }

      // Return order to READY so waiter can proceed with payment at discounted total
      await orderRepository.updateStatus(orderId, organizationId, 'READY');
    } else {
      // Rejected — return order to READY at full price
      await orderRepository.updateStatus(orderId, organizationId, 'READY');
    }

    socketService.emitStaffDiscountAuthResolved(requestedById, organizationId, {
      orderId,
      dailyNumber: authRequest.order.dailyNumber,
      approved: decision === 'APPROVED',
      ...(discountedTotal !== undefined && { discountedTotal }),
    });

    logger.info(
      { authRequestId: authRequest.id, decision, orderId },
      'Staff discount auth request resolved',
    );

    return serializeAuthRequest(resolved);
  },
};
