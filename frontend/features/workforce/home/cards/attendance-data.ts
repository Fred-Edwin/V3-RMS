'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { useWorkforcePermissions, type WorkforceKpiCell } from '../../_shared';
import { dayWords, kpiCells, lookItems, useBoard, useMyDay, withWorked, type Board } from '../../attendance';
import type { WaitingItem } from '../components/waiting-for-you';
import type { CardDataState } from '../lib/card-registry';
import type { WaitingData } from './branch-cards';
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
function useHomeBoard(): { board: Board | null; reload: () => void; failed: boolean; loading: boolean } {
  const remote = useBoard(undefined, undefined, true);
  return { board: remote.data, reload: remote.reload, failed: remote.status === 'error' && !remote.data, loading: remote.status === 'loading' };
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
  return useMemo((): CardDataState<WeekCardData> => {
    // A branch on the old clock has no phone Home at all; its planned-hours card stays off too.
    if (status === 'ready' && day && !day.enabled) return OFF();
    if (planned.status !== 'ready') return planned;
    return { status: 'ready', data: day ? { ...planned.data, ...withWorked(planned.data, day) } : planned.data };
  }, [planned, status, day]);
}

/** A department head's "team today" (B1 scoped to their departments). */
export function useTeamCardData(): CardDataState<TeamSlot> {
  const { board, reload, failed, loading } = useHomeBoard();
  return useMemo((): CardDataState<TeamSlot> => {
    if (failed) return { status: 'error', retry: reload };
    if (loading || !board) return { status: 'loading' };
    if (!board.enabled) return OFF();
    return { status: 'ready', data: { live: { board, reload } } };
  }, [board, reload, failed, loading]);
}

/** The branch strip: on shift, late, not in, on leave. */
export function useBranchKpis(): CardDataState<KpiData> {
  const router = useRouter();
  const { board, reload, failed, loading } = useHomeBoard();
  return useMemo((): CardDataState<KpiData> => {
    if (failed) return { status: 'error', retry: reload };
    if (loading || !board) return { status: 'loading' };
    if (!board.enabled) return OFF();
    const go = (): void => router.push('/app/workforce/today');
    const cells: WorkforceKpiCell[] = kpiCells(board, { late: go, notIn: go });
    return { status: 'ready', data: { cells } };
  }, [board, reload, failed, loading, router]);
}

/** The board itself on the Branch Manager's Home. */
export function useBoardCardData(): CardDataState<{ live: { board: Board; reload: () => void } }> {
  const { board, reload, failed, loading } = useHomeBoard();
  return useMemo((): CardDataState<{ live: { board: Board; reload: () => void } }> => {
    if (failed) return { status: 'error', retry: reload };
    if (loading || !board) return { status: 'loading' };
    if (!board.enabled) return OFF();
    return { status: 'ready', data: { live: { board, reload } } };
  }, [board, reload, failed, loading]);
}

/** "Waiting for you" gets the shifts the phone closed for a manager to put right; approvals join it in slice 4. */
export function useWaitingCardData(): CardDataState<WaitingData> {
  const router = useRouter();
  const { can } = useWorkforcePermissions();
  const canFix = can('time.fix');
  const { board, reload, failed, loading } = useHomeBoard();
  return useMemo((): CardDataState<WaitingData> => {
    if (failed) return { status: 'error', retry: reload };
    if (loading || !board) return { status: 'loading' };
    if (!board.enabled || !canFix) return OFF();
    const items: WaitingItem[] = lookItems(board)
      .filter((i) => i.kind === 'AUTO_CLOSED')
      .map((i) => ({
        key: i.key,
        title: `Shift closed by the phone · ${i.name}`,
        detail: `${dayWords(i.date)}. ${i.name.split(/\s+/)[0] ?? i.name} did not answer the end-of-shift question.`,
        kind: 'request',
        actions: [{ label: 'Review', kind: 'primary', onClick: () => router.push(`/app/workforce/today?review=${encodeURIComponent(i.entryId)}&employee=${encodeURIComponent(i.employeeId)}&date=${i.date}`) }],
      }));
    return { status: 'ready', data: { items } };
  }, [board, reload, failed, loading, canFix, router]);
}
