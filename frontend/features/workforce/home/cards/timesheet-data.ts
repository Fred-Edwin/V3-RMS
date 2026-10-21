'use client';

import { useMemo } from 'react';

import { useAuthStore } from '@/store/authStore';

import { useRemote, useWorkforcePermissions, type ComingUpEvent } from '../../_shared';
import { attendanceReads } from '../../attendance';
import { dayMonth, monthReads } from '../../timesheets';
import type { CardDataState } from '../lib/card-registry';

/**
 * The Home card Timesheets (slice 4a) feeds: when the timesheets close, in Coming up. What waits for a person's decision (overtime,
 * requests, month approvals) is no longer read here: the Needs you card lists it from the server (Segment 6a). Only the branches whose new
 * clock is on are asked (a branch that is off has no timesheets, so nothing appears).
 */

interface Closes {
  closes: { branch: string; approvableFrom: string }[];
}

/** The first day a month can be approved: the day after its last day ("2026-10" becomes "2026-11-01"). */
const dayAfterMonth = (monthKey: string): string => new Date(Date.UTC(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 1)).toISOString().slice(0, 10);

/** The branches to ask: every branch with the new clock on for a company-wide role, else the person's own (undefined). */
async function branchesToAsk(wide: boolean): Promise<{ id: string | undefined; name: string }[]> {
  if (!wide) return [{ id: undefined, name: '' }];
  return (await attendanceReads.switches()).filter((s) => s.enabled).map((s) => ({ id: s.organizationId, name: s.organizationName }));
}

async function loadCloses(wide: boolean): Promise<Closes> {
  const parts = await Promise.all(
    (await branchesToAsk(wide)).map(async (b) => {
      const months = await monthReads.list(b.id, 1, 5);
      const open = months.months.find((m) => m.state === 'OPEN');
      return open ? [{ branch: b.name, approvableFrom: dayAfterMonth(open.monthKey) }] : [];
    })
  );
  return { closes: parts.flat() };
}

/** "Timesheet ready to approve" for each branch whose month is open: the first day the manager can approve it. Nothing closes by itself. */
export function useTimesheetCloseEvents(): CardDataState<readonly ComingUpEvent[]> {
  const permissions = useWorkforcePermissions();
  const readable = permissions.ready && permissions.can('timesheet.read');
  const wide = permissions.scopeOf('timesheet.read') === 'all';
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const key = `home-closes:${userId}:${wide}`;
  const remote = useRemote(() => loadCloses(wide), key, readable);
  const { data, reload } = remote;
  const failed = remote.status === 'error' && !data;
  return useMemo((): CardDataState<readonly ComingUpEvent[]> => {
    if (failed) return { status: 'error', retry: reload };
    if (!data) return { status: 'loading' };
    return { status: 'ready', data: data.closes.map((c) => ({ key: `close-${c.branch}-${c.approvableFrom}`, date: dayMonth(c.approvableFrom).toUpperCase(), text: `Timesheet ready to approve${c.branch ? ` · ${c.branch}` : ''}` })) };
  }, [data, failed, reload]);
}
