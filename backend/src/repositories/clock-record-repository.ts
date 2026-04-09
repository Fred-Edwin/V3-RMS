import { ClockMethod, type ClockRecord } from '@prisma/client';
import { prisma } from '../config/database';

export const clockRecordRepository = {
  findByAssignmentId: async (
    shiftAssignmentId: string,
    organizationId: string,
  ): Promise<ClockRecord | null> => {
    return prisma.clockRecord.findFirst({
      where: {
        organizationId,
        shiftAssignmentId,
      },
    });
  },

  findOpenByUserId: async (userId: string, organizationId: string): Promise<ClockRecord | null> => {
    return prisma.clockRecord.findFirst({
      where: {
        organizationId,
        userId,
        clockInAt: {
          not: null,
        },
        clockOutAt: null,
      },
      orderBy: {
        clockInAt: 'desc',
      },
    });
  },

  createClockIn: async (
    organizationId: string,
    data: {
      shiftAssignmentId: string;
      userId: string;
      method: ClockMethod;
      overrideById?: string;
      overrideNote?: string;
      clockInAt?: Date;
    },
  ): Promise<ClockRecord> => {
    return prisma.clockRecord.create({
      data: {
        organizationId,
        shiftAssignmentId: data.shiftAssignmentId,
        userId: data.userId,
        clockInAt: data.clockInAt ?? new Date(),
        clockInMethod: data.method,
        overrideById: data.overrideById,
        overrideNote: data.overrideNote,
      },
    });
  },

  // Close all open clock records whose clockInAt is before the start of today (Nairobi).
  // Returns the number of records closed. Used by the nightly job and as a safety
  // guard inside clockIn so stale records from a previous day never block new ones.
  closeStaleOpenRecords: async (
    organizationId: string,
    todayStartUtc: Date,
  ): Promise<number> => {
    const result = await prisma.clockRecord.updateMany({
      where: {
        organizationId,
        clockInAt: {
          not: null,
          lt: todayStartUtc,
        },
        clockOutAt: null,
      },
      data: {
        clockOutAt: todayStartUtc,
        clockOutMethod: ClockMethod.OVERRIDE,
        overrideNote: 'Auto-closed: shift ended without clock-out',
      },
    });
    return result.count;
  },

  voidClockOut: async (
    id: string,
    organizationId: string,
    overrideById: string,
    overrideNote: string,
  ): Promise<ClockRecord | null> => {
    const result = await prisma.clockRecord.updateMany({
      where: {
        id,
        organizationId,
        clockInAt: { not: null },
        clockOutAt: { not: null },
      },
      data: {
        clockOutAt: null,
        clockOutMethod: null,
        overrideById,
        overrideNote,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return prisma.clockRecord.findFirst({ where: { id, organizationId } });
  },

  updateClockOut: async (
    id: string,
    organizationId: string,
    data: {
      clockOutAt: Date;
      clockOutMethod: ClockMethod;
      overrideById?: string;
      overrideNote?: string;
    },
  ): Promise<ClockRecord | null> => {
    const result = await prisma.clockRecord.updateMany({
      where: {
        id,
        organizationId,
        clockInAt: {
          not: null,
        },
        clockOutAt: null,
      },
      data: {
        clockOutAt: data.clockOutAt,
        clockOutMethod: data.clockOutMethod,
        overrideById: data.overrideById,
        overrideNote: data.overrideNote,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return prisma.clockRecord.findFirst({
      where: {
        id,
        organizationId,
      },
    });
  },
};
