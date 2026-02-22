import { branchRepository } from '../repositories/branch-repository';
import { NotFoundError } from '../utils/errors';

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

  setHubBranch: async (id: string) => {
    const existing = await branchRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Branch not found');
    }

    return branchRepository.setHub(id);
  },
};
