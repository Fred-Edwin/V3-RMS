import { apiClient } from '@/lib/apiClient';
import type {
  OtherIncomeCategory,
  OtherIncomeCategoryDropdownItem,
  OtherIncomeEntry,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateEntryInput,
  ListEntriesParams,
} from '@/types/otherIncome';
import type { PaginationMeta } from '@/types/order';

const toQueryString = (params: ListEntriesParams & { organizationId?: string }): string => {
  const query = new URLSearchParams();
  if (params.organizationId) query.set('organizationId', params.organizationId);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.categoryId) query.set('categoryId', params.categoryId);
  if (params.branchId) query.set('branchId', params.branchId);
  if (params.page) query.set('page', String(params.page));
  if (params.perPage) query.set('perPage', String(params.perPage));
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

export const otherIncomeService = {
  // ── Categories ──────────────────────────────────────────────────────────────

  /** Directors must pass organizationId (= branch id). Branch-level roles omit it. */
  listCategories: (token: string, organizationId?: string): Promise<OtherIncomeCategory[]> => {
    const qs = organizationId ? `?organizationId=${organizationId}` : '';
    return apiClient.get(`/other-income/categories${qs}`, token);
  },

  listActiveCategories: (token: string, organizationId?: string): Promise<OtherIncomeCategoryDropdownItem[]> => {
    const qs = organizationId ? `?organizationId=${organizationId}` : '';
    return apiClient.get(`/other-income/categories/active${qs}`, token);
  },

  createCategory: (input: CreateCategoryInput, token: string, organizationId?: string): Promise<OtherIncomeCategory> => {
    const qs = organizationId ? `?organizationId=${organizationId}` : '';
    return apiClient.post(`/other-income/categories${qs}`, input, token);
  },

  updateCategory: (
    id: string,
    input: UpdateCategoryInput,
    token: string,
    organizationId?: string,
  ): Promise<OtherIncomeCategory> => {
    const qs = organizationId ? `?organizationId=${organizationId}` : '';
    return apiClient.patch(`/other-income/categories/${id}${qs}`, input, token);
  },

  // ── Entries ─────────────────────────────────────────────────────────────────

  listEntries: async (
    params: ListEntriesParams & { organizationId?: string },
    token: string,
  ): Promise<{ entries: OtherIncomeEntry[]; pagination: PaginationMeta }> => {
    const response = await apiClient.getWithEnvelope<OtherIncomeEntry[]>(
      `/other-income/entries${toQueryString(params)}`,
      token,
    );
    return {
      entries: response.data ?? [],
      pagination: response.pagination ?? { total: 0, page: 1, perPage: 20, totalPages: 0 },
    };
  },

  createEntry: (input: CreateEntryInput, token: string): Promise<OtherIncomeEntry> =>
    apiClient.post('/other-income/entries', input, token),

  deleteEntry: (id: string, token: string): Promise<void> =>
    apiClient.delete(`/other-income/entries/${id}`, token),
};
