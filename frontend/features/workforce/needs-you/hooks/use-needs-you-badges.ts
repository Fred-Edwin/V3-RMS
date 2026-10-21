'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuthStore } from '@/store/authStore';
import { useWorkforceNudge } from '../../_shared';
import { needsYouReads } from '../services/needs-you-services';
import type { NeedsYouBadges } from '../types/needs-you-types';

const NONE: NeedsYouBadges = { 'workforce-timesheets': 0, 'workforce-leave': 0, 'workforce-conduct': 0, 'workforce-payroll': 0, 'workforce-security': 0 };
const KEYS = Object.keys(NONE) as Array<keyof NeedsYouBadges>;

export interface NeedsYouMenuCounts {
  /** What waits, per menu link. */
  badges: NeedsYouBadges;
  /** How many of those are overdue: a link with any is drawn with the red-brown dot. */
  overdue: NeedsYouBadges;
}

const EMPTY: NeedsYouMenuCounts = { badges: NONE, overdue: NONE };

/**
 * The numbers on the Workforce menu links, and which of them hold something overdue. They come from `GET /workforce/needs-you/counts`,
 * which counts the same rows the card lists, so a badge cannot disagree with its card. `enabled` false asks nothing and answers no
 * badges (the person holds no `needs_you.read`). A failed call keeps the last numbers: a badge never invents a count. The returned
 * object keeps its identity until a number changes.
 */
export function useNeedsYouMenuCounts(enabled: boolean): NeedsYouMenuCounts {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [counts, setCounts] = useState<{ userId: string; value: NeedsYouMenuCounts } | null>(null);

  const load = useCallback((): void => {
    if (!userId) return;
    needsYouReads.counts().then(
      (answer) =>
        setCounts((prev) => {
          const overdue = { ...NONE, ...(answer.overdue ?? {}) };
          const same = prev && prev.userId === userId && KEYS.every((k) => prev.value.badges[k] === (answer.badges[k] ?? 0) && prev.value.overdue[k] === overdue[k]);
          return same ? prev : { userId, value: { badges: { ...NONE, ...answer.badges }, overdue } };
        }),
      () => {
        // Non-critical: the menu keeps the last numbers it had.
      }
    );
  }, [userId]);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);
  useWorkforceNudge(['workforce:needs-you'], load, enabled);

  return enabled && counts !== null && counts.userId === userId ? counts.value : EMPTY;
}

/** Only the numbers (the Inbox and tests read this one). */
export const useNeedsYouBadges = (enabled: boolean): NeedsYouBadges => useNeedsYouMenuCounts(enabled).badges;
