import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import type { HomeView, NeedsYouPage, NeedsYouPageQuery } from '../types/role-home-types';

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;

export const roleHomeReads = {
  home: (): Promise<HomeView> => apiClient.get('/workforce/home', token()),
  needsYouPage: (q: NeedsYouPageQuery): Promise<NeedsYouPage> => {
    const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize) });
    if (q.q.trim()) params.set('q', q.q.trim());
    if (q.group) params.set('group', q.group);
    if (q.siteId) params.set('siteId', q.siteId);
    return apiClient.get(`/workforce/needs-you/page?${params.toString()}`, token());
  },
};
