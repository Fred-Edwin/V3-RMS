'use client';

import * as React from 'react';

import { BUSY_EVENT } from '@/lib/busy-signal';

/** "The system is busy, trying again" (finding 46): shown while a read is waiting to retry after the rate limit, gone when it stops. */
export function BusyNotice() {
  const [waiting, setWaiting] = React.useState(0);
  React.useEffect(() => {
    const onBusy = (event: Event): void => setWaiting((event as CustomEvent<{ waiting: number }>).detail.waiting);
    window.addEventListener(BUSY_EVENT, onBusy);
    return () => window.removeEventListener(BUSY_EVENT, onBusy);
  }, []);
  if (waiting === 0) return null;
  return (
    <p role="status" className="fixed bottom-4 left-1/2 z-50 m-0 -translate-x-1/2 border border-wds-border bg-wds-surface px-4 py-2 font-wds-sans text-[13px] leading-[18px] text-wds-text-ink shadow-md print:hidden">
      The system is busy, trying again.
    </p>
  );
}
