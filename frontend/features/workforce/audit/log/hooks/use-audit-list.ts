'use client';

import { useCallback } from 'react';

import { useRemote } from '../../../_shared';
import { auditReads } from '../services/audit-log-services';
import type { AuditPage, AuditQuery } from '../types/audit-log-types';

/**
 * One page of the log for the view in the address bar. The key is the whole query, so a change of any filter reads again while the old
 * page stays on screen (no flash); `reload` asks again for the same view ("Try again").
 */
export function useAuditList(query: AuditQuery, key: string) {
  const list = useRemote<AuditPage>(() => auditReads.list(query), `audit:${key}`);
  const { reload } = list;
  const retry = useCallback((): void => reload(), [reload]);
  return { list, retry };
}
