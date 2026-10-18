'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { UnderlineTabs } from '../../../../_shared';

export type OrgTab = 'sites' | 'positions';

/** "Sites and departments" and "Positions N": the chosen tab lives in the address (`?tab=positions`), so a reload keeps it. */
export function OrgTabs({ value, positionCount }: { value: OrgTab; positionCount?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <UnderlineTabs
      label="Organisation"
      className="overflow-y-hidden"
      value={value}
      onChange={(next) => router.replace(next === 'positions' ? `${pathname}?tab=positions` : pathname)}
      items={[
        { value: 'sites', label: 'Sites and departments' },
        { value: 'positions', label: 'Positions', count: positionCount },
      ]}
    />
  );
}
