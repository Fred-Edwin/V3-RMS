import { type Prisma, type ShiftAssignment } from '@prisma/client';
import { prisma } from '../config/database';

const shiftAssignmentInclude = {
  shift: {
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
      isActive: true,
    },
  },
  user: {
    select: {
      id: true,
      name: true,
      role: true,
      departmentTag: true,
      isActive: true,
    },
  },
  clockRecord: {
    select: {
      id: true,
      clockInAt: true,
      clockOutAt: true,
      clockInMethod: true,
      clockOutMethod: true,
      overrideById: true,
      overrideNote: true,
    },
  },
} as const;

export type ShiftAssignmentWithRelations = Prisma.ShiftAssignmentGetPayload<{
  include: typeof shiftAssignmentInclude;
}>;

export const shiftAssignmentRepository = {
  findByOrganizationAndDateRange: async (
    organizationId: string,
    startDate: Date,
    endDate: Date,
    filters?: { userId?: string; shiftId?: string; userWhere?: Prisma.UserWhereInput },
  ): Promise<ShiftAssignmentWithRelations[]> => {
    return prisma.shiftAssignment.findMany({
      where: {
        organizationId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        userId: filters?.userId,
        shiftId: filters?.shiftId,
        // Department-head scoping: restrict the roster to the head's department.
        user: filters?.userWhere,
      },
      include: shiftAssignmentInclude,
      orderBy: [{ date: 'asc' }, { shift: { startTime: 'asc' } }, { user: { name: 'asc' } }],
    });
  },

  findByUserAndDateRange: async (
    userId: string,
    organizationId: string,
    startDate: Date,
    endDate: Date,
    filters?: { shiftId?: string },
  ): Promise<ShiftAssignmentWithRelations[]> => {
    return prisma.shiftAssignment.findMany({
      where: {
        organizationId,
        userId,
        shiftId: filters?.shiftId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: shiftAssignmentInclude,
      orderBy: [{ date: 'asc' }, { shift: { startTime: 'asc' } }],
    });
  },

  findById: async (id: string, organizationId: string): Promise<ShiftAssignmentWithRelations | null> => {
    return prisma.shiftAssignment.findFirst({
      where: {
        id,
        organizationId,
      },
      include: shiftAssignmentInclude,
    });
  },

  create: async (
    organizationId: string,
    data: {
      userId: string;
      shiftId: string;
      date: Date;
    },
  ): Promise<ShiftAssignment> => {
    return prisma.shiftAssignment.create({
      data: {
        organizationId,
        userId: data.userId,
        shiftId: data.shiftId,
        date: data.date,
      },
    });
  },

  delete: async (id: string, organizationId: string): Promise<boolean> => {
    const result = await prisma.shiftAssignment.deleteMany({
      where: {
        id,
        organizationId,
      },
    });

    return result.count > 0;
  },

  findByOrganizationAndWeek: async (
    organizationId: string,
    weekStart: Date,
    filters?: { userWhere?: Prisma.UserWhereInput },
  ): Promise<ShiftAssignmentWithRelations[]> => {
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    return prisma.shiftAssignment.findMany({
      where: {
        organizationId,
        date: { gte: weekStart, lte: weekEnd },
        // Department-head scoping: restrict the copied roster to the head's department.
        user: filters?.userWhere,
      },
      include: shiftAssignmentInclude,
      orderBy: [{ date: 'asc' }, { shift: { startTime: 'asc' } }],
    });
  },

  deleteByIds: async (ids: string[], organizationId: string): Promise<number> => {
    // Delete clock records first to satisfy the FK constraint, then the assignments
    return prisma.$transaction(async (tx) => {
      await tx.clockRecord.deleteMany({
        where: { shiftAssignmentId: { in: ids } },
      });
      const result = await tx.shiftAssignment.deleteMany({
        where: { id: { in: ids }, organizationId },
      });
      return result.count;
    });
  },

  reconcileWeek: async (
    organizationId: string,
    operations: Array<{
      userId: string;
      date: Date;
      shiftId: string | null;
      deleteIds: string[];
    }>,
  ): Promise<void> => {
    await prisma.$transaction(async (tx) => {
      for (const operation of operations) {
        if (operation.deleteIds.length > 0) {
          await tx.shiftAssignment.deleteMany({
            where: {
              id: { in: operation.deleteIds },
              organizationId,
            },
          });
        }

        if (operation.shiftId) {
          await tx.shiftAssignment.create({
            data: {
              organizationId,
              userId: operation.userId,
              shiftId: operation.shiftId,
              date: operation.date,
            },
          });
        }
      }
    });
  },
};
