import type { Request } from 'express';
import type { Location } from '@prisma/client';
import { locationRepository } from '../repositories/location-repository';
import { branchRepository } from '../repositories/branch-repository';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';

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

  // The Central Store is never created under "whichever org the actor happens
  // to be on": the target organization is always resolved to the hub org
  // (design doc D-15), so store data can never end up tied to a branch.
  createCentralStore: async (name: string): Promise<Location> => {
    const hubOrg = await branchRepository.findHub();
    if (!hubOrg) {
      throw new ValidationError(
        'No hub organization is set. Create the Central Store organization and flag it as hub first.',
      );
    }

    const existing = await locationRepository.findCentralStore();
    if (existing) {
      throw new ConflictError('A Central Store location already exists');
    }

    return locationRepository.createCentralStore(hubOrg.id, name);
  },
};
