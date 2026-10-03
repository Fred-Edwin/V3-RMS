import type { Request } from 'express';
import type { Location } from '@prisma/client';
import { locationRepository } from '../repositories/location-repository';
import { branchRepository } from '../repositories/branch-repository';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';

type Actor = NonNullable<Request['user']>;

const requireSite = (actor: Actor): string => {
  if (!actor.siteId) {
    throw new ValidationError('Branch context missing for this user');
  }
  return actor.siteId;
};

export const locationService = {
  list: async (actor: Actor): Promise<Location[]> => {
    const siteId = requireSite(actor);
    return locationRepository.findAllBySite(siteId);
  },

  getById: async (actor: Actor, id: string): Promise<Location> => {
    const siteId = requireSite(actor);
    const location = await locationRepository.findById(id, siteId);
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
