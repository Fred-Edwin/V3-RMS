'use client';

import { useCallback, type MouseEvent } from 'react';

import { useNotificationsDrawer } from '../store/drawer-store';

/** The desktop breakpoint (Tailwind `lg`): from here the notifications are a drawer, below it a page. */
const DESKTOP = '(min-width: 1024px)';

/** True for a plain left click: a modified click (new tab, new window) keeps the link's own behaviour. */
const isPlainClick = (e: MouseEvent): boolean => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/**
 * Click handler for the bell and "See all notifications". Both stay real links to `/app/workforce/notifications`, which the phone
 * follows; on a desktop screen the click opens the drawer instead, so the person keeps their place.
 */
export function useOpenNotifications(): (e: MouseEvent) => void {
  const setOpen = useNotificationsDrawer((s) => s.setOpen);
  return useCallback(
    (e: MouseEvent): void => {
      if (e.defaultPrevented || !isPlainClick(e) || !window.matchMedia(DESKTOP).matches) return;
      e.preventDefault();
      setOpen(true);
    },
    [setOpen]
  );
}
