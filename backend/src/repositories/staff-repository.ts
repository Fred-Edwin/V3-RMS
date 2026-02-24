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
  }) => {
    return prisma.user.create({
      data,
      select: staffSelect,
    });
  },

  update: async (
    id: string,
    data: {
      name?: string;
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
