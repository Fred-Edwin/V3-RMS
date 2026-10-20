'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuthStore } from '@/store/authStore';
import { useWorkforceNudge } from '../../_shared';
import { needsYouReads } from '../services/needs-you-services';
import type { NeedsYouBadges } from '../types/needs-you-types';

const NONE: NeedsYouBadges = { 'workforce-timesheets': 0, 'workforce-leave': 0, 'workforce-conduct': 0, 'workforce-payroll': 0, 'workforce-security': 0 };

/**
 * The numbers on the Workforce menu links. They come from `GET /workforce/needs-you/counts`, which counts the same rows the card lists,
 * so a badge cannot disagree with its card. `enabled` false asks nothing and answers no badges (the person holds no `needs_you.read`).
 * A failed call keeps the last numbers: a badge never invents a count. The returned object keeps its identity until a number changes.
 */
export function useNeedsYouBadges(enabled: boolean): NeedsYouBadges {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [counts, setCounts] = useState<{ userId: string; badges: NeedsYouBadges } | null>(null);

  const load = useCallback((): void => {
    if (!userId) return;
    needsYouReads.counts().then(
      (answer) =>
        setCounts((prev) => {
          const same = prev && prev.userId === userId && (Object.keys(NONE) as Array<keyof NeedsYouBadges>).every((k) => prev.badges[k] === (answer.badges[k] ?? 0));
          return same ? prev : { userId, badges: { ...NONE, ...answer.badges } };
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

  return enabled && counts !== null && counts.userId === userId ? counts.badges : NONE;
}
