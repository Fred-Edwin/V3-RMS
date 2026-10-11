'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { usePurchasing } from '../../hooks/use-purchasing';
import { PhoneLoading, PhoneScreen } from './phone-kit';

/** Whoever raises requests but cannot approve them (the Store Attendant in the access table) works Purchasing on the phone. Decided from capabilities, never from a role name. */
export function useIsAttendant(): { ready: boolean; attendant: boolean } {
  const { can, ready } = usePurchasing();
  return { ready, attendant: ready && can('orders.request') && !can('orders.approve') };
}

/** Renders the phone screen for the Attendant; anyone else is sent to the desktop Purchasing, which is theirs. */
export function AttendantOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, attendant } = useIsAttendant();
  React.useEffect(() => {
    if (ready && !attendant) router.replace('/app/inventory/purchasing');
  }, [ready, attendant, router]);
  if (!attendant) {
    return (
      <PhoneScreen header={<div className="h-[88px] shrink-0 bg-wds-sidebar-top" aria-hidden="true" />}>
        <PhoneLoading rows={3} />
      </PhoneScreen>
    );
  }
  return <>{children}</>;
}

/** Page state in the address (filter, search, page, dates), changed in place so Back keeps the screen and a link can be shared. */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      const text = next.toString();
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  return { params, set };
}
