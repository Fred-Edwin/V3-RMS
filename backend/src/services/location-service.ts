import type { Request } from 'express';
import type { Location } from '@prisma/client';
import { locationRepository } from '../repositories/location-repository';
import { NotFoundError, ValidationError } from '../utils/errors';

type Actor = NonNullable<Request['user']>;

const requireOrganization = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ValidationError('Branch context missing for this user');
  }
  return actor.organizationId;
};

export const locationService = {
  list: async (actor: Actor): Promise<Location[]> => {
    const organizationId = requireOrganization(actor);
    return locationRepository.findAllByOrganization(organizationId);
  },

  getById: async (actor: Actor, id: string): Promise<Location> => {
    const organizationId = requireOrganization(actor);
    const location = await locationRepository.findById(id, organizationId);
    if (!location) {
      throw new NotFoundError('Location not found');
    }
    return location;
  },
};
