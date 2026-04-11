import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { customerDiscountAuthRepository } from '../repositories/customer-discount-auth-repository';
import { discountRepository } from '../repositories/discount-repository';
import { orderRepository } from '../repositories/order-repository';
import { socketService } from '../sockets/socket-service';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import type {
  CustomerDiscountAuthRequestRecord,
  CustomerDiscountDecision,
} from '../types/discount.types';

type Actor = NonNullable<Request['user']>;

const serializeAuthRequest = (
  raw: Awaited<ReturnType<typeof customerDiscountAuthRepository.findById>>,
): CustomerDiscountAuthRequestRecord => {
  if (!raw) throw new NotFoundError('Customer discount auth request not found');
  return {
    id: raw.id,
    organizationId: raw.organizationId,
    orderId: raw.orderId,
    discountId: raw.discountId,
    requestedById: raw.requestedById,
    discountPercent: raw.discountPercent ? raw.discountPercent.toString() : null,
    discountFixed: raw.discountFixed ? raw.discountFixed.toString() : null,
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
    discount: {
      id: raw.discount.id,
      name: raw.discount.name,
      type: raw.discount.type,
      value: raw.discount.value.toString(),
    },
    requestedBy: raw.requestedBy,
    resolvedBy: raw.resolvedBy,
  };
};

export const customerDiscountAuthService = {
  listPending: async (actor: Actor): Promise<CustomerDiscountAuthRequestRecord[]> => {
    if (!actor.organizationId) return [];
    const records = await customerDiscountAuthRepository.findPendingByOrganization(
      actor.organizationId,
    );
    return records.map(serializeAuthRequest);
  },

  getPendingByOrderId: async (
    orderId: string,
    organizationId: string,
  ): Promise<CustomerDiscountAuthRequestRecord> => {
    const authRequest = await customerDiscountAuthRepository.findPendingByOrderId(orderId);
    if (!authRequest || authRequest.organizationId !== organizationId) {
      throw new NotFoundError('No pending customer discount request found for this order');
    }
    return serializeAuthRequest(authRequest);
  },

  getById: async (
    authRequestId: string,
    actor: Actor,
  ): Promise<CustomerDiscountAuthRequestRecord> => {
    const authRequest = await customerDiscountAuthRepository.findById(authRequestId);
    if (!authRequest) throw new NotFoundError('Customer discount auth request not found');

    const isRequester = authRequest.requestedById === actor.id;
    const isManager = actor.role === 'MANAGER' || actor.role === 'DIRECTOR';
    if (!isRequester && !isManager) throw new ForbiddenError('Access denied');

    return serializeAuthRequest(authRequest);
  },

  /**
   * Called by order-service when a waiter submits payment with applyDiscountId set.
   * If the discount requires approval — creates a pending auth request and locks the order.
   * If the discount does NOT require approval — applies it immediately and returns the order.
   */
  createAuthRequest: async (
    orderId: string,
    discountId: string,
    organizationId: string,
    actor: Actor,
  ): Promise<{ requiresApproval: boolean; authRequest?: CustomerDiscountAuthRequestRecord }> => {
    const order = await orderRepository.findById(orderId, organizationId);
    if (!order) throw new NotFoundError('Order not found');

    if (order.status !== 'READY') {
      throw new ConflictError('Order must be in READY status to apply a discount');
    }

    if (order.discountAmount !== null) {
      throw new ConflictError('A discount has already been applied to this order');
    }

    // Verify discount is active and visible to this branch
    const discount = await discountRepository.findById(discountId);
    if (!discount || !discount.isActive) {
      throw new NotFoundError('Discount not found or inactive');
    }
    if (discount.organizationId !== null && discount.organizationId !== organizationId) {
      throw new ForbiddenError('This discount is not available at this branch');
    }

    // Prevent duplicate pending requests
    const existing = await customerDiscountAuthRepository.findPendingByOrderId(orderId);
    if (existing) {
      throw new ConflictError('A discount approval request is already pending for this order');
    }

    // Calculate discount amount
    const originalAmount = order.total;
    let discountAmount: Prisma.Decimal;
    let discountPercent: string | null = null;
    let discountFixed: string | null = null;

    if (discount.type === 'PERCENTAGE') {
      discountPercent = discount.value.toString();
      discountAmount = originalAmount
        .mul(new Prisma.Decimal(discount.value))
        .div(100)
        .toDecimalPlaces(2);
    } else {
      discountFixed = discount.value.toString();
      discountAmount = Prisma.Decimal.min(
        new Prisma.Decimal(discount.value),
        originalAmount,
      ).toDecimalPlaces(2);
    }

    if (!discount.requiresApproval) {
      // Auto-apply — write discount directly without going through AWAITING_AUTHORIZATION
      await orderRepository.applyDiscount(
        orderId,
        organizationId,
        discountPercent ?? '0',
        discountAmount.toString(),
        actor.id,
        discountId,
      );
      logger.info(
        { orderId, discountId, actorId: actor.id, discountAmount: discountAmount.toString() },
        'Customer discount auto-applied',
      );
      return { requiresApproval: false };
    }

    // Requires approval — create pending request
    const authRequest = await customerDiscountAuthRepository.create({
      organizationId,
      orderId,
      discountId,
      requestedById: actor.id,
      discountPercent,
      discountFixed,
      originalAmount: originalAmount.toString(),
      discountAmount: discountAmount.toString(),
    });

    await orderRepository.updateStatus(orderId, organizationId, 'AWAITING_AUTHORIZATION');

    socketService.emitCustomerDiscountAuthPending(actor.id, organizationId, {
      orderId,
      dailyNumber: order.dailyNumber,
      authRequestId: authRequest.id,
      discountName: discount.name,
      originalAmount: originalAmount.toString(),
      discountAmount: discountAmount.toString(),
    });

    logger.info(
      { authRequestId: authRequest.id, orderId, actorId: actor.id, discountId },
      'Customer discount auth request created',
    );

    return { requiresApproval: true, authRequest: serializeAuthRequest(authRequest) };
  },

  /**
   * Manager or director approves or rejects the discount request.
   */
  managerApprove: async (
    authRequestId: string,
    decision: CustomerDiscountDecision,
    actor: Actor,
  ): Promise<CustomerDiscountAuthRequestRecord> => {
    if (actor.role !== 'MANAGER' && actor.role !== 'DIRECTOR') {
      throw new ForbiddenError('Only managers and directors can approve customer discount requests');
    }

    const authRequest = await customerDiscountAuthRepository.findById(authRequestId);
    if (!authRequest) throw new NotFoundError('Customer discount auth request not found');

    if (actor.organizationId && authRequest.organizationId !== actor.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    return customerDiscountAuthService._applyDecision(authRequest, decision, actor.id);
  },

  _applyDecision: async (
    authRequest: NonNullable<Awaited<ReturnType<typeof customerDiscountAuthRepository.findById>>>,
    decision: CustomerDiscountDecision,
    resolvedById: string,
  ): Promise<CustomerDiscountAuthRequestRecord> => {
    const { organizationId, orderId, requestedById } = authRequest;

    const resolved = await customerDiscountAuthRepository.resolveIfPending(
      authRequest.id,
      decision,
      resolvedById,
    );

    if (!resolved) {
      const current = await customerDiscountAuthRepository.findById(authRequest.id);
      if (!current) throw new NotFoundError('Customer discount auth request not found');
      logger.info({ authRequestId: authRequest.id }, 'Customer discount resolution race: already resolved');
      return serializeAuthRequest(current);
    }

    let discountedTotal: string | undefined;

    if (decision === 'APPROVED') {
      const discountPercent = authRequest.discountPercent?.toString() ?? '0';
      const discountedOrder = await orderRepository.applyDiscount(
        orderId,
        organizationId,
        discountPercent,
        authRequest.discountAmount.toString(),
        resolvedById,
        authRequest.discountId,
      );

      if (!discountedOrder) {
        logger.warn(
          { orderId, authRequestId: authRequest.id },
          'Customer discount approved but order is no longer AWAITING_AUTHORIZATION',
        );
      } else {
        discountedTotal = discountedOrder.total.toString();
      }

      await orderRepository.updateStatus(orderId, organizationId, 'READY');
    } else {
      await orderRepository.updateStatus(orderId, organizationId, 'READY');
    }

    socketService.emitCustomerDiscountAuthResolved(requestedById, organizationId, {
      orderId,
      dailyNumber: authRequest.order.dailyNumber,
      approved: decision === 'APPROVED',
      ...(discountedTotal !== undefined && { discountedTotal }),
    });

    logger.info(
      { authRequestId: authRequest.id, decision, orderId },
      'Customer discount auth request resolved',
    );

    return serializeAuthRequest(resolved);
  },
};
