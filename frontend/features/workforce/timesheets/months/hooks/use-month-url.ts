'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * The month page's own address parameters (spec D20): `site`, `month`, `from`, `to`, `person`. The people table keeps its own (`q`,
 * `page`, `view`, `dept`, rows) in the same address and this hook leaves them alone unless asked. A `null` value removes a parameter.
 */
export function useMonthUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const get = (key: string): string | null => params.get(key);
  const set = useCallback(
    (patch: Record<string, string | null>, push = false): void => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [params, pathname, router]
  );
  return { get, set };
}
