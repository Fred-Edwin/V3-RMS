'use client';

import * as React from 'react';

import { PermissionDeniedState } from '@/components/app/shell/shell-states';
import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { AttendantHome } from './attendant-home';
import { ManagerRunsHome } from './manager-runs-home';
import { PrepHomeLoading } from './prep-home-loading';

/**
 * The Runs home (`/app/inventory/prep`). Who sees what comes from the server's permissions table, not from a role name:
 *  - holds `prep.record` and not `prep.read_flags` (the Store Attendant): Prep again, Something else, Recent runs;
 *  - anyone else holding `prep.read`: the runs list, with "New prep run" for those who also hold `prep.record`.
 * While the permissions arrive the frame (top bar, title) stays and only the data region loads (`PrepHomeLoading`).
 */
export function PrepHomeScreen() {
  const { can, ready, failed } = usePermissions();

  if (!ready && !failed) return <PrepHomeLoading />;
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
