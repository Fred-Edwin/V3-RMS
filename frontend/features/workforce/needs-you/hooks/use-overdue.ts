'use client';

import { useAuthStore } from '@/store/authStore';
import { useRemote, useWorkforceNudge, type Remote } from '../../_shared';
import { needsYouReads } from '../services/needs-you-services';
import type { OverdueList } from '../types/needs-you-types';

export type OverdueState = Remote<OverdueList>;

/** The Director's Overdue list: anything past 3 days anywhere in the company. `enabled` false asks nothing (no `needs_you.remind`). */
export function useOverdue(enabled: boolean): OverdueState {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const remote = useRemote(() => needsYouReads.overdue(), `overdue:${userId}`, enabled);
  useWorkforceNudge(['workforce:needs-you'], remote.reload, enabled);
  return remote;
}
