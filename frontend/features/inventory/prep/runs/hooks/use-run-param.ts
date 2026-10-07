'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const PARAM = 'run';

/**
 * The open run lives in the URL as `?run=<id>`, so a link opens the drawer on load and Back closes it. Opening pushes one history
 * entry; closing from the X or Escape goes back to it when this screen pushed it, and otherwise just drops the param (a link that
 * landed straight on a run has nothing to go back to). Every other query parameter (the History filters) is kept.
 * `open` and `close` are stable, so effects that depend on them do not refire.
 */
export function useRunParam(): { runId: string | null; open: (id: string) => void; close: () => void } {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const runId = search.get(PARAM);
  const pushed = React.useRef(false);
  // Read through refs so `open` and `close` keep one identity while the query changes.
  const searchRef = React.useRef(search);
  searchRef.current = search;

  React.useEffect(() => {
    // The param went away some other way (Back, a link): the next close has nothing to undo.
    if (!runId) pushed.current = false;
  }, [runId]);

  const open = React.useCallback(
    (id: string) => {
      const next = new URLSearchParams(searchRef.current.toString());
      const alreadyOpen = next.has(PARAM);
      next.set(PARAM, id);
      const url = `${pathname}?${next.toString()}`;
      // Switching from one open run to another (a replaced-by link) swaps the entry, so the X still closes in one step.
      if (alreadyOpen) router.replace(url, { scroll: false });
      else {
        pushed.current = true;
        router.push(url, { scroll: false });
      }
    },
    [router, pathname]
  );

  const close = React.useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      router.back();
      return;
    }
    const next = new URLSearchParams(searchRef.current.toString());
    next.delete(PARAM);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname]);

  return { runId, open, close };
}
