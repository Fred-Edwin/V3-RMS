import { apiClient } from '@/lib/apiClient';
import { deviceHeader } from '@/lib/device-id';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';

import type { AuditDetail, AuditPage, AuditQuery, AuditViewer, ChainCheck } from '../types/audit-log-types';

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const BASE = '/workforce/audit';

/** The query string the list and the export share. Empty values are left out (the API refuses unknown keys, not empty ones). */
export function filterParams(q: Omit<AuditQuery, 'page' | 'pageSize'>): URLSearchParams {
  const p = new URLSearchParams();
  if (q.q.trim()) p.set('q', q.q.trim());
  if (q.area) p.set('area', q.area);
  if (q.event !== 'all') p.set('event', q.event);
  if (q.siteId) p.set('siteId', q.siteId);
  if (q.actorId) p.set('actorId', q.actorId);
  if (q.subjectUserId) p.set('subjectUserId', q.subjectUserId);
  if (q.flagged) p.set('flagged', 'true');
  if (q.from) p.set('from', q.from);
  if (q.to) p.set('to', q.to);
  p.set('sort', q.sort);
  return p;
}

export const auditReads = {
  list: (q: AuditQuery): Promise<AuditPage> => {
    const p = filterParams(q);
    p.set('page', String(q.page));
    p.set('pageSize', String(q.pageSize));
    return apiClient.get(`${BASE}/entries?${p.toString()}`, token());
  },
  detail: (id: string): Promise<AuditDetail> => apiClient.get(`${BASE}/entries/${id}`, token()),
  viewers: (): Promise<AuditViewer[]> => apiClient.get(`${BASE}/viewers`, token()),
  actors: (q: string): Promise<{ id: string; name: string; role: string }[]> => apiClient.get(`${BASE}/actors?q=${encodeURIComponent(q)}`, token()),
};

export const auditWrites = {
  checkChain: (fromSeq: number, toSeq: number): Promise<ChainCheck> => apiClient.post(`${BASE}/chain/check`, { fromSeq, toSeq }, token()),
};

export interface ExportedFile {
  blob: Blob;
  filename: string;
}

/** The CSV of the view. The API writes one `audit.exported` entry before the first byte; a failure here has written nothing to the file. */
export async function downloadExport(q: Omit<AuditQuery, 'page' | 'pageSize'>): Promise<ExportedFile> {
  const response = await fetch(`${env.apiUrl}${BASE}/export?${filterParams(q).toString()}`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
    headers: { ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...deviceHeader() },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null;
    throw new ApiError(payload?.error?.message ?? 'Could not export.', response.status, payload?.error?.code ?? 'EXPORT_FAILED');
  }
  const named = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '');
  return { blob: await response.blob(), filename: named?.[1] ?? 'Audit-log.csv' };
}

/** Hands the file to the browser. */
export function saveFile({ blob, filename }: ExportedFile): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
