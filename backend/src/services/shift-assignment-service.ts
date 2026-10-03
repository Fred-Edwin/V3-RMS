import { UserRole, type DepartmentTag, type Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { mapPrismaError } from '../utils/prisma-errors';
import type { Request } from 'express';
import { prisma } from '../config/database';
import { shiftAssignmentRepository, type ShiftAssignmentWithRelations } from '../repositories/shift-assignment-repository';
import { shiftRepository } from '../repositories/shift-repository';
import { staffRepository } from '../repositories/staff-repository';
import { getTodayDateOnly, parseDateOnly, toIsoDateOnly } from '../utils/date-only';
import { SHIFT_ASSIGNABLE_ROLES, departmentScopeFilter, staffMatchesDepartment } from '../utils/departments';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import type { BatchCreateShiftAssignmentInput, BatchDeleteShiftAssignmentInput, CopyWeekInput, CreateShiftAssignmentInput, ReconcileWeekShiftAssignmentsInput, ShiftAssignmentQueryInput, ShiftListQueryInput } from '../validators/shift-schemas';

type Actor = NonNullable<Request['user']>;
type SerializedShiftAssignment = Omit<ShiftAssignmentWithRelations, 'date'> & { date: string };

const assignableRoles: UserRole[] = [...SHIFT_ASSIGNABLE_ROLES];

// Worked roles whose `GET /shift-assignments` returns only their OWN shifts
// (self-service "my shifts" view). A department head is deliberately excluded
// even though they share one of these roles — a head needs the full department
// roster to schedule, and their own shifts are part of it.
const selfServiceRoles: UserRole[] = [...SHIFT_ASSIGNABLE_ROLES];

const requiresExplicitSiteId = (actor: Actor): boolean => actor.role === 'DIRECTOR' || actor.role === 'HR_MANAGER';

/** True when this actor's scheduling reach is limited to a single department. */
const isDepartmentScoped = (actor: Actor): boolean => actor.isDepartmentHead === true;

/** The department a scoped actor is confined to; throws if a head has no department. */
const actorDepartmentTag = (actor: Actor): DepartmentTag => {
  if (!actor.departmentTag) {
    throw new ForbiddenError('Department head has no department assigned');
  }
  return actor.departmentTag;
};

/**
 * Prisma `where.user` fragment scoping a query to the actor's department, or
 * `undefined` for full-scope actors (MANAGER / HR_MANAGER / DIRECTOR).
 */
const actorUserScope = (actor: Actor): Prisma.UserWhereInput | undefined =>
  isDepartmentScoped(actor) ? departmentScopeFilter(actorDepartmentTag(actor)) : undefined;

/**
 * Guard a write path: every staff member touched must be inside the scoped
 * actor's department. No-op for full-scope actors.
 */
const assertStaffInScope = (
  actor: Actor,
  staff: ({ role: UserRole } | null | undefined)[],
): void => {
  if (!isDepartmentScoped(actor)) {
    return;
  }
  const tag = actorDepartmentTag(actor);
  for (const member of staff) {
    if (!member || !staffMatchesDepartment(member, tag)) {
      throw new ForbiddenError('You can only schedule staff in your own department');
    }
  }
};

const resolveReadSiteId = (actor: Actor, query: ShiftAssignmentQueryInput): string => {
  if (requiresExplicitSiteId(actor)) {
    if (!query.siteId) {
      throw new ValidationError('organizationId query param is required for organization-level shift access');
    }
    return query.siteId;
  }

  if (!actor.siteId) {
    throw new ForbiddenError('Branch context missing for this user');
  }

  return actor.siteId;
};

const resolveWriteSiteId = (actor: Actor, siteId?: string): string => {
  if (requiresExplicitSiteId(actor)) {
    if (!siteId) {
      throw new ValidationError('organizationId is required for organization-level shift access');
    }
    return siteId;
  }

  if (!actor.siteId) {
    throw new ForbiddenError('Branch context missing for this user');
  }

  if (siteId && siteId !== actor.siteId) {
    throw new ForbiddenError('Cannot manage shift assignments outside your branch');
  }

  return actor.siteId;
};

const isOverlapping = (
  candidate: { startTime: string; endTime: string },
  existing: { shift: { startTime: string; endTime: string } },
): boolean => candidate.startTime < existing.shift.endTime && candidate.endTime > existing.shift.startTime;

export const shiftAssignmentService = {
  listAssignments: async (actor: Actor, query: ShiftAssignmentQueryInput): Promise<SerializedShiftAssignment[]> => {
    const startDate = parseDateOnly(query.startDate);
    const endDate = parseDateOnly(query.endDate);

    if (startDate > endDate) {
      throw new ValidationError('startDate must be earlier than or equal to endDate');
    }

    const siteId = resolveReadSiteId(actor, query);

    // A worked-role staffer (but NOT a department head) only ever sees their
    // own shifts.
    if (!isDepartmentScoped(actor) && selfServiceRoles.map(String).includes(actor.role)) {
      const assignments = await shiftAssignmentRepository.findByUserAndDateRange(
        actor.id,
        siteId,
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

    const assignments = await shiftAssignmentRepository.findBySiteAndDateRange(
      siteId,
      startDate,
      endDate,
      {
        userId: query.userId,
        shiftId: query.shiftId,
        // A department head sees only its own department's roster; full scope otherwise.
        userWhere: actorUserScope(actor),
      },
    );

    return assignments.map((assignment) => ({
      ...assignment,
      date: toIsoDateOnly(assignment.date),
    }));
  },

  createAssignment: async (actor: Actor, input: CreateShiftAssignmentInput) => {
    const siteId = resolveWriteSiteId(actor, input.siteId);

    const assignmentDate = parseDateOnly(input.date);
    const today = getTodayDateOnly();
    if (assignmentDate < today) {
      throw new ValidationError('Cannot create shift assignments for past dates');
    }

    const staff = await staffRepository.findById(input.userId, siteId, assignableRoles);
    if (!staff || !staff.isActive) {
      throw new ValidationError('userId must belong to an active staff member in this branch');
    }
    assertStaffInScope(actor, [staff]);

    const shift = await shiftRepository.findById(input.shiftId, siteId);
    if (!shift) {
      throw new ValidationError('shiftId is invalid for this branch');
    }

    const existingAssignments = await shiftAssignmentRepository.findByUserAndDateRange(
      input.userId,
      siteId,
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
      const created = await shiftAssignmentRepository.create(siteId, {
        userId: input.userId,
        shiftId: input.shiftId,
        date: assignmentDate,
      });

      return {
        ...created,
        date: toIsoDateOnly(created.date),
      };
    } catch (error) {
      return mapPrismaError(error, { conflict: 'Staff member already assigned to this shift on this date' });
    }
  },

  batchCreateAssignments: async (
    actor: Actor,
    input: BatchCreateShiftAssignmentInput,
  ): Promise<{ created: number; skipped: number; errors: { userId: string; date: string; reason: string }[] }> => {
    const siteId = resolveWriteSiteId(actor, input.siteId);

    const today = getTodayDateOnly();

    const shift = await shiftRepository.findById(input.shiftId, siteId);
    if (!shift) {
      throw new ValidationError('shiftId is invalid for this branch');
    }

    // Validate all userIds belong to active assignable staff in this branch
    const staffList = await Promise.all(
      input.userIds.map((uid) => staffRepository.findById(uid, siteId, assignableRoles)),
    );
    for (let i = 0; i < input.userIds.length; i++) {
      const member = staffList[i];
      if (!member || !member.isActive) {
        throw new ValidationError(`userId ${input.userIds[i]} is not an active staff member in this branch`);
      }
    }
    assertStaffInScope(actor, staffList);

    // Reject any past dates eagerly — the whole batch fails fast
    for (const dateStr of input.dates) {
      const d = parseDateOnly(dateStr);
      if (d < today) {
        throw new ValidationError(`Cannot create shift assignments for past date: ${dateStr}`);
      }
    }

    let skipped = 0;
    const errors: { userId: string; date: string; reason: string }[] = [];
    const toCreate: Array<{ userId: string; date: Date; dateStr: string }> = [];

    // Pre-validate all combinations before writing — fail fast, no partial state
    for (const userId of input.userIds) {
      for (const dateStr of input.dates) {
        const assignmentDate = parseDateOnly(dateStr);

        const existingAssignments = await shiftAssignmentRepository.findByUserAndDateRange(
          userId,
          siteId,
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
        } else {
          toCreate.push({ userId, date: assignmentDate, dateStr });
        }
      }
    }

    // Create all valid assignments atomically — all succeed or all roll back
    if (toCreate.length > 0) {
      try {
        await prisma.$transaction(
          toCreate.map(({ userId, date }) =>
            prisma.shiftAssignment.create({
              data: {
                siteId,
                userId,
                shiftId: input.shiftId,
                date,
              },
            }),
          ),
        );
      } catch (error) {
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
          // Duplicate detected inside transaction — report all as skipped
          for (const { userId, dateStr } of toCreate) {
            skipped++;
            errors.push({ userId, date: dateStr, reason: 'Already assigned to this shift on this date' });
          }
          return { created: 0, skipped, errors };
        }
        throw error;
      }
    }

    return { created: toCreate.length, skipped, errors };
  },

  copyWeek: async (
    actor: Actor,
    input: CopyWeekInput,
  ): Promise<{ created: number; skipped: number }> => {
    const siteId = resolveWriteSiteId(actor, input.siteId);

    const sourceWeekStart = parseDateOnly(input.sourceWeekStart);
    const targetWeekStart = parseDateOnly(input.targetWeekStart);

    // Offset in milliseconds between the two week starts
    const offsetMs = targetWeekStart.getTime() - sourceWeekStart.getTime();

    const sourceAssignments = await shiftAssignmentRepository.findBySiteAndWeek(
      siteId,
      sourceWeekStart,
      // A department head copies only its own department's rows forward.
      { userWhere: actorUserScope(actor) },
    );

    if (sourceAssignments.length === 0) {
      return { created: 0, skipped: 0 };
    }

    // Guard: skip assignments for inactive shifts
    const shiftIds = [...new Set(sourceAssignments.map((a) => a.shiftId))];
    const shifts = await Promise.all(
      shiftIds.map((id) => shiftRepository.findById(id, siteId)),
    );
    const activeShiftIds = new Set(
      shifts.filter((s) => s !== null && s.isActive).map((s) => s!.id),
    );

    let created = 0;
    let skipped = 0;

    for (const src of sourceAssignments) {
      if (!activeShiftIds.has(src.shiftId)) {
        skipped++;
        continue;
      }

      // Shift the date by the exact offset — preserves day-of-week perfectly
      const targetDate = new Date(src.date.getTime() + offsetMs);

      try {
        await shiftAssignmentRepository.create(siteId, {
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
    const siteId = resolveWriteSiteId(actor, input.siteId);

    // A department head may only delete rows for its own department — verify
    // every target assignment's staff member is in scope before deleting anything.
    if (isDepartmentScoped(actor)) {
      const targets = await Promise.all(
        input.ids.map((id) => shiftAssignmentRepository.findById(id, siteId)),
      );
      assertStaffInScope(
        actor,
        targets.filter((t): t is NonNullable<typeof t> => t !== null).map((t) => t.user),
      );
    }

    const deleted = await shiftAssignmentRepository.deleteByIds(input.ids, siteId);
    return { deleted };
  },

  reconcileWeek: async (
    actor: Actor,
    input: ReconcileWeekShiftAssignmentsInput,
  ): Promise<{
    saved: number;
    skipped: number;
    errors: { userId: string; date: string; reason: string }[];
    assignments: SerializedShiftAssignment[];
  }> => {
    const siteId = resolveWriteSiteId(actor, input.siteId);

    const weekStart = parseDateOnly(input.weekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    const today = getTodayDateOnly();
    const errors: { userId: string; date: string; reason: string }[] = [];
    const operations: Array<{ userId: string; date: Date; shiftId: string | null; deleteIds: string[] }> = [];

    const uniqueChanges = new Map<string, ReconcileWeekShiftAssignmentsInput['changes'][number]>();
    for (const change of input.changes) {
      uniqueChanges.set(`${change.userId}|${change.date}`, change);
    }

    for (const change of uniqueChanges.values()) {
      const assignmentDate = parseDateOnly(change.date);

      if (assignmentDate < today) {
        errors.push({ userId: change.userId, date: change.date, reason: 'Cannot edit past shift assignments' });
        continue;
      }

      if (assignmentDate < weekStart || assignmentDate > weekEnd) {
        errors.push({ userId: change.userId, date: change.date, reason: 'Date is outside the selected week' });
        continue;
      }

      const staff = await staffRepository.findById(change.userId, siteId, assignableRoles);
      if (!staff || !staff.isActive) {
        errors.push({ userId: change.userId, date: change.date, reason: 'Staff member is not active in this branch' });
        continue;
      }
      if (isDepartmentScoped(actor) && !staffMatchesDepartment(staff, actorDepartmentTag(actor))) {
        errors.push({ userId: change.userId, date: change.date, reason: 'Staff member is not in your department' });
        continue;
      }

      const existingAssignments = await shiftAssignmentRepository.findByUserAndDateRange(
        change.userId,
        siteId,
        assignmentDate,
        assignmentDate,
      );

      if (existingAssignments.some((assignment) => assignment.clockRecord !== null)) {
        errors.push({ userId: change.userId, date: change.date, reason: 'Cannot change a shift that already has attendance records' });
        continue;
      }

      if (change.shiftId === null) {
        operations.push({
          userId: change.userId,
          date: assignmentDate,
          shiftId: null,
          deleteIds: existingAssignments.map((assignment) => assignment.id),
        });
        continue;
      }

      const shift = await shiftRepository.findById(change.shiftId, siteId);
      if (!shift) {
        errors.push({ userId: change.userId, date: change.date, reason: 'Shift is not active in this branch' });
        continue;
      }

      const sameShiftOnly = existingAssignments.length === 1 && existingAssignments[0]?.shiftId === change.shiftId;
      if (sameShiftOnly) {
        continue;
      }

      const retainedAssignments = existingAssignments.filter((assignment) => assignment.shiftId === change.shiftId);
      const hasOverlap = retainedAssignments.some((assignment) => isOverlapping(shift, assignment));
      if (hasOverlap) {
        errors.push({ userId: change.userId, date: change.date, reason: `Shift "${shift.name}" overlaps with an existing assignment` });
        continue;
      }

      operations.push({
        userId: change.userId,
        date: assignmentDate,
        shiftId: change.shiftId,
        deleteIds: existingAssignments.map((assignment) => assignment.id),
      });
    }

    if (operations.length > 0) {
      await shiftAssignmentRepository.reconcileWeek(siteId, operations);
    }

    const assignments = await shiftAssignmentService.listAssignments(actor, {
      siteId,
      startDate: toIsoDateOnly(weekStart),
      endDate: toIsoDateOnly(weekEnd),
    });

    return {
      saved: operations.length,
      skipped: errors.length,
      errors,
      assignments,
    };
  },

  deleteAssignment: async (actor: Actor, id: string, query: ShiftListQueryInput = {}): Promise<void> => {
    const siteId = resolveWriteSiteId(actor, query.siteId);

    const assignment = await shiftAssignmentRepository.findById(id, siteId);
    if (!assignment) {
      throw new NotFoundError('Shift assignment not found');
    }
    assertStaffInScope(actor, [assignment.user]);

    await shiftAssignmentRepository.delete(id, siteId);
  },
};
