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
