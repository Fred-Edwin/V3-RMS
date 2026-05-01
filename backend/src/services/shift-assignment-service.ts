import { UserRole } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { Request } from 'express';
import { shiftAssignmentRepository } from '../repositories/shift-assignment-repository';
import { shiftRepository } from '../repositories/shift-repository';
import { staffRepository } from '../repositories/staff-repository';
import { getTodayDateOnly, parseDateOnly, toIsoDateOnly } from '../utils/date-only';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import type { BatchCreateShiftAssignmentInput, BatchDeleteShiftAssignmentInput, CopyMonthInput, CreateShiftAssignmentInput, ShiftAssignmentQueryInput } from '../validators/shift-schemas';

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

  copyMonth: async (
    actor: Actor,
    input: CopyMonthInput,
  ): Promise<{ created: number; skipped: number }> => {
    if (!actor.organizationId) {
      throw new ForbiddenError('Branch context missing for this user');
    }

    const srcParts = input.sourceMonth.split('-');
    const tgtParts = input.targetMonth.split('-');
    const srcYear = parseInt(srcParts[0]!, 10);
    const srcMonth = parseInt(srcParts[1]!, 10);
    const tgtYear = parseInt(tgtParts[0]!, 10);
    const tgtMonth = parseInt(tgtParts[1]!, 10);

    const sourceAssignments = await shiftAssignmentRepository.findByOrganizationAndMonth(
      actor.organizationId,
      srcYear,
      srcMonth,
    );

    if (sourceAssignments.length === 0) {
      return { created: 0, skipped: 0 };
    }

    // Verify all referenced shifts still exist (they should, but guard defensively)
    const shiftIds = [...new Set(sourceAssignments.map((a) => a.shiftId))];
    const shifts = await Promise.all(
      shiftIds.map((id) => shiftRepository.findById(id, actor.organizationId!)),
    );
    const activeShiftIds = new Set(
      shifts.filter((s) => s !== null && s.isActive).map((s) => s!.id),
    );

    // Map each source assignment to the same day-of-week in the target month
    const targetMonthLastDay = new Date(tgtYear, tgtMonth, 0).getDate();
    let created = 0;
    let skipped = 0;

    for (const src of sourceAssignments) {
      if (!activeShiftIds.has(src.shiftId)) {
        skipped++;
        continue;
      }

      // Find the same day-of-week in the target month
      const srcDate = new Date(src.date);
      const srcDow = srcDate.getUTCDay();
      const srcDayOfMonth = srcDate.getUTCDate();

      // Walk forward from the same-numbered day in the target month to find the same DOW
      // Strategy: map the same calendar position — same week-of-month, same day-of-week.
      // If that date falls outside the target month (e.g. Feb shorter), skip it.
      const srcMonthLastDay = new Date(srcYear, srcMonth, 0).getDate();
      const weekOfMonth = Math.floor((srcDayOfMonth - 1) / 7);
      const firstDowInTarget = new Date(tgtYear, tgtMonth - 1, 1).getDay();
      let dayOfMonth = 1 + weekOfMonth * 7 + ((srcDow - firstDowInTarget + 7) % 7);
      if (dayOfMonth > targetMonthLastDay) {
        // Same week-of-month doesn't exist in target (e.g. 5th Friday) — skip
        skipped++;
        continue;
      }

      // Suppress unused variable warning for srcMonthLastDay — it documents intent above
      void srcMonthLastDay;

      const targetDate = new Date(Date.UTC(tgtYear, tgtMonth - 1, dayOfMonth));

      try {
        await shiftAssignmentRepository.create(actor.organizationId, {
          userId: src.userId,
          shiftId: src.shiftId,
          date: targetDate,
        });
        created++;
      } catch (error) {
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
          skipped++;
        } else {
          throw error;
        }
      }
    }

    return { created, skipped };
  },

  batchDeleteAssignments: async (
    actor: Actor,
    input: BatchDeleteShiftAssignmentInput,
  ): Promise<{ deleted: number }> => {
    if (!actor.organizationId) {
      throw new ForbiddenError('Branch context missing for this user');
    }

    const deleted = await shiftAssignmentRepository.deleteByIds(input.ids, actor.organizationId);
    return { deleted };
  },

  deleteAssignment: async (actor: Actor, id: string): Promise<void> => {
    if (!actor.organizationId) {
      throw new ForbiddenError('Branch context missing for this user');
    }

    const assignment = await shiftAssignmentRepository.findById(id, actor.organizationId);
    if (!assignment) {
      throw new NotFoundError('Shift assignment not found');
    }

    await shiftAssignmentRepository.delete(id, actor.organizationId);
  },
};
