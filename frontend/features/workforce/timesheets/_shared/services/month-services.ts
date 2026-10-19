import { apiClient } from '@/lib/apiClient';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError, type ApiResponseEnvelope } from '@/types/api';

import type {
  ApprovalResult,
  ApproveBody,
  DownloadedFile,
  ExportRequest,
  MonthList,
  MonthPeople,
  MonthQuery,
  MonthView,
  OvertimeAnswer,
  OvertimeDetail,
  PeopleQuery,
  PersonDays,
  PersonDrawerData,
} from '../types/month-types';

/** Every months endpoint the Timesheets screens use (MO1 to MO7, O3, O2), one function each. The months reads take `site` (the spec's name). */

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const BASE = '/workforce/timesheets';

export function query(params: Record<string, string | number | undefined>): string {
  const pairs = Object.entries(params).filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '');
  return pairs.length === 0 ? '' : `?${pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}`;
}

const range = (q: MonthQuery): Record<string, string | undefined> => ({ from: q.from, to: q.to });

export const monthReads = {
  /** MO1: the months of a branch, newest first, 5 a page. */
  list: (site: string | undefined, page: number, rows = 5): Promise<MonthList> => apiClient.get(`${BASE}/months${query({ site, page, rows })}`, token()),
  /** MO2 */
  month: (monthKey: string, site: string | undefined, q: MonthQuery): Promise<MonthView> => apiClient.get(`${BASE}/months/${monthKey}${query({ site, ...range(q) })}`, token()),
  /** MO3 */
  people: (monthKey: string, site: string | undefined, q: PeopleQuery): Promise<MonthPeople> =>
    apiClient.get(`${BASE}/months/${monthKey}/people${query({ site, ...range(q), q: q.q, dept: q.dept, view: q.view, sort: q.sort, dir: q.dir, page: q.page, rows: q.rows })}`, token()),
  /** MO4 */
  person: (monthKey: string, employeeId: string, site: string | undefined, q: MonthQuery): Promise<PersonDrawerData> =>
    apiClient.get(`${BASE}/months/${monthKey}/people/${employeeId}${query({ site, ...range(q) })}`, token()),
  /** MO5 */
  personDays: (monthKey: string, employeeId: string, site: string | undefined, q: MonthQuery & { view: 'all' | 'needs' | 'worked'; page: number; rows: number }): Promise<PersonDays> =>
    apiClient.get(`${BASE}/months/${monthKey}/people/${employeeId}/days${query({ site, ...range(q), view: q.view, page: q.page, rows: q.rows })}`, token()),
  /** O3: one overtime item with the evidence beside it. */
  overtime: (id: string): Promise<OvertimeDetail> => apiClient.get(`${BASE}/overtime/${id}`, token()),
};

export const monthWrites = {
  /** MO6 */
  approve: (monthKey: string, body: ApproveBody): Promise<ApprovalResult> => apiClient.post(`${BASE}/months/${monthKey}/approve`, body, token()),
  /** O2 */
  decideOvertime: (id: string, body: OvertimeAnswer): Promise<unknown> => apiClient.post(`${BASE}/overtime/${id}/decision`, body, token()),
};

const nameFrom = (disposition: string | null, fallback: string): string => /filename="([^"]+)"/.exec(disposition ?? '')?.[1] ?? fallback;

/**
 * MO7: the file itself, not JSON. The server names it and, for an approved month, sends the document number in a header. A refusal
 * comes back as the usual JSON envelope, so it reads in the server's own words.
 */
export async function downloadExport(monthKey: string, body: ExportRequest): Promise<DownloadedFile> {
  const accessToken = token();
  const response = await fetch(`${env.apiUrl}${BASE}/months/${monthKey}/exports`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as Partial<ApiResponseEnvelope<unknown>>;
    throw new ApiError(payload.error?.message ?? 'The file could not be made.', response.status, payload.error?.code ?? 'EXPORT_FAILED', payload.error?.details);
  }
  return {
    blob: await response.blob(),
    filename: nameFrom(response.headers.get('Content-Disposition'), `Timesheet-${monthKey}.${body.format}`),
    documentNumber: response.headers.get('X-Document-Number'),
  };
}
