'use client';

import { useEffect, useRef } from 'react';

import { needsYouWrites } from '../services/needs-you-services';

/**
 * "New" means new since the last time this person opened Home. The marks stay during the visit and are cleared when the person leaves
 * Home or hides the tab, so the next visit shows only what arrived since. Best effort: a failed call is ignored (the marks just stay one visit longer).
 */
export function useSeenOnLeave(hasNew: boolean): void {
  const pending = useRef(hasNew);
  useEffect(() => {
    pending.current = hasNew;
  }, [hasNew]);

  useEffect(() => {
    const markSeen = (): void => {
      if (!pending.current) return;
      pending.current = false;
      needsYouWrites.seen().catch(() => undefined);
    };
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') markSeen();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      markSeen();
    };
  }, []);
}
