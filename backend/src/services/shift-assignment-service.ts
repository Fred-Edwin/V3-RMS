import { UserRole } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { Request } from 'express';
import { shiftAssignmentRepository } from '../repositories/shift-assignment-repository';
import { shiftRepository } from '../repositories/shift-repository';
import { staffRepository } from '../repositories/staff-repository';
import { getTodayDateOnly, parseDateOnly, toIsoDateOnly } from '../utils/date-only';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import type { BatchCreateShiftAssignmentInput, CreateShiftAssignmentInput, ShiftAssignmentQueryInput } from '../validators/shift-schemas';

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

    const existingAssignments = await shiftAssignmentRepository.findByUserAndDateRange(
      input.userId,
      actor.organizationId,
      assignmentDate,
      assignmentDate,
    );
    for (const existing of existingAssignments) {
      if (shift.startTime < existing.shift.endTime && shift.endTime > existing.shift.startTime) {
        throw new ConflictError(
          `Shift "${shift.name}" (${shift.startTime}–${shift.endTime}) overlaps with "${existing.shift.name}" (${existing.shift.startTime}–${existing.shift.endTime})`,
        );
      }
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

  batchCreateAssignments: async (
    actor: Actor,
    input: BatchCreateShiftAssignmentInput,
  ): Promise<{ created: number; skipped: number; errors: { userId: string; date: string; reason: string }[] }> => {
    if (!actor.organizationId) {
      throw new ForbiddenError('Branch context missing for this user');
    }

    const today = getTodayDateOnly();

    const shift = await shiftRepository.findById(input.shiftId, actor.organizationId);
    if (!shift) {
      throw new ValidationError('shiftId is invalid for this branch');
    }

    // Validate all userIds belong to active assignable staff in this branch
    const staffList = await Promise.all(
      input.userIds.map((uid) => staffRepository.findById(uid, actor.organizationId!, assignableRoles)),
    );
    for (let i = 0; i < input.userIds.length; i++) {
      const member = staffList[i];
      if (!member || !member.isActive) {
        throw new ValidationError(`userId ${input.userIds[i]} is not an active staff member in this branch`);
      }
    }

    // Reject any past dates eagerly — the whole batch fails fast
    for (const dateStr of input.dates) {
      const d = parseDateOnly(dateStr);
      if (d < today) {
        throw new ValidationError(`Cannot create shift assignments for past date: ${dateStr}`);
      }
    }

    let created = 0;
    let skipped = 0;
    const errors: { userId: string; date: string; reason: string }[] = [];

    for (const userId of input.userIds) {
      for (const dateStr of input.dates) {
        const assignmentDate = parseDateOnly(dateStr);

        // Check for time-range overlap with existing assignments for this user on this date
        const existingAssignments = await shiftAssignmentRepository.findByUserAndDateRange(
          userId,
          actor.organizationId,
          assignmentDate,
          assignmentDate,
        );

        const hasOverlap = existingAssignments.some(
          (existing) =>
            shift.startTime < existing.shift.endTime && shift.endTime > existing.shift.startTime,
        );

        if (hasOverlap) {
          skipped++;
          errors.push({
            userId,
            date: dateStr,
            reason: `Shift "${shift.name}" overlaps with an existing assignment`,
          });
          continue;
        }

        try {
          await shiftAssignmentRepository.create(actor.organizationId, {
            userId,
            shiftId: input.shiftId,
            date: assignmentDate,
          });
          created++;
        } catch (error) {
          if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
            skipped++;
            errors.push({ userId, date: dateStr, reason: 'Already assigned to this shift on this date' });
          } else {
            throw error;
          }
        }
      }
    }

    return { created, skipped, errors };
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
