'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';

import { useWorkforcePermissions, EmptyState, ListSkeleton, PhoneScreen } from '../../../_shared';
import { PAYSLIP_COPY } from '../../_shared/lib/payslip-copy';
import { PAYSLIP_HOME, payslipHref } from '../../_shared/lib/routes';
import { useUnlocked } from '../../_shared/lib/unlock-session';
import { useRelock } from '../hooks/use-relock';
import { UnlockScreen } from './unlock-screen';

/**
 * The section wrapper of My payslips. Everything inside is behind the code: until the server has said yes the person sees the locked
 * list and the code field, never a figure. It also owns the relock rules (background, leaving, idle). Nobody without `me.payslip`
 * (the System Admin) gets past it; the route answers like a missing page.
 */
export function PayslipGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const permissions = useWorkforcePermissions();
  const unlocked = useUnlocked(userId);
  useRelock(userId);

  if (!permissions.ready) {
    return (
      <PhoneScreen screen={PAYSLIP_COPY.screen} kicker="MY PAYSLIPS" back="/app/workforce" desktopTitle="My payslips">
        <ListSkeleton rows={2} columns={['fill', 60]} label="Opening your payslips" />
      </PhoneScreen>
    );
  }
  if (!permissions.can('me.payslip')) {
    return (
      <PhoneScreen screen={PAYSLIP_COPY.screen} kicker="MY PAYSLIPS" back="/app/workforce" desktopTitle="My payslips">
        <EmptyState kind="nothingYet" title="Page not found" line="There is nothing at this address." />
      </PhoneScreen>
    );
  }
  if (!unlocked) {
    return (
      <UnlockScreen
        onOpened={(chosenId) => {
          // From the home address the chosen payslip opens at once; a deep link stays where it is.
          if (pathname === PAYSLIP_HOME && chosenId) router.push(payslipHref(chosenId));
        }}
      />
    );
  }
  return <>{children}</>;
}
