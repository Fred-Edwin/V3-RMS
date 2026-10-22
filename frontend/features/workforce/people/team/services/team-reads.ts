import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import { queryString } from '../../_shared/services/people-reads';
import type { Pagination } from '../../_shared/types/people-types';
import type { TeamCounts, TeamMember, TeamQuery } from '../types/team-types';

export interface TeamPage {
  people: TeamMember[];
  counts: TeamCounts;
  pagination: Pagination;
}

/** `GET /workforce/people/team`: the people a head leads (a manager's whole site), read only. */
export const teamReads = {
  async list(query: TeamQuery): Promise<TeamPage> {
    const token = useAuthStore.getState().accessToken ?? undefined;
    const envelope = await apiClient.getWithEnvelope<{ people: TeamMember[]; counts: TeamCounts }>(`/workforce/people/team${queryString({ page: query.page, perPage: query.perPage, q: query.q, status: query.status })}`, token);
    const people = envelope.data?.people ?? [];
    return {
      people,
      counts: envelope.data?.counts ?? { all: people.length, onShift: 0, notOnShift: 0 },
      pagination: envelope.pagination ?? { total: people.length, page: 1, perPage: people.length, totalPages: 1 },
    };
  },
};
