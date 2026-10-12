'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { reqFile } from '../../lib/routes';
import { WorkSkeleton } from './head-work-screen';

/**
 * The old "Change lines" and "Add an item" pages (Paper steps 3 and 4) are now part of the one working screen
 * (`head-work-screen.tsx`, shown by the file route while the list is still being filled in). The routes stay so old links and
 * bookmarks still land on the right page.
 */
export function HeadEditScreen({ requisitionId }: { requisitionId: string }) {
  const router = useRouter();
  React.useEffect(() => {
    router.replace(reqFile(requisitionId));
  }, [router, requisitionId]);
  return <WorkSkeleton />;
}
