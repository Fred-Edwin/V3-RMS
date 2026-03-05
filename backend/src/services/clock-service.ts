import { ClockMethod } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { Request } from 'express';
import { branchRepository } from '../repositories/branch-repository';
import { clockRecordRepository } from '../repositories/clock-record-repository';
import { shiftAssignmentRepository } from '../repositories/shift-assignment-repository';
import { getTodayDateOnly, toIsoDateOnly } from '../utils/date-only';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { haversineDistanceMetres } from '../utils/haversine';
import type { ClockInOutInput, ClockOverrideInput } from '../validators/shift-schemas';

type Actor = NonNullable<Request['user']>;

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
  action: 'clock in' | 'clock out',
): Promise<void> => {
  const branch = await branchRepository.findById(organizationId);
  if (!branch) {
    throw new NotFoundError('Branch not found');
  }

  const distance = haversineDistanceMetres(latitude, longitude, Number(branch.latitude), Number(branch.longitude));
  if (distance > 50) {
    const roundedDistance = Math.round(distance);
    throw new ForbiddenError(
      `You must be at the branch to ${action}. You are approximately ${roundedDistance} metres away.`,
    );
  }
};

export const clockService = {
  clockIn: async (actor: Actor, input: ClockInOutInput) => {
    const organizationId = requireOrganizationId(actor);
    const assignment = await shiftAssignmentRepository.findById(input.shiftAssignmentId, organizationId);
    if (
      !assignment ||
      assignment.userId !== actor.id ||
      toIsoDateOnly(assignment.date) !== toIsoDateOnly(getTodayDateOnly())
    ) {
      throw new NotFoundError('shiftAssignmentId is invalid for this user today');
    }

    const existingRecord = await clockRecordRepository.findByAssignmentId(assignment.id, organizationId);
    if (existingRecord) {
      if (existingRecord.clockOutAt === null) {
        throw new ConflictError('Already clocked in');
      }
      throw new ConflictError('Shift attendance is already completed');
    }

    const openRecord = await clockRecordRepository.findOpenByUserId(actor.id, organizationId);
    if (openRecord) {
      throw new ConflictError('Already clocked in');
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
        throw new ConflictError('Already clocked in');
      }
      throw error;
    }
  },

  clockOut: async (actor: Actor, input: ClockInOutInput) => {
    const organizationId = requireOrganizationId(actor);
    const assignment = await shiftAssignmentRepository.findById(input.shiftAssignmentId, organizationId);
    if (
      !assignment ||
      assignment.userId !== actor.id ||
      toIsoDateOnly(assignment.date) !== toIsoDateOnly(getTodayDateOnly())
    ) {
      throw new NotFoundError('shiftAssignmentId is invalid for this user today');
    }

    const existingRecord = await clockRecordRepository.findByAssignmentId(assignment.id, organizationId);
    if (!existingRecord || !existingRecord.clockInAt || existingRecord.clockOutAt) {
      throw new ConflictError('Not currently clocked in');
    }

    await assertWithinGeofence(organizationId, input.latitude, input.longitude, 'clock out');

    const updated = await clockRecordRepository.updateClockOut(existingRecord.id, organizationId, {
      clockOutAt: new Date(),
      clockOutMethod: ClockMethod.GPS,
    });
    if (!updated) {
      throw new NotFoundError('Clock record not found');
    }

    return updated;
  },

  clockOverride: async (
    actor: Actor,
    input: ClockOverrideInput,
  ): Promise<{ record: Awaited<ReturnType<typeof clockRecordRepository.createClockIn>>; message: string }> => {
    const organizationId = requireOrganizationId(actor);
    const assignment = await shiftAssignmentRepository.findById(input.shiftAssignmentId, organizationId);
    if (!assignment || assignment.userId !== input.userId) {
      throw new NotFoundError('Shift assignment not found for this user');
    }

    if (toIsoDateOnly(assignment.date) !== toIsoDateOnly(getTodayDateOnly())) {
      throw new ConflictError('Overrides are only allowed for today assignments');
    }

    if (input.action === 'CLOCK_IN') {
      const existingRecord = await clockRecordRepository.findByAssignmentId(assignment.id, organizationId);
      if (existingRecord) {
        if (existingRecord.clockOutAt === null) {
          throw new ConflictError('Staff member is already clocked in');
        }
        throw new ConflictError('Shift attendance is already completed');
      }

      try {
        const record = await clockRecordRepository.createClockIn(organizationId, {
          shiftAssignmentId: assignment.id,
          userId: input.userId,
          method: ClockMethod.OVERRIDE,
          overrideById: actor.id,
          overrideNote: input.reason,
        });

        return {
          record,
          message: `Clock-in override applied for ${assignment.user.name}`,
        };
      } catch (error) {
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictError('Staff member is already clocked in');
        }
        throw error;
      }
    }

    const existingRecord = await clockRecordRepository.findByAssignmentId(assignment.id, organizationId);
    if (!existingRecord || !existingRecord.clockInAt || existingRecord.clockOutAt) {
      throw new ConflictError('Staff member is not currently clocked in');
    }

    const updated = await clockRecordRepository.updateClockOut(existingRecord.id, organizationId, {
      clockOutAt: new Date(),
      clockOutMethod: ClockMethod.OVERRIDE,
      overrideById: actor.id,
      overrideNote: input.reason,
    });
    if (!updated) {
      throw new NotFoundError('Clock record not found');
    }

    return {
      record: updated,
      message: `Clock-out override applied for ${assignment.user.name}`,
    };
  },
};
