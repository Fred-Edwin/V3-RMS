import type { Request } from 'express';
import type { DepartmentTag } from '@prisma/client';
import { departmentRepository } from '../repositories/department-repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';

type Actor = NonNullable<Request['user']>;

const DEPARTMENT_TAGS: DepartmentTag[] = ['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING'];

// D-17: the Branch Manager assigns department heads at their own branch;
// Director and System Admin can act on any branch.
const requireBranchAccess = (actor: Actor, targetOrgId: string): void => {
  if (actor.role === 'DIRECTOR' || actor.role === 'SYSTEM_ADMIN') {
    return;
  }
  if (actor.role === 'MANAGER' && actor.organizationId === targetOrgId) {
    return;
  }
  throw new ForbiddenError('Only the Branch Manager of this branch, a Director, or a System Admin may manage department heads');
};

const requireNonHubBranch = async (organizationId: string) => {
  const org = await departmentRepository.findOrganization(organizationId);
  if (!org) {
    throw new NotFoundError('Organization not found');
  }
  if (org.isHub) {
    throw new ValidationError('The Central Store has no departments');
  }
  return org;
};

export const departmentService = {
  listDepartments: async (actor: Actor, organizationId: string) => {
    requireBranchAccess(actor, organizationId);
    await requireNonHubBranch(organizationId);

    return Promise.all(
      DEPARTMENT_TAGS.map(async (tag) => {
        const [head, staffCount] = await Promise.all([
          departmentRepository.findHeadByDepartment(organizationId, tag),
          departmentRepository.countStaffByDepartment(organizationId, tag),
        ]);
        return { departmentTag: tag, head, staffCount };
      }),
    );
  },

  listEligibleStaff: async (actor: Actor, organizationId: string, departmentTag: DepartmentTag) => {
    requireBranchAccess(actor, organizationId);
    await requireNonHubBranch(organizationId);

    if (!DEPARTMENT_TAGS.includes(departmentTag)) {
      throw new ValidationError('Invalid department');
    }

    return departmentRepository.findEligibleStaff(organizationId);
  },

  assignHead: async (
    actor: Actor,
    organizationId: string,
    departmentTag: DepartmentTag,
    userId: string,
  ) => {
    requireBranchAccess(actor, organizationId);
    await requireNonHubBranch(organizationId);

    if (!DEPARTMENT_TAGS.includes(departmentTag)) {
      throw new ValidationError('Invalid department');
    }

    const staff = await departmentRepository.findStaffById(userId, organizationId);
    if (!staff) {
      throw new NotFoundError('Staff member not found at this branch');
    }
    if (!staff.isActive) {
      throw new ValidationError('Cannot assign an inactive staff member as department head');
    }

    return departmentRepository.assignHead(userId, departmentTag);
  },

  unassignHead: async (actor: Actor, organizationId: string, departmentTag: DepartmentTag) => {
    requireBranchAccess(actor, organizationId);
    await requireNonHubBranch(organizationId);

    const currentHead = await departmentRepository.findHeadByDepartment(organizationId, departmentTag);
    if (!currentHead) {
      throw new NotFoundError('No head is currently assigned to this department');
    }

    return departmentRepository.unassignHead(currentHead.id);
  },
};
