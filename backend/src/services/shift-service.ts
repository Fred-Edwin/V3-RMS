import type { Request } from 'express';
import { shiftRepository } from '../repositories/shift-repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import type { CreateShiftInput, ShiftListQueryInput, UpdateShiftInput } from '../validators/shift-schemas';

type Actor = NonNullable<Request['user']>;

const isStartBeforeEnd = (startTime: string, endTime: string): boolean => startTime < endTime;

const requireActorSiteId = (actor: Actor): string => {
  if (!actor.siteId) {
    throw new ForbiddenError('Branch context missing for this user');
  }

  return actor.siteId;
};

const requiresExplicitSiteId = (actor: Actor): boolean => actor.role === 'DIRECTOR' || actor.role === 'HR_MANAGER';

const resolveReadSiteId = (actor: Actor, query: ShiftListQueryInput): string => {
  if (requiresExplicitSiteId(actor)) {
    if (!query.siteId) {
      throw new ValidationError('organizationId query param is required for organization-level shift access');
    }
    return query.siteId;
  }

  return requireActorSiteId(actor);
};

const resolveWriteSiteId = (actor: Actor, siteId?: string): string => {
  if (requiresExplicitSiteId(actor)) {
    if (!siteId) {
      throw new ValidationError('organizationId is required for organization-level shift access');
    }
    return siteId;
  }

  const actorSiteId = requireActorSiteId(actor);
  if (siteId && siteId !== actorSiteId) {
    throw new ForbiddenError('Cannot manage shifts outside your branch');
  }

  return actorSiteId;
};

export const shiftService = {
  listShifts: async (actor: Actor, query: ShiftListQueryInput) => {
    const siteId = resolveReadSiteId(actor, query);
    return shiftRepository.findAllBySite(siteId);
  },

  createShift: async (actor: Actor, input: CreateShiftInput) => {
    const { siteId: requestedSiteId, ...shiftInput } = input;
    const siteId = resolveWriteSiteId(actor, requestedSiteId);

    if (!isStartBeforeEnd(shiftInput.startTime, shiftInput.endTime)) {
      throw new ValidationError('startTime must be earlier than endTime');
    }

    return shiftRepository.create(siteId, shiftInput);
  },

  updateShift: async (actor: Actor, id: string, input: UpdateShiftInput) => {
    const { siteId: requestedSiteId, ...shiftInput } = input;
    const siteId = resolveWriteSiteId(actor, requestedSiteId);
    const existing = await shiftRepository.findById(id, siteId);
    if (!existing) {
      throw new NotFoundError('Shift not found');
    }

    const startTime = shiftInput.startTime ?? existing.startTime;
    const endTime = shiftInput.endTime ?? existing.endTime;
    if (!isStartBeforeEnd(startTime, endTime)) {
      throw new ValidationError('startTime must be earlier than endTime');
    }

    const updated = await shiftRepository.update(id, siteId, shiftInput);
    if (!updated) {
      throw new NotFoundError('Shift not found');
    }

    return updated;
  },

  deleteShift: async (actor: Actor, id: string, query: ShiftListQueryInput = {}): Promise<void> => {
    const siteId = resolveWriteSiteId(actor, query.siteId);
    const existing = await shiftRepository.findById(id, siteId);
    if (!existing) {
      throw new NotFoundError('Shift not found');
    }

    await shiftRepository.softDelete(id, siteId);
  },
};
