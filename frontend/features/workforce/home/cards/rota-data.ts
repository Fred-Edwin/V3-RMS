'use client';

import { useMemo } from 'react';

import { addDays, mondayOf, nairobiToday, useMyShifts, weekPlan } from '../../rota';
import type { CardDataState } from '../lib/card-registry';
import type { WeekCardData } from './phone-cards-defs';

/**
 * The phone "This week" card (Chapter 1 card 05) fed by the Rota: the person's own planned hours, day by day. The answer is the same
 * object until the shifts change, so the page does not re-sort on every render. Worked hours and overtime waiting arrive with Attendance.
 */
export function useThisWeekCard(): CardDataState<WeekCardData> {
  const today = nairobiToday();
  const weekStart = mondayOf(today);
  const mine = useMyShifts(weekStart, addDays(weekStart, 6));
  const shifts = mine.data?.shifts;
  const reload = mine.reload;
  return useMemo((): CardDataState<WeekCardData> => {
    if (mine.status === 'error' && !shifts) return { status: 'error', retry: reload };
    if (!shifts) return { status: 'loading' };
    return { status: 'ready', data: weekPlan(shifts, weekStart, today) };
  }, [mine.status, shifts, reload, weekStart, today]);
}
