'use client';

import { usePathname } from 'next/navigation';

import { usePermissions } from '../../../_shared/hooks/use-permissions';

export type DayView = 'branch' | 'all' | 'none';

/**
 * Who sees which Branch day desktop screen (contract §3), from the server's table only, never a role name: `branch_day.read` is the
 * Branch Manager's own branch, `branch_day.read_any_branch` is every branch read only with a picker (a holder of both, the System Admin,
 * gets the picker). Money needs `catalog.see_costs`. Buttons follow `branch_day.close` and `branch_day.count_on_behalf`, but the
 * response's own `can` decides what a given day allows.
 */
export function useDayAccess(): { ready: boolean; failed: boolean; view: DayView; seesMoney: boolean; canClose: boolean; canCountOnBehalf: boolean; canConfirmOnBehalf: boolean; canCorrect: boolean } {
  const { can, ready, failed } = usePermissions();
  const view: DayView = can('branch_day.read_any_branch') ? 'all' : can('branch_day.read') ? 'branch' : 'none';
  return {
    ready,
    failed,
    view,
    seesMoney: can('catalog.see_costs'),
    canClose: can('branch_day.close'),
    canCountOnBehalf: can('branch_day.count_on_behalf'),
    canConfirmOnBehalf: can('deliveries.confirm_on_behalf'),
    canCorrect: can('branch_day.correct'),
  };
}

/** The Branch Manager's pages live under `/app/branch/day`, the hub roles' under `/app/inventory/branch-day`; the screens are the same. */
export function useDayBase(): '/app/inventory/branch-day' | '/app/branch/day' {
  const pathname = usePathname();
  return pathname.startsWith('/app/inventory/branch-day') ? '/app/inventory/branch-day' : '/app/branch/day';
}
