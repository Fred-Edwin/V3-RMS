import { prisma } from '../config/database';
import type { DepartmentTag } from '@prisma/client';
import { departmentScopeFilter } from '../utils/departments';
import { departmentLinks } from '../modules/inventory/departments/department-links';

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
  findSite: async (siteId: string) => {
    return prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, name: true, isHub: true, isActive: true },
    });
  },

  findHeadByDepartment: async (siteId: string, departmentTag: DepartmentTag) => {
    return prisma.user.findFirst({
      where: {
        siteId,
        departmentTag,
        isDepartmentHead: true,
        isActive: true,
      },
      select: staffSelect,
    });
  },

  listMembersByDepartment: async (siteId: string, departmentTag: DepartmentTag) => {
    // Department membership for scheduling is role-derived (see utils/departments):
    // the worked roles for this department. The head is one of those roles too,
    // so no separate clause is needed. The count is just `members.length`.
    return prisma.user.findMany({
      where: { siteId, isActive: true, ...departmentScopeFilter(departmentTag) },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
  },

  findEligibleStaff: async (siteId: string, departmentTag: DepartmentTag) => {
    // Eligible = active staff at this branch whose worked role belongs to this
    // department (role-derived membership, see utils/departments — KITCHEN also
    // covers PASTRY). Anyone already heading a department is excluded: change a
    // head via unassign-then-assign so there is never ambiguity about which
    // department a person heads.
    return prisma.user.findMany({
      where: {
        siteId,
        isActive: true,
        isDepartmentHead: false,
        ...departmentScopeFilter(departmentTag),
      },
      select: staffSelect,
      orderBy: { name: 'asc' },
    });
  },

  findStaffById: async (id: string, siteId: string) => {
    return prisma.user.findFirst({
      where: { id, siteId },
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
        siteId: true,
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
          siteId: user.siteId,
          departmentTag,
          isDepartmentHead: true,
          id: { not: userId },
        },
      });
      if (currentHead) {
        await tx.user.update({
          where: { id: currentHead.id },
          data: { isDepartmentHead: false, departmentTag: null, departmentId: null },
        });
      }

      // Marker model: the person keeps their real role; we only set the flag
      // and the tag naming which department they head. "Move a head from
      // Kitchen to Service" is just a new departmentTag on the same row.
      // Dual-write (Block 1 expand phase): departmentId follows departmentTag.
      const departmentId = user.siteId ? await departmentLinks.idForKey(user.siteId, departmentTag, tx) : null;
      return tx.user.update({
        where: { id: userId },
        data: { isDepartmentHead: true, departmentTag, departmentId },
        select: staffSelect,
      });
    });
  },

  unassignHead: async (userId: string) => {
    return prisma.user.update({
      where: { id: userId },
      data: { isDepartmentHead: false, departmentTag: null, departmentId: null },
      select: staffSelect,
    });
  },
};
