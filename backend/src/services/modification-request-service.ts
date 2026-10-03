import { OrderStatus } from '@prisma/client';
import type { Request } from 'express';
import { orderRepository } from '../repositories/order-repository';
import {
  modificationRequestRepository,
  type ModRequestWithRelations,
} from '../repositories/modification-request-repository';
import { socketService } from '../sockets/socket-service';
import { incidentService } from './incident-service';
import type { ModificationRequestRecord } from '../types/modification-request.types';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';

type Actor = NonNullable<Request['user']>;

const serialize = (req: ModRequestWithRelations): ModificationRequestRecord => ({
  id: req.id,
  siteId: req.siteId,
  orderId: req.orderId,
  requestedBy: { id: req.requestedBy.id, name: req.requestedBy.name },
  description: req.description,
  status: req.status,
  reviewedBy: req.reviewedBy ? { id: req.reviewedBy.id, name: req.reviewedBy.name } : null,
  reviewedAt: req.reviewedAt?.toISOString() ?? null,
  reviewNote: req.reviewNote,
  createdAt: req.createdAt.toISOString(),
});

export const modificationRequestService = {
  create: async (
    orderId: string,
    description: string,
    actor: Actor,
  ): Promise<ModificationRequestRecord> => {
    const siteId = actor.siteId;
    if (!siteId) {
      throw new ForbiddenError('Branch context required');
    }

    const order = await orderRepository.findById(orderId, siteId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (order.createdById !== actor.id) {
      throw new ForbiddenError('Only the waiter who created this order can request modifications');
    }

    if (order.status !== OrderStatus.IN_PROGRESS) {
      throw new ConflictError('Modification requests can only be made for in-progress orders');
    }

    const existingPending = await modificationRequestRepository.findPendingByOrder(orderId, siteId);
    if (existingPending) {
      throw new ConflictError('There is already a pending modification request for this order');
    }

    const created = await modificationRequestRepository.create({
      siteId,
      orderId,
      requestedById: actor.id,
      description,
    });

    const stations = [...new Set(order.prepTickets.map((t) => t.station))];
    socketService.emitModificationRequested(siteId, stations, {
      requestId: created.id,
      orderId,
      dailyNumber: order.dailyNumber,
      description,
      requestedBy: { id: actor.id, name: created.requestedBy.name },
    });

    incidentService.log({
      siteId,
      orderId,
      type: 'MODIFICATION_REQUESTED',
      actorId: actor.id,
      details: { dailyNumber: order.dailyNumber, description },
    });

    return serialize(created);
  },

  getByOrder: async (
    orderId: string,
    actor: Actor,
  ): Promise<ModificationRequestRecord[]> => {
    const siteId = actor.siteId;
    if (!siteId) {
      throw new ForbiddenError('Branch context required');
    }

    const requests = await modificationRequestRepository.findByOrder(orderId, siteId);
    return requests.map(serialize);
  },

  review: async (
    requestId: string,
    status: 'APPROVED' | 'REJECTED',
    reviewNote: string | undefined,
    actor: Actor,
  ): Promise<ModificationRequestRecord> => {
    const siteId = actor.siteId;
    if (!siteId) {
      throw new ForbiddenError('Branch context required');
    }

    const request = await modificationRequestRepository.findById(requestId, siteId);
    if (!request) {
      throw new NotFoundError('Modification request not found');
    }

    const reviewed = await modificationRequestRepository.review(requestId, siteId, {
      status,
      reviewedById: actor.id,
      reviewNote,
    });

    if (!reviewed) {
      throw new ConflictError('This request has already been reviewed');
    }

    socketService.emitModificationReviewed(request.requestedById, {
      requestId: reviewed.id,
      orderId: reviewed.orderId,
      status: reviewed.status,
      reviewNote: reviewed.reviewNote,
    });

    incidentService.log({
      siteId,
      orderId: reviewed.orderId,
      type: status === 'APPROVED' ? 'MODIFICATION_APPROVED' : 'MODIFICATION_REJECTED',
      actorId: actor.id,
      details: {
        requestId: reviewed.id,
        description: reviewed.description,
        reviewNote: reviewed.reviewNote,
      },
    });

    return serialize(reviewed);
  },
};
