'use client';

import { useMemo } from 'react';

import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import { useRemote, type Remote } from '../../../_shared';
import { addDay, nairobiDay, orderDays, type DigestDay } from '../lib/digest';

/** The last 7 days of openings, newest day first. The server allows at most 31 days; the card asks for 7. */
export function usePayslipOpens(): Remote<{ days: DigestDay[] }> {
  const today = useMemo(() => nairobiDay(new Date()), []);
  return useRemote(
    async () => {
      const token = useAuthStore.getState().accessToken ?? undefined;
      const answer = await apiClient.get<{ days: DigestDay[] }>(`/workforce/payslips/opens?from=${addDay(today, -6)}&to=${today}`, token);
      return { days: orderDays(answer.days) };
    },
    `payslip-opens:${today}`
  );
}
