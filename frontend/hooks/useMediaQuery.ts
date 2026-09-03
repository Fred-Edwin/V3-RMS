'use client';

import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query. `matches` is `false` until mounted; use
 * `hydrated` to hold layout-critical branches until the real value is known
 * (avoids mounting the wrong subtree for one frame).
 */
export function useMediaQuery(query: string): { matches: boolean; hydrated: boolean } {
  const [matches, setMatches] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    setHydrated(true);
    const handler = (event: MediaQueryListEvent): void => setMatches(event.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return { matches, hydrated };
}
