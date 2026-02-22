import { apiClient } from '@/lib/apiClient';

export interface BranchDto {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: string;
  longitude: string;
  isHub: boolean;
  isActive: boolean;
}

export interface CreateBranchInput {
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
}

export interface UpdateBranchInput {
  name?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export const branchService = {
  listBranches: (accessToken: string): Promise<BranchDto[]> => {
    return apiClient.get('/branches', accessToken);
  },

  createBranch: (input: CreateBranchInput, accessToken: string): Promise<BranchDto> => {
    return apiClient.post('/branches', input, accessToken);
  },

  updateBranch: (id: string, input: UpdateBranchInput, accessToken: string): Promise<BranchDto> => {
    return apiClient.patch(`/branches/${id}`, input, accessToken);
  },

  setHub: (id: string, accessToken: string): Promise<BranchDto> => {
    return apiClient.patch(`/branches/${id}/set-hub`, {}, accessToken);
  },
};
