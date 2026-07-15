import { prisma } from '../config/database';
import type { UserRole } from '@prisma/client';

const staffSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  organizationId: true,
  createdAt: true,
  organization: {
    select: {
      name: true,
    },
  },
} as const;

interface StaffFilters {
  organizationId?: string;
  role?: UserRole;
  isActive?: boolean;
  onShift?: boolean;
  allowedRoles?: UserRole[];
}

const getTodayRange = (): { startOfDay: Date; endOfDay: Date } => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  return { startOfDay, endOfDay };
};

export const staffRepository = {
  findByEmail: async (email: string) => {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
      },
    });
  },

  findMany: async ({ organizationId, role, isActive, onShift, allowedRoles }: StaffFilters) => {
    const { startOfDay, endOfDay } = getTodayRange();

    return prisma.user.findMany({
      where: {
        organizationId,
        role: role ?? (allowedRoles ? { in: allowedRoles } : undefined),
        isActive,
        ...(onShift
          ? {
              shiftAssignments: {
                some: {
                  ...(organizationId ? { organizationId } : {}),
                  date: {
                    gte: startOfDay,
                    lt: endOfDay,
                  },
                  clockRecord: {
                    is: {
                      clockInAt: {
                        not: null,
                      },
                      clockOutAt: null,
                    },
                  },
                },
              },
            }
          : {}),
      },
      select: staffSelect,
      orderBy: { createdAt: 'desc' },
    });
  },

  findMessagingContacts: async (organizationId: string, excludeId: string) => {
    // Branch staff for the caller's org + system-level leadership (DIRECTOR, HR_MANAGER)
    const [branchStaff, leadership] = await Promise.all([
      prisma.user.findMany({
        where: {
          organizationId,
          isActive: true,
          id: { not: excludeId },
          role: { in: ['MANAGER', 'ACCOUNTANT', 'WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING'] },
        },
        select: staffSelect,
        orderBy: { name: 'asc' },
      }),
      prisma.user.findMany({
        where: {
          isActive: true,
          id: { not: excludeId },
          role: { in: ['DIRECTOR', 'HR_MANAGER'] },
        },
        select: staffSelect,
        orderBy: { name: 'asc' },
      }),
    ]);
    return [...leadership, ...branchStaff];
  },

  findById: async (id: string, organizationId?: string, allowedRoles?: UserRole[]) => {
    return prisma.user.findFirst({
      where: {
        id,
        organizationId,
        role: allowedRoles ? { in: allowedRoles } : undefined,
      },
      select: staffSelect,
    });
  },

  create: async (data: {
    name: string;
    email: string;
    phone?: string;
    role: UserRole;
    organizationId: string | null;
    passwordHash: string;
    /** Create the EmployeeProfile atomically with the user (contract type left unset). */
    withEmployeeProfile?: boolean;
  }) => {
    const { withEmployeeProfile, ...userData } = data;
    return prisma.user.create({
      data: {
        ...userData,
        ...(withEmployeeProfile
          ? { employeeProfile: { create: { startDate: new Date() } } }
          : {}),
      },
      select: staffSelect,
    });
  },

  update: async (
    id: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
    },
    organizationId?: string,
  ) => {
    return prisma.user.updateMany({
      where: {
        id,
        organizationId,
      },
      data,
    });
  },

  updatePassword: async (id: string, passwordHash: string, organizationId?: string) => {
    return prisma.user.updateMany({
      where: {
        id,
        organizationId,
      },
      data: { passwordHash },
    });
  },

  countDependencies: async (id: string, organizationId?: string) => {
    const where = { userId: id, ...(organizationId ? { organizationId } : {}) };
    const [orders, shiftAssignments, clockRecords] = await Promise.all([
      prisma.order.count({ where: { createdById: id, ...(organizationId ? { organizationId } : {}) } }),
      prisma.shiftAssignment.count({ where }),
      prisma.clockRecord.count({ where }),
    ]);
    return { orders, shiftAssignments, clockRecords };
  },

  hardDelete: async (id: string, organizationId?: string) => {
    return prisma.user.deleteMany({
      where: {
        id,
        organizationId,
      },
    });
  },

  setActive: async (id: string, isActive: boolean, organizationId?: string) => {
    return prisma.user.updateMany({
      where: {
        id,
        organizationId,
      },
      data: {
        isActive,
      },
    });
  },

  findByIdOnShift: async (
    id: string,
    organizationId: string,
    allowedRoles: UserRole[],
  ) => {
    const { startOfDay, endOfDay } = getTodayRange();

    return prisma.user.findFirst({
      where: {
        id,
        organizationId,
        role: {
          in: allowedRoles,
        },
        isActive: true,
        shiftAssignments: {
          some: {
            organizationId,
            date: {
              gte: startOfDay,
              lt: endOfDay,
            },
            clockRecord: {
              is: {
                clockInAt: {
                  not: null,
                },
                clockOutAt: null,
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
    });
  },
};
