import * as React from 'react';

import { cn } from '@/lib/cn';

import { ComingUpTimeline, type ComingUpEvent } from '../../_shared';
import { SectionHeader } from './section-header';

/** "Coming up" (HR Home, Paper POH-0): the kit's `ComingUpTimeline` under the Home section line. On a phone it reads as a list. */
export function ComingUpSection({ events, range = 'NEXT 4 WEEKS', className }: { events: readonly ComingUpEvent[]; range?: string; className?: string }) {
  return (
    <section aria-label="Coming up" className={cn('flex min-w-0 flex-col', className)}>
      <SectionHeader title="Coming up" mono={range} />
      <ComingUpTimeline events={[...events]} className="pt-[18px] max-md:flex-col max-md:gap-4" />
    </section>
  );
}
