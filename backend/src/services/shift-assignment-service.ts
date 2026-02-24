import { UserRole } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { Request } from 'express';
import { shiftAssignmentRepository } from '../repositories/shift-assignment-repository';
import { shiftRepository } from '../repositories/shift-repository';
import { staffRepository } from '../repositories/staff-repository';
import { getTodayDateOnly, parseDateOnly, toIsoDateOnly } from '../utils/date-only';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import type { CreateShiftAssignmentInput, ShiftAssignmentQueryInput } from '../validators/shift-schemas';

type Actor = NonNullable<Request['user']>;

const assignableRoles: UserRole[] = [UserRole.WAITER, UserRole.CHEF, UserRole.BARISTA];

const resolveReadOrganizationId = (actor: Actor, query: ShiftAssignmentQueryInput): string => {
  if (actor.role === 'DIRECTOR') {
    if (!query.organizationId) {
      throw new ValidationError('organizationId query param is required for directors');
    }
    return query.organizationId;
  }

  if (!actor.organizationId) {
    throw new ForbiddenError('Branch context missing for this user');
  }

  return actor.organizationId;
};

export const shiftAssignmentService = {
  listAssignments: async (actor: Actor, query: ShiftAssignmentQueryInput) => {
    const startDate = parseDateOnly(query.startDate);
    const endDate = parseDateOnly(query.endDate);

    if (startDate > endDate) {
      throw new ValidationError('startDate must be earlier than or equal to endDate');
    }

    const organizationId = resolveReadOrganizationId(actor, query);

    if (actor.role === 'WAITER' || actor.role === 'CHEF' || actor.role === 'BARISTA') {
      const assignments = await shiftAssignmentRepository.findByUserAndDateRange(
        actor.id,
        organizationId,
        startDate,
        endDate,
        {
          shiftId: query.shiftId,
        },
      );

      return assignments.map((assignment) => ({
        ...assignment,
        date: toIsoDateOnly(assignment.date),
      }));
    }

    const assignments = await shiftAssignmentRepository.findByOrganizationAndDateRange(
      organizationId,
      startDate,
      endDate,
      {
        userId: query.userId,
        shiftId: query.shiftId,
      },
    );

    return assignments.map((assignment) => ({
      ...assignment,
      date: toIsoDateOnly(assignment.date),
    }));
  },

  createAssignment: async (actor: Actor, input: CreateShiftAssignmentInput) => {
    if (!actor.organizationId) {
      throw new ForbiddenError('Branch context missing for this user');
    }

    const assignmentDate = parseDateOnly(input.date);
    const today = getTodayDateOnly();
    if (assignmentDate < today) {
      throw new ValidationError('Cannot create shift assignments for past dates');
    }

    const staff = await staffRepository.findById(input.userId, actor.organizationId, assignableRoles);
    if (!staff || !staff.isActive) {
      throw new ValidationError('userId must belong to an active staff member in this branch');
    }

    const shift = await shiftRepository.findById(input.shiftId, actor.organizationId);
    if (!shift) {
      throw new ValidationError('shiftId is invalid for this branch');
    }

    try {
      const created = await shiftAssignmentRepository.create(actor.organizationId, {
        userId: input.userId,
        shiftId: input.shiftId,
        date: assignmentDate,
      });

      return {
        ...created,
        date: toIsoDateOnly(created.date),
      };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Staff member already assigned to this shift on this date');
      }
      throw error;
    }
  },

  deleteAssignment: async (actor: Actor, id: string): Promise<void> => {
    if (!actor.organizationId) {
      throw new ForbiddenError('Branch context missing for this user');
    }

    const assignment = await shiftAssignmentRepository.findById(id, actor.organizationId);
    if (!assignment) {
      throw new NotFoundError('Shift assignment not found');
    }

    const today = toIsoDateOnly(getTodayDateOnly());
    if (toIsoDateOnly(assignment.date) <= today) {
      throw new ValidationError('Cannot delete past or current shift assignments');
    }

    await shiftAssignmentRepository.delete(id, actor.organizationId);
  },
};
