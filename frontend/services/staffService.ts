import { apiClient } from '@/lib/apiClient';
import type { AppRole } from '@/types/auth';

export interface StaffDto {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: AppRole;
  isActive: boolean;
  organizationId: string | null;
  organizationName?: string | null;
  createdAt: string;
}

export interface ListStaffFilters {
  organizationId?: string;
  role?: AppRole;
  isActive?: boolean;
  onShift?: boolean;
}

export interface CreateStaffInput {
  name: string;
  email: string;
  phone?: string;
  role: AppRole;
  temporaryPassword: string;
  organizationId?: string;
}

export interface UpdateStaffInput {
  name?: string;
  email?: string;
  phone?: string;
}

const toQueryString = (filters?: ListStaffFilters): string => {
  if (!filters) {
    return '';
  }

  const params = new URLSearchParams();
  if (filters.organizationId) {
    params.set('organizationId', filters.organizationId);
  }
  if (filters.role) {
    params.set('role', filters.role);
  }
  if (filters.isActive !== undefined) {
    params.set('isActive', String(filters.isActive));
  }
  if (filters.onShift !== undefined) {
    params.set('onShift', String(filters.onShift));
  }

  const query = params.toString();
  return query ? `?${query}` : '';
};

export const staffService = {
  listStaff: (accessToken: string, filters?: ListStaffFilters): Promise<StaffDto[]> => {
    return apiClient.get(`/staff${toQueryString(filters)}`, accessToken);
  },

  getMessagingContacts: (accessToken: string): Promise<StaffDto[]> => {
    return apiClient.get('/staff/messaging-contacts', accessToken);
  },

  getById: (id: string, accessToken: string): Promise<StaffDto> => {
    return apiClient.get(`/staff/${id}`, accessToken);
  },

  createStaff: (input: CreateStaffInput, accessToken: string): Promise<StaffDto> => {
    return apiClient.post('/staff', input, accessToken);
  },

  updateStaff: (id: string, input: UpdateStaffInput, accessToken: string): Promise<StaffDto> => {
    return apiClient.patch(`/staff/${id}`, input, accessToken);
  },

  deactivateStaff: async (id: string, accessToken: string): Promise<void> => {
    await apiClient.patch(`/staff/${id}/deactivate`, {}, accessToken);
  },

  reactivateStaff: async (id: string, accessToken: string): Promise<void> => {
    await apiClient.patch(`/staff/${id}/reactivate`, {}, accessToken);
  },

  resetPassword: async (id: string, temporaryPassword: string, accessToken: string): Promise<void> => {
    await apiClient.patch(`/staff/${id}/reset-password`, { temporaryPassword }, accessToken);
  },

  deleteStaff: async (id: string, accessToken: string): Promise<void> => {
    await apiClient.delete(`/staff/${id}`, accessToken);
  },
};
