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
  allowedRoles?: UserRole[];
}

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

  findMany: async ({ organizationId, role, isActive, allowedRoles }: StaffFilters) => {
    return prisma.user.findMany({
      where: {
        organizationId,
        role: role ?? (allowedRoles ? { in: allowedRoles } : undefined),
        isActive,
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
};
