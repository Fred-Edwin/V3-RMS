import * as React from 'react';

import { Skeleton } from '@/components/ui2/skeleton';
import { MobileHubHeader } from '@/components/app/shell/mobile-headers';
import { Topbar } from '@/components/app/shell/topbar';

/**
 * Loading frame for the Prep home: the real top bar and the "Prep" title stay put (the sidebar is the shell's and never leaves);
 * only the data region is skeleton. The title is the same for every role, so it can be drawn before we know which view applies.
 */
export function PrepHomeLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-busy="true" aria-label="Loading Prep">
      <Topbar breadcrumb={{ root: 'Central Store', section: 'Prep', screen: 'Runs' }} hideSearch className="hidden shrink-0 lg:flex" />
      <MobileHubHeader title="Prep" subtitle="Batched at the Central Store" userInitials="" orgLabel="Hub" className="lg:hidden" />
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-wds-5 p-wds-4 sm:p-wds-6 lg:px-8 lg:py-7">
        <h1 className="hidden font-wds-sans text-wds-h1 text-wds-text-ink lg:block">Prep</h1>
        <Skeleton className="h-[72px] w-full" />
        <Skeleton className="h-[72px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    </div>
  );
}
