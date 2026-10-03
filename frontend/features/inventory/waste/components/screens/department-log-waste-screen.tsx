'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';
import { LogWasteMobile } from '../log-waste-drawer';
import { DEPARTMENT_LABEL } from '../../../_shared/components/stock-format';

/**
 * Log waste · Department — Milestone Six Session 1, `1ACM-0`. A Department
 * Head logs waste against their own department; the server resolves the
 * location and the carried-in unit cost from the actor, so the screen only
 * names the department ("Kitchen, Nyeri Town"). Opened from the DH landing's
 * Quick actions; closing or logging returns there.
 */
export function DepartmentLogWasteScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const dept = user?.departmentTag ? DEPARTMENT_LABEL[user.departmentTag] : 'your department';
  const locationLabel = user?.organizationName ? `${dept}, ${user.organizationName}` : dept;
  const back = React.useCallback(() => router.push('/app/requisitions'), [router]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-wds-canvas lg:mx-auto lg:w-full lg:max-w-[480px] lg:border-x lg:border-wds-border">
      <LogWasteMobile asOverlay={false} locationLabel={locationLabel} onClose={back} />
    </div>
  );
}
