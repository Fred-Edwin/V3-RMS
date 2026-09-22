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
    <div className={cn('flex flex-col gap-3 p-wds-4', className)}>
      <div className="grid grid-cols-2 gap-px">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-wds-sm" />
      ))}
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
