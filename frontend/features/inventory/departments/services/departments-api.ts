/**
 * Departments' HTTP service (contract R23 to R26). `NEXT_PUBLIC_REQUISITIONS_MOCK=1` answers reads and writes from the contract
 * fixtures until back end B and the integration pass; the real API replaces it by unsetting the flag.
 */
import { apiClient } from '@/lib/apiClient';
import { ApiError } from '@/types/api';
import { useAuthStore } from '@/store/authStore';
import { queryString } from '../../_shared/services/scw-call';
import fixtures from '../types/departments-contract.fixtures.json';
import type { AddDepartmentInput, DepartmentRow, ListDepartments, ListDepartmentsQuery, RenameDepartmentInput } from '../types/departments-contract';

const BASE = '/inventory/departments';
const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const useMock = (): boolean => process.env.NEXT_PUBLIC_REQUISITIONS_MOCK === '1';
/** The same scenarios as the Requisitions mock (`sessionStorage.reqMockScenario`): `error`, `slow`, `write:<CODE>`. */
const scenario = (): string => {
  try {
    return window.sessionStorage.getItem('reqMockScenario') ?? '';
  } catch {
    return '';
  }
};
const later = <T>(value: T, isWrite = false): Promise<T> =>
  new Promise((resolve, reject) => {
    const s = scenario();
    window.setTimeout(
      () => {
        if (s === 'error' && !isWrite) reject(new ApiError('Server error', 500, 'SERVER_ERROR'));
        else if (s.startsWith('write:') && isWrite) reject(new ApiError('Refused.', 409, s.slice('write:'.length)));
        else resolve(structuredClone(value));
      },
      s === 'slow' ? 3000 : 120,
    );
  });

export const departmentsApi = {
  /** R23 */
  list: (query: ListDepartmentsQuery = {}): Promise<ListDepartments> =>
    useMock() ? later((useAuthStore.getState().user?.role === 'MANAGER' ? fixtures.listDepartmentsManager : fixtures.listDepartmentsDirector) as ListDepartments) : apiClient.get<ListDepartments>(`${BASE}${queryString(query)}`, token()),
  /** R24 */
  add: (input: AddDepartmentInput): Promise<DepartmentRow> => (useMock() ? later(fixtures.addDepartmentResult as DepartmentRow, true) : apiClient.post<DepartmentRow>(BASE, input, token())),
  /** R25 */
  rename: (id: string, input: RenameDepartmentInput): Promise<DepartmentRow> =>
    useMock() ? later({ ...(fixtures.addDepartmentResult as DepartmentRow), name: input.name }, true) : apiClient.patch<DepartmentRow>(`${BASE}/${id}`, input, token()),
  /** R26 */
  retire: (id: string): Promise<DepartmentRow> => (useMock() ? later(fixtures.addDepartmentResult as DepartmentRow, true) : apiClient.post<DepartmentRow>(`${BASE}/${id}/retire`, {}, token())),
  restore: (id: string): Promise<DepartmentRow> => (useMock() ? later(fixtures.addDepartmentResult as DepartmentRow, true) : apiClient.post<DepartmentRow>(`${BASE}/${id}/restore`, {}, token())),
};
