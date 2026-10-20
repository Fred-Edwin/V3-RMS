import { apiClient } from '@/lib/apiClient';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';

import type { FileBlob, NewCasualBody, PutLinesBody, Sheet, SheetCard, Waiting, Worker } from '../types/casual-types';

/** One function per endpoint of API_CONTRACT §42 (Casual pay) that the phone uses. */
const BASE = '/workforce/casuals';
const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const qs = (q: Record<string, string | undefined>): string => {
  const parts = Object.entries(q).filter((e): e is [string, string] => Boolean(e[1])).map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

/** A PDF. Nothing is kept: the caller shows or saves it, then drops it. */
async function file(path: string, fallback: string): Promise<FileBlob> {
  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, { cache: 'no-store', credentials: 'include', headers: { Authorization: `Bearer ${token() ?? ''}` } });
  } catch {
    throw new ApiError('No signal.', 0, 'NETWORK');
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null;
    throw new ApiError(payload?.error?.message ?? 'Request failed', response.status, payload?.error?.code ?? 'UNKNOWN_ERROR');
  }
  return { blob: await response.blob(), filename: /filename="?([^";]+)"?/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? fallback };
}

export const casualReads = {
  day: (siteId: string, departmentId: string, date: string): Promise<Sheet> => apiClient.get(`${BASE}/sheets${qs({ siteId, departmentId, date })}`, token()),
  sheet: (id: string): Promise<Sheet> => apiClient.get(`${BASE}/sheets/${id}`, token()),
  people: (siteId: string, departmentId: string, q?: string): Promise<Worker[]> => apiClient.get(`${BASE}/people${qs({ siteId, departmentId, q })}`, token()),
  waiting: (): Promise<Waiting> => apiClient.get(`${BASE}/sheets/waiting`, token()),
  recent: (siteId: string, departmentId?: string): Promise<SheetCard[]> => apiClient.get(`${BASE}/sheets/recent${qs({ siteId, departmentId })}`, token()),
  preview: (id: string): Promise<FileBlob> => file(`${BASE}/sheets/${id}/preview`, 'CPS-draft.pdf'),
  document: (id: string): Promise<FileBlob> => file(`${BASE}/sheets/${id}/document`, 'Casual-pay-sheet.pdf'),
};

interface Versioned {
  version: number;
  idempotencyKey: string;
}

export const casualWrites = {
  /** C7: `409 CASUAL_EXISTS` carries the existing record. */
  addPerson: (body: NewCasualBody): Promise<Worker> => apiClient.post(`${BASE}/people`, body, token()),
  /** C2: finds or makes the day's sheet. Safe to send twice with the same key. */
  putLines: (body: PutLinesBody): Promise<Sheet> => apiClient.put(`${BASE}/sheets/lines`, body, token()),
  send: (id: string, body: Versioned): Promise<Sheet> => apiClient.post(`${BASE}/sheets/${id}/send`, body, token()),
  takeBack: (id: string, body: Versioned): Promise<Sheet> => apiClient.post(`${BASE}/sheets/${id}/take-back`, body, token()),
  approve: (id: string, body: Versioned & { pin: string; expectedTotal: string }): Promise<Sheet> => apiClient.post(`${BASE}/sheets/${id}/approve`, body, token()),
  sendBack: (id: string, body: Versioned & { reason: string }): Promise<Sheet> => apiClient.post(`${BASE}/sheets/${id}/send-back`, body, token()),
  void: (id: string, body: Versioned & { reason: string; pin: string }): Promise<Sheet> => apiClient.post(`${BASE}/sheets/${id}/void`, body, token()),
  receive: (id: string, lineId: string, body: { name: string; idempotencyKey: string }): Promise<Sheet> => apiClient.post(`${BASE}/sheets/${id}/lines/${lineId}/receive`, body, token()),
};
