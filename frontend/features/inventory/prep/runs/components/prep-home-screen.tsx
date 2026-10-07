'use client';

import * as React from 'react';

import { Skeleton } from '@/components/ui2/skeleton';
import { PermissionDeniedState } from '@/components/app/shell/shell-states';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { AttendantHome } from './attendant-home';
import { ManagerRunsHome } from './manager-runs-home';

/**
 * The Runs home (`/app/inventory/prep`). Who sees what comes from the server's permissions table, not from a role name:
 *  - holds `prep.record` and not `prep.read_flags` (the Store Attendant): Prep again, Something else, Recent runs;
 *  - anyone else holding `prep.read`: the runs list, with "New prep run" for those who also hold `prep.record`.
 */
export function PrepHomeScreen() {
  const { can, ready, failed } = usePermissions();

  if (!ready && !failed) {
    return (
      <div className="flex flex-1 flex-col gap-wds-4 p-wds-6" aria-busy="true" aria-label="Loading Prep">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }
  if (failed || !can('prep.read')) {
    return (
      <div className="flex flex-1 items-center justify-center p-wds-6">
        <PermissionDeniedState description="Prep is not available for your role." />
      </div>
    );
  }
  if (can('prep.record') && !can('prep.read_flags')) return <AttendantHome />;
  return <ManagerRunsHome canRecord={can('prep.record')} />;
}
