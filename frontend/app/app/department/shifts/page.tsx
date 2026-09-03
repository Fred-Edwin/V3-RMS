'use client';

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { DepartmentScheduler } from '@/components/department/DepartmentScheduler';
import ManagerShiftPage from '../../manage/shifts/page';

/**
 * The department head's shift scheduler (marker model, 2026-09-03).
 *
 * - Phone / narrow: a day-first scheduler purpose-built for a head on the
 *   floor (Paper: `Department Scheduler (Dept Head, Mobile)`).
 * - Desktop (lg+): the existing Manager shift week-grid, which already trims
 *   itself for a department head (no branch picker, schedule tab only, roster
 *   filtered to the head's department) via the `isDepartmentHead` store flag.
 *   Reused as-is — the grid is not rebuilt (Paper: desktop artboard is
 *   reference-only).
 */
export default function DepartmentShiftsPage(): JSX.Element | null {
  const { matches: isDesktop, hydrated } = useMediaQuery('(min-width: 1024px)');

  // Hold until we know the viewport — mounting the wrong subtree would fire a
  // wasted round of data loads.
  if (!hydrated) return null;
  return isDesktop ? <ManagerShiftPage /> : <DepartmentScheduler />;
}
