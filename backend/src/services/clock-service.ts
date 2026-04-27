import { ClockMethod, type ClockRecord } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { Request } from 'express';
import { env } from '../config/env';
import { branchRepository } from '../repositories/branch-repository';
import { clockRecordRepository } from '../repositories/clock-record-repository';
import { orderRepository } from '../repositories/order-repository';
import { shiftAssignmentRepository } from '../repositories/shift-assignment-repository';
import { getTodayDateOnly, toIsoDateOnly } from '../utils/date-only';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { haversineDistanceMetres } from '../utils/haversine';
import { logger } from '../utils/logger';
import type { ClockInOutInput, ClockOverrideInput, UndoClockOutInput } from '../validators/shift-schemas';

type Actor = NonNullable<Request['user']>;
type ClockActionName = 'clock in' | 'clock out';

const CLOCK_GEOFENCE_RADIUS_METRES = env.CLOCK_GEOFENCE_RADIUS_METRES;

const requireOrganizationId = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ForbiddenError('Branch context missing for this user');
  }

  return actor.organizationId;
};

const assertWithinGeofence = async (
  organizationId: string,
  latitude: number,
  longitude: number,
  action: ClockActionName,
): Promise<void> => {
  const branch = await branchRepository.findById(organizationId);
  if (!branch) {
    throw new NotFoundError('Branch not found');
  }

  const distance = haversineDistanceMetres(latitude, longitude, Number(branch.latitude), Number(branch.longitude));
  if (distance > CLOCK_GEOFENCE_RADIUS_METRES) {
    const roundedDistance = Math.round(distance);
    logger.warn(
      {
        organizationId,
        branchId: branch.id,
        action,
        distanceMetres: roundedDistance,
        allowedRadiusMetres: CLOCK_GEOFENCE_RADIUS_METRES,
      },
      'Clock geofence rejected',
    );
    throw new ForbiddenError(
      `You must be at the branch to ${action}. You are approximately ${roundedDistance} metres away.`,
      'CLOCK_OUTSIDE_GEOFENCE',
      {
        action,
        distanceMetres: roundedDistance,
        allowedRadiusMetres: CLOCK_GEOFENCE_RADIUS_METRES,
      },
    );
  }
};

const assertTodayAssignmentForActor = async (actor: Actor, shiftAssignmentId: string) => {
  const organizationId = requireOrganizationId(actor);
  const assignment = await shiftAssignmentRepository.findById(shiftAssignmentId, organizationId);
  if (
    !assignment ||
    assignment.userId !== actor.id ||
    toIsoDateOnly(assignment.date) !== toIsoDateOnly(getTodayDateOnly())
  ) {
    throw new NotFoundError('This shift is not available for clocking today.', 'CLOCK_ASSIGNMENT_INVALID');
  }

  return { assignment, organizationId };
};

const assertTodayAssignmentForOverride = async (actor: Actor, input: ClockOverrideInput) => {
  const organizationId = requireOrganizationId(actor);
  const assignment = await shiftAssignmentRepository.findById(input.shiftAssignmentId, organizationId);
  if (!assignment || assignment.userId !== input.userId) {
    throw new NotFoundError('Shift assignment not found for this staff member.', 'CLOCK_ASSIGNMENT_INVALID');
  }

  if (toIsoDateOnly(assignment.date) !== toIsoDateOnly(getTodayDateOnly())) {
    throw new ConflictError('Overrides are only allowed for today assignments.', 'CLOCK_OVERRIDE_NOT_ALLOWED');
  }

  return { assignment, organizationId };
};

const throwAlreadyClockedInConflict = (
  message: string,
  assignmentId: string,
  userId: string,
  openShiftAssignmentId?: string,
): never => {
  throw new ConflictError(message, 'CLOCK_ALREADY_IN', {
    assignmentId,
    userId,
    openShiftAssignmentId,
  });
};

const throwNotClockedInConflict = (
  message: string,
  assignmentId: string,
  userId: string,
  code: 'CLOCK_NOT_IN' | 'CLOCK_ALREADY_OUT' | 'CLOCK_STALE_STATE' = 'CLOCK_NOT_IN',
): never => {
  throw new ConflictError(message, code, {
    assignmentId,
    userId,
  });
};

const requireActiveClockRecord = (
  record: ClockRecord | null,
  assignmentId: string,
  userId: string,
  notClockedInMessage: string,
): ClockRecord => {
  if (!record) {
    throw new ConflictError(notClockedInMessage, 'CLOCK_NOT_IN', {
      assignmentId,
      userId,
    });
  }

  if (!record.clockInAt) {
    throw new ConflictError(notClockedInMessage, 'CLOCK_NOT_IN', {
      assignmentId,
      userId,
    });
  }

  if (record.clockOutAt) {
    throw new ConflictError('This shift has already been clocked out.', 'CLOCK_ALREADY_OUT', {
      assignmentId,
      userId,
    });
  }

  return record;
};

const requireUpdatedClockRecord = (record: ClockRecord | null, assignmentId: string, userId: string): ClockRecord => {
  if (!record) {
    throw new ConflictError('Attendance changed just now. Refresh and try again.', 'CLOCK_STALE_STATE', {
      assignmentId,
      userId,
    });
  }

  return record;
};

export const clockService = {
  clockIn: async (actor: Actor, input: ClockInOutInput) => {
    const { assignment, organizationId } = await assertTodayAssignmentForActor(actor, input.shiftAssignmentId);

    const existingRecord = await clockRecordRepository.findByAssignmentId(assignment.id, organizationId);
    if (existingRecord) {
      if (existingRecord.clockOutAt === null) {
        throwAlreadyClockedInConflict('You are already clocked in for this shift.', assignment.id, actor.id);
      }
      throwNotClockedInConflict(
        'This shift attendance is already complete.',
        assignment.id,
        actor.id,
        'CLOCK_ALREADY_OUT',
      );
    }

    // Auto-close any stale open records from a previous day before checking for conflicts.
    // This prevents yesterday's forgotten clock-out from permanently blocking today's clock-in.
    await clockRecordRepository.closeStaleOpenRecords(organizationId, getTodayDateOnly());

    const openRecord = await clockRecordRepository.findOpenByUserId(actor.id, organizationId);
    if (openRecord) {
      throwAlreadyClockedInConflict(
        'You already have an open clock-in for another shift.',
        assignment.id,
        actor.id,
        openRecord.shiftAssignmentId,
      );
    }

    await assertWithinGeofence(organizationId, input.latitude, input.longitude, 'clock in');

    try {
      return await clockRecordRepository.createClockIn(organizationId, {
        shiftAssignmentId: assignment.id,
        userId: actor.id,
        method: ClockMethod.GPS,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throwAlreadyClockedInConflict('You are already clocked in for this shift.', assignment.id, actor.id);
      }
      throw error;
    }
  },

  clockOut: async (actor: Actor, input: ClockInOutInput) => {
    const { assignment, organizationId } = await assertTodayAssignmentForActor(actor, input.shiftAssignmentId);

    const record = requireActiveClockRecord(
      await clockRecordRepository.findByAssignmentId(assignment.id, organizationId),
      assignment.id,
      actor.id,
      'You are not currently clocked in for this shift.',
    );

    await assertWithinGeofence(organizationId, input.latitude, input.longitude, 'clock out');

    // Block clock-out if the waiter has any open orders from today's shift.
    const today = getTodayDateOnly();
    const openOrders = await orderRepository.findUnclosedOrdersByUserForDate(organizationId, actor.id, today);
    if (openOrders.length > 0) {
      const orderNumbers = openOrders.map((o) => `#${o.dailyNumber}`).join(', ');
      throw new ConflictError(
        `You have ${openOrders.length} open order(s): ${orderNumbers}. Close or cancel them before clocking out.`,
        'CLOCK_HAS_OPEN_ORDERS',
        { openOrders },
      );
    }

    return requireUpdatedClockRecord(
      await clockRecordRepository.updateClockOut(record.id, organizationId, {
        clockOutAt: new Date(),
        clockOutMethod: ClockMethod.GPS,
      }),
      assignment.id,
      actor.id,
    );
  },

  clockOverride: async (
    actor: Actor,
    input: ClockOverrideInput,
  ): Promise<{ record: ClockRecord; message: string }> => {
    const { assignment, organizationId } = await assertTodayAssignmentForOverride(actor, input);

    if (input.action === 'CLOCK_IN') {
      const existingRecord = await clockRecordRepository.findByAssignmentId(assignment.id, organizationId);
      if (existingRecord) {
        if (existingRecord.clockOutAt === null) {
          throwAlreadyClockedInConflict('Staff member is already clocked in for this shift.', assignment.id, input.userId);
        }
        throwNotClockedInConflict(
          'This shift attendance is already complete.',
          assignment.id,
          input.userId,
          'CLOCK_ALREADY_OUT',
        );
      }

      const openRecord = await clockRecordRepository.findOpenByUserId(input.userId, organizationId);
      if (openRecord) {
        throwAlreadyClockedInConflict(
          'Staff member already has an open clock-in for another shift.',
          assignment.id,
          input.userId,
          openRecord.shiftAssignmentId,
        );
      }

      try {
        const record = await clockRecordRepository.createClockIn(organizationId, {
          shiftAssignmentId: assignment.id,
          userId: input.userId,
          method: ClockMethod.OVERRIDE,
          overrideById: actor.id,
          overrideNote: input.reason,
        });

        logger.info(
          {
            organizationId,
            managerId: actor.id,
            staffUserId: input.userId,
            shiftAssignmentId: assignment.id,
            action: input.action,
            reason: input.reason,
          },
          'Attendance override applied',
        );

        return {
          record,
          message: `Clock-in override applied for ${assignment.user.name}`,
        };
      } catch (error) {
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
          throwAlreadyClockedInConflict('Staff member is already clocked in for this shift.', assignment.id, input.userId);
        }
        throw error;
      }
    }

    if (input.action === 'VOID_CLOCK_OUT') {
      const existing = await clockRecordRepository.findByAssignmentId(assignment.id, organizationId);
      if (!existing || !existing.clockOutAt) {
        throw new ConflictError('This shift does not have a clock-out to void.', 'CLOCK_NOT_OUT', {
          assignmentId: assignment.id,
          userId: input.userId,
        });
      }

      const voided = await clockRecordRepository.voidClockOut(existing.id, organizationId, actor.id, input.reason);
      if (!voided) {
        throw new ConflictError('Attendance changed just now. Refresh and try again.', 'CLOCK_STALE_STATE', {
          assignmentId: assignment.id,
          userId: input.userId,
        });
      }

      logger.info(
        { organizationId, managerId: actor.id, staffUserId: input.userId, shiftAssignmentId: assignment.id, reason: input.reason },
        'Clock-out voided by manager',
      );

      return {
        record: voided,
        message: `Clock-out voided for ${assignment.user.name}`,
      };
    }

    const record = requireActiveClockRecord(
      await clockRecordRepository.findByAssignmentId(assignment.id, organizationId),
      assignment.id,
      input.userId,
      'Staff member is not currently clocked in for this shift.',
    );

    const updated = requireUpdatedClockRecord(
      await clockRecordRepository.updateClockOut(record.id, organizationId, {
        clockOutAt: new Date(),
        clockOutMethod: ClockMethod.OVERRIDE,
        overrideById: actor.id,
        overrideNote: input.reason,
      }),
      assignment.id,
      input.userId,
    );

    logger.info(
      {
        organizationId,
        managerId: actor.id,
        staffUserId: input.userId,
        shiftAssignmentId: assignment.id,
        action: input.action,
        reason: input.reason,
      },
      'Attendance override applied',
    );

    return {
      record: updated,
      message: `Clock-out override applied for ${assignment.user.name}`,
    };
  },

  undoClockOut: async (actor: Actor, input: UndoClockOutInput): Promise<ClockRecord> => {
    const { assignment, organizationId } = await assertTodayAssignmentForActor(actor, input.shiftAssignmentId);

    const record = await clockRecordRepository.findByAssignmentId(assignment.id, organizationId);
    if (!record || !record.clockOutAt) {
      throw new ConflictError('This shift does not have a clock-out to undo.', 'CLOCK_NOT_OUT', {
        assignmentId: assignment.id,
        userId: actor.id,
      });
    }

    const UNDO_WINDOW_MS = 60_000;
    const msSinceClockOut = Date.now() - new Date(record.clockOutAt).getTime();
    if (msSinceClockOut > UNDO_WINDOW_MS) {
      throw new ConflictError(
        'The 60-second undo window has passed. Ask your manager to void the clock-out.',
        'CLOCK_UNDO_EXPIRED',
        { assignmentId: assignment.id, userId: actor.id },
      );
    }

    const voided = await clockRecordRepository.voidClockOut(
      record.id,
      organizationId,
      actor.id,
      'Self-undo within 60-second grace period',
    );

    if (!voided) {
      throw new ConflictError('Attendance changed just now. Refresh and try again.', 'CLOCK_STALE_STATE', {
        assignmentId: assignment.id,
        userId: actor.id,
      });
    }

    logger.info(
      { organizationId, userId: actor.id, shiftAssignmentId: assignment.id },
      'Clock-out undone within grace period',
    );

    return voided;
  },
};
