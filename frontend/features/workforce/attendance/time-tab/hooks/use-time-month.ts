'use client';

import { useRef } from 'react';

import { useRemote, type Remote } from '../../../_shared';
import { attendanceReads } from '../../_shared/services/attendance-services';
import type { TimeFilter, TimeMonth, TimeTiles } from '../../_shared/types/attendance-types';

/** What the Time tab draws: the answer (kept on screen while a new month or page loads) and the raw state. */
export interface TimeMonthView {
  remote: Remote<TimeMonth>;
  /** The last good answer. The month picker, chips and figures stay up while the days underneath load. */
  shown: TimeMonth | null;
  /** True while a new answer is on its way and an old one is on screen. */
  refreshing: boolean;
}

export interface TimeMonthQuery {
  employeeId: string;
  month: string;
  filter: TimeFilter;
  page: number;
  pageSize: number;
}

/** T1 as a `Remote`, keyed by the whole query so a new month, chip or page asks again. */
export function useTimeMonth(q: TimeMonthQuery, enabled = true): TimeMonthView {
  const remote = useRemote(() => attendanceReads.timeMonth(q.employeeId, q.month, q.filter, q.page, q.pageSize), `time:${q.employeeId}:${q.month}:${q.filter}:${q.page}:${q.pageSize}`, enabled);
  const last = useRef<TimeMonth | null>(null);
  if (remote.data) last.current = remote.data;
  // Another person's file must never show this person's days while it loads.
  if (last.current && last.current.employeeId !== q.employeeId) last.current = null;
  return { remote, shown: remote.data ?? last.current, refreshing: remote.status === 'loading' && last.current !== null };
}

/** T2 as a `Remote`: the Overview tiles. */
export function useTimeTiles(employeeId: string, enabled = true): Remote<TimeTiles> {
  return useRemote(() => attendanceReads.timeTiles(employeeId), `time-tiles:${employeeId}`, enabled);
}
