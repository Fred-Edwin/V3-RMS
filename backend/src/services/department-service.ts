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
  if (actor.role === 'MANAGER' && actor.siteId === targetOrgId) {
    return;
  }
  throw new ForbiddenError('Only the Branch Manager of this branch, a Director, or a System Admin may manage department heads');
};

const requireNonHubBranch = async (siteId: string) => {
  const org = await departmentRepository.findSite(siteId);
  if (!org) {
    throw new NotFoundError('Organization not found');
  }
  if (org.isHub) {
    throw new ValidationError('The Central Store has no departments');
  }
  return org;
};

export const departmentService = {
  listDepartments: async (actor: Actor, siteId: string) => {
    requireBranchAccess(actor, siteId);
    await requireNonHubBranch(siteId);

    return Promise.all(
      DEPARTMENT_TAGS.map(async (tag) => {
        const [head, members] = await Promise.all([
          departmentRepository.findHeadByDepartment(siteId, tag),
          departmentRepository.listMembersByDepartment(siteId, tag),
        ]);
        // `members` is the single source of truth for the roster line and its
        // count — the card shows `members.length` then the first few names.
        return { departmentTag: tag, head, members };
      }),
    );
  },

  listEligibleStaff: async (actor: Actor, siteId: string, departmentTag: DepartmentTag) => {
    requireBranchAccess(actor, siteId);
    await requireNonHubBranch(siteId);

    if (!DEPARTMENT_TAGS.includes(departmentTag)) {
      throw new ValidationError('Invalid department');
    }

    return departmentRepository.findEligibleStaff(siteId, departmentTag);
  },

  assignHead: async (
    actor: Actor,
    siteId: string,
    departmentTag: DepartmentTag,
    userId: string,
  ) => {
    requireBranchAccess(actor, siteId);
    await requireNonHubBranch(siteId);

    if (!DEPARTMENT_TAGS.includes(departmentTag)) {
      throw new ValidationError('Invalid department');
    }

    const staff = await departmentRepository.findStaffById(userId, siteId);
    if (!staff) {
      throw new NotFoundError('Staff member not found at this branch');
    }
    if (!staff.isActive) {
      throw new ValidationError('Cannot assign an inactive staff member as department head');
    }

    return departmentRepository.assignHead(userId, departmentTag);
  },

  unassignHead: async (actor: Actor, siteId: string, departmentTag: DepartmentTag) => {
    requireBranchAccess(actor, siteId);
    await requireNonHubBranch(siteId);

    const currentHead = await departmentRepository.findHeadByDepartment(siteId, departmentTag);
    if (!currentHead) {
      throw new NotFoundError('No head is currently assigned to this department');
    }

    return departmentRepository.unassignHead(currentHead.id);
  },
};
