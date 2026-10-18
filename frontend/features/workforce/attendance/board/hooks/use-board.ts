'use client';

import { useEffect } from 'react';

import { useRemote, type Remote } from '../../../_shared';
import { attendanceReads } from '../../_shared/services/attendance-services';
import type { Board } from '../../_shared/types/attendance-types';

const POLL_MS = 30_000;

/**
 * The Today board (B1) as a `Remote`. Asked again every 30 seconds when it shows today, so "who is in" stays live without a push.
 * `enabled` waits for the permissions so a screen never flashes "no access".
 */
export function useBoard(date: string | undefined, siteId: string | undefined, live: boolean, enabled = true): Remote<Board> {
  const remote = useRemote(() => attendanceReads.board(date, siteId), `board:${date ?? 'today'}:${siteId ?? ''}`, enabled);
  const reload = remote.reload;
  useEffect(() => {
    if (!enabled || !live) return;
    const id = setInterval(reload, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, live, reload]);
  return remote;
}
