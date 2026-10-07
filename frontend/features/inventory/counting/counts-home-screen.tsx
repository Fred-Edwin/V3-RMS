'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

import { Skeleton } from '@/components/ui2/skeleton';
import { LoadingAnnouncer, ScwStatePanel } from '../_shared/components/scw-states';
import { usePermissions } from '../_shared/hooks/use-permissions';
import { COUNTING_STATES_COPY } from './_shared/lib/states-copy';
import { PickSectionScreen } from './record/components/pick-section-screen';
import { CountsListScreen } from './review/components/counts-list-screen';

/**
 * `/stock/counts`. Which screen this is comes from what the server says the person may do, never from a role name: a caller who
 * holds `counts.read` gets the Counts list (steps 8, 48), or the Director's flagged view (step 26) when they hold
 * `counts.acknowledge` without `counts.resolve` or ask for it with `?view=flagged`; a caller who only holds `counts.record` gets
 * Pick a section (step 1) as the phone-width column.
 */
export function CountsHomeScreen() {
  const { can, ready, failed } = usePermissions();
  const params = useSearchParams();
  if (!ready && !failed) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-8" aria-hidden>
        <LoadingAnnouncer text={COUNTING_STATES_COPY.countsList.loading} />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (failed || (!can('counts.read') && !can('counts.record'))) {
    return <ScwStatePanel kind="permission" text={COUNTING_STATES_COPY.pickSection.permission} className="m-8" />;
  }
  if (!can('counts.read')) return <PickSectionScreen />;
  void params;
  return <CountsListScreen />;
}
