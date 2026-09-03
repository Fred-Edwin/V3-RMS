import { prisma } from '../config/database';
import type { DepartmentTag } from '@prisma/client';
import { departmentScopeFilter } from '../utils/departments';

const staffSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  departmentTag: true,
  isDepartmentHead: true,
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
        isDepartmentHead: true,
        isActive: true,
      },
      select: staffSelect,
    });
  },

  countStaffByDepartment: async (organizationId: string, departmentTag: DepartmentTag) => {
    // Department membership for scheduling is role-derived (see utils/departments):
    // the worked roles for this department. The head is one of those roles too,
    // so no separate clause is needed.
    return prisma.user.count({
      where: { organizationId, isActive: true, ...departmentScopeFilter(departmentTag) },
    });
  },

  findEligibleStaff: async (organizationId: string, departmentTag: DepartmentTag) => {
    // Eligible = active staff at this branch whose worked role belongs to this
    // department (role-derived membership, see utils/departments — KITCHEN also
    // covers PASTRY). Anyone already heading a department is excluded: change a
    // head via unassign-then-assign so there is never ambiguity about which
    // department a person heads.
    return prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        isDepartmentHead: false,
        ...departmentScopeFilter(departmentTag),
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
        isDepartmentHead: true,
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
          isDepartmentHead: true,
          id: { not: userId },
        },
      });
      if (currentHead) {
        await tx.user.update({
          where: { id: currentHead.id },
          data: { isDepartmentHead: false, departmentTag: null },
        });
      }

      // Marker model: the person keeps their real role; we only set the flag
      // and the tag naming which department they head. "Move a head from
      // Kitchen to Service" is just a new departmentTag on the same row.
      return tx.user.update({
        where: { id: userId },
        data: { isDepartmentHead: true, departmentTag },
        select: staffSelect,
      });
    });
  },

  unassignHead: async (userId: string) => {
    return prisma.user.update({
      where: { id: userId },
      data: { isDepartmentHead: false, departmentTag: null },
      select: staffSelect,
    });
  },
};
