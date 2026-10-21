import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import { queryString } from '../../../_shared/services/people-reads';
import type {
  AssignHeadBody,
  DepartmentCreateBody,
  DepartmentUpdateBody,
  DepartmentView,
  EndHeadBody,
  HeadCandidate,
  HeadPreview,
  PersonWithoutLogin,
  OrgOverview,
  PositionCreateBody,
  PositionDetail,
  PositionImpact,
  PositionUpdateBody,
  PositionView,
} from '../types/org-types';

/** Every Organisation endpoint (O1 to O15), one function each. Screens never build a path. */

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const BASE = '/workforce/org';

export const orgReads = {
  /** O1 */
  overview: (includeRetired = false): Promise<OrgOverview> => apiClient.get(`${BASE}${queryString({ includeRetired: includeRetired ? 'true' : undefined })}`, token()),
  /** O2 */
  department: (id: string, page = 1, perPage = 50): Promise<DepartmentView> => apiClient.get(`${BASE}/departments/${id}${queryString({ page, perPage })}`, token()),
  /** O6 */
  headCandidates: (id: string): Promise<HeadCandidate[]> => apiClient.get(`${BASE}/departments/${id}/head-candidates`, token()),
  /** O6b */
  withoutLogin: (id: string): Promise<PersonWithoutLogin[]> => apiClient.get(`${BASE}/departments/${id}/head-candidates/no-login`, token()),
  /** O10 */
  positions: (query: { q?: string; departmentId?: string; includeRetired?: boolean } = {}): Promise<PositionView[]> =>
    apiClient.get(`${BASE}/positions${queryString({ q: query.q, departmentId: query.departmentId, includeRetired: query.includeRetired ? 'true' : undefined })}`, token()),
  /** O11 */
  position: (id: string): Promise<PositionDetail> => apiClient.get(`${BASE}/positions/${id}`, token()),
  /** O13 */
  positionImpact: (id: string, defaultTracksTime: boolean): Promise<PositionImpact> =>
    apiClient.get(`${BASE}/positions/${id}/impact${queryString({ defaultTracksTime: String(defaultTracksTime) })}`, token()),
};

export const orgWrites = {
  /** O3 */
  createDepartment: (body: DepartmentCreateBody): Promise<DepartmentView> => apiClient.post(`${BASE}/departments`, body, token()),
  /** O4 */
  updateDepartment: (id: string, body: DepartmentUpdateBody): Promise<DepartmentView> => apiClient.patch(`${BASE}/departments/${id}`, body, token()),
  /** O5 */
  retireDepartment: (id: string): Promise<unknown> => apiClient.post(`${BASE}/departments/${id}/retire`, {}, token()),
  restoreDepartment: (id: string): Promise<unknown> => apiClient.post(`${BASE}/departments/${id}/restore`, {}, token()),
  /** O7: writes nothing */
  previewHead: (id: string, body: AssignHeadBody): Promise<HeadPreview> => apiClient.post(`${BASE}/departments/${id}/head/preview`, body, token()),
  /** O8 */
  assignHead: (id: string, body: AssignHeadBody): Promise<unknown> => apiClient.post(`${BASE}/departments/${id}/head`, body, token()),
  /** O9 */
  endHead: (id: string, body: EndHeadBody): Promise<unknown> => apiClient.post(`${BASE}/departments/${id}/head/end`, body, token()),
  /** O12 */
  createPosition: (body: PositionCreateBody): Promise<PositionView> => apiClient.post(`${BASE}/positions`, body, token()),
  /** O14 */
  updatePosition: (id: string, body: PositionUpdateBody): Promise<PositionView> => apiClient.patch(`${BASE}/positions/${id}`, body, token()),
  /** O15 */
  retirePosition: (id: string): Promise<unknown> => apiClient.post(`${BASE}/positions/${id}/retire`, {}, token()),
  restorePosition: (id: string): Promise<unknown> => apiClient.post(`${BASE}/positions/${id}/restore`, {}, token()),
};
