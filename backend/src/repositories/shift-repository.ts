import { type Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { getTodayDateOnly } from '../utils/date-only';

const shiftSelect = {
  id: true,
  organizationId: true,
  name: true,
  startTime: true,
  endTime: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type ShiftRecord = Prisma.ShiftGetPayload<{ select: typeof shiftSelect }>;

export const shiftRepository = {
  findAllByOrganization: async (organizationId: string): Promise<ShiftRecord[]> => {
    return prisma.shift.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      select: shiftSelect,
      orderBy: [{ startTime: 'asc' }, { name: 'asc' }],
    });
  },

  findById: async (id: string, organizationId: string): Promise<ShiftRecord | null> => {
    return prisma.shift.findFirst({
      where: {
        id,
        organizationId,
        isActive: true,
      },
      select: shiftSelect,
    });
  },

  create: async (
    organizationId: string,
    data: {
      name: string;
      startTime: string;
      endTime: string;
    },
  ): Promise<ShiftRecord> => {
    return prisma.shift.create({
      data: {
        organizationId,
        name: data.name,
        startTime: data.startTime,
        endTime: data.endTime,
      },
      select: shiftSelect,
    });
  },

  update: async (
    id: string,
    organizationId: string,
    data: {
      name?: string;
      startTime?: string;
      endTime?: string;
    },
  ): Promise<ShiftRecord | null> => {
    const result = await prisma.shift.updateMany({
      where: {
        id,
        organizationId,
        isActive: true,
      },
      data,
    });

    if (result.count === 0) {
      return null;
    }

    return prisma.shift.findFirst({
      where: {
        id,
        organizationId,
      },
      select: shiftSelect,
    });
  },

  hasFutureAssignments: async (id: string, organizationId: string): Promise<boolean> => {
    const nextDayStart = getTodayDateOnly();
    nextDayStart.setUTCDate(nextDayStart.getUTCDate() + 1);

    const assignment = await prisma.shiftAssignment.findFirst({
      where: {
        organizationId,
        shiftId: id,
        date: {
          gte: nextDayStart,
        },
      },
      select: {
        id: true,
      },
    });

    return Boolean(assignment);
  },

  softDelete: async (id: string, organizationId: string): Promise<boolean> => {
    const result = await prisma.shift.updateMany({
      where: {
        id,
        organizationId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    return result.count > 0;
  },
};
