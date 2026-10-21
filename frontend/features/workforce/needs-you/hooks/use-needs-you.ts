'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuthStore } from '@/store/authStore';
import { toRemoteError, useWorkforceNudge, type RemoteError } from '../../_shared';
import { needsYouReads } from '../services/needs-you-services';
import type { NeedsYouList } from '../types/needs-you-types';

export type NeedsYouState =
  | { status: 'loading'; list: null; error: null; reload: () => void }
  | { status: 'ready'; list: NeedsYouList; error: null; reload: () => void }
  | { status: 'error'; list: NeedsYouList | null; error: RemoteError; reload: () => void };

/**
 * The person's Needs you rows, oldest first. It asks again on the `workforce:needs-you` nudge, when the tab comes back, and every
 * minute while it is visible. An answer that fails after one succeeded keeps the old rows on screen (greyed by the caller) and
 * reports the error, so a lost signal never blanks the card. `enabled` false asks nothing (the person holds no `needs_you.read`).
 */
export function useNeedsYou(enabled: boolean): NeedsYouState {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [answer, setAnswer] = useState<{ userId: string; list: NeedsYouList | null; error: RemoteError | null } | null>(null);

  const load = useCallback((): void => {
    if (!userId) return;
    needsYouReads.list().then(
      (list) => setAnswer({ userId, list, error: null }),
      (err: unknown) => setAnswer((prev) => ({ userId, list: prev?.userId === userId ? prev.list : null, error: toRemoteError(err) }))
    );
  }, [userId]);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);
  useWorkforceNudge(['workforce:needs-you'], load, enabled);

  const mine = answer !== null && answer.userId === userId ? answer : null;
  return useMemo((): NeedsYouState => {
    if (mine?.error) return { status: 'error', list: mine.list, error: mine.error, reload: load };
    if (mine?.list) return { status: 'ready', list: mine.list, error: null, reload: load };
    return { status: 'loading', list: null, error: null, reload: load };
  }, [mine, load]);
}
