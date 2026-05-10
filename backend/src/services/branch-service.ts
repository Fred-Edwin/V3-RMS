import type { UserRole } from '@prisma/client';
import { branchRepository } from '../repositories/branch-repository';
import { ForbiddenError, NotFoundError } from '../utils/errors';

interface BranchProfileActor {
  role: UserRole;
  organizationId: string | null;
}

export const branchService = {
  listBranches: async () => {
    return branchRepository.findAll();
  },

  createBranch: async (data: {
    name: string;
    address: string;
    city: string;
    latitude: number;
    longitude: number;
  }) => {
    return branchRepository.create(data);
  },

  updateBranch: async (
    id: string,
    data: Partial<{
      name: string;
      address: string;
      city: string;
      latitude: number;
      longitude: number;
      isActive: boolean;
    }>,
  ) => {
    const existing = await branchRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Branch not found');
    }

    return branchRepository.update(id, data);
  },

  getBranchProfile: async (id: string) => {
    const branch = await branchRepository.findById(id);
    if (!branch) {
      throw new NotFoundError('Branch not found');
    }
    return branch;
  },

  updateBranchProfile: async (
    id: string,
    actor: BranchProfileActor,
    data: Partial<{ phone: string; mpesaPaybill: string; accountNumber: string; googleReviewUrl: string; kraPIN: string }>,
  ) => {
    if (actor.role === 'MANAGER' && !actor.organizationId) {
      throw new ForbiddenError('Branch context required');
    }

    if (actor.role === 'MANAGER' && id !== actor.organizationId) {
      throw new ForbiddenError('You can only edit your own branch');
    }

    if (actor.role !== 'MANAGER' && actor.role !== 'DIRECTOR' && actor.role !== 'SYSTEM_ADMIN') {
      throw new ForbiddenError('You do not have permission to perform this action');
    }

    const existing = await branchRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Branch not found');
    }
    return branchRepository.updateProfile(id, data);
  },

  setHubBranch: async (id: string) => {
    const existing = await branchRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Branch not found');
    }

    return branchRepository.setHub(id);
  },
};
