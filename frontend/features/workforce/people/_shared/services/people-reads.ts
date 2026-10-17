import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import type { DraftRow } from '../types/people-requests';
import type {
  DocumentRow,
  DuplicateCheck,
  EmployeeFile,
  EmployeeListQuery,
  EmployeeListRow,
  Lookups,
  PayChangeRow,
  PayView,
  Pagination,
  PeopleSummary,
} from '../types/people-types';

/** Every People read (R1 to R11, W1 drafts list). The token comes from the auth store, as the Inventory services do. */

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const BASE = '/workforce/people';

/** Builds `?a=1&b=2` from the defined values only, so an unset filter is never sent. */
export function queryString(params: Record<string, string | number | undefined>): string {
  const pairs = Object.entries(params).filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '');
  if (pairs.length === 0) return '';
  return `?${pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}`;
}

export interface EmployeePage {
  rows: EmployeeListRow[];
  pagination: Pagination;
}

export const peopleReads = {
  /** R1 */
  async list(query: EmployeeListQuery): Promise<EmployeePage> {
    const envelope = await apiClient.getWithEnvelope<EmployeeListRow[]>(`${BASE}${queryString({ ...query })}`, token());
    const rows = envelope.data ?? [];
    return { rows, pagination: envelope.pagination ?? { total: rows.length, page: 1, perPage: rows.length, totalPages: 1 } };
  },
  /** R2 */
  summary: (siteId?: string): Promise<PeopleSummary> => apiClient.get(`${BASE}/summary${queryString({ siteId })}`, token()),
  /** R3 */
  lookups: (): Promise<Lookups> => apiClient.get(`${BASE}/lookups`, token()),
  /** R4: booleans only, so a screen can say "someone with this ID is already on file" without showing who. */
  duplicateCheck: (query: { nationalId?: string; phone?: string; email?: string }): Promise<DuplicateCheck> =>
    apiClient.get(`${BASE}/duplicate-check${queryString(query)}`, token()),
  /** R6 */
  mine: (): Promise<EmployeeFile> => apiClient.get(`${BASE}/me`, token()),
  /** R7 */
  file: (id: string): Promise<EmployeeFile> => apiClient.get(`${BASE}/${id}`, token()),
  /** R8 (audited unless it is the person's own) */
  pay: (id: string): Promise<PayView> => apiClient.get(`${BASE}/${id}/pay`, token()),
  /** R9 */
  documents: (id: string): Promise<DocumentRow[]> => apiClient.get(`${BASE}/${id}/documents`, token()),
  /** R10 (audited unless it is the person's own): a short-lived link to the file. */
  openDocument: (id: string, docId: string): Promise<{ url: string }> => apiClient.get(`${BASE}/${id}/documents/${docId}`, token()),
  /** R11 */
  payChanges: (status: PayChangeRow['status'] = 'PENDING'): Promise<PayChangeRow[]> => apiClient.get(`${BASE}/pay-changes${queryString({ status })}`, token()),
  /** W1 */
  drafts: (): Promise<DraftRow[]> => apiClient.get(`${BASE}/drafts`, token()),
};
