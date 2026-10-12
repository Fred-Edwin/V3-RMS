import { prisma } from '../../../config/database';
import type { DepartmentRole } from './permissions-contract';

/** The caller's own department, for `GET /inventory/permissions/me` (database access only). */
export const permissionsRepository = {
  /** The active department of a branch this person heads or belongs to. Empty for a person with none (the hub and the desktop roles). */
  findDepartmentsOf: async (userId: string): Promise<Array<{ id: string; name: string; role: DepartmentRole }>> => {
    const user = await prisma.user.findFirst({
      where: { id: userId, isActive: true, deletedAt: null, departmentId: { not: null } },
      select: { isDepartmentHead: true, department: { select: { id: true, name: true, status: true, site: { select: { type: true } } } } },
    });
    const dept = user?.department;
    if (!user || !dept || dept.status !== 'ACTIVE' || dept.site.type !== 'BRANCH') return [];
    return [{ id: dept.id, name: dept.name, role: user.isDepartmentHead ? 'HEAD' : 'MEMBER' }];
  },
};
