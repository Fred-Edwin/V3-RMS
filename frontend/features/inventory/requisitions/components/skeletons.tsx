import * as React from 'react';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';

/**
 * Layout-mirroring loading skeletons for the Branch Manager approval screens
 * (Milestone Four Session B). Same established convention as
 * `features/inventory/components/skeletons.tsx` — the real breadcrumb/title
 * stay put, only the data region swaps to skeleton blocks.
 */

export function RequisitionApprovalSkeletonDesktop({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-1 flex-col gap-7 px-8 py-5', className)}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-12 w-full rounded-wds-sm" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-3 border-t border-wds-neutral-800 pt-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

/** KPI strip placeholder for the manager list/detail screen's initial load (Paper `13PB-0`). */
export function RequisitionsKpiSkeletonDesktop({ className }: { className?: string }) {
  return (
    <div className={cn('mx-8 mb-5 flex gap-px overflow-hidden rounded-wds-sm border border-wds-border bg-wds-border', className)}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex grow basis-0 flex-col gap-1.5 bg-wds-surface px-5 py-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-12" />
        </div>
      ))}
    </div>
  );
}

/** List-rail placeholder for the manager list/detail screen's initial load (Paper `13PB-0`). */
export function RequisitionsListRailSkeletonDesktop({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-1.5 border-b border-b-solid border-b-wds-border px-5 py-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function RequisitionApprovalSkeletonMobile({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4 p-wds-4', className)}>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-16 w-full rounded-wds-sm" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-24 w-full rounded-wds-sm" />
      ))}
    </div>
  );
}

export function RequisitionsForApprovalListSkeletonMobile({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      <div className="grid grid-cols-2 gap-px border-b border-wds-border bg-wds-border">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-1.5 bg-wds-surface px-4 py-3.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-10" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 p-wds-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RequisitionHistorySkeletonDesktop({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 px-8', className)}>
      <Skeleton className="h-8 w-full" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
