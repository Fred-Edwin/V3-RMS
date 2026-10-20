'use client';

import * as React from 'react';

import { clearSession, isUnlocked } from '../../_shared/lib/unlock-session';
import { payslipWrites } from '../../_shared/services/payslip-services';

/** The phone calls Lock after this long in the background (PD2). The server's own idle rule is 10 minutes. */
export const BACKGROUND_LOCK_MS = 60_000;
/** How often the section checks the idle rule so the code comes back without waiting for a refused read. */
const IDLE_CHECK_MS = 15_000;

/** Ends the unlock now: in memory first (the screen goes back to the code at once), then on the server. A failed call is harmless. */
export function lockNow(): void {
  clearSession();
  payslipWrites.lock().catch(() => undefined);
}

/**
 * While My payslips is open: lock after 60 seconds in the background, lock on leaving the section, and re-check the idle rule.
 * `userId` is read through a ref so the effect runs once per mount.
 */
export function useRelock(userId: string | null): void {
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  const idRef = React.useRef(userId);
  idRef.current = userId;

  React.useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null) {
        // Timers are paused in the background, so the time away is measured, not counted.
        const away = Date.now() - hiddenAt;
        hiddenAt = null;
        if (away >= BACKGROUND_LOCK_MS && isUnlocked(idRef.current)) lockNow();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const idle = window.setInterval(tick, IDLE_CHECK_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(idle);
      if (isUnlocked(idRef.current)) lockNow();
    };
  }, []);
}
