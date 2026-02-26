import { apiClient } from '@/lib/apiClient';
import { env } from '@/lib/env';
import { ApiError, type ApiResponseEnvelope } from '@/types/api';
import type {
  BranchMenuItemAvailability,
  CreateCategoryInput,
  CreateItemInput,
  MenuCategorySummary,
  MenuResponse,
  UpdateCategoryInput,
  UpdateItemInput,
} from '@/types/menu';

interface MenuQueryParams {
  categoryId?: string;
  branchId?: string;
}

const toMenuQuery = (params?: MenuQueryParams): string => {
  if (!params) {
    return '';
  }

  const searchParams = new URLSearchParams();
  if (params.categoryId) {
    searchParams.set('categoryId', params.categoryId);
  }
  if (params.branchId) {
    searchParams.set('branchId', params.branchId);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const menuService = {
  getMenu: (accessToken: string, params?: MenuQueryParams): Promise<MenuResponse> => {
    return apiClient.get(`/menu${toMenuQuery(params)}`, accessToken);
  },

  getCategories: (accessToken: string): Promise<MenuCategorySummary[]> => {
    return apiClient.get('/menu/categories', accessToken);
  },

  createCategory: async (data: CreateCategoryInput, accessToken: string): Promise<void> => {
    await apiClient.post('/menu/categories', data, accessToken);
  },

  updateCategory: async (id: string, data: UpdateCategoryInput, accessToken: string): Promise<void> => {
    await apiClient.patch(`/menu/categories/${id}`, data, accessToken);
  },

  deleteCategory: async (id: string, accessToken: string): Promise<void> => {
    await apiClient.delete(`/menu/categories/${id}`, accessToken);
  },

  createItem: async (data: CreateItemInput, accessToken: string): Promise<void> => {
    await apiClient.post('/menu/items', data, accessToken);
  },

  updateItem: async (id: string, data: UpdateItemInput, accessToken: string): Promise<void> => {
    await apiClient.patch(`/menu/items/${id}`, data, accessToken);
  },

  deleteItem: async (id: string, accessToken: string): Promise<void> => {
    await apiClient.delete(`/menu/items/${id}`, accessToken);
  },

  setItemAvailability: (
    id: string,
    isAvailable: boolean,
    accessToken: string,
    branchId?: string,
  ): Promise<BranchMenuItemAvailability> => {
    const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
    return apiClient.patch(`/menu/items/${id}/availability${query}`, { isAvailable }, accessToken);
  },

  uploadItemImage: async (file: File, accessToken: string): Promise<{ imageUrl: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch(`${env.apiUrl}/menu/items/upload-image`, {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    const payload = (await response.json()) as ApiResponseEnvelope<{ imageUrl: string }>;
    if (!response.ok) {
      throw new ApiError(
        payload.error?.message ?? 'Image upload failed',
        response.status,
        payload.error?.code ?? 'UPLOAD_ERROR',
      );
    }
    return payload.data as { imageUrl: string };
  },
};
