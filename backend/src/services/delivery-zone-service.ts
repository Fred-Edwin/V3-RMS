import type { Request } from 'express';
import type { DeliveryZone } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { deliveryZoneRepository } from '../repositories/delivery-zone-repository';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import type { CreateDeliveryZoneInput, UpdateDeliveryZoneInput } from '../validators/delivery-zone-schemas';

type Actor = NonNullable<Request['user']>;

const requireOrganizationId = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ForbiddenError('Branch context missing for this user');
  }

  return actor.organizationId;
};

const remapDeliveryZoneWriteError = (error: unknown): never => {
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2000') {
      throw new ValidationError('Delivery zone data is too long');
    }

    if (error.code === 'P2003') {
      throw new ValidationError('Invalid branch context for delivery zone');
    }
  }

  throw error;
};

export const deliveryZoneService = {
  listZones: async (actor: Actor): Promise<DeliveryZone[]> => {
    const organizationId = requireOrganizationId(actor);
    return deliveryZoneRepository.findAllActiveByOrganization(organizationId);
  },

  createZone: async (actor: Actor, input: CreateDeliveryZoneInput): Promise<DeliveryZone> => {
    const organizationId = requireOrganizationId(actor);
    try {
      return await deliveryZoneRepository.create(organizationId, input);
    } catch (error) {
      remapDeliveryZoneWriteError(error);
    }

    throw new ValidationError('Unable to create delivery zone');
  },

  updateZone: async (
    actor: Actor,
    id: string,
    input: UpdateDeliveryZoneInput,
  ): Promise<DeliveryZone> => {
    const organizationId = requireOrganizationId(actor);
    let zone: DeliveryZone | null = null;
    try {
      zone = await deliveryZoneRepository.update(id, organizationId, input);
    } catch (error) {
      remapDeliveryZoneWriteError(error);
    }

    if (!zone) {
      throw new NotFoundError('Delivery zone not found');
    }

    return zone;
  },

  deleteZone: async (actor: Actor, id: string): Promise<void> => {
    const organizationId = requireOrganizationId(actor);
    const zone = await deliveryZoneRepository.findById(id, organizationId);
    if (!zone) {
      throw new NotFoundError('Delivery zone not found');
    }

    const hasOrders = await deliveryZoneRepository.hasOrders(id, organizationId);
    if (hasOrders) {
      throw new ConflictError('Delivery zone cannot be deactivated because it has associated orders');
    }

    await deliveryZoneRepository.update(id, organizationId, { isActive: false });
  },
};
