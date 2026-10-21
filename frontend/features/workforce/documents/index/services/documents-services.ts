import { apiClient } from '@/lib/apiClient';
import { deviceHeader } from '@/lib/device-id';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';

import type { DocumentPanelData, DocumentsPage, DocumentsQuery } from '../types/documents-types';

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const BASE = '/workforce/documents';

export function listParams(q: DocumentsQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.q.trim()) p.set('q', q.q.trim());
  if (q.type) p.set('type', q.type);
  if (q.siteId) p.set('siteId', q.siteId);
  if (q.from) p.set('from', q.from);
  if (q.to) p.set('to', q.to);
  p.set('sort', q.sort);
  p.set('page', String(q.page));
  p.set('pageSize', String(q.pageSize));
  return p;
}

export const documentReads = {
  list: (q: DocumentsQuery): Promise<DocumentsPage> => apiClient.get(`${BASE}?${listParams(q).toString()}`, token()),
  panel: (number: string, version: number): Promise<DocumentPanelData> => apiClient.get(`${BASE}/${number}?v=${version}`, token()),
};

/**
 * The method and body the file's own route wants. Payroll, timesheet and P9 files are made on request, so they are POST routes (the
 * documents door stores their address, not their method); the rest are GET. A payroll document opens as its signed summary, a timesheet
 * document as the month's PDF.
 */
export function openRequest(kind: string, openHref: string): { method: 'GET' | 'POST'; body?: unknown } {
  const key = () => `open${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  if (kind === 'PAY') return { method: 'POST', body: { kind: 'SUMMARY', format: 'pdf', idempotencyKey: key() } };
  if (kind === 'TSH') return { method: 'POST', body: { format: 'pdf', scope: 'month', idempotencyKey: key() } };
  if (kind === 'P9' || /\/exports$/.test(openHref)) return { method: 'POST', body: {} };
  return { method: 'GET' };
}

/**
 * "Open document": records the opening (`document.opened`), then fetches the file from its own route. Returns the PDF. A failure is an
 * `ApiError` the screen words as "Could not open the document. Try again."
 */
export async function openDocument(item: Pick<DocumentPanelData, 'number' | 'version' | 'kind'>): Promise<Blob> {
  const opened = await apiClient.post<{ openHref: string | null }>(`${BASE}/${item.number}/open?v=${item.version}`, {}, token());
  if (!opened.openHref) throw new ApiError('Archived.', 410, 'ARCHIVED');
  const { method, body } = openRequest(item.kind, opened.openHref);
  const response = await fetch(`${env.apiUrl}${opened.openHref}`, {
    method,
    cache: 'no-store',
    credentials: 'include',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...deviceHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null;
    throw new ApiError(payload?.error?.message ?? 'Could not open the document.', response.status, payload?.error?.code ?? 'OPEN_FAILED');
  }
  return response.blob();
}
