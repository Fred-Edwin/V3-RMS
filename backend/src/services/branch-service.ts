import { branchRepository } from '../repositories/branch-repository';
import { ForbiddenError, NotFoundError } from '../utils/errors';

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
    requestingOrgId: string,
    data: Partial<{ phone: string; mpesaPaybill: string; accountNumber: string; googleReviewUrl: string }>,
  ) => {
    if (id !== requestingOrgId) {
      throw new ForbiddenError('You can only edit your own branch');
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
