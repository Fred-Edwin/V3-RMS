import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import type {
  ApplyResult,
  CopyBody,
  CopyPreview,
  CopyResult,
  FillBody,
  MyShifts,
  PrintedRota,
  SetCellsBody,
  TemplateBody,
  TemplateUpdateBody,
  TemplateView,
  WeekView,
} from '../types/rota-types';

/** Every Rota endpoint (T1 to T5, G1 to G7), one function each. Screens never build a path. There is no publish endpoint: edits are live. */

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const BASE = '/workforce/rota';

/** `?a=1&b=2` from the defined values only. */
export function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const pairs = Object.entries(params).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== '');
  if (pairs.length === 0) return '';
  return `?${pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}`;
}

export interface WeekQuery {
  weekStart: string;
  siteId?: string;
  departmentId?: string;
}

export const rotaReads = {
  /** T1 */
  templates: async (query: { siteId?: string; weekStart?: string; includeRetired?: boolean } = {}): Promise<TemplateView[]> => {
    const answer = await apiClient.get<{ templates: TemplateView[]; weekStart: string }>(
      `${BASE}/templates${queryString({ siteId: query.siteId, weekStart: query.weekStart, includeRetired: query.includeRetired ? true : undefined })}`,
      token()
    );
    return answer.templates;
  },
  /** G1 */
  week: (query: WeekQuery): Promise<WeekView> => apiClient.get(`${BASE}/week${queryString({ weekStart: query.weekStart, siteId: query.siteId, departmentId: query.departmentId })}`, token()),
  /** G2 */
  print: (query: WeekQuery): Promise<PrintedRota> => apiClient.get(`${BASE}/week/print${queryString({ weekStart: query.weekStart, siteId: query.siteId, departmentId: query.departmentId })}`, token()),
  /** G3 */
  mine: (query: { from?: string; to?: string } = {}): Promise<MyShifts> => apiClient.get(`${BASE}/mine${queryString({ from: query.from, to: query.to })}`, token()),
};

export const rotaWrites = {
  /** T2 */
  createTemplate: (body: TemplateBody): Promise<TemplateView> => apiClient.post(`${BASE}/templates`, body, token()),
  /** T3 */
  updateTemplate: (id: string, body: TemplateUpdateBody): Promise<TemplateView> => apiClient.patch(`${BASE}/templates/${id}`, body, token()),
  /** T4 */
  retireTemplate: (id: string): Promise<TemplateView> => apiClient.post(`${BASE}/templates/${id}/retire`, {}, token()),
  /** T5 */
  restoreTemplate: (id: string): Promise<TemplateView> => apiClient.post(`${BASE}/templates/${id}/restore`, {}, token()),
  /** G4: set or clear any cells (an empty `templateIds` is a day off). */
  setCells: (body: SetCellsBody): Promise<ApplyResult> => apiClient.put(`${BASE}/cells`, body, token()),
  /** G5: the brush, one shift (or a day off) across people and days. */
  fill: (body: FillBody): Promise<ApplyResult> => apiClient.post(`${BASE}/fill`, body, token()),
  /** G6: what "start from last week" would do; writes nothing. */
  copyPreview: (body: CopyBody): Promise<CopyPreview> => apiClient.post(`${BASE}/copy/preview`, body, token()),
  /** G7: fills empty cells only; returns the clashes left out. */
  copy: (body: CopyBody): Promise<CopyResult> => apiClient.post(`${BASE}/copy`, body, token()),
};
