'use client';

import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import { useRemote, useWorkforcePermissions } from '../../../_shared';

interface OrgDepartment {
  id: string;
  name: string;
  isActive: boolean;
}
interface OrgBlock {
  id: string;
  departments: OrgDepartment[];
}

/**
 * The departments of the site being looked at, for the Calendar's Department filter. Read from the Organisation overview (the one
 * place departments are listed). A reader who may not see Organisation gets an empty list, so the filter simply is not offered.
 */
export function useDepartments(siteId: string | undefined): { id: string; name: string }[] {
  const permissions = useWorkforcePermissions();
  const own = permissions.siteId;
  const target = siteId ?? own ?? undefined;
  const remote = useRemote(
    async () => {
      const token = useAuthStore.getState().accessToken ?? undefined;
      const overview = await apiClient.get<{ organizations: OrgBlock[] }>('/workforce/org', token);
      return overview.organizations.filter((o) => !target || o.id === target).flatMap((o) => o.departments).filter((d) => d.isActive).map((d) => ({ id: d.id, name: d.name }));
    },
    `leave-departments:${target ?? 'all'}`,
    permissions.ready
  );
  return remote.data ?? [];
}
