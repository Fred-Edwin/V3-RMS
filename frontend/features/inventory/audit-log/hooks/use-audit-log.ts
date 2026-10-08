import { useMemo } from 'react';

import type { DateRange } from '@/components/ui2/date-range-picker';
import { useLoader } from '../../_shared/hooks/use-async';
import { getAuditLog } from '../../services';
import { rangeToApi } from '../lib/audit-log-logic';
import type { AuditArea } from '../types/audit-log';

export interface AuditLogFilters {
  area: AuditArea | null;
  actorId: string | null;
  branchId: string | null;
  /** The Nairobi days shown (both included). */
  range: DateRange;
  page: number;
  /** Rows per page: 25, 50 or 100 (UI_BUILD_RULES §4a). */
  perPage: number;
}

/**
 * The Audit log page for the filters. The range is turned into the API's timestamps from its two days only, so the same range does
 * not reload itself every render; only the latest request writes state (see `useLoader`).
 */
export function useAuditLog(filters: AuditLogFilters, enabled: boolean) {
  const { area, actorId, branchId, range, page, perPage } = filters;
  const { from: rangeFrom, to: rangeTo } = range;
  const key = enabled ? JSON.stringify([area, actorId, branchId, rangeFrom, rangeTo, page, perPage]) : null;
  const api = useMemo(() => rangeToApi({ from: rangeFrom, to: rangeTo }), [rangeFrom, rangeTo]);
  return useLoader(
    key,
    () => getAuditLog({ area: area ?? undefined, actorId: actorId ?? undefined, branchId: branchId ?? undefined, from: api.from, to: api.to, page, perPage }),
    'Could not load the audit log. Try again.'
  );
}
