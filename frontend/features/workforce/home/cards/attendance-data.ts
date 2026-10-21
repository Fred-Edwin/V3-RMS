'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';

import type { WorkforceKpiCell } from '../../_shared';
import { kpiCells, useBoard, useMyDay, withWorked, type Board } from '../../attendance';
import { hmWords, useMyTime } from '../../timesheets';
import type { CardDataState } from '../lib/card-registry';
import type { KpiData } from './hr-cards';
import { noSource } from './no-source';
import type { ClockSlot, TeamSlot, WeekCardData } from './phone-cards-defs';
import { useThisWeekCard } from './rota-data';

/**
 * The Home cards Attendance feeds. Every one of them answers "no source" when the person's branch is still on the old clock (the
 * server's `enabled`), so a branch that is off sees exactly the Home it saw before. While the answer is on its way the card is "loading".
 */

const OFF = <T>(): CardDataState<T> => noSource<T>()();

/** The live Today board for the Home cards (B1), asked every 30 seconds. */
function useHomeBoard(): { board: Board | null; reload: () => void; failed: boolean; loading: boolean; noSite: boolean } {
  // The System Admin and the Director belong to no branch: there is no board to ask for (the server says SITE_REQUIRED), so the cards leave themselves out.
  const noSite = useAuthStore((s) => s.organizationId === null);
  const remote = useBoard(undefined, undefined, true, !noSite);
  return { board: remote.data, reload: remote.reload, failed: remote.status === 'error' && !remote.data, loading: remote.status === 'loading', noSite };
}

/** The phone clock card (C1): a person on a branch with the new clock on. */
export function useClockCardData(): CardDataState<ClockSlot> {
  const mine = useMyDay();
  const { status, day, reload } = mine;
  return useMemo((): CardDataState<ClockSlot> => {
    if (status === 'loading') return { status: 'loading' };
    if (!day) return { status: 'error', retry: reload };
    if (!day.enabled) return OFF();
    return { status: 'ready', data: { live: { day, reload } } };
  }, [status, day, reload]);
}

/** "This week": the Rota's planned hours, with hours worked added once the new clock is on. */
export function useWeekCardData(): CardDataState<WeekCardData> {
  const planned = useThisWeekCard();
  const mine = useMyDay();
  const { status, day } = mine;
  // Overtime still waiting for a manager's answer (Timesheets, slice 4a); asked only where the new clock is on.
  const time = useMyTime(undefined, status === 'ready' && day !== null && day.enabled);
  const waitingMinutes = time.data?.totals.overtimePendingMinutes ?? 0;
  return useMemo((): CardDataState<WeekCardData> => {
    // A branch on the old clock has no phone Home at all; its planned-hours card stays off too.
    if (status === 'ready' && day && !day.enabled) return OFF();
    if (planned.status !== 'ready') return planned;
    const base = day ? { ...planned.data, ...withWorked(planned.data, day) } : planned.data;
    return { status: 'ready', data: waitingMinutes > 0 ? { ...base, overtimeWaiting: `${hmWords(waitingMinutes)} overtime waiting` } : base };
  }, [planned, status, day, waitingMinutes]);
}

/** A department head's "team today" (B1 scoped to their departments). */
export function useTeamCardData(): CardDataState<TeamSlot> {
  const { board, reload, failed, loading, noSite } = useHomeBoard();
  return useMemo((): CardDataState<TeamSlot> => {
    if (noSite) return OFF();
    if (failed) return { status: 'error', retry: reload };
    if (loading || !board) return { status: 'loading' };
    if (!board.enabled) return OFF();
    return { status: 'ready', data: { live: { board, reload } } };
  }, [board, reload, failed, loading, noSite]);
}

/** The branch strip: on shift, late, not in, on leave. */
export function useBranchKpis(): CardDataState<KpiData> {
  const router = useRouter();
  const { board, reload, failed, loading, noSite } = useHomeBoard();
  return useMemo((): CardDataState<KpiData> => {
    if (noSite) return OFF();
    if (failed) return { status: 'error', retry: reload };
    if (loading || !board) return { status: 'loading' };
    if (!board.enabled) return OFF();
    const go = (): void => router.push('/app/workforce/today');
    const cells: WorkforceKpiCell[] = kpiCells(board, { late: go, notIn: go });
    return { status: 'ready', data: { cells } };
  }, [board, reload, failed, loading, noSite, router]);
}

/** The board itself on the Branch Manager's Home. */
export function useBoardCardData(): CardDataState<{ live: { board: Board; reload: () => void } }> {
  const { board, reload, failed, loading, noSite } = useHomeBoard();
  return useMemo((): CardDataState<{ live: { board: Board; reload: () => void } }> => {
    if (noSite) return OFF();
    if (failed) return { status: 'error', retry: reload };
    if (loading || !board) return { status: 'loading' };
    if (!board.enabled) return OFF();
    return { status: 'ready', data: { live: { board, reload } } };
  }, [board, reload, failed, loading, noSite]);
}

