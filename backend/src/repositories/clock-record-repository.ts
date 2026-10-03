import { ClockMethod, type ClockRecord } from '@prisma/client';
import { prisma } from '../config/database';

export const clockRecordRepository = {
  findByAssignmentId: async (
    shiftAssignmentId: string,
    siteId: string,
  ): Promise<ClockRecord | null> => {
    return prisma.clockRecord.findFirst({
      where: {
        siteId,
        shiftAssignmentId,
      },
    });
  },

  findOpenByUserId: async (userId: string, siteId: string): Promise<ClockRecord | null> => {
    return prisma.clockRecord.findFirst({
      where: {
        siteId,
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
    siteId: string,
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
        siteId,
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
    siteId: string,
    todayStartUtc: Date,
  ): Promise<number> => {
    const result = await prisma.clockRecord.updateMany({
      where: {
        siteId,
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
    siteId: string,
    overrideById: string,
    overrideNote: string,
  ): Promise<ClockRecord | null> => {
    const result = await prisma.clockRecord.updateMany({
      where: {
        id,
        siteId,
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

    return prisma.clockRecord.findFirst({ where: { id, siteId } });
  },

  updateClockOut: async (
    id: string,
    siteId: string,
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
        siteId,
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
        siteId,
      },
    });
  },
};
