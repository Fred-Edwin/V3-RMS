import { prisma } from '../config/database';
import type { DepartmentTag } from '@prisma/client';

const staffSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  departmentTag: true,
} as const;

export const departmentRepository = {
  findOrganization: async (organizationId: string) => {
    return prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, isHub: true, isActive: true },
    });
  },

  findHeadByDepartment: async (organizationId: string, departmentTag: DepartmentTag) => {
    return prisma.user.findFirst({
      where: {
        organizationId,
        departmentTag,
        role: 'DEPARTMENT_HEAD',
        isActive: true,
      },
      select: staffSelect,
    });
  },

  countStaffByDepartment: async (organizationId: string, departmentTag: DepartmentTag) => {
    return prisma.user.count({
      where: { organizationId, departmentTag, isActive: true },
    });
  },

  findEligibleStaff: async (organizationId: string) => {
    // Eligible = active staff at this branch, not already heading a different
    // department (a DEPARTMENT_HEAD already assigned elsewhere at this branch
    // is excluded — reassigning them must go through unassign first, so the
    // previousRole restoration on unassignment stays unambiguous).
    return prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        role: { not: 'DEPARTMENT_HEAD' },
      },
      select: staffSelect,
      orderBy: { name: 'asc' },
    });
  },

  findStaffById: async (id: string, organizationId: string) => {
    return prisma.user.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
        organizationId: true,
        departmentTag: true,
        previousRole: true,
      },
    });
  },

  assignHead: async (userId: string, departmentTag: DepartmentTag) => {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

      // Vacate any existing head of this department at the same branch first —
      // never two heads for the same (branch, department) simultaneously.
      const currentHead = await tx.user.findFirst({
        where: {
          organizationId: user.organizationId,
          departmentTag,
          role: 'DEPARTMENT_HEAD',
          id: { not: userId },
        },
      });
      if (currentHead) {
        await tx.user.update({
          where: { id: currentHead.id },
          data: {
            role: currentHead.previousRole ?? currentHead.role,
            previousRole: null,
            departmentTag: null,
          },
        });
      }

      return tx.user.update({
        where: { id: userId },
        data: {
          // Only stamp previousRole if this user isn't already a department
          // head being moved between departments — in that case the role
          // doesn't change and the original previousRole must be preserved.
          previousRole: user.role === 'DEPARTMENT_HEAD' ? user.previousRole : user.role,
          role: 'DEPARTMENT_HEAD',
          departmentTag,
        },
        select: staffSelect,
      });
    });
  },

  unassignHead: async (userId: string) => {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      return tx.user.update({
        where: { id: userId },
        data: {
          role: user.previousRole ?? 'WAITER',
          previousRole: null,
          departmentTag: null,
        },
        select: staffSelect,
      });
    });
  },
};
