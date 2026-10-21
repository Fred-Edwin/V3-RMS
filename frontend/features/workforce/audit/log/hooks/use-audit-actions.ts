'use client';

import { useCallback, useState } from 'react';

import { ApiError, formatApiErrorMessage } from '@/types/api';

import { useRemote } from '../../../_shared';
import { AUDIT_COPY } from '../lib/audit-words';
import { auditReads, auditWrites, downloadExport, saveFile } from '../services/audit-log-services';
import type { AuditDetail, AuditQuery, ChainCheck } from '../types/audit-log-types';

/** One entry in full for the drawer. The key is the id, so another row reads again and the old entry never shows under the new title. */
export function useEntryDetail(id: string | null) {
  return useRemote<AuditDetail | null>(() => (id ? auditReads.detail(id) : Promise.resolve(null)), `entry:${id ?? 'none'}`, id !== null);
}

export type ChainState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'intact'; checked: number; toSeq: string }
  | { status: 'broken'; seq: string }
  | { status: 'wait' }
  | { status: 'failed'; message: string };

/**
 * "Check the chain" from entry 1 to the entry on screen. Limits are real: once a minute (429 `CHECK_TOO_SOON`), 200,000 entries a call
 * (400). A break is told plainly and the back end has already written its own entry and told the System Admin.
 */
export function useChainCheck() {
  const [state, setState] = useState<ChainState>({ status: 'idle' });
  const run = useCallback(async (toSeq: string): Promise<void> => {
    setState({ status: 'running' });
    try {
      const result: ChainCheck = await auditWrites.checkChain(1, Number(toSeq));
      setState(result.ok ? { status: 'intact', checked: result.checked, toSeq } : { status: 'broken', seq: result.firstBadSeq ?? toSeq });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CHECK_TOO_SOON') setState({ status: 'wait' });
      else setState({ status: 'failed', message: formatApiErrorMessage(err, 'We could not check the chain. Nothing was changed.') });
    }
  }, []);
  const reset = useCallback((): void => setState({ status: 'idle' }), []);
  return { state, run, reset };
}

/** "Export this view": the file the list is showing (same filters, no page). */
export function useExport() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const run = useCallback(async (query: Omit<AuditQuery, 'page' | 'pageSize'>): Promise<boolean> => {
    setBusy(true);
    setMessage(AUDIT_COPY.exportPreparing);
    try {
      saveFile(await downloadExport(query));
      setMessage(null);
      return true;
    } catch {
      setMessage(AUDIT_COPY.exportFailed);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, message, run, dismiss: () => setMessage(null) };
}
