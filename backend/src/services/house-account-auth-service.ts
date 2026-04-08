import type { Request } from 'express';
import { houseAccountAuthRequestRepository } from '../repositories/house-account-auth-request-repository';
import { houseAccountRepository } from '../repositories/house-account-repository';
import { orderRepository } from '../repositories/order-repository';
import { authRepository } from '../repositories/auth-repository';
import { socketService } from '../sockets/socket-service';
import { fcmService } from './fcm-service';
import { incidentService } from './incident-service';
import { authQueue } from '../config/queues';
import { cancelAuthTimeoutJob } from '../jobs/house-account-auth-timeout';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import type { HouseAccountAuthRequestRecord, AuthDecision } from '../types/house-account-auth.types';

type Actor = NonNullable<Request['user']>;

const serializeAuthRequest = (
  raw: Awaited<ReturnType<typeof houseAccountAuthRequestRepository.findById>>,
): HouseAccountAuthRequestRecord => {
  if (!raw) throw new NotFoundError('Auth request not found');
  return {
    id: raw.id,
    organizationId: raw.organizationId,
    orderId: raw.orderId,
    houseAccountId: raw.houseAccountId,
    requestedById: raw.requestedById,
    amount: raw.amount.toString(),
    status: raw.status,
    bullmqJobId: raw.bullmqJobId,
    expiresAt: raw.expiresAt,
    resolvedById: raw.resolvedById,
    resolvedAt: raw.resolvedAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    order: {
      id: raw.order.id,
      dailyNumber: raw.order.dailyNumber,
      total: raw.order.total.toString(),
    },
    houseAccount: {
      id: raw.houseAccount.id,
      user: raw.houseAccount.user,
    },
    requestedBy: raw.requestedBy,
    resolvedBy: raw.resolvedBy,
  };
};

export const houseAccountAuthService = {
  listPending: async (actor: Actor): Promise<HouseAccountAuthRequestRecord[]> => {
    // Directors may have no organizationId (system-level role) — scope to their own house account requests
    if (!actor.organizationId) {
      const records = await houseAccountAuthRequestRepository.findPendingByHolderUserId(actor.id);
      return records.map(serializeAuthRequest);
    }
    const records = await houseAccountAuthRequestRepository.findPendingByOrganization(actor.organizationId);
    return records.map(serializeAuthRequest);
  },

  /**
   * Called by order-service when a waiter submits a House Account payment.
   * Creates a pending auth request and notifies the holder via FCM + socket.
   * No timeout — the request stays pending until a manager/director acts on it.
   */
  createAuthRequest: async (
    orderId: string,
    houseAccountId: string,
    organizationId: string,
    actor: Actor,
  ): Promise<HouseAccountAuthRequestRecord> => {
    const order = await orderRepository.findById(orderId, organizationId);
    if (!order) throw new NotFoundError('Order not found');

    const account = await houseAccountRepository.findById(houseAccountId);
    if (!account || !account.isActive) throw new NotFoundError('House account not found or inactive');

    // expiresAt is kept in schema but no longer enforced — set far future so UI never shows "Expired"
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const authRequest = await houseAccountAuthRequestRepository.create({
      organizationId,
      orderId,
      houseAccountId,
      requestedById: actor.id,
      amount: order.total.toString(),
      bullmqJobId: '',
      expiresAt,
    });

    // Update order status to AWAITING_AUTHORIZATION
    await orderRepository.updateStatus(orderId, organizationId, 'AWAITING_AUTHORIZATION');

    // Notify the account holder via FCM (fire-and-forget)
    void fcmService.sendHouseAccountAuthPush(account.userId, {
      orderId,
      dailyNumber: order.dailyNumber,
      amount: order.total.toString(),
      authRequestId: authRequest.id,
    });

    // Notify all branch members via socket so order cards update immediately
    socketService.emitAuthPending(actor.id, organizationId, {
      orderId,
      dailyNumber: order.dailyNumber,
      authRequestId: authRequest.id,
    });

    logger.info({ authRequestId: authRequest.id, orderId, houseAccountId }, 'House account auth request created');

    return serializeAuthRequest(authRequest);
  },

  /**
   * Fetches the pending auth request for an order (used by the authorize page).
   */
  getPendingByOrderId: async (
    orderId: string,
    organizationId: string,
  ): Promise<HouseAccountAuthRequestRecord> => {
    const authRequest = await houseAccountAuthRequestRepository.findPendingByOrderId(orderId);
    if (!authRequest || authRequest.organizationId !== organizationId) {
      throw new NotFoundError('No pending authorization request found for this order');
    }
    return serializeAuthRequest(authRequest);
  },

  /**
   * Fetches any auth request by its own ID (used by the authorize page via requestId param).
   */
  getById: async (authRequestId: string, actor: Actor): Promise<HouseAccountAuthRequestRecord> => {
    const authRequest = await houseAccountAuthRequestRepository.findById(authRequestId);
    if (!authRequest) throw new NotFoundError('Authorization request not found');

    // Only the account holder or a manager/director can view
    const isHolder = authRequest.houseAccount.user.id === actor.id;
    const isManager = actor.role === 'MANAGER' || actor.role === 'DIRECTOR';
    if (!isHolder && !isManager) throw new ForbiddenError('Access denied');

    return serializeAuthRequest(authRequest);
  },

  /**
   * Called by the account holder to approve or reject a charge.
   */
  resolve: async (
    authRequestId: string,
    decision: AuthDecision,
    actor: Actor,
  ): Promise<HouseAccountAuthRequestRecord> => {
    const authRequest = await houseAccountAuthRequestRepository.findById(authRequestId);
    if (!authRequest) throw new NotFoundError('Authorization request not found');

    // Only the account holder can resolve (not override — that's managerOverride)
    const isHolder = authRequest.houseAccount.user.id === actor.id;
    if (!isHolder) throw new ForbiddenError('Only the account holder can approve or reject this charge');

    return houseAccountAuthService._applyDecision(authRequest.id, authRequest, decision, actor.id);
  },

  /**
   * Manager or director can override a pending request.
   */
  managerOverride: async (
    authRequestId: string,
    decision: AuthDecision,
    actor: Actor,
  ): Promise<HouseAccountAuthRequestRecord> => {
    if (actor.role !== 'MANAGER' && actor.role !== 'DIRECTOR') {
      throw new ForbiddenError('Only managers and directors can override authorization requests');
    }

    const authRequest = await houseAccountAuthRequestRepository.findById(authRequestId);
    if (!authRequest) throw new NotFoundError('Authorization request not found');

    // Scope check — manager must belong to the same branch
    if (actor.organizationId && authRequest.organizationId !== actor.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    return houseAccountAuthService._applyDecision(authRequest.id, authRequest, decision, actor.id);
  },

  /**
   * Called by the BullMQ timeout worker — auto-rejects if still PENDING.
   */
  handleTimeout: async (authRequestId: string): Promise<void> => {
    const authRequest = await houseAccountAuthRequestRepository.findById(authRequestId);
    if (!authRequest) {
      logger.warn({ authRequestId }, 'Auth timeout fired but request not found');
      return;
    }

    if (authRequest.status !== 'PENDING') {
      logger.info({ authRequestId, status: authRequest.status }, 'Auth timeout fired but request already resolved');
      return;
    }

    // Use a system actor ID (the waiter who created the request) for the resolution
    await houseAccountAuthService._applyDecision(
      authRequestId,
      authRequest,
      'REJECTED',
      authRequest.requestedById,
      true,
    );
  },

  /**
   * Internal — shared resolution logic for resolve, managerOverride, and handleTimeout.
   * isTimeout=true suppresses the "only holder can resolve" check.
   */
  _applyDecision: async (
    authRequestId: string,
    authRequest: NonNullable<Awaited<ReturnType<typeof houseAccountAuthRequestRepository.findById>>>,
    decision: AuthDecision,
    resolvedById: string,
    isTimeout = false,
  ): Promise<HouseAccountAuthRequestRecord> => {
    const newStatus = decision === 'APPROVED' ? 'APPROVED' : (isTimeout ? 'TIMED_OUT' : 'REJECTED');

    const resolved = await houseAccountAuthRequestRepository.resolveIfPending(
      authRequestId,
      newStatus,
      resolvedById,
    );

    if (!resolved) {
      // Race condition: already resolved by another path — read current state
      const current = await houseAccountAuthRequestRepository.findById(authRequestId);
      if (!current) throw new NotFoundError('Authorization request not found');
      logger.info({ authRequestId }, 'Auth resolution race: request already resolved, returning current state');
      return serializeAuthRequest(current);
    }

    const { organizationId, orderId, requestedById } = authRequest;

    // Cancel the timeout job if it exists and we're not the timeout
    if (!isTimeout && authRequest.bullmqJobId) {
      void cancelAuthTimeoutJob(authQueue, authRequest.bullmqJobId);
    }

    if (decision === 'APPROVED') {
      // Run the payment — same logic as the immediate path in order-service
      try {
        await orderRepository.recordPayment(orderId, organizationId, {
          paymentMethod: 'HOUSE_ACCOUNT',
          mpesaCode: null,
          mpesaAmount: null,
          cashAmount: null,
          cardAmount: null,
          splitType: null,
          houseAccountId: authRequest.houseAccountId,
          corporateAccountId: null,
          corporateEmployeeRef: null,
          customerCreditAccountId: null,
        });
      } catch (err) {
        // If payment fails (e.g. credit limit race), revert to READY and treat as rejection
        await orderRepository.updateStatus(orderId, organizationId, 'READY');
        logger.error({ err, orderId, authRequestId }, 'House account payment failed after approval — reverting to READY');
        throw new ConflictError('Payment could not be processed after approval. Order returned to READY.');
      }

      // Notify kitchen/barista stations the order is closed
      const order = await orderRepository.findById(orderId, organizationId);
      if (order) {
        const { PrepStation } = await import('@prisma/client');
        const stations = [...new Set(order.prepTickets.map((t) => t.station))];
        socketService.emitOrderClosed(
          organizationId,
          stations as (typeof PrepStation)[keyof typeof PrepStation][],
          { orderId, dailyNumber: order.dailyNumber },
        );
      }
    } else {
      // Rejected or timed out — return order to READY so waiter can collect differently
      await orderRepository.updateStatus(orderId, organizationId, 'READY');

      // Log incident
      const reason = isTimeout ? 'Authorization timed out' : 'Rejected by account holder';
      incidentService.log({
        organizationId,
        orderId,
        type: 'PAYMENT_REJECTED',
        actorId: resolvedById,
        details: {
          authRequestId,
          reason,
          houseAccountId: authRequest.houseAccountId,
          amount: authRequest.amount.toString(),
        },
      });
    }

    // Notify waiter and all branch members via socket
    socketService.emitAuthResolved(requestedById, organizationId, {
      orderId,
      dailyNumber: authRequest.order.dailyNumber,
      approved: decision === 'APPROVED',
    });

    void fcmService.sendAuthResolutionPush(requestedById, {
      dailyNumber: authRequest.order.dailyNumber,
      approved: decision === 'APPROVED',
    });

    logger.info({ authRequestId, decision, orderId }, 'House account auth request resolved');
    return serializeAuthRequest(resolved);
  },

  /**
   * Force-revert an expired pending auth request back to READY.
   * Used when the BullMQ timeout job was missed (worker restart, etc.)
   * Only callable by MANAGER or DIRECTOR.
   */
  forceExpire: async (authRequestId: string, actor: Actor): Promise<void> => {
    if (actor.role !== 'MANAGER' && actor.role !== 'DIRECTOR') {
      throw new ForbiddenError('Only managers and directors can force-expire auth requests');
    }

    const authRequest = await houseAccountAuthRequestRepository.findById(authRequestId);
    if (!authRequest) throw new NotFoundError('Authorization request not found');
    if (authRequest.status !== 'PENDING') {
      throw new ConflictError('Authorization request is already resolved');
    }
    if (new Date(authRequest.expiresAt) > new Date()) {
      throw new ConflictError('Authorization request has not yet expired');
    }

    // Scope check for managers
    if (actor.organizationId && authRequest.organizationId !== actor.organizationId) {
      throw new ForbiddenError('Access denied');
    }

    await houseAccountAuthService._applyDecision(authRequestId, authRequest, 'REJECTED', actor.id, true);
    logger.info({ authRequestId, actorId: actor.id }, 'Auth request force-expired by manager');
  },
};
