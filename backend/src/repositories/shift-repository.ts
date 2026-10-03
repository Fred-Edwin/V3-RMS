import { type Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { getTodayDateOnly } from '../utils/date-only';

const shiftSelect = {
  id: true,
  siteId: true,
  name: true,
  startTime: true,
  endTime: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type ShiftRecord = Prisma.ShiftGetPayload<{ select: typeof shiftSelect }>;

export const shiftRepository = {
  findAllBySite: async (siteId: string): Promise<ShiftRecord[]> => {
    return prisma.shift.findMany({
      where: {
        siteId,
        isActive: true,
      },
      select: shiftSelect,
      orderBy: [{ startTime: 'asc' }, { name: 'asc' }],
    });
  },

  findById: async (id: string, siteId: string): Promise<ShiftRecord | null> => {
    return prisma.shift.findFirst({
      where: {
        id,
        siteId,
        isActive: true,
      },
      select: shiftSelect,
    });
  },

  create: async (
    siteId: string,
    data: {
      name: string;
      startTime: string;
      endTime: string;
    },
  ): Promise<ShiftRecord> => {
    return prisma.shift.create({
      data: {
        siteId,
        name: data.name,
        startTime: data.startTime,
        endTime: data.endTime,
      },
      select: shiftSelect,
    });
  },

  update: async (
    id: string,
    siteId: string,
    data: {
      name?: string;
      startTime?: string;
      endTime?: string;
    },
  ): Promise<ShiftRecord | null> => {
    const result = await prisma.shift.updateMany({
      where: {
        id,
        siteId,
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
        siteId,
      },
      select: shiftSelect,
    });
  },

  hasFutureAssignments: async (id: string, siteId: string): Promise<boolean> => {
    const nextDayStart = getTodayDateOnly();
    nextDayStart.setUTCDate(nextDayStart.getUTCDate() + 1);

    const assignment = await prisma.shiftAssignment.findFirst({
      where: {
        siteId,
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

  softDelete: async (id: string, siteId: string): Promise<boolean> => {
    const result = await prisma.shift.updateMany({
      where: {
        id,
        siteId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    return result.count > 0;
  },
};
