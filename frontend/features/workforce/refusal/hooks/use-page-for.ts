'use client';

import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import { useRemote, type Remote } from '../../_shared';
import type { PageFor } from '../types/refusal-types';

/** Who the blocked page is for. `path` null asks nothing. A failure leaves the screen with its plain line (it never blocks the way out). */
export function usePageFor(path: string | null): Remote<PageFor> {
  const token = useAuthStore((s) => s.accessToken) ?? undefined;
  return useRemote<PageFor>(() => apiClient.get(`/workforce/page-for?path=${encodeURIComponent(path ?? '')}`, token), path ?? 'none', path !== null && token !== undefined);
}
