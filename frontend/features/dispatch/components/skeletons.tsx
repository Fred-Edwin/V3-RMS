import * as React from 'react';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';

/** Layout-mirroring loading skeletons for the Dispatch screens (Milestone Five, Session A). Same convention as requisitions/components/skeletons.tsx. */

/** KPI strip placeholder for the desktop dispatch queue's initial load. */
export function DispatchKpiSkeletonDesktop({ className }: { className?: string }) {
  return (
    <div className={cn('mx-8 mb-5 flex overflow-hidden rounded-wds-sm border border-wds-border', className)}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={cn('flex grow basis-0 flex-col gap-1.5 px-5 py-4', i > 0 && 'border-l border-l-wds-border')}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-12" />
        </div>
      ))}
    </div>
  );
}

/** Queue rail placeholder for the desktop master-detail's initial load. */
export function DispatchQueueRailSkeletonDesktop({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-1.5 border-b border-b-solid border-b-wds-border px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

/** Detail column placeholder — mirrors the section-block layout. */
export function DispatchFulfilSkeletonDesktop({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-1 flex-col gap-7 px-8 py-5', className)}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
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

export function DispatchQueueSkeletonMobile({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 p-wds-4', className)}>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 w-full rounded-wds-sm" />
      ))}
    </div>
  );
}

export function DispatchFulfilSkeletonMobile({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4 p-wds-4', className)}>
      <Skeleton className="h-6 w-48" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-wds-sm" />
      ))}
    </div>
  );
}

/** KPI strip placeholder for the branch-incoming desktop's initial load — Session B (`168U-0`). */
export function DeliveriesKpiSkeletonDesktop({ className }: { className?: string }) {
  return (
    <div className={cn('flex overflow-hidden rounded-wds-sm border border-wds-border', className)}>
      {[0, 1, 2].map((i) => (
        <div key={i} className={cn('flex grow basis-0 flex-col gap-1.5 px-5 py-4', i > 0 && 'border-l border-l-wds-border')}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-12" />
        </div>
      ))}
    </div>
  );
}

/** Deliveries rail placeholder for the branch-incoming desktop master-detail's initial load. */
export function DeliveriesRailSkeletonDesktop({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col gap-1.5 border-b border-b-solid border-b-wds-border px-4 py-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

/** Detail column placeholder for the branch-incoming confirm detail. */
export function DeliveryConfirmSkeletonDesktop({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-1 flex-col gap-4 px-8 py-5', className)}>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex flex-col gap-3 border-t border-wds-neutral-800 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}
