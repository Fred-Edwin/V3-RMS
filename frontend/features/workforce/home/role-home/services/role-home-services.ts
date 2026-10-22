import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import type { HomeView, NeedsYouPage, NeedsYouPageQuery } from '../types/role-home-types';

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;

/** What the API sends for the See all page: its wire names still say "organization" for a Site (`wire-names.ts` on the back end). */
interface NeedsYouPageWire extends Omit<NeedsYouPage, 'sites' | 'rows'> {
  organizations: NeedsYouPage['sites'];
  rows: Array<Omit<NeedsYouPage['rows'][number], 'siteId' | 'siteName'> & { organizationId: string | null; organizationName: string | null }>;
}

/** The screen speaks of sites; only this function knows the wire's older word. */
export const needsYouPageFromWire = ({ organizations, rows, ...rest }: NeedsYouPageWire): NeedsYouPage => ({
  ...rest,
  sites: organizations ?? [],
  rows: rows.map(({ organizationId, organizationName, ...row }) => ({ ...row, siteId: organizationId, siteName: organizationName })),
});

export const roleHomeReads = {
  home: (): Promise<HomeView> => apiClient.get('/workforce/home', token()),
  needsYouPage: (q: NeedsYouPageQuery): Promise<NeedsYouPage> => {
    const params = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize) });
    if (q.q.trim()) params.set('q', q.q.trim());
    if (q.group) params.set('group', q.group);
    if (q.siteId) params.set('siteId', q.siteId);
    return apiClient.get<NeedsYouPageWire>(`/workforce/needs-you/page?${params.toString()}`, token()).then(needsYouPageFromWire);
  },
};
