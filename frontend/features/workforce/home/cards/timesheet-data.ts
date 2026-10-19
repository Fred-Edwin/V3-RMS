'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';

import { useRemote, useWorkforcePermissions, type ComingUpEvent } from '../../_shared';
import { attendanceReads } from '../../attendance';
import { dayMonth, hmWords, plainName, requestTitle, monthReads, shortCompare, timesheetReads, waitingWords, type InboxRequest, type OvertimeListItem } from '../../timesheets';
import type { AttentionItem } from '../components/attention-list';
import type { WaitingItem } from '../components/waiting-for-you';
import type { CardDataState } from '../lib/card-registry';

/**
 * The Home cards Timesheets (slice 4a) feeds: "Report a problem" on HR's Needs your attention, overtime and requests in Waiting for you,
 * and when the timesheets close in Coming up. Each asks only the branches whose new clock is on (a branch that is off has no timesheets, so
 * nothing is asked of it and nothing appears). While the answer is on its way the card is "loading"; a failure is the card's own error.
 */

interface Waiting {
  requests: InboxRequest[];
  overtime: OvertimeListItem[];
  closes: { branch: string; approvableFrom: string }[];
}

/** The first day a month can be approved: the day after its last day ("2026-10" becomes "2026-11-01"). */
const dayAfterMonth = (monthKey: string): string => new Date(Date.UTC(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 1)).toISOString().slice(0, 10);

/** The branches to ask: every branch with the new clock on for a company-wide role, else the person's own (undefined). */
async function branchesToAsk(wide: boolean): Promise<{ id: string | undefined; name: string }[]> {
  if (!wide) return [{ id: undefined, name: '' }];
  return (await attendanceReads.switches()).filter((s) => s.enabled).map((s) => ({ id: s.organizationId, name: s.organizationName }));
}

async function loadWaiting(wide: boolean, readsOvertime: boolean): Promise<Waiting> {
  const parts = await Promise.all(
    (await branchesToAsk(wide)).map(async (b) => {
      const [requests, overtime, months] = await Promise.all([
        timesheetReads.inbox('WAITING', undefined, 1, 10, b.id),
        readsOvertime ? timesheetReads.overtime('PENDING', b.id) : Promise.resolve({ rows: [] as OvertimeListItem[] }),
        monthReads.list(b.id, 1, 5),
      ]);
      const open = months.months.find((m) => m.state === 'OPEN');
      return { requests: requests.rows, overtime: overtime.rows, close: open ? { branch: b.name, approvableFrom: dayAfterMonth(open.monthKey) } : null };
    })
  );
  return { requests: parts.flatMap((p) => p.requests), overtime: parts.flatMap((p) => p.overtime), closes: parts.flatMap((p) => (p.close ? [p.close] : [])) };
}

/** The three cards that read this ask at the same moment, so one answer is shared for a few seconds instead of three requests. */
const SHARE_MS = 10_000;
let shared: { key: string; at: number; promise: Promise<Waiting> } | null = null;
function loadShared(key: string, wide: boolean, readsOvertime: boolean): Promise<Waiting> {
  if (shared && shared.key === key && Date.now() - shared.at < SHARE_MS) return shared.promise;
  const promise = loadWaiting(wide, readsOvertime);
  shared = { key, at: Date.now(), promise };
  promise.catch(() => {
    if (shared?.promise === promise) shared = null;
  });
  return promise;
}

/** One read for the three cards; each card picks its part. */
function useTimesheetWaiting(): { data: Waiting | null; failed: boolean; reload: () => void } {
  const permissions = useWorkforcePermissions();
  const readable = permissions.ready && permissions.can('timesheet.read');
  const wide = permissions.scopeOf('timesheet.read') === 'all';
  const overtime = permissions.can('overtime.approve');
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const key = `home-timesheets:${userId}:${wide}:${overtime}`;
  const remote = useRemote(() => loadShared(key, wide, overtime), key, readable);
  return { data: remote.data, failed: remote.status === 'error' && !remote.data, reload: remote.reload };
}

const ageWords = (days: number): string => (days === 0 ? 'TODAY' : `${days} ${days === 1 ? 'DAY' : 'DAYS'}`);

/** HR's "Report a problem" rows: what people reported, oldest first, the ones that have gone to HR marked late. */
export function useRequestAttention(): CardDataState<readonly AttentionItem[]> {
  const waiting = useTimesheetWaiting();
  const router = useRouter();
  const { data, failed, reload } = waiting;
  return useMemo((): CardDataState<readonly AttentionItem[]> => {
    if (failed) return { status: 'error', retry: reload };
    if (!data) return { status: 'loading' };
    const items: AttentionItem[] = data.requests.map((r) => ({
      key: `request-${r.id}`,
      kind: 'report',
      title: `Report a problem · ${plainName(r.person.name)}`,
      detail: `${requestTitle(r.kind, r.requested, r.shiftDate)}. ${shortCompare(r)}`,
      age: ageWords(r.waitingDays),
      late: r.escalatedToHr,
      action: { label: 'Open', onClick: () => router.push('/app/workforce/requests') },
    }));
    return { status: 'ready', data: items };
  }, [data, failed, reload, router]);
}

/** Overtime and requests waiting on a manager, as Waiting for you shows them. Empty for a branch whose clock is off. */
export function useTimesheetWaitingItems(): CardDataState<readonly WaitingItem[]> {
  const { data, failed, reload } = useTimesheetWaiting();
  const router = useRouter();
  return useMemo((): CardDataState<readonly WaitingItem[]> => {
    if (failed) return { status: 'error', retry: reload };
    if (!data) return { status: 'loading' };
    const overtime: WaitingItem[] = data.overtime.map((o) => ({
      key: `overtime-${o.id}`,
      title: `Overtime · ${plainName(o.person.name)}`,
      detail: `${dayMonth(o.shiftDate)}, ${hmWords(o.needsMinutes)} waiting for your answer.`,
      kind: 'overtime',
      actions: [{ label: 'Review', kind: 'primary', onClick: () => router.push('/app/workforce/timesheets') }],
    }));
    const requests: WaitingItem[] = data.requests.map((r) => ({
      key: `request-${r.id}`,
      title: `${requestTitle(r.kind, r.requested, r.shiftDate)} · ${plainName(r.person.name)}`,
      detail: `${waitingWords(r)}. ${shortCompare(r)}`,
      kind: 'request',
      actions: [{ label: 'Review', kind: 'primary', onClick: () => router.push('/app/workforce/requests') }],
    }));
    return { status: 'ready', data: [...overtime, ...requests] };
  }, [data, failed, reload, router]);
}

/** "Timesheet ready to approve" for each branch whose month is open: the first day the manager can approve it. Nothing closes by itself. */
export function useTimesheetCloseEvents(): CardDataState<readonly ComingUpEvent[]> {
  const { data, failed, reload } = useTimesheetWaiting();
  return useMemo((): CardDataState<readonly ComingUpEvent[]> => {
    if (failed) return { status: 'error', retry: reload };
    if (!data) return { status: 'loading' };
    return { status: 'ready', data: data.closes.map((c) => ({ key: `close-${c.branch}-${c.approvableFrom}`, date: dayMonth(c.approvableFrom).toUpperCase(), text: `Timesheet ready to approve${c.branch ? ` · ${c.branch}` : ''}` })) };
  }, [data, failed, reload]);
}
