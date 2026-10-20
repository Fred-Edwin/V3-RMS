'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * The Payroll page's address: `month`, `tab`, and each tab's own (`q`, `page`, `rows`, `site`, `status`, `payslip`). A `null` value removes
 * a parameter. Changing the month or tab clears the table parameters so one tab's page number never leaks into another.
 */
export function usePayrollUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const get = (key: string): string | null => params.get(key);
  const set = useCallback(
    (patch: Record<string, string | null>): void => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );
  return { get, set };
}

/** Asks for a fresh read when the tab comes back after `afterMs` away. No message is shown. */
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
