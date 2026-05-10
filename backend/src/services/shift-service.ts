import type { Request } from 'express';
import { shiftRepository } from '../repositories/shift-repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import type { CreateShiftInput, ShiftListQueryInput, UpdateShiftInput } from '../validators/shift-schemas';

type Actor = NonNullable<Request['user']>;

const isStartBeforeEnd = (startTime: string, endTime: string): boolean => startTime < endTime;

const requireActorOrganizationId = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ForbiddenError('Branch context missing for this user');
  }

  return actor.organizationId;
};

const requiresExplicitOrganizationId = (actor: Actor): boolean => actor.role === 'DIRECTOR' || actor.role === 'HR_MANAGER';

const resolveReadOrganizationId = (actor: Actor, query: ShiftListQueryInput): string => {
  if (requiresExplicitOrganizationId(actor)) {
    if (!query.organizationId) {
      throw new ValidationError('organizationId query param is required for organization-level shift access');
    }
    return query.organizationId;
  }

  return requireActorOrganizationId(actor);
};

const resolveWriteOrganizationId = (actor: Actor, organizationId?: string): string => {
  if (requiresExplicitOrganizationId(actor)) {
    if (!organizationId) {
      throw new ValidationError('organizationId is required for organization-level shift access');
    }
    return organizationId;
  }

  const actorOrganizationId = requireActorOrganizationId(actor);
  if (organizationId && organizationId !== actorOrganizationId) {
    throw new ForbiddenError('Cannot manage shifts outside your branch');
  }

  return actorOrganizationId;
};

export const shiftService = {
  listShifts: async (actor: Actor, query: ShiftListQueryInput) => {
    const organizationId = resolveReadOrganizationId(actor, query);
    return shiftRepository.findAllByOrganization(organizationId);
  },

  createShift: async (actor: Actor, input: CreateShiftInput) => {
    const { organizationId: requestedOrganizationId, ...shiftInput } = input;
    const organizationId = resolveWriteOrganizationId(actor, requestedOrganizationId);

    if (!isStartBeforeEnd(shiftInput.startTime, shiftInput.endTime)) {
      throw new ValidationError('startTime must be earlier than endTime');
    }

    return shiftRepository.create(organizationId, shiftInput);
  },

  updateShift: async (actor: Actor, id: string, input: UpdateShiftInput) => {
    const { organizationId: requestedOrganizationId, ...shiftInput } = input;
    const organizationId = resolveWriteOrganizationId(actor, requestedOrganizationId);
    const existing = await shiftRepository.findById(id, organizationId);
    if (!existing) {
      throw new NotFoundError('Shift not found');
    }

    const startTime = shiftInput.startTime ?? existing.startTime;
    const endTime = shiftInput.endTime ?? existing.endTime;
    if (!isStartBeforeEnd(startTime, endTime)) {
      throw new ValidationError('startTime must be earlier than endTime');
    }

    const updated = await shiftRepository.update(id, organizationId, shiftInput);
    if (!updated) {
      throw new NotFoundError('Shift not found');
    }

    return updated;
  },

  deleteShift: async (actor: Actor, id: string, query: ShiftListQueryInput = {}): Promise<void> => {
    const organizationId = resolveWriteOrganizationId(actor, query.organizationId);
    const existing = await shiftRepository.findById(id, organizationId);
    if (!existing) {
      throw new NotFoundError('Shift not found');
    }

    await shiftRepository.softDelete(id, organizationId);
  },
};
