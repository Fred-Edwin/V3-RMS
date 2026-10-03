import { useMemo } from 'react';

import { useLoader } from '../../_shared/hooks/use-async';
import { getAuditLog } from '../../services';
import { periodStart, type AuditPeriod } from '../lib/audit-log-logic';
import type { AuditArea } from '../types/audit-log';

export interface AuditLogFilters {
  area: AuditArea | null;
  actorId: string | null;
  period: AuditPeriod;
  page: number;
}

const PER_PAGE = 50;

/**
 * The Audit log page for the filters. `now` is taken once per filter change so the same period does not reload itself
 * every render; only the latest request writes state (see `useLoader`).
 */
export function useAuditLog(filters: AuditLogFilters, enabled: boolean) {
  const { area, actorId, period, page } = filters;
  const key = enabled ? JSON.stringify([area, actorId, period, page]) : null;
  const from = useMemo(() => periodStart(period, new Date()), [period]);
  return useLoader(
    key,
    () => getAuditLog({ area: area ?? undefined, actorId: actorId ?? undefined, from, page, perPage: PER_PAGE }),
    'Could not load the audit log. Try again.'
  );
}
