import { prisma } from '../config/database';
import type { UserRole } from '@prisma/client';

const staffSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  siteId: true,
  createdAt: true,
  site: {
    select: {
      name: true,
    },
  },
} as const;

// Team views need to show whether a person has set a signing PIN. The hash is
// selected only to derive a boolean and is stripped before anything is returned.
const staffWithPinSelect = { ...staffSelect, pinHash: true } as const;

interface StaffFilters {
  siteId?: string;
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

  findMany: async ({ siteId, role, isActive, onShift, allowedRoles }: StaffFilters) => {
    const { startOfDay, endOfDay } = getTodayRange();

    return prisma.user.findMany({
      where: {
        siteId,
        role: role ?? (allowedRoles ? { in: allowedRoles } : undefined),
        isActive,
        ...(onShift
          ? {
              shiftAssignments: {
                some: {
                  ...(siteId ? { siteId } : {}),
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

  /** Team list for a scoped org: accounts of the given roles, each with a `hasPin` boolean (never the hash). */
  findTeamWithPinStatus: async (siteId: string, roles: UserRole[], isActive?: boolean) => {
    const users = await prisma.user.findMany({
      where: { siteId, role: { in: roles }, isActive },
      select: staffWithPinSelect,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return users.map(({ pinHash, ...rest }) => ({ ...rest, hasPin: pinHash !== null }));
  },

  /** Clears the signing PIN so the user sets a new one at next signing. */
  clearPin: async (id: string, siteId: string, allowedRoles: UserRole[]) => {
    return prisma.user.updateMany({
      where: { id, siteId, role: { in: allowedRoles } },
      data: { pinHash: null },
    });
  },

  findMessagingContacts: async (siteId: string, excludeId: string) => {
    // Branch staff for the caller's org + system-level leadership (DIRECTOR, HR_MANAGER)
    const [branchStaff, leadership] = await Promise.all([
      prisma.user.findMany({
        where: {
          siteId,
          isActive: true,
          id: { not: excludeId },
          role: { in: ['MANAGER', 'ACCOUNTANT', 'WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING', 'STORE_MANAGER', 'STORE_ATTENDANT'] },
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

  findById: async (id: string, siteId?: string, allowedRoles?: UserRole[]) => {
    return prisma.user.findFirst({
      where: {
        id,
        siteId,
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
    siteId: string | null;
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
    siteId?: string,
  ) => {
    return prisma.user.updateMany({
      where: {
        id,
        siteId,
      },
      data,
    });
  },

  updatePassword: async (
    id: string,
    passwordHash: string,
    siteId?: string,
    allowedRoles?: UserRole[],
  ) => {
    return prisma.user.updateMany({
      where: {
        id,
        siteId,
        role: allowedRoles ? { in: allowedRoles } : undefined,
      },
      data: { passwordHash },
    });
  },

  countDependencies: async (id: string, siteId?: string) => {
    const where = { userId: id, ...(siteId ? { siteId } : {}) };
    const [orders, shiftAssignments, clockRecords] = await Promise.all([
      prisma.order.count({ where: { createdById: id, ...(siteId ? { siteId } : {}) } }),
      prisma.shiftAssignment.count({ where }),
      prisma.clockRecord.count({ where }),
    ]);
    return { orders, shiftAssignments, clockRecords };
  },

  hardDelete: async (id: string, siteId?: string) => {
    return prisma.user.deleteMany({
      where: {
        id,
        siteId,
      },
    });
  },

  setActive: async (
    id: string,
    isActive: boolean,
    siteId?: string,
    allowedRoles?: UserRole[],
  ) => {
    return prisma.user.updateMany({
      where: {
        id,
        siteId,
        role: allowedRoles ? { in: allowedRoles } : undefined,
      },
      data: {
        isActive,
      },
    });
  },

  findByIdOnShift: async (
    id: string,
    siteId: string,
    allowedRoles: UserRole[],
  ) => {
    const { startOfDay, endOfDay } = getTodayRange();

    return prisma.user.findFirst({
      where: {
        id,
        siteId,
        role: {
          in: allowedRoles,
        },
        isActive: true,
        shiftAssignments: {
          some: {
            siteId,
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
