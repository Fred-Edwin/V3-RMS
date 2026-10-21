'use client';

import { useCallback } from 'react';

import { useAuthStore } from '@/store/authStore';
import { useRemote, useWorkforceNudge, type Remote } from '../../../_shared';
import { roleHomeReads } from '../services/role-home-services';
import type { HomeView } from '../types/role-home-types';

/**
 * The person's Home. It asks again on the Needs you and notification nudges, when the tab returns and every minute. A failed refresh
 * keeps the last answer on screen (the screen greys it) and reports the error. The key is the person, so a new sign-in never shows
 * the last person's numbers.
 */
export function useRoleHome(): Remote<HomeView> {
  const userId = useAuthStore((s) => s.user?.id ?? 'none');
  const remote = useRemote<HomeView>(() => roleHomeReads.home(), userId, userId !== 'none');
  const { reload } = remote;
  const again = useCallback(() => reload(), [reload]);
  useWorkforceNudge(['workforce:needs-you', 'workforce:notifications'], again, userId !== 'none');
  return remote;
}
