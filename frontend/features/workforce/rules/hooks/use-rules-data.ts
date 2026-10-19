'use client';

import { useEffect, useState } from 'react';

import { useRemote, type Remote } from '../../_shared';
import { rulesReads } from '../services/rules-services';
import type { AccessTableRow, HistoryAnswer, RuleGroupCode, RulesPageAnswer } from '../types/rules-types';

/** One tab for this viewer. `organizationId` null = the company rule. Asks again when `reload` is called (after a save). */
export function useRulesPage(group: RuleGroupCode, organizationId: string | null, enabled = true): Remote<RulesPageAnswer> {
  return useRemote(() => rulesReads.page(group, organizationId), `page:${group}:${organizationId ?? 'company'}`, enabled);
}

export function useRulesHistory(group: RuleGroupCode, organizationId: string | null, page: number, pageSize: number, enabled = true): Remote<HistoryAnswer> {
  return useRemote(() => rulesReads.history(group, organizationId, page, pageSize), `history:${group}:${organizationId ?? 'company'}:${page}:${pageSize}`, enabled);
}

export function useAccessTable(enabled = true): Remote<{ rows: AccessTableRow[] }> {
  return useRemote(() => rulesReads.accessTable(), 'access-table', enabled);
}

/** The browser's own word on whether it is online (Change is disabled with the reason "No connection" when it is not). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = (): void => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  return online;
}
