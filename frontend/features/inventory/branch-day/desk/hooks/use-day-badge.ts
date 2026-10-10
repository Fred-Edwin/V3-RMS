'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { create } from 'zustand';

import { useAuthStore } from '@/store/authStore';
import { branchDayDeskApi } from '../services/branch-day-desk-api';

interface DayBadgeState {
  /** Things that block the close today; 0 until the first answer (a zero badge draws nothing). */
  count: number;
  /** Whose count this is, so a different person never sees the last person's number. */
  userId: string | null;
  refresh: (userId: string) => Promise<void>;
}

let latest = 0;

/**
 * The number beside Today in the Branch Manager's sidebar (Paper B5, gap G12): what blocks the close now (`summary.todo` of BD11), and
 * nothing once the day is closed or nothing blocks. Only the newest request writes, and a failed refresh keeps the old number (the badge
 * is a hint, not a gate).
 */
const useDayBadgeStore = create<DayBadgeState>((set) => ({
  count: 0,
  userId: null,
  refresh: async (userId) => {
    const request = ++latest;
    try {
      const today = await branchDayDeskApi.today({});
      const blocking = today.day && !today.day.closed ? today.day.summary.todo : 0;
      if (request === latest) set({ count: blocking, userId });
    } catch {
      /* keep the old number */
    }
  },
}));

/**
 * The shell calls this with "this person closes the day". It refetches when the route changes, never on a timer, and for anyone else
 * requests nothing and answers 0. Selecting `refresh` from the store keeps the effect's dependencies stable.
 */
export function useBranchDayBadge(enabled: boolean): number {
  const pathname = usePathname();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const count = useDayBadgeStore((s) => s.count);
  const owner = useDayBadgeStore((s) => s.userId);
  const refresh = useDayBadgeStore((s) => s.refresh);

  React.useEffect(() => {
    if (enabled && userId && accessToken) void refresh(userId);
  }, [enabled, userId, accessToken, pathname, refresh]);

  return enabled && owner === userId ? count : 0;
}

/** Call after a count is signed or the day is closed so the number catches up without leaving the page. */
export function refreshBranchDayBadge(): void {
  const userId = useAuthStore.getState().user?.id;
  if (userId) void useDayBadgeStore.getState().refresh(userId);
}
