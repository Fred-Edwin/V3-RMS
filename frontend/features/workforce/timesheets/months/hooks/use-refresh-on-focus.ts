'use client';

import { useEffect, useRef } from 'react';

/** Asks for a fresh read when the tab comes back after `afterMs` away (spec S1: refetch on focus after 60 s). No message is shown. */
export function useRefreshOnFocus(afterMs: number, refresh: () => void): void {
  const last = useRef(Date.now());
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    const onFocus = (): void => {
      if (Date.now() - last.current < afterMs) return;
      last.current = Date.now();
      refreshRef.current();
    };
    const stamp = (): void => {
      last.current = Date.now();
    };
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') onFocus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('blur', stamp);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('blur', stamp);
    };
  }, [afterMs]);
}
