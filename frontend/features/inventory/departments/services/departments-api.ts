/**
 * Departments' HTTP service (contract R23 to R26).
 */
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import { queryString } from '../../_shared/services/scw-call';
import type { AddDepartmentInput, DepartmentRow, ListDepartments, ListDepartmentsQuery, RenameDepartmentInput } from '../types/departments-contract';

const BASE = '/inventory/departments';
const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;

export const departmentsApi = {
  /** R23 */
  list: (query: ListDepartmentsQuery = {}): Promise<ListDepartments> => apiClient.get<ListDepartments>(`${BASE}${queryString(query)}`, token()),
  /** R24 */
  add: (input: AddDepartmentInput): Promise<DepartmentRow> => apiClient.post<DepartmentRow>(BASE, input, token()),
  /** R25 */
  rename: (id: string, input: RenameDepartmentInput): Promise<DepartmentRow> => apiClient.patch<DepartmentRow>(`${BASE}/${id}`, input, token()),
  /** R26 */
  retire: (id: string): Promise<DepartmentRow> => apiClient.post<DepartmentRow>(`${BASE}/${id}/retire`, {}, token()),
  restore: (id: string): Promise<DepartmentRow> => apiClient.post<DepartmentRow>(`${BASE}/${id}/restore`, {}, token()),
};
