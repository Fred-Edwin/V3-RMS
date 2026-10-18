'use client';

import { useRemote, type Remote } from '../../../_shared';
import { attendanceReads } from '../../_shared/services/attendance-services';
import type { DayHistory, LatenessReport } from '../../_shared/types/attendance-types';

/** One person's day with every clock event (F1). `enabled` false (no person chosen, or no right to read time) asks nothing. */
export const useDayHistory = (employeeId: string | null, date: string, enabled: boolean): Remote<DayHistory> =>
  useRemote(() => attendanceReads.day(employeeId ?? '', date), `day:${employeeId ?? ''}:${date}`, enabled && employeeId !== null);

/** One person's late days over a stretch (L1), for the line "Late N days this month" in their drawer. */
export const useLateness = (employeeId: string | null, from: string, to: string, enabled: boolean): Remote<LatenessReport> =>
  useRemote(() => attendanceReads.lateness(from, to, employeeId ?? undefined), `late:${employeeId ?? ''}:${from}:${to}`, enabled && employeeId !== null);
