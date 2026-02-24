import type { Request } from 'express';
import { shiftRepository } from '../repositories/shift-repository';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import type { CreateShiftInput, ShiftListQueryInput, UpdateShiftInput } from '../validators/shift-schemas';

type Actor = NonNullable<Request['user']>;

const isStartBeforeEnd = (startTime: string, endTime: string): boolean => startTime < endTime;

const requireActorOrganizationId = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ForbiddenError('Branch context missing for this user');
  }

  return actor.organizationId;
};

const resolveReadOrganizationId = (actor: Actor, query: ShiftListQueryInput): string => {
  if (actor.role === 'DIRECTOR') {
    if (!query.organizationId) {
      throw new ValidationError('organizationId query param is required for directors');
    }
    return query.organizationId;
  }

  return requireActorOrganizationId(actor);
};

export const shiftService = {
  listShifts: async (actor: Actor, query: ShiftListQueryInput) => {
    const organizationId = resolveReadOrganizationId(actor, query);
    return shiftRepository.findAllByOrganization(organizationId);
  },

  createShift: async (actor: Actor, input: CreateShiftInput) => {
    const organizationId = requireActorOrganizationId(actor);

    if (!isStartBeforeEnd(input.startTime, input.endTime)) {
      throw new ValidationError('startTime must be earlier than endTime');
    }

    return shiftRepository.create(organizationId, input);
  },

  updateShift: async (actor: Actor, id: string, input: UpdateShiftInput) => {
    const organizationId = requireActorOrganizationId(actor);
    const existing = await shiftRepository.findById(id, organizationId);
    if (!existing) {
      throw new NotFoundError('Shift not found');
    }

    const startTime = input.startTime ?? existing.startTime;
    const endTime = input.endTime ?? existing.endTime;
    if (!isStartBeforeEnd(startTime, endTime)) {
      throw new ValidationError('startTime must be earlier than endTime');
    }

    const updated = await shiftRepository.update(id, organizationId, input);
    if (!updated) {
      throw new NotFoundError('Shift not found');
    }

    return updated;
  },

  deleteShift: async (actor: Actor, id: string): Promise<void> => {
    const organizationId = requireActorOrganizationId(actor);
    const existing = await shiftRepository.findById(id, organizationId);
    if (!existing) {
      throw new NotFoundError('Shift not found');
    }

    const hasFutureAssignments = await shiftRepository.hasFutureAssignments(id, organizationId);
    if (hasFutureAssignments) {
      throw new ConflictError('Cannot delete shift with future assignments');
    }

    await shiftRepository.softDelete(id, organizationId);
  },
};
